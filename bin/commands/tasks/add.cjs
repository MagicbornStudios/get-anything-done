'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTasksAddCommand(deps) {
  return defineCommand({
    meta: {
      name: 'add',
      description: 'Register a new task in TASK-REGISTRY.xml. The canonical write path — no more hand-editing XML.',
    },
    args: {
      id: { type: 'positional', description: 'Task id (e.g. 60-05a)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id to nest under (must already exist in ROADMAP.xml)', required: true },
      goal: { type: 'string', description: 'One-sentence or longer description of the task outcome', required: true },
      type: { type: 'string', description: 'Optional category (code | site | design | migration | cleanup | framework | …)', default: '' },
      depends: { type: 'string', description: 'Comma-separated list of prerequisite task ids (no spaces)', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      print: { type: 'boolean', description: 'Print the mutated XML to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) {
        deps.outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`);
        process.exit(1);
        return;
      }

      const { appendTaskToFile, addTaskToXml, TaskWriterError } = require('../../../lib/task-registry-writer.cjs');
      const def = {
        id: String(args.id),
        phase: String(args.phase),
        goal: String(args.goal),
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

        // Dual-write to per-task JSON file (decision 2026-04-20 D3).
        // Reader prefers tasks/<id>.json when the directory exists, so the
        // XML write stays as a legacy safety net during the migration window.
        try {
          const taskFiles = require('../../../lib/task-files.cjs');
          const planningDir = path.join(baseDir, root.path, root.planningDir);
          taskFiles.writeOne(planningDir, {
            id: def.id,
            phase: def.phase,
            status: def.status,
            goal: def.goal,
            type: def.type,
            depends: def.depends ? def.depends.split(',').map(s => s.trim()).filter(Boolean) : [],
          });
        } catch (jsonErr) {
          // Don't fail the whole add on per-task file write error — XML is
          // still authoritative during the migration window. Just warn.
          console.error(`  (warning: per-task file write failed: ${jsonErr.message})`);
        }

        console.log(`Added task ${def.id} to phase ${def.phase} (${args.projectid}).`);
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

module.exports = { createTasksAddCommand };
