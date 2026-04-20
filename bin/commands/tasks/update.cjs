'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTasksUpdateCommand(deps) {
  return defineCommand({
    meta: {
      name: 'update',
      description: 'Update task fields in TASK-REGISTRY.xml (currently supports --goal).',
    },
    args: {
      id: { type: 'positional', description: 'Task id to update (e.g. 63-06)', required: true },
      projectid: { type: 'string', description: 'Project id whose TASK-REGISTRY.xml to update', required: true },
      goal: { type: 'string', description: 'Replacement goal text for the task', default: '' },
      print: { type: 'boolean', description: 'Print the mutated XML to stdout instead of writing the file', default: false },
    },
    run({ args }) {
      if (!String(args.goal || '').trim()) {
        deps.outputError('tasks update currently requires --goal <text>.');
        process.exit(1);
        return;
      }

      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const xmlPath = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
      if (!fs.existsSync(xmlPath)) {
        deps.outputError(`TASK-REGISTRY.xml not found at ${xmlPath}`);
        process.exit(1);
        return;
      }

      const { TaskWriterError, updateTaskGoalInXml, updateTaskGoalInFile } = require('../../../lib/task-registry-writer.cjs');
      try {
        if (args.print) {
          const xml = fs.readFileSync(xmlPath, 'utf8');
          const mutated = updateTaskGoalInXml(xml, { id: String(args.id), goal: String(args.goal) });
          process.stdout.write(mutated);
          return;
        }
        updateTaskGoalInFile({ filePath: xmlPath, id: String(args.id), goal: String(args.goal) });

        // Dual-write to per-task JSON file (decision 2026-04-20 D3).
        try {
          const taskFiles = require('../../../lib/task-files.cjs');
          const planningDir = path.join(baseDir, root.path, root.planningDir);
          if (taskFiles.hasTasksDir(planningDir) && taskFiles.readOne(planningDir, String(args.id))) {
            taskFiles.updateOne(planningDir, String(args.id), { goal: String(args.goal) });
          }
        } catch (jsonErr) {
          console.error(`  (warning: per-task file update failed: ${jsonErr.message})`);
        }

        console.log(`Updated task ${args.id} goal (${args.projectid}).`);
        deps.maybeRebuildGraph(baseDir, root);
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

module.exports = { createTasksUpdateCommand };
