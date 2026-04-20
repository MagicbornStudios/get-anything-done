'use strict';
/**
 * gad tasks migrate — one-shot: parse TASK-REGISTRY.xml → write one JSON
 * file per task under <planningDir>/tasks/<id>.json.
 *
 * Safe to re-run: idempotent per task id (content overwritten with latest
 * parse). XML stays in place as a legacy fallback. Run after first adoption
 * and whenever the XML is hand-edited (which we're trying to phase out but
 * may still happen during the migration window).
 *
 * Decision 2026-04-20 D3.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const taskFiles = require('../../../lib/task-files.cjs');
const { readTasks } = require('../../../lib/task-registry-reader.cjs');

function createTasksMigrateCommand(deps) {
  return defineCommand({
    meta: {
      name: 'migrate',
      description: 'Walk TASK-REGISTRY.xml → write per-task JSON files under <planningDir>/tasks/<id>.json. Idempotent. Part of 63-11 migration (D3).',
    },
    args: {
      projectid: { type: 'string', description: 'Project id whose tasks to migrate', required: true },
      'dry-run': { type: 'boolean', description: 'Report what would be written without touching disk', default: false },
      force: { type: 'boolean', description: 'Overwrite existing per-task files even if newer than XML', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);
      const xmlPath = path.join(planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) {
        deps.outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`);
        process.exit(1);
        return;
      }

      // Force XML-source read (bypass the reader's auto-prefer-tasks-dir
      // behavior so we get the canonical XML state for migration).
      const { parseXmlForMigration } = require('../../../lib/task-registry-reader.cjs');
      const tasks = parseXmlForMigration(fs.readFileSync(xmlPath, 'utf8'));
      if (tasks.length === 0) {
        console.log(`No tasks found in ${path.relative(baseDir, xmlPath)}.`);
        return;
      }

      console.log(`Migrating ${tasks.length} tasks from ${path.relative(baseDir, xmlPath)} → ${path.relative(baseDir, taskFiles.tasksDir(planningDir))}/`);
      let wrote = 0;
      let skipped = 0;
      for (const t of tasks) {
        const canonical = {
          id: t.id,
          phase: t.phase,
          status: t.status,
          goal: t.goal,
          type: t.type || '',
          keywords: t.keywords || '',
          depends: typeof t.depends === 'string' ? t.depends.split(',').map(s => s.trim()).filter(Boolean) : (t.depends || []),
          commands: t.commands || [],
          files: t.files || [],
          agent_id: t.agentId || '',
          agent_role: t.agentRole || '',
          runtime: t.runtime || '',
          model_profile: t.modelProfile || '',
          resolved_model: t.resolvedModel || '',
          claimed: Boolean(t.claimed),
          claimed_at: t.claimedAt || '',
          lease_expires_at: t.leaseExpiresAt || '',
          skill: t.skill || '',
        };

        if (!args.force) {
          const existing = taskFiles.readOne(planningDir, canonical.id);
          if (existing && existing.updated_at && !args['dry-run']) {
            // Keep existing if it looks more recent than migration would produce.
            // Conservative: assume existing is authoritative unless --force.
            skipped++;
            continue;
          }
        }

        if (args['dry-run']) {
          console.log(`  would write: ${canonical.id}.json  status=${canonical.status}  phase=${canonical.phase}`);
          wrote++;
        } else {
          try {
            taskFiles.writeOne(planningDir, canonical);
            wrote++;
          } catch (err) {
            console.error(`  FAILED: ${canonical.id} — ${err.message}`);
          }
        }
      }
      console.log('');
      console.log(`${args['dry-run'] ? 'Would write' : 'Wrote'}: ${wrote}  ·  Skipped (already present): ${skipped}`);
      if (!args['dry-run']) {
        console.log(`Next: \`gad graph build --projectid ${args.projectid}\` to refresh graph.json from the new source.`);
      }
    },
  });
}

module.exports = { createTasksMigrateCommand };
