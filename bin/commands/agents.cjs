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
        'Unified view of installed runtimes, OMX/Codex state, router daemon, recent subagent runs, and pending handoffs per runtime.',
    },
    args: {
      'no-probe': { type: 'boolean', description: 'Skip binary probes (which/where). Faster, less info.', default: false },
      'days-back': { type: 'string', description: 'How many days of subagent-runs to include (default 2)', default: '2' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const {
        probeRuntimes, readOmxState, readRouterLock, listSubagentRuns, listHeartbeats, formatAge,
      } = require('../../lib/agents-status.cjs');

      const daysBack = Math.max(1, parseInt(args['days-back'], 10) || 2);
      const runtimes = probeRuntimes({ skipProbe: !!args['no-probe'] });
      const omx = readOmxState(baseDir);
      const router = readRouterLock(baseDir);
      const subagentRuns = listSubagentRuns(baseDir, { daysBack });
      const heartbeats = listHeartbeats ? listHeartbeats(baseDir) : [];

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
          heartbeats,
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

      console.log('-- OMX / CODEX WORKFLOW LAYER ---------------------------------');
      if (!omx) {
        console.log('No .omx/state/team-state.json — OMX not in use, or state dir absent.');
      } else {
        console.log(`  active:       ${omx.active ? 'yes' : 'no'}`);
        console.log(`  mode:         ${omx.mode || '-'}`);
        console.log(`  last turn:    ${omx.lastTurnAt || '-'}`);
        console.log(`  age:          ${formatAge(omx.ageMs)}`);
        console.log(`  iteration:    ${omx.iteration == null ? '-' : omx.iteration}`);
        if (omx.ageMs != null && omx.ageMs > 30 * 60 * 1000) {
          console.log(`  note:         stale (>${Math.floor(omx.ageMs / 60000)}min); Codex may have crashed or idled.`);
        }
      }
      console.log('');

      console.log('-- HEARTBEATS (real-time liveness) ----------------------------');
      if (heartbeats.length === 0) {
        console.log('No heartbeats (callers opt in via `gad agents heartbeat`).');
      } else {
        const hbRows = heartbeats.map((h) => ({
          runtime: h.runtime,
          session: h.sessionId ? String(h.sessionId).slice(0, 16) : '-',
          pid: h.pid == null ? '-' : String(h.pid),
          age: formatAge(h.ageMs),
          state: h.stale ? 'STALE' : 'alive',
        }));
        console.log(render(hbRows, { format: 'table', headers: ['runtime', 'session', 'pid', 'age', 'state'] }));
        const aliveCount = heartbeats.filter((h) => !h.stale).length;
        if (aliveCount < heartbeats.length) {
          console.log(`(${heartbeats.length - aliveCount} stale; last_seen_at > 90s old — probably crashed or exited uncleanly)`);
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

  const agentsHeartbeatCmd = defineCommand({
    meta: {
      name: 'heartbeat',
      description: 'Write a liveness heartbeat for the current runtime/session at .gad/heartbeats/<runtime>-<session>.json. Callers should invoke periodically (e.g. every 30–60s).',
    },
    args: {
      runtime: { type: 'string', description: 'Runtime id (default: detected)', default: '' },
      session: { type: 'string', description: 'Session id (default: detected env or pid)', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { writeHeartbeat } = require('../../lib/agents-status.cjs');
      const runtime = (args.runtime || (detectRuntimeIdentity && detectRuntimeIdentity().id) || 'unknown').trim();
      const sessionId = (args.session || (detectRuntimeSessionId && detectRuntimeSessionId()) || '').trim();
      const result = writeHeartbeat(baseDir, { runtime, sessionId, cwd: process.cwd() });
      if (args.json) {
        console.log(JSON.stringify({ ...result.data, path: path.relative(baseDir, result.path) }, null, 2));
      } else {
        console.log(`Heartbeat: ${runtime}${sessionId ? '/' + sessionId : ''} @ ${result.data.last_seen_at}`);
        console.log(`  path: ${path.relative(baseDir, result.path)}`);
      }
    },
  });

  return defineCommand({
    meta: { name: 'agents', description: 'Agent / runtime visibility. Read-only inspection; write-only for heartbeats.' },
    subCommands: { status: agentsStatusCmd, heartbeat: agentsHeartbeatCmd },
  });
}

module.exports = { createAgentsCommand };
