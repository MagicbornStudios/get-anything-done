'use strict';
/**
 * gad next — cross-project priority hotlist.
 *
 * Priority tiers (top = most urgent):
 *   1. in-progress tasks WITH attribution (agent / skill / runtime set) —
 *      actively claimed work.
 *   2. in-progress tasks WITHOUT attribution — stalled carryovers.
 *   3. first planned task per project, ordered by earliest sprint phase.
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, readTasks,
 *                formatId, render
 */

const { defineCommand } = require('citty');

function createNextCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, readTasks, formatId, render } = deps;

  return defineCommand({
    meta: {
      name: 'next',
      description: 'Priority hotlist of what to work on next — in-progress first, then stalled carryovers, then the first planned task per project.',
    },
    args: {
      projectid: { type: 'string', description: 'Scope to one project', default: '' },
      all: { type: 'boolean', description: 'Show every project (overrides session/cwd scope)', default: false },
      limit: { type: 'string', description: 'Max rows per project (default 3)', default: '3' },
      json: { type: 'boolean', description: 'Emit structured JSON', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      if (roots.length === 0) return;
      const limit = Math.max(1, parseInt(args.limit, 10) || 3);

      const rows = [];
      for (const root of roots) {
        const tasks = readTasks(root, baseDir, {});
        const attributed = (t) => Boolean(
          (t.agentId && String(t.agentId).trim()) ||
          (t.agentRole && String(t.agentRole).trim()) ||
          (t.runtime && String(t.runtime).trim()),
        );
        const inProgressAttributed = tasks.filter((t) => t.status === 'in-progress' && attributed(t));
        const inProgressStalled = tasks.filter((t) => t.status === 'in-progress' && !attributed(t));
        const planned = tasks.filter((t) => t.status === 'planned');
        planned.sort((a, b) => (a.phase || '').localeCompare(b.phase || ''));

        const candidates = [];
        for (const t of inProgressAttributed) candidates.push({ t, tier: 'active' });
        for (const t of inProgressStalled) candidates.push({ t, tier: 'stalled' });
        for (const t of planned) candidates.push({ t, tier: 'next' });

        let emitted = 0;
        for (const { t, tier } of candidates) {
          if (emitted >= limit) break;
          const goal = t.goal || '';
          rows.push({
            project: root.id,
            tier,
            id: formatId(root.id, 'T', t.id),
            'legacy-id': t.id,
            phase: t.phase,
            goal: goal.length > 90 ? goal.slice(0, 87) + '…' : goal,
          });
          emitted += 1;
        }
        if (emitted === 0) {
          rows.push({
            project: root.id, tier: 'idle',
            id: '—', 'legacy-id': '—',
            phase: '—', goal: 'No open tasks.',
          });
        }
      }

      if (args.json) { console.log(JSON.stringify(rows, null, 2)); return; }
      console.log(render(rows, { format: 'table', title: `Next (${rows.length})` }));
    },
  });
}

module.exports = { createNextCommand };
