'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createTasksUpdateCommand(deps) {
  return defineCommand({
    meta: {
      name: 'update',
      description: 'Update task fields in .planning/tasks/<id>.json. Supports --goal / --append-goal / --type / --status / --depends / --phase.',
    },
    args: {
      id: { type: 'positional', description: 'Task id to update (e.g. 63-06)', required: true },
      projectid: { type: 'string', description: 'Project id whose task to update', required: true },
      goal: { type: 'string', description: 'Replacement goal text for the task', default: '' },
      'append-goal': { type: 'string', description: 'Text to append to the existing goal (space-joined)', default: '' },
      type: { type: 'string', description: 'New type / category (code | site | framework | cleanup | docs | …)', default: '' },
      status: { type: 'string', description: 'New status (planned | in-progress | done | cancelled). Prefer `gad tasks stamp` for attribution.', default: '' },
      depends: { type: 'string', description: 'Replacement depends list (comma-separated). Pass "" to clear.', default: null },
      phase: { type: 'string', description: 'Move task to a different phase id', default: '' },
      print: { type: 'boolean', description: 'Print the mutated task JSON to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);

      const taskFiles = require('../../../lib/task-files.cjs');
      if (!taskFiles.hasTasksDir(planningDir)) {
        deps.outputError(
          `No per-task files at ${path.relative(baseDir, taskFiles.tasksDir(planningDir))}. ` +
          `Run: gad tasks migrate --projectid ${args.projectid}`
        );
        process.exit(1);
        return;
      }
      const existing = taskFiles.readOne(planningDir, String(args.id));
      if (!existing) {
        deps.outputError(`Task not found: ${args.id} (looked at ${taskFiles.taskPath(planningDir, String(args.id))})`);
        process.exit(1);
        return;
      }

      const patch = {};
      if (args.goal && String(args.goal).trim()) {
        patch.goal = String(args.goal);
      }
      if (args['append-goal'] && String(args['append-goal']).trim()) {
        const addition = String(args['append-goal']).trim();
        patch.goal = existing.goal ? `${existing.goal} ${addition}` : addition;
      }
      if (args.type) patch.type = String(args.type);
      if (args.status) patch.status = String(args.status).toLowerCase();
      if (args.phase) patch.phase = String(args.phase);
      if (args.depends !== null && args.depends !== undefined) {
        patch.depends = String(args.depends).split(',').map(s => s.trim()).filter(Boolean);
      }

      if (Object.keys(patch).length === 0) {
        deps.outputError('Nothing to update. Pass at least one of --goal / --append-goal / --type / --status / --depends / --phase.');
        process.exit(1);
        return;
      }
      if (patch.goal && args.goal && args['append-goal']) {
        deps.outputError('Pass only one of --goal / --append-goal, not both.');
        process.exit(1);
        return;
      }

      try {
        if (args.print) {
          const merged = taskFiles.normalizeTask({ ...existing, ...patch, id: existing.id });
          process.stdout.write(JSON.stringify(merged, null, 2) + '\n');
          return;
        }
        const updated = taskFiles.updateOne(planningDir, String(args.id), patch);
        const shown = Object.keys(patch).map(k => `${k}=${JSON.stringify(updated[k])}`).join(' ');
        console.log(`Updated task ${args.id} (${args.projectid}): ${shown}`);
        deps.maybeRebuildGraph(baseDir, root);
      } catch (error) {
        deps.outputError(`tasks update: ${error.message}`);
        process.exit(1);
      }
    },
  });
}

module.exports = { createTasksUpdateCommand };
