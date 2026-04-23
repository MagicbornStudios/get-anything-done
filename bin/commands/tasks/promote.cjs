'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTasksPromoteCommand(deps) {
  return defineCommand({
    meta: {
      name: 'promote',
      description: 'Promote a .planning/todos/*.md file into a real task (.planning/tasks/<id>.json). Filename derives the id unless --id is set; first H1/prose line becomes the goal. Move the todo to .planning/todos/promoted/ after success unless --keep.',
    },
    args: {
      todo: { type: 'positional', description: 'Path to the todo markdown file (absolute or relative to cwd)', required: true },
      projectid: { type: 'string', description: 'Project id whose tasks dir to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id to nest under', required: true },
      id: { type: 'string', description: 'Override the auto-derived task id', default: '' },
      type: { type: 'string', description: 'Optional category', default: '' },
      depends: { type: 'string', description: 'Comma-separated prerequisite task ids', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      keep: { type: 'boolean', description: 'Do not move the todo into .planning/todos/promoted/', default: false },
      print: { type: 'boolean', description: 'Print the task JSON without writing files', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const todoPath = path.isAbsolute(args.todo) ? args.todo : path.resolve(process.cwd(), args.todo);
      if (!fs.existsSync(todoPath)) {
        deps.outputError(`Todo file not found: ${todoPath}`);
        process.exit(1);
        return;
      }
      const todoContent = fs.readFileSync(todoPath, 'utf8');
      const basename = path.basename(todoPath, '.md');
      const derivedId = args.id ? String(args.id) : basename.replace(/^\d{4}-\d{2}-\d{2}-/, '').slice(0, 80);
      const firstLine = todoContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith('---')) || '';
      const goal = firstLine.replace(/^#+\s*/, '').trim() || `Promoted from ${path.basename(todoPath)}`;

      const planningDir = path.join(baseDir, root.path, root.planningDir);
      const taskFiles = require('../../../lib/task-files.cjs');
      const def = {
        id: derivedId,
        phase: String(args.phase),
        status: String(args.status || 'planned'),
        goal,
        type: String(args.type || ''),
        depends: args.depends ? String(args.depends).split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      try {
        if (args.print) {
          process.stdout.write(JSON.stringify(taskFiles.normalizeTask(def), null, 2) + '\n');
          return;
        }
        if (taskFiles.readOne(planningDir, def.id)) {
          deps.outputError(`Task already exists: ${def.id} (pick a different --id or update the existing task).`);
          process.exit(1);
          return;
        }
        taskFiles.writeOne(planningDir, def);
        console.log(`Promoted ${path.relative(baseDir, todoPath)} → task ${def.id} (phase ${def.phase}).`);
        if (!args.keep) {
          const promotedDir = path.join(path.dirname(todoPath), 'promoted');
          fs.mkdirSync(promotedDir, { recursive: true });
          const dest = path.join(promotedDir, path.basename(todoPath));
          fs.renameSync(todoPath, dest);
          console.log(`  moved → ${path.relative(baseDir, dest)}`);
        }
        deps.maybeRebuildGraph(baseDir, root);
      } catch (error) {
        deps.outputError(`tasks promote: ${error.message}`);
        process.exit(1);
      }
    },
  });
}

module.exports = { createTasksPromoteCommand };
