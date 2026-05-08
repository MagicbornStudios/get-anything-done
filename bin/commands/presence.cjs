'use strict';
/**
 * gad presence — agent presence ledger CLI.
 *
 *   gad presence write  [--projectid <id>] [--runtime <r>] [--model <m>]
 *   gad presence list   [--projectid <id>] [--all]
 *   gad presence claim  [--projectid <id>] [--focus-route <r>] [--focus-cid <cid>]
 *                                          [--active-skill <s>] [--handoff-id <h>]
 *
 * GLOBAL-D-323 Phase B. Factory pattern matching bin/commands/state.cjs.
 */

const { defineCommand } = require('citty');
const { write, claim, scan, ageLabel, LIVE_THRESHOLD_S } = require('../../lib/agent-presence.cjs');

function createPresenceCommand(deps) {
  const { findRepoRoot, gadConfig, detectRuntimeIdentity, render, shouldUseJson } = deps;

  // -------------------------------------------------------------------------
  // presence write
  // -------------------------------------------------------------------------
  const writeCmd = defineCommand({
    meta: { name: 'write', description: 'Write or refresh presence for this agent instance (one-shot heartbeat)' },
    args: {
      projectid:    { type: 'string',  description: 'Project id', default: '' },
      runtime:      { type: 'string',  description: 'Runtime id override', default: '' },
      model:        { type: 'string',  description: 'Model id override', default: '' },
      'focus-route':{ type: 'string',  description: 'Current focus route (e.g. /kael)', default: '' },
      'focus-cid':  { type: 'string',  description: 'Current focus component cid', default: '' },
      'active-skill':{ type: 'string', description: 'Active skill slug', default: '' },
      'handoff-id': { type: 'string',  description: 'Current handoff id', default: '' },
      json:         { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir  = findRepoRoot();
      let config     = null;
      try { config = gadConfig.load(baseDir); } catch {}

      const projectid = args.projectid || (config && config.roots && config.roots[0] && config.roots[0].id) || '';
      const ri        = detectRuntimeIdentity();

      const result = write({
        baseDir,
        projectid,
        runtime:          args.runtime   || ri.id   || undefined,
        model:            args.model     || ri.model || undefined,
        focusRoute:       args['focus-route']   || undefined,
        focusCid:         args['focus-cid']      || undefined,
        activeSkill:      args['active-skill']   || undefined,
        currentHandoffId: args['handoff-id']     || undefined,
      });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`presence written: ${result.filePath}`);
        console.log(`agent-slug: ${result.agentSlug}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // presence list
  // -------------------------------------------------------------------------
  const listCmd = defineCommand({
    meta: { name: 'list', description: 'List all known agent presence records' },
    args: {
      projectid: { type: 'string',  description: 'Filter by project id (empty = all)', default: '' },
      all:       { type: 'boolean', description: 'Include idle agents beyond 5 min', default: false },
      json:      { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      let config    = null;
      try { config = gadConfig.load(baseDir); } catch {}

      let entries = scan(baseDir, config);

      if (args.projectid) {
        entries = entries.filter((e) => e.record.projectid === args.projectid);
      }
      if (!args.all) {
        entries = entries.filter((e) => e.live);
      }

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(entries.map((e) => ({ ...e.record, age_seconds: e.ageSeconds, live: e.live })), null, 2));
        return;
      }

      if (entries.length === 0) {
        console.log('(no presence records found)');
        return;
      }

      const liveCount = entries.filter((e) => e.live).length;
      const idleCount = entries.length - liveCount;
      console.log(`\nAgent presence — ${liveCount} live, ${idleCount} idle (threshold ${LIVE_THRESHOLD_S / 60} min)\n`);

      for (const e of entries) {
        const r     = e.record;
        const badge = e.live ? '[LIVE]' : '[IDLE]';
        const focus = [r.current_focus_route, r.current_focus_cid, r.active_skill].filter(Boolean).join(' / ') || '—';
        console.log(`  ${badge}  ${r.agent_slug}`);
        console.log(`         project=${r.projectid}  runtime=${r.runtime}  model=${r.model || '—'}`);
        console.log(`         last-seen=${ageLabel(e.ageSeconds)}  focus=${focus}`);
        if (r.current_handoff_id) console.log(`         handoff=${r.current_handoff_id}`);
        console.log('');
      }
    },
  });

  // -------------------------------------------------------------------------
  // presence claim
  // -------------------------------------------------------------------------
  const claimCmd = defineCommand({
    meta: { name: 'claim', description: 'Update specific presence fields for this agent' },
    args: {
      projectid:     { type: 'string', description: 'Project id', default: '' },
      'focus-route': { type: 'string', description: 'Set current focus route', default: '' },
      'focus-cid':   { type: 'string', description: 'Set current focus cid', default: '' },
      'active-skill':{ type: 'string', description: 'Set active skill slug', default: '' },
      'handoff-id':  { type: 'string', description: 'Set current handoff id', default: '' },
      json:          { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir   = findRepoRoot();
      let config      = null;
      try { config = gadConfig.load(baseDir); } catch {}

      const projectid = args.projectid || (config && config.roots && config.roots[0] && config.roots[0].id) || '';

      const result = claim({
        baseDir,
        projectid,
        focusRoute:       args['focus-route']    || undefined,
        focusCid:         args['focus-cid']       || undefined,
        activeSkill:      args['active-skill']    || undefined,
        currentHandoffId: args['handoff-id']      || undefined,
      });

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`presence updated: ${result.filePath}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // presence (root — default to list)
  // -------------------------------------------------------------------------
  return defineCommand({
    meta: { name: 'presence', description: 'Agent presence ledger — write heartbeat, list live agents, claim focus' },
    subCommands: {
      write: writeCmd,
      list:  listCmd,
      claim: claimCmd,
    },
  });
}

module.exports = { createPresenceCommand };

module.exports.register = (ctx) => ({
  presence: createPresenceCommand({
    ...ctx.common,
  }),
});
