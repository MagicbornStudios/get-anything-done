'use strict';
/**
 * gad tasks stamp — attribute a task without pre-claim. Idempotent write
 * to the per-task JSON file (and a best-effort nudge to the legacy XML).
 *
 * Decision 2026-04-20 D2: handoffs are the atomic lock. Pre-claim on tasks
 * was the wrong layer. `stamp` is what a worker (or operator) calls when
 * the work is done to record who did it, with what skill, on what runtime —
 * no pre-reservation, no race window.
 *
 * Shape:
 *   gad tasks stamp <id> --projectid <p> \
 *     [--agent <name>] [--role <r>] [--runtime <id>] [--skill <s>] \
 *     [--status done] [--resolution <text>]
 *
 * All fields optional except id + projectid. Absent fields leave the
 * existing value untouched (no blanking).
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const taskFiles = require('../../../lib/task-files.cjs');

function createTasksStampCommand(deps) {
  return defineCommand({
    meta: {
      name: 'stamp',
      description: 'Stamp attribution (agent / skill / runtime / status) onto a task. Idempotent. Prefer over `claim` for post-completion attribution — no pre-reservation, no race (D2).',
    },
    args: {
      id: { type: 'positional', description: 'Task id', required: true },
      projectid: { type: 'string', description: 'Project id', required: true },
      agent: { type: 'string', description: 'Agent name (e.g. team-w1)', default: '' },
      role: { type: 'string', description: 'Agent role (executor, reviewer, …)', default: '' },
      runtime: { type: 'string', description: 'Runtime id (claude-code, codex-cli, …)', default: '' },
      skill: { type: 'string', description: 'Skill that did the work', default: '' },
      status: { type: 'string', description: 'Final status (planned | in-progress | done | cancelled)', default: '' },
      resolution: { type: 'string', description: 'Free-form completion note', default: '' },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);

      if (!taskFiles.hasTasksDir(planningDir)) {
        deps.outputError(`No per-task files yet at ${path.relative(baseDir, taskFiles.tasksDir(planningDir))}. Run \`gad tasks migrate --projectid ${args.projectid}\` first.`);
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
      if (args.agent)      patch.agent_id = String(args.agent);
      if (args.role)       patch.agent_role = String(args.role);
      if (args.runtime)    patch.runtime = String(args.runtime);
      if (args.skill)      patch.skill = String(args.skill);
      if (args.status)     patch.status = String(args.status).toLowerCase();
      if (args.resolution) patch.resolution = String(args.resolution);

      if (Object.keys(patch).length === 0) {
        deps.outputError('Nothing to stamp — pass at least one of --agent / --role / --runtime / --skill / --status / --resolution.');
        process.exit(1);
        return;
      }

      const updated = taskFiles.updateOne(planningDir, String(args.id), patch);
      console.log(`Stamped ${updated.id}: ${Object.entries(patch).map(([k, v]) => `${k}=${v}`).join(' ')}`);
      deps.maybeRebuildGraph(baseDir, root);
    },
  });
}

module.exports = { createTasksStampCommand };
