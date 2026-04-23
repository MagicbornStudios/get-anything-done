'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTasksAddCommand(deps) {
  return defineCommand({
    meta: {
      name: 'add',
      description: 'Register a new task as .planning/tasks/<id>.json. Per-task JSON is the sole source of truth post-63-53.',
    },
    args: {
      id: { type: 'positional', description: 'Task id (e.g. 60-05a)', required: true },
      projectid: { type: 'string', description: 'Project id whose planning dir to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id this task belongs to', required: true },
      goal: { type: 'string', description: 'One-sentence or longer description of the task outcome', required: true },
      type: { type: 'string', description: 'Optional category (code | site | design | migration | cleanup | framework | …)', default: '' },
      depends: { type: 'string', description: 'Comma-separated list of prerequisite task ids (no spaces)', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      print: { type: 'boolean', description: 'Print the JSON to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);

      const taskFiles = require('../../../lib/task-files.cjs');
      const def = {
        id: String(args.id),
        phase: String(args.phase),
        status: String(args.status || 'planned'),
        goal: String(args.goal),
        type: String(args.type || ''),
        depends: args.depends ? String(args.depends).split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      try {
        if (args.print) {
          process.stdout.write(JSON.stringify(taskFiles.normalizeTask(def), null, 2) + '\n');
          return;
        }
        const existing = taskFiles.readOne(planningDir, def.id);
        if (existing) {
          deps.outputError(`Task already exists: ${def.id} (use 'gad tasks update' to change).`);
          process.exit(1);
          return;
        }
        taskFiles.writeOne(planningDir, def);
        console.log(`Added task ${def.id} to phase ${def.phase} (${args.projectid}).`);
        deps.maybeRebuildGraph(baseDir, root);
      } catch (error) {
        deps.outputError(`tasks add: ${error.message}`);
        process.exit(1);
      }
    },
  });
}

module.exports = { createTasksAddCommand };
