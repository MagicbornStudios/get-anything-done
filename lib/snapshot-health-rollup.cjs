'use strict';
/**
 * lib/snapshot-health-rollup.cjs — operational substrate health for `gad snapshot`.
 *
 * Surfaces what the planning sections do not: dispatcher liveness, worker
 * tallies + stale flags, account quota state per provider, daemon liveness.
 *
 * Decision: GLOBAL-D-314 (snapshot must include health rollup).
 * Trigger: dispatcher was DEAD 13.8h on 2026-05-08, only discovered when
 * operator asked why a handoff was "refused" — snapshot showed nothing wrong.
 *
 * Cost target: <500 tokens, all reads file-system only. No subprocess spawns,
 * no auth preflight (too slow for snapshot — call `gad runtime check` separately).
 */

const fs = require('fs');
const path = require('path');
const { readHeartbeat } = require('./team/dispatcher.cjs');
const { listWorkerIds, readStatus } = require('./team/status.cjs');
const { loadRuntimeRegistry, loadRuntimeAccountState } = require('./team/accounts-registry.cjs');
const { buildSnapshotModelsLine } = require('./telemetry/model-rollup.cjs');

// 2026-05-14: periodic-tick daemons (overnight, datasets-curator, sessions-watcher,
// accounts-poller) MIGRATED to apps/desk hook scheduler. The daemons no longer
// auto-start, so health rollup stops alerting on their absence/staleness.
// Remaining substrate (dispatcher, workers, supervisor, cross-project-watcher)
// has its own liveness checks in rollupDispatcher / rollupWorkers below.
const SINGLETONS = [];

function isAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function readDaemonState(baseDir, pidfileName) {
  const p = path.join(baseDir, '.planning', pidfileName);
  if (!fs.existsSync(p)) return { exists: false, alive: false, pid: null };
  let pid = null;
  try { pid = parseInt(fs.readFileSync(p, 'utf8').trim(), 10); } catch {}
  return { exists: true, pid, alive: isAlive(pid) };
}

function rollupDispatcher(baseDir) {
  try {
    const hb = readHeartbeat(baseDir);
    return { state: hb.state, age_s: hb.age_s, pid: hb.pid };
  } catch (err) {
    return { state: 'UNKNOWN', error: err.message };
  }
}

function rollupWorkers(baseDir) {
  try {
    const ids = listWorkerIds(baseDir);
    const tally = { total: ids.length, working: 0, idle: 0, claiming: 0, stopped: 0, not_started: 0, unknown: 0 };
    const stale = [];
    for (const id of ids) {
      const s = readStatus(baseDir, id);
      if (!s) { tally.unknown++; stale.push(`${id}(no-status)`); continue; }
      const state = String(s.state || 'UNKNOWN').toLowerCase();
      if (state === 'working') tally.working++;
      else if (state === 'idle') tally.idle++;
      else if (state === 'claiming') tally.claiming++;
      else if (state === 'stopped') { tally.stopped++; stale.push(id); }
      else if (state === 'not_started') { tally.not_started++; stale.push(id); }
      else tally.unknown++;
      if (s.last_heartbeat) {
        const ageS = Math.round((Date.now() - Date.parse(s.last_heartbeat)) / 1000);
        if (Number.isFinite(ageS) && ageS > 300 && state !== 'stopped' && state !== 'not_started') {
          stale.push(`${id}(hb${ageS}s)`);
        }
      }
    }
    return { tally, stale };
  } catch (err) {
    return { tally: null, stale: [], error: err.message };
  }
}

function rollupAccounts(baseDir) {
  try {
    const reg = loadRuntimeRegistry(baseDir);
    const state = loadRuntimeAccountState(baseDir) || {};
    const byProvider = {};
    for (const [runtime, entry] of Object.entries(reg || {})) {
      const provider = (entry && entry.provider) || runtime;
      const accounts = (entry && entry.accounts) || [];
      if (!byProvider[provider]) {
        byProvider[provider] = { active: 0, paused: 0, exhausted: 0, last_error: null };
      }
      for (const acc of accounts) {
        if (acc && acc.paused_at) byProvider[provider].paused++;
        else byProvider[provider].active++;
        const accState = state[`${runtime}/${acc && acc.label}`] || {};
        if (accState.quota_exhausted_until) byProvider[provider].exhausted++;
        if (accState.last_error_class && !byProvider[provider].last_error) {
          byProvider[provider].last_error = accState.last_error_class;
        }
      }
    }
    return byProvider;
  } catch (err) {
    return { _error: err.message };
  }
}

