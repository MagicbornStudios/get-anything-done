'use strict';

const path = require('path');
const { defineCommand } = require('citty');

function createTaskCheckpointCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, readTasks, readXmlFile } = deps;

  return defineCommand({
    meta: { name: 'checkpoint', description: 'Verify planning docs updated before proceeding to next task' },
    args: {
      projectid: { type: 'string', description: 'Project ID', default: '' },
      task: { type: 'string', description: 'Task ID that should be done (e.g. 02-03)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const root = roots[0];

      const allTasks = readTasks(root, baseDir, {});
      const issues = [];
      let passCount = 0;

      if (args.task) {
        const task = allTasks.find(t => t.id === args.task);
        if (!task) {
          issues.push(`Task ${args.task} not found in TASK-REGISTRY.xml`);
        } else if (task.status !== 'done') {
          issues.push(`Task ${args.task} status is "${task.status}" — must be "done" before proceeding`);
        } else {
          passCount++;
        }
      }

      const planDir = path.join(baseDir, root.path, root.planningDir);
      const stateContent = readXmlFile(path.join(planDir, 'STATE.xml'));
      if (stateContent) {
        const nextAction = (stateContent.match(/<next-action>([\s\S]*?)<\/next-action>/) || [])[1]?.trim();
        if (!nextAction || nextAction.length < 10) {
          issues.push('STATE.xml next-action is empty or too short — update it to describe what comes next');
        } else {
          passCount++;
        }
      } else {
        issues.push('STATE.xml not found');
      }

      try {
        const { execSync } = require('child_process');
        const projectPath = root.path === '.' ? root.planningDir : path.join(root.path, root.planningDir);
        const status = execSync(`git status --porcelain -- "${projectPath}"`, {
          cwd: baseDir, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
        }).trim();
        if (status) {
          issues.push(`Uncommitted planning doc changes:\n${status}`);
        } else {
          passCount++;
        }
      } catch { passCount++; }

      const openTasks = allTasks.filter(t => t.status === 'planned');
      const nextTask = openTasks[0];

      if (issues.length === 0) {
        console.log(`\n✓ Checkpoint passed${args.task ? ` for task ${args.task}` : ''} (${passCount} checks)`);
        if (nextTask) {
          console.log(`\nNext task: ${nextTask.id} — ${(nextTask.goal || '').slice(0, 100)}`);
        } else {
          console.log('\nNo more planned tasks — phase may be complete.');
        }
      } else {
        console.error(`\n✗ Checkpoint FAILED (${issues.length} issue${issues.length > 1 ? 's' : ''}):\n`);
        for (const issue of issues) {
          console.error(`  • ${issue}`);
        }
        console.error('\nFix these before proceeding to the next task.');
        process.exit(1);
      }
    },
  });
}

module.exports = { createTaskCheckpointCommand };
