'use strict';
/**
 * gad team enqueue — operator-forced assignment into a specific worker mailbox.
 * Use for priority overrides. Self-claim handles the common case.
 */

const path = require('path');
const { defineCommand } = require('citty');
const { listWorkerIds } = require('../../../lib/team/status.cjs');
const { mailboxDepth, enqueueMessage } = require('../../../lib/team/mailbox.cjs');

function createEnqueueCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  return defineCommand({
    meta: { name: 'enqueue', description: 'Drop a task or handoff into a worker mailbox. Use when you want a SPECIFIC worker to pick up a SPECIFIC item regardless of priority.' },
    args: {
      task: { type: 'string', default: '' },
      handoff: { type: 'string', default: '' },
      'worker-id': { type: 'string', default: '' },
      projectid: { type: 'string', default: '', description: 'Target project id (resolves .planning/team/ path)' },
      priority: { type: 'string', default: 'normal' },
      'runtime-preference': { type: 'string', default: '' },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      if (!args.task && !args.handoff) { outputError('Pass --task <id> or --handoff <id>.'); process.exit(1); }
      if (args.task && args.handoff) { outputError('Pass exactly one of --task / --handoff.'); process.exit(1); }
      const ids = listWorkerIds(baseDir);
      if (ids.length === 0) { outputError('No workers configured. Run `gad team start` first.'); process.exit(1); }

      let target = String(args['worker-id'] || '').trim();
      if (!target) {
        const loads = ids.map(id => ({ id, depth: mailboxDepth(baseDir, id) }));
        loads.sort((a, b) => a.depth - b.depth);
        target = loads[0].id;
      }
      if (!ids.includes(target)) { outputError(`Unknown worker: ${target}. Known: ${ids.join(', ')}`); process.exit(1); }

      const kind = args.task ? 'task' : 'handoff';
      const ref = args.task || args.handoff;
      const msg = {
        kind, ref,
        projectid: args.projectid || null,
        priority: String(args.priority),
        runtime_preference: args['runtime-preference'] || null,
        enqueued_at: new Date().toISOString(),
        enqueued_by: process.env.GAD_AGENT_NAME || 'cli',
      };
      const p = enqueueMessage(baseDir, target, msg);
      console.log(`Enqueued ${kind}:${ref} → ${target} (${require('path').relative(baseDir, p)})`);
    },
  });
}

module.exports = { createEnqueueCommand };