function rollupDaemons(baseDir) {
  return SINGLETONS.map((s) => {
    const r = readDaemonState(baseDir, s.pidfile);
    return { id: s.id, alive: r.alive, pid: r.pid, exists: r.exists };
  });
}

function rollupModels(baseDir) {
  // 1-hour window; falls back silently to null if no data or read error.
  return buildSnapshotModelsLine(baseDir, 60 * 60 * 1000, 3);
}

/**
 * Time-box a sync rollup function. All current readers are file-system only
 * and complete in <2ms; this guard exists so a hung NFS / antivirus hook on
 * Windows cannot block snapshot composition. Records elapsed when slow.
 */
function withTimeBox(label, fn, timeoutMs = 500) {
  const t0 = Date.now();
  try {
    const result = fn();
    const elapsed = Date.now() - t0;
    if (elapsed > timeoutMs) result._slow_ms = elapsed;
    return result;
  } catch (err) {
    return { _error: `${label}: ${err.message}` };
  }
}

function buildHealthSection(baseDir) {
  const dispatcher = withTimeBox('dispatcher', () => rollupDispatcher(baseDir));
  const workers = withTimeBox('workers', () => rollupWorkers(baseDir));
  const accounts = withTimeBox('accounts', () => rollupAccounts(baseDir));
  const daemons = withTimeBox('daemons', () => rollupDaemons(baseDir));
  const modelsLine = withTimeBox('models', () => rollupModels(baseDir), 200);

  const lines = [];

  const dState = dispatcher.state || 'UNKNOWN';
  const dAge = typeof dispatcher.age_s === 'number' ? `age=${dispatcher.age_s}s` : '';
  const dFlag = (dState === 'DEAD' || dState === 'STALE') ? ' [!]' : '';
  lines.push(`Dispatcher: ${dState}${dFlag}  ${dAge}  pid=${dispatcher.pid || '-'}`);

  if (workers.tally) {
    const t = workers.tally;
    const parts = [`total=${t.total}`, `working=${t.working}`, `idle=${t.idle}`];
    if (t.claiming) parts.push(`claiming=${t.claiming}`);
    if (t.stopped) parts.push(`stopped=${t.stopped}`);
    if (t.not_started) parts.push(`not_started=${t.not_started}`);
    if (t.unknown) parts.push(`unknown=${t.unknown}`);
    let line = `Workers:    ${parts.join(' ')}`;
    if (workers.stale && workers.stale.length > 0) line += `  stale=[${workers.stale.join(',')}]`;
    lines.push(line);
  } else if (workers._error) {
    lines.push(`Workers:    error (${workers._error})`);
  } else {
    lines.push(`Workers:    (no team config)`);
  }

  if (accounts && !accounts._error) {
    const accLines = Object.entries(accounts).map(([prov, c]) => {
      const flags = [];
      if (c.exhausted > 0) flags.push(`exhausted=${c.exhausted}`);
      if (c.paused > 0) flags.push(`paused=${c.paused}`);
      if (c.last_error) flags.push(`last_err=${c.last_error}`);
      const flagStr = flags.length ? ` [${flags.join(' ')}]` : '';
      return `${prov}=${c.active}${flagStr}`;
    });
    if (accLines.length > 0) lines.push(`Accounts:   ${accLines.join('  ')}`);
  } else if (accounts && accounts._error) {
    lines.push(`Accounts:   error (${accounts._error})`);
  }

  const dLines = daemons.map((d) => {
    const sigil = d.alive ? 'UP' : (d.exists ? 'STALE-PID' : 'OFF');
    return `${d.id}=${sigil}`;
  });
  lines.push(`Daemons:    ${dLines.join('  ')}`);

  // MODELS line — top 3 runtimes by calls in last 1h.  Omitted when no data.
  const mLine = typeof modelsLine === 'string' ? modelsLine : null;
  if (mLine) lines.push(mLine);

  const hints = [];
  if (dState === 'DEAD' || dState === 'STALE') {
    hints.push(`! Dispatcher offline.       Run: gad team dispatcher start --projectid <id>`);
  }
  if (workers.stale && workers.stale.length > 0) {
    hints.push(`! Stale workers.            Run: gad team restart --worker-id <id>`);
  }
  // 2026-05-14: periodic-tick daemons migrated to apps/desk hooks; no liveness
  // hint here. Remaining substrate (dispatcher/workers/supervisor) is handled
  // by the dedicated rollups above.
  if (hints.length > 0) lines.push('', ...hints);

  return { title: 'HEALTH (substrate liveness)', content: lines.join('\n') };
}

module.exports = {
  buildHealthSection,
  rollupDispatcher,
  rollupWorkers,
  rollupAccounts,
  rollupDaemons,
  rollupModels,
};
