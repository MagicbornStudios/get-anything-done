'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTasksPromoteCommand(deps) {
  return defineCommand({
    meta: {
      name: 'promote',
      description: 'Promote a .planning/todos/*.md file into a real task entry. Filename derives the id unless --id is set; first H1/prose line becomes the goal; full file body is preserved as the <implementation> block. Move the todo to .planning/todos/promoted/ after success unless --keep.',
    },
    args: {
      todo: { type: 'positional', description: 'Path to the todo markdown file (absolute or relative to cwd)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id to nest under', required: true },
      id: { type: 'string', description: 'Override the auto-derived task id', default: '' },
      type: { type: 'string', description: 'Optional category', default: '' },
      depends: { type: 'string', description: 'Comma-separated prerequisite task ids', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      keep: { type: 'boolean', description: 'Do not move the todo into .planning/todos/promoted/', default: false },
      print: { type: 'boolean', description: 'Print the mutated XML without writing files', default: false },
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

      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) {
        deps.outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`);
        process.exit(1);
        return;
      }

      const { appendTaskToFile, addTaskToXml, TaskWriterError } = require('../../../lib/task-registry-writer.cjs');
      const def = {
        id: derivedId,
        phase: String(args.phase),
        goal,
        type: String(args.type || ''),
        depends: String(args.depends || ''),
        status: String(args.status || 'planned'),
      };

      try {
        if (args.print) {
          const xml = fs.readFileSync(xmlPath, 'utf8');
          const mutated = addTaskToXml(xml, def);
          process.stdout.write(mutated);
          return;
        }
        appendTaskToFile({ filePath: xmlPath, def });
        console.log(`Promoted ${path.relative(baseDir, todoPath)} → task ${def.id} (phase ${def.phase}).`);
        if (!args.keep) {
          const promotedDir = path.join(path.dirname(todoPath), 'promoted');
          fs.mkdirSync(promotedDir, { recursive: true });
          const dest = path.join(promotedDir, path.basename(todoPath));
          fs.renameSync(todoPath, dest);
          console.log(`  moved → ${path.relative(baseDir, dest)}`);
        }
      } catch (error) {
        if (error instanceof TaskWriterError) {
          deps.outputError(`${error.code}: ${error.message}`);
          process.exit(1);
          return;
        }
        throw error;
      }
    },
  });
}

module.exports = { createTasksPromoteCommand };
