'use strict';
/**
 * gad agents — read-only runtime/agent visibility (2026-04-19).
 *
 * Required deps:
 *   findRepoRoot, render, detectRuntimeIdentity, listHandoffs, path
 */

const path = require('path');
const { defineCommand } = require('citty');

function createAgentsCommand(deps) {
  const { findRepoRoot, render, detectRuntimeIdentity, listHandoffs, detectRuntimeSessionId } = deps;

  const agentsStatusCmd = defineCommand({
    meta: {
      name: 'status',
      description:
        'Unified view of installed runtimes, GAD team state, router daemon, recent subagent runs, and pending handoffs per runtime.',
    },
    args: {
      'no-probe': { type: 'boolean', description: 'Skip binary probes (which/where). Faster, less info.', default: false },
      'days-back': { type: 'string', description: 'How many days of subagent-runs to include (default 2)', default: '2' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const {
        probeRuntimes, readOmxState, readRouterLock, listSubagentRuns, inferLivenessFromLogs, formatAge,
      } = require('../../lib/agents-status.cjs');

      const daysBack = Math.max(1, parseInt(args['days-back'], 10) || 2);
      const runtimes = probeRuntimes({ skipProbe: !!args['no-probe'] });
      const omx = readOmxState(baseDir);
      const router = readRouterLock(baseDir);
      const subagentRuns = listSubagentRuns(baseDir, { daysBack });
      const liveness = inferLivenessFromLogs(baseDir);

      const allOpen = listHandoffs({ baseDir, bucket: 'open' });
      const handoffsFor = {};
      for (const h of allOpen) {
        const rp = (h.frontmatter && h.frontmatter.runtime_preference) || 'any';
        handoffsFor[rp] = (handoffsFor[rp] || 0) + 1;
      }

      const detected = detectRuntimeIdentity();

      if (args.json) {
        console.log(JSON.stringify({
          detectedRuntime: detected,
          runtimes,
          omx,
          router,
          liveness,
          subagentRuns,
          handoffsOpen: { total: allOpen.length, byRuntime: handoffsFor },
          generatedAt: new Date().toISOString(),
        }, null, 2));
        return;
      }

      console.log('-- RUNTIMES ---------------------------------------------------');
      const headers = ['runtime', 'installed', 'bin', 'this-process', 'env-hints', 'handoffs'];
      const rows = runtimes.map((rt) => ({
        runtime: rt.id,
        installed: rt.installed === null ? '-' : (rt.installed ? 'yes' : 'no'),
        bin: rt.binPath ? path.basename(rt.binPath) : '-',
        'this-process': rt.id === detected.id ? '✓ (current)' : (rt.currentProcess ? 'yes' : '-'),
        'env-hints': rt.envHints.length > 0 ? rt.envHints.join(',') : '-',
        handoffs: String(handoffsFor[rt.id] || 0),
      }));
      console.log(render(rows, { format: 'table', headers }));
      if (handoffsFor.any) {
        console.log(`(+${handoffsFor.any} open handoff(s) with runtime_preference=any — any runtime can claim)`);
      }
      console.log('');

      console.log('-- GAD TEAM WORKFLOW LAYER -----------------------------------');
      if (!omx) {
        console.log('No .planning/team/state.json — team mode not active.');
      } else {
        console.log(`  active:       ${omx.active ? 'yes' : 'no'}`);
        console.log(`  mode:         ${omx.mode || '-'}`);
        console.log(`  last turn:    ${omx.lastTurnAt || '-'}`);
        console.log(`  age:          ${formatAge(omx.ageMs)}`);
        console.log(`  iteration:    ${omx.iteration == null ? '-' : omx.iteration}`);
        if (omx.ageMs != null && omx.ageMs > 30 * 60 * 1000) {
          console.log(`  note:         stale (>${Math.floor(omx.ageMs / 60000)}min); team leader may have crashed or idled.`);
        }
      }
      console.log('');

      console.log('-- LIVENESS (inferred from gad-log + trace-events) ------------');
      if (liveness.length === 0) {
        console.log('No recent activity in .planning/.gad-log/ or .planning/.trace-events.jsonl.');
      } else {
        const lvRows = liveness.map((l) => ({
          runtime: l.runtime,
          session: l.sessionId ? String(l.sessionId).slice(0, 16) : '-',
          'last-activity': l.lastTool || '-',
          age: formatAge(l.ageMs),
          state: l.stale ? 'stale' : 'active',
          events: String(l.eventCount),
          source: Array.isArray(l.sources) ? l.sources.map((s) => s === 'gad-log' ? 'cli' : 'hook').join('+') : '-',
        }));
        console.log(render(lvRows, { format: 'table', headers: ['runtime', 'session', 'last-activity', 'age', 'state', 'events', 'source'] }));
        const staleCount = liveness.filter((l) => l.stale).length;
        if (staleCount > 0) {
          console.log(`(${staleCount} stale; last activity > 10min ago — session probably ended or idled)`);
        }
        const unknowns = liveness.filter((l) => l.runtime === 'unknown');
        if (unknowns.length > 0) {
          console.log(`(${unknowns.length} with runtime=unknown — the runtime didn't set fingerprint env vars; add them in lib/runtime-detect.cjs)`);
        }
      }
      console.log('');

      console.log('-- GAD-TUI ROUTER DAEMON --------------------------------------');
      if (!router) {
        console.log('Not running (no lockfile at packages/gad-tui/.gad/router-logs/.lock).');
        console.log('Start: pnpm --filter @magicborn/gad-tui router');
      } else {
        console.log(`  pid:          ${router.pid || '?'}`);
        console.log(`  lock mtime:   ${router.mtimeAt || '-'}`);
        console.log(`  age:          ${formatAge(router.ageMs)}`);
      }
      console.log('');

      console.log('-- RECENT SUBAGENT RUNS ---------------------------------------');
      if (subagentRuns.length === 0) {
        console.log(`(none in the last ${daysBack} day(s))`);
      } else {
        const saRows = subagentRuns.map((r) => ({
          project: r.projectid,
          task: r.taskId || '-',
          date: r.date,
          status: r.status,
          ended: r.endedAt ? formatAge(Date.now() - Date.parse(r.endedAt)) : '-',
        }));
        console.log(render(saRows, { format: 'table', headers: ['project', 'task', 'date', 'status', 'ended'] }));
      }
      console.log('');

      if (allOpen.length === 0) {
        console.log('No open handoffs. Queue is empty.');
      } else {
        const detectedId = detected.id && detected.id !== 'unknown' ? detected.id : null;
        const forMe = detectedId ? (handoffsFor[detectedId] || 0) + (handoffsFor.any || 0) : 0;
        if (detectedId && forMe > 0) {
          console.log(`${forMe} open handoff(s) match your runtime (${detectedId}). Claim: \`gad handoffs claim-next\`.`);
        } else if (detectedId) {
          console.log(`${allOpen.length} open handoff(s) — none for you (runtime=${detectedId}).`);
        } else {
          console.log(`${allOpen.length} open handoff(s) — runtime not auto-detected; pass \`--runtime <id>\` to claim.`);
        }
      }
    },
  });

  return defineCommand({
    meta: { name: 'agents', description: 'Agent / runtime visibility. Read-only. Liveness inferred from CLI trace logs (no explicit heartbeats).' },
    subCommands: { status: agentsStatusCmd },
  });
}

module.exports = { createAgentsCommand };
module.exports.register = (ctx) => ({ agents: createAgentsCommand(ctx.common) });
