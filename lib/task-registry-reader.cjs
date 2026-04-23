'use strict';
/**
 * task-registry-reader.cjs — parse tasks into a unified list.
 *
 * Source of truth (decision 2026-04-20 D3, retired 2026-04-22 via 63-53):
 *   1. `.planning/tasks/<id>.json` per-task files  (canonical)
 *   2. `.planning/TASK-REGISTRY.xml`               (read-only legacy
 *                                                   fallback — emits a
 *                                                   migration nudge on
 *                                                   stderr)
 *   3. `.planning/STATE.md` task table             (ancient fallback)
 *
 * TASK-REGISTRY.xml is no longer a dual-write target. `gad tasks
 * add/update/stamp/promote` only touch per-task JSON. The XML fallback
 * exists so (a) pre-migration projects still render, (b) test fixtures
 * don't break overnight. Operators get nudged on stderr until they run
 * `gad tasks migrate --projectid <id>` (set GAD_SUPPRESS_MIGRATION_NUDGE=1
 * to silence during CI).
 */

const fs = require('fs');
const path = require('path');
const taskFiles = require('./task-files.cjs');

/**
 * @typedef {{ id: string, goal: string, status: string, phase: string, keywords: string }} Task
 */

/**
 * Read tasks for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ status?: string, phase?: string }} [filter]
 * @returns {Task[]}
 */
function readTasks(root, baseDir, filter = {}) {
  const planningDir = path.join(baseDir, root.path, root.planningDir);
  const xmlFile = path.join(planningDir, 'TASK-REGISTRY.xml');
  const mdFile  = path.join(planningDir, 'STATE.md');

  // Per-task JSON files are the source of truth post-63-53.
  if (taskFiles.hasTasksDir(planningDir)) {
    return taskFiles.listAll(planningDir, filter).map(taskFiles.toReaderShape);
  }

  // tasks/ dir missing but legacy XML present → parse in-place as a
  // read-only fallback. Operator gets a one-line nudge on stderr to run
  // `gad tasks migrate` so the project stops paying the XML-parse cost.
  if (fs.existsSync(xmlFile)) {
    if (!process.env.GAD_SUPPRESS_MIGRATION_NUDGE) {
      try {
        process.stderr.write(
          `[gad] Reading legacy TASK-REGISTRY.xml at ${xmlFile}. ` +
          `Run 'gad tasks migrate --projectid <id>' to adopt per-task JSON (63-53).\n`
        );
      } catch { /* stderr unavailable in some sandboxes */ }
    }
    return parseXml(fs.readFileSync(xmlFile, 'utf8'), filter);
  }

  // Ancient projects with no XML and no tasks/: STATE.md table fallback.
  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'), filter);
  }
  return [];
}

