'use strict';
/**
 * gad team dispatch — one-shot: enqueue open handoffs not yet in a mailbox.
 * Persistent daemon lives in bin/commands/team/dispatcher.cjs (M3.6).
 * Workers also self-claim on idle, so this is optional pre-queuing.
 */

const { defineCommand } = require('citty');
const { readConfig } = require('../../../lib/team/config.cjs');
const { listWorkerIds } = require('../../../lib/team/status.cjs');
const { mailboxDepth, listMailboxRefs, enqueueMessage } = require('../../../lib/team/mailbox.cjs');
const { matchesLane } = require('../../../lib/team/lanes.cjs');
const { workerSpec } = require('../../../lib/team/config.cjs');

function createDispatchCommand(deps) {
  const { findRepoRoot, outputError } = deps;
  return defineCommand({
    meta: { name: 'dispatch', description: 'One-shot: scan open gad handoffs, enqueue any not yet in a mailbox. Workers self-claim on idle too, so this is optional.' },
    args: { projectid: { type: 'string', default: '' } },
    run() {
      const baseDir = findRepoRoot();
      const ids = listWorkerIds(baseDir);
      if (ids.length === 0) { outputError('No workers configured. Run `gad team start` first.'); process.exit(1); }
      const cfg = readConfig(baseDir) || {};
      const { listHandoffs } = require('../../../lib/handoffs.cjs');
      const { sortHandoffsForPickup } = require('../../../lib/agent-detect.cjs');
      const open = listHandoffs({ baseDir, bucket: 'open' });
      const queued = listMailboxRefs(baseDir, ids);
      const candidates = open.filter(h => !queued.has(h.id));
      if (candidates.length === 0) { console.log(`No new open handoffs to dispatch (${open.length} open, ${queued.size} already queued).`); return; }

      const sorted = sortHandoffsForPickup(candidates, cfg.runtime || null);
      let assigned = 0;
      for (const h of sorted) {
        const hlane = h.frontmatter && h.frontmatter.lane;
        // Pick least-loaded worker whose lane matches this handoff's lane (null/null → any).
        const laneMatches = ids
          .map(id => ({ id, spec: workerSpec(cfg, id), depth: mailboxDepth(baseDir, id) }))
          .filter(w => matchesLane(w.spec.lane, hlane));
        const pool = laneMatches.length > 0 ? laneMatches : ids.map(id => ({ id, spec: workerSpec(cfg, id), depth: mailboxDepth(baseDir, id) }));
        pool.sort((a, b) => a.depth - b.depth);
        const target = pool[0].id;
        const msg = {
          kind: 'handoff', ref: h.id,
          projectid: (h.frontmatter && h.frontmatter.projectid) || null,
          priority: (h.frontmatter && h.frontmatter.priority) || 'normal',
          runtime_preference: (h.frontmatter && h.frontmatter.runtime_preference) || null,
          enqueued_at: new Date().toISOString(),
          enqueued_by: 'dispatcher',
        };
        enqueueMessage(baseDir, target, msg);
        console.log(`  → ${target}  ${h.id}  [${msg.priority}]${hlane ? ` lane=${hlane}` : ''}`);
        assigned++;
      }
      console.log('');
      console.log(`Dispatched ${assigned} handoff(s).`);
    },
  });
}

module.exports = { createDispatchCommand };
