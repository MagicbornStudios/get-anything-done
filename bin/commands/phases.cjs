'use strict';
/**
 * gad phases — list / add subcommands.
 *
 * Required deps:
 *   findRepoRoot, gadConfig, resolveRoots, outputError,
 *   render, shouldUseJson, readPhases, writePhase, maybeRebuildGraph
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function createPhasesCommand(deps) {
  const {
    findRepoRoot, gadConfig, resolveRoots, outputError,
    render, shouldUseJson, readPhases, writePhase, maybeRebuildGraph,
  } = deps;

  const phasesListCmd = defineCommand({
    meta: { name: 'list', description: 'List phases from ROADMAP.xml' },
    args: {
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
      all: { type: 'boolean', description: 'Show all projects (overrides session scope)', default: false },
      full: { type: 'boolean', description: 'Show complete goal text for each phase', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;

      const rows = [];
      for (const root of roots) {
        const phases = readPhases(root, baseDir);
        if (phases.length === 0) continue;
        for (const phase of phases) {
          const isActive = phase.status === 'active' || phase.status === 'in-progress';
          const useJson = args.json || shouldUseJson();
          const row = {
            project: root.id,
            id: phase.id,
            status: phase.status,
            title: phase.title.length > 60 ? phase.title.slice(0, 57) + '...' : phase.title,
          };
          if (useJson || args.full) {
            row.goal = phase.goal || phase.title;
            row.depends = phase.depends || '';
            row.milestone = phase.milestone || '';
            row.plans = phase.plans || '';
            row.requirements = phase.requirements || '';
          } else if (isActive) {
            row.goal = phase.goal || phase.title;
          }
          rows.push(row);
        }
      }

      if (rows.length === 0) {
        console.log('No phases found. Create ROADMAP.md files in your .planning/ directories.');
        return;
      }

      if (args.full && !args.json && !shouldUseJson()) {
        for (const r of rows) {
          console.log(`\n[${r.project}] Phase ${r.id} — ${r.title}  (${r.status})`);
          if (r.goal) console.log(`  Goal: ${r.goal}`);
        }
        console.log(`\n${rows.length} phase(s)`);
        return;
      }

      const fmt = args.json ? 'json' : (shouldUseJson() ? 'json' : 'table');
      console.log(render(rows, { format: fmt, title: `Phases (${rows.length})` }));
    },
  });

  const phasesAddCmd = defineCommand({
    meta: { name: 'add', description: 'Append a <phase> to ROADMAP.xml. Fails if id collides.' },
    args: {
      id: { type: 'positional', description: 'Phase id (e.g. 47, 47.1)', required: true },
      title: { type: 'string', description: 'Short phase title', required: true },
      goal: { type: 'string', description: 'Phase goal text (the outcome)', required: true },
      status: { type: 'string', description: 'Phase status', default: 'planned' },
      depends: { type: 'string', description: 'Comma-separated phase ids this depends on', default: '' },
      milestone: { type: 'string', description: 'Milestone (optional)', default: '' },
      projectid: { type: 'string', description: 'Scope to one project by id', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots({ projectid: args.projectid }, baseDir, config.roots);
      if (roots.length === 0) {
        outputError('No project resolved. Pass --projectid <id> or run from a project root.');
        return;
      }
      if (roots.length > 1) {
        outputError('phases add requires a single project. Pass --projectid <id>.');
        return;
      }
      const root = roots[0];
      const taskRegistryPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(taskRegistryPath)) {
        outputError(`TASK-REGISTRY.xml not found at ${path.relative(baseDir, taskRegistryPath)}`);
        process.exit(1);
        return;
      }
      const roadmapPath = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');
      let roadmapBackup = null;
      let phaseWritten = false;
      try {
        roadmapBackup = fs.readFileSync(roadmapPath, 'utf8');
        const result = writePhase(root, baseDir, {
          id: String(args.id),
          title: String(args.title),
          goal: String(args.goal),
          status: String(args.status || 'planned'),
          depends: String(args.depends || ''),
          milestone: String(args.milestone || ''),
        });
        phaseWritten = true;
        const { ensurePhaseInFile } = require('../../lib/task-registry-writer.cjs');
        const registrySync = ensurePhaseInFile({
          filePath: taskRegistryPath,
          phaseId: String(args.id),
        });
        console.log(`Added phase ${args.id}: ${args.title}`);
        console.log(`File:    ${path.relative(baseDir, result.filePath)}`);
        console.log(`Total:   ${result.count} phase(s)`);
        console.log(`Task registry phase sync: ${registrySync.inserted ? 'inserted' : 'already-present'}`);
        maybeRebuildGraph(baseDir, root);
      } catch (e) {
        if (phaseWritten && roadmapBackup != null) {
          try { fs.writeFileSync(roadmapPath, roadmapBackup, 'utf8'); } catch {}
        }
        outputError(e.message);
        process.exit(1);
      }
    },
  });

  return defineCommand({
    meta: { name: 'phases', description: 'Manage phases — list (default), add' },
    subCommands: {
      list: phasesListCmd,
      add: phasesAddCmd,
    },
  });
}

module.exports = { createPhasesCommand };
module.exports.register = (ctx) => ({ phases: createPhasesCommand(ctx.common) });
