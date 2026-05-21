'use strict';
/**
 * lib/supervisor-agent.cjs — GAD substrate supervisor daemon.
 *
 * Ticks every 60s and auto-recovers four failure conditions:
 *   1. Handoffs stuck in claimed/ for >30min    → auto-unclaim (stuck reason)
 *   2. Workers with stale heartbeat >300s        → gad team restart --worker-id <id>
 *   3. Accounts with quota_exhausted state       → gad accounts rotate
 *   4. Dispatcher dead (heartbeat >120s gone)    → gad team dispatcher start
 *
 * All interventions are delegated to existing CLIs via spawnSync.
 * Every intervention is logged to .planning/supervisor.log.jsonl.
 *
 * Pidfile: .planning/supervisor.pid
 * SIGTERM / SIGINT: clean exit, removes pidfile.
 *
 * DESIGN NOTE: No auto-respawn loop. If the supervisor itself dies, it is
 * detected by `gad system start` (which gad system start --only supervisor
 * restores). This is intentional — infinite supervisor-of-supervisor
 * recursion is a failure pattern.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ──────────────────────────────────────────────────────────────────────────────
// Path helpers
// ──────────────────────────────────────────────────────────────────────────────

function supervisorPidPath(baseDir) {
  return path.join(baseDir, '.planning', 'supervisor.pid');
}

function supervisorLogPath(baseDir) {
  return path.join(baseDir, '.planning', 'supervisor.log.jsonl');
}

function teamRoot(baseDir) {
  return path.join(baseDir, '.planning', 'team');
}

function dispatcherHeartbeatPath(baseDir) {
  return path.join(teamRoot(baseDir), 'dispatcher.heartbeat.json');
}

function claimedDir(baseDir) {
  return path.join(baseDir, '.planning', 'handoffs', 'claimed');
}

function openDir(baseDir) {
  return path.join(baseDir, '.planning', 'handoffs', 'open');
}

function workerStatusPath(baseDir, id) {
  return path.join(teamRoot(baseDir), 'workers', id, 'status.json');
}

function accountsStatePath(baseDir) {
  return path.join(baseDir, '.planning', 'accounts-state.json');
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON helpers
// ──────────────────────────────────────────────────────────────────────────────

function readJsonSafe(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Logging
// ──────────────────────────────────────────────────────────────────────────────

function appendLog(baseDir, entry) {
  const logPath = supervisorLogPath(baseDir);
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n';
    fs.appendFileSync(logPath, line);
  } catch {}
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI dispatch (all interventions route through existing CLIs)
// ──────────────────────────────────────────────────────────────────────────────

function gadCli(baseDir) {
  // Prefer the gad.cjs in the same repo as this lib/ file.
  return path.resolve(__dirname, '..', 'bin', 'gad.cjs');
}

function runGad(baseDir, args) {
  const result = spawnSync('node', [gadCli(baseDir), ...args], {
    cwd: baseDir,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    error: result.error ? result.error.message : null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 1 — stuck handoffs (claimed > 30min)
// ──────────────────────────────────────────────────────────────────────────────

const STUCK_HANDOFF_MS = 30 * 60 * 1000; // 30 minutes

function checkStuckHandoffs(baseDir, projectid, log) {
  const dir = claimedDir(baseDir);
  if (!fs.existsSync(dir)) return;

  let files;
  try { files = fs.readdirSync(dir); } catch { return; }

  const now = Date.now();
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(dir, file);
    let stat;
    try { stat = fs.statSync(filePath); } catch { continue; }

    const ageMs = now - stat.mtimeMs;
    if (ageMs < STUCK_HANDOFF_MS) continue;

    // Move back to open/ — the simplest safe unclaim
    const openPath = path.join(openDir(baseDir), file);
    try {
      fs.mkdirSync(openDir(baseDir), { recursive: true });
      fs.renameSync(filePath, openPath);
      const entry = {
        kind: 'unclaim-stuck', handoff: file,
        age_min: Math.round(ageMs / 60_000),
        reason: 'claimed >30min without completion',
      };
      log(entry);
      appendLog(baseDir, entry);
    } catch (err) {
      appendLog(baseDir, { kind: 'unclaim-error', handoff: file, error: err.message });
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 2 — stale worker heartbeats (>300s)
// ──────────────────────────────────────────────────────────────────────────────

const STALE_WORKER_S = 300;

function checkStaleWorkers(baseDir, projectid, log) {
  const workersDir = path.join(teamRoot(baseDir), 'workers');
  if (!fs.existsSync(workersDir)) return;

  let workerIds;
  try { workerIds = fs.readdirSync(workersDir); } catch { return; }

  const now = Date.now();
  for (const id of workerIds) {
    const statusPath = workerStatusPath(baseDir, id);
    const status = readJsonSafe(statusPath, null);
    if (!status) continue;
    if (!status.last_heartbeat) continue;
    // Only check workers in an active state — NOT_STARTED / STOPPED are expected to be quiet.
    if (['NOT_STARTED', 'STOPPED'].includes(status.state)) continue;

    const ageMs = now - Date.parse(status.last_heartbeat);
    const age_s = Math.round(ageMs / 1000);
    if (age_s < STALE_WORKER_S) continue;

    const entry = {
      kind: 'restart-stale-worker', worker_id: id, state: status.state,
      heartbeat_age_s: age_s,
    };
    log(entry);
    appendLog(baseDir, entry);

    const result = runGad(baseDir, [
      'team', 'restart', '--worker-id', id,
      ...(projectid ? ['--projectid', projectid] : []),
    ]);
    appendLog(baseDir, {
      kind: 'restart-stale-worker-result', worker_id: id,
      ok: result.ok, stdout: result.stdout.slice(0, 500), stderr: result.stderr.slice(0, 500),
    });
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 3 — quota-exhausted accounts
// ──────────────────────────────────────────────────────────────────────────────

function checkExhaustedAccounts(baseDir, projectid, log) {
  const stateFile = accountsStatePath(baseDir);
  const state = readJsonSafe(stateFile, null);
  if (!state) return;

  // state shape: { accounts: { [name]: { quota_exhausted: bool, ... } } }
  // or flat array — handle both
  const accounts = state.accounts || state;
  if (typeof accounts !== 'object') return;

  const exhausted = Object.entries(accounts)
    .filter(([, v]) => v && v.quota_exhausted === true)
    .map(([k]) => k);

  if (exhausted.length === 0) return;

  const entry = { kind: 'rotate-accounts', exhausted };
  log(entry);
  appendLog(baseDir, entry);

  const result = runGad(baseDir, [
    'accounts', 'rotate',
    ...(projectid ? ['--projectid', projectid] : []),
  ]);
  appendLog(baseDir, {
    kind: 'rotate-accounts-result',
    ok: result.ok, stdout: result.stdout.slice(0, 500), stderr: result.stderr.slice(0, 500),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 4 — dispatcher dead
// ──────────────────────────────────────────────────────────────────────────────

const DISPATCHER_DEAD_S = 120;

function checkDispatcher(baseDir, projectid, log) {
  const hbPath = dispatcherHeartbeatPath(baseDir);
  let hb = null;
  try { hb = JSON.parse(fs.readFileSync(hbPath, 'utf8')); } catch { /* missing */ }

  let dead = false;
  if (!hb || !hb.ts) {
    dead = true;
  } else {
    const age_s = Math.round((Date.now() - Date.parse(hb.ts)) / 1000);
    if (age_s > DISPATCHER_DEAD_S) dead = true;
  }

  if (!dead) return;

  const entry = { kind: 'restart-dispatcher', reason: hb ? 'heartbeat stale' : 'no heartbeat file' };
  log(entry);
  appendLog(baseDir, entry);

  const result = runGad(baseDir, [
    'team', 'dispatcher', 'start',
    ...(projectid ? ['--projectid', projectid] : []),
  ]);
  appendLog(baseDir, {
    kind: 'restart-dispatcher-result',
    ok: result.ok, stdout: result.stdout.slice(0, 500), stderr: result.stderr.slice(0, 500),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Tick — run all checks once
// ──────────────────────────────────────────────────────────────────────────────

function tick(baseDir, projectid, interventionLog) {
  const log = interventionLog || (() => {});
  checkStuckHandoffs(baseDir, projectid, log);
  checkStaleWorkers(baseDir, projectid, log);
  checkExhaustedAccounts(baseDir, projectid, log);
  checkDispatcher(baseDir, projectid, log);
}

// ──────────────────────────────────────────────────────────────────────────────
// Daemon
// ──────────────────────────────────────────────────────────────────────────────

const TICK_MS = 60_000;

async function runDaemon(baseDir, opts) {
  const projectid = (opts && opts.projectid) || '';
  const tickMs = (opts && opts.tickMs) || TICK_MS;
  const pidPath = supervisorPidPath(baseDir);

  // Pidfile guard
  fs.mkdirSync(path.dirname(pidPath), { recursive: true });
  fs.writeFileSync(pidPath, String(process.pid));

  appendLog(baseDir, { kind: 'start', pid: process.pid, projectid, tick_ms: tickMs });
  process.stderr.write(`[gad-supervisor] started pid=${process.pid} projectid=${projectid || '(none)'} tick=${tickMs}ms\n`);

  let stopping = false;
  let intervalId = null;

  function cleanup() {
    stopping = true;
    if (intervalId) clearInterval(intervalId);
    try { fs.unlinkSync(pidPath); } catch {}
    appendLog(baseDir, { kind: 'stop', pid: process.pid });
    process.stderr.write('[gad-supervisor] stopped\n');
  }

  process.once('SIGTERM', () => { cleanup(); process.exit(0); });
  process.once('SIGINT',  () => { cleanup(); process.exit(0); });

  // Initial tick immediately on startup
  tick(baseDir, projectid);

  intervalId = setInterval(() => {
    if (!stopping) tick(baseDir, projectid);
  }, tickMs);
}

// ──────────────────────────────────────────────────────────────────────────────
// Exports
// ──────────────────────────────────────────────────────────────────────────────

module.exports = {
  tick,
  runDaemon,
  supervisorPidPath,
  supervisorLogPath,
  // Individual checks exported for unit testing
  checkStuckHandoffs,
  checkStaleWorkers,
  checkExhaustedAccounts,
  checkDispatcher,
  STUCK_HANDOFF_MS,
  STALE_WORKER_S,
  DISPATCHER_DEAD_S,
};