function parseXml(content, filter) {
  const tasks = [];
  // Require whitespace after "task" so we don't match <task-registry> or similar
  const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
  let m;
  while ((m = taskRe.exec(content)) !== null) {
    const attrs  = m[1];
    const body   = m[2];

    // Use lookbehind to avoid matching "id" inside "agent-id" or similar compound attrs
    const idMatch      = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const statusMatch  = attrs.match(/(?<![a-z-])status="([^"]*)"/);
    const phaseMatch   = attrs.match(/\bphase="([^"]*)"/);
    const agentIdMatch = attrs.match(/\bagent-id="([^"]*)"/);
    const agentRoleMatch = attrs.match(/\bagent-role="([^"]*)"/);
    const runtimeMatch = attrs.match(/\bruntime="([^"]*)"/);
    const modelProfileMatch = attrs.match(/\bmodel-profile="([^"]*)"/);
    const resolvedModelMatch = attrs.match(/\bresolved-model="([^"]*)"/);
    const claimedMatch = attrs.match(/\bclaimed="([^"]*)"/);
    const claimedAtMatch = attrs.match(/\bclaimed-at="([^"]*)"/);
    const leaseExpiresAtMatch = attrs.match(/\blease-expires-at="([^"]*)"/);
    const skillMatch   = attrs.match(/\bskill="([^"]*)"/);
    const typeMatch    = attrs.match(/\btype="([^"]*)"/);

    const id      = idMatch      ? idMatch[1]     : '';
    const status  = statusMatch  ? statusMatch[1].toLowerCase() : 'planned';
    const agentId = agentIdMatch ? agentIdMatch[1] : '';
    const agentRole = agentRoleMatch ? agentRoleMatch[1] : '';
    const runtime = runtimeMatch ? runtimeMatch[1] : '';
    const modelProfile = modelProfileMatch ? modelProfileMatch[1] : '';
    const resolvedModel = resolvedModelMatch ? resolvedModelMatch[1] : '';
    const claimed = claimedMatch ? claimedMatch[1].toLowerCase() === 'true' : false;
    const claimedAt = claimedAtMatch ? claimedAtMatch[1] : '';
    const leaseExpiresAt = leaseExpiresAtMatch ? leaseExpiresAtMatch[1] : '';
    const skill   = skillMatch   ? skillMatch[1]   : '';
    const type    = typeMatch    ? typeMatch[1]     : '';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;

    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const kwMatch   = body.match(/<keywords>([\s\S]*?)<\/keywords>/);
    const depMatch  = body.match(/<depends>([\s\S]*?)<\/depends>/);

    const goal     = goalMatch ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const keywords = kwMatch   ? kwMatch[1].trim() : '';
    const depends  = depMatch  ? depMatch[1].trim() : '';

    // Parse commands list
    const commands = [];
    const cmdBlockMatch = body.match(/<commands>([\s\S]*?)<\/commands>/);
    if (cmdBlockMatch) {
      const cmdRe = /<command>([\s\S]*?)<\/command>/g;
      let cm;
      while ((cm = cmdRe.exec(cmdBlockMatch[1])) !== null) {
        const cmd = cm[1].trim();
        if (cmd) commands.push(cmd);
      }
    }

    // Parse files list (optional — tracks files touched by this task)
    const files = [];
    const filesBlockMatch = body.match(/<files>([\s\S]*?)<\/files>/);
    if (filesBlockMatch) {
      const fileRe = /<file>([\s\S]*?)<\/file>/g;
      let fm;
      while ((fm = fileRe.exec(filesBlockMatch[1])) !== null) {
        const f = fm[1].trim();
        if (f) files.push(f);
      }
    }

    // Phase: prefer explicit attribute (D3 2026-04-20 + phase-66 fix 2026-04-22);
    // fall back to ID prefix only for legacy records with no phase attr.
    const phase = (phaseMatch && phaseMatch[1]) || id.split('-')[0] || '';
    if (filter.phase && phase !== filter.phase) continue;

    tasks.push({
      id,
      agentId,
      agentRole,
      runtime,
      modelProfile,
      resolvedModel,
      claimed,
      claimedAt,
      leaseExpiresAt,
      skill,
      type,
      goal,
      status,
      phase,
      keywords,
      depends,
      commands,
      files,
    });
  }
  return tasks;
}

function parseMd(content, filter) {
  const tasks = [];
  // Match markdown task table rows: | id | description | status |
  const lines = content.split('\n');
  let inTable = false;
  for (const line of lines) {
    if (/task|status/i.test(line) && line.includes('|')) { inTable = true; continue; }
    if (!inTable) continue;
    if (line.trim() === '' || line.includes('---')) { inTable = false; continue; }
    if (!line.trim().startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const id     = cols[0];
    const goal   = cols[1] || '';
    const status = (cols[2] || 'planned').toLowerCase();
    if (filter.status && status !== filter.status) continue;
    tasks.push({ id, goal, status, phase: id.split('-')[0] || '', keywords: '', depends: '' });
  }
  return tasks;
}

/** Exported for the one-shot migration script (63-11) which must bypass
 * the reader's prefer-tasks-dir logic and read the canonical XML state. */
function parseXmlForMigration(content, filter = {}) {
  return parseXml(content, filter);
}

module.exports = { readTasks, parseXmlForMigration };
