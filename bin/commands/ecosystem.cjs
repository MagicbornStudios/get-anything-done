'use strict';
/**
 * gad ecosystem — bring up / query / tear down the operator's full dev ecosystem.
 *
 * Subcommands:
 *   up       [--projectid] [--no-kael] [--no-team] [--no-daemons] [--detach] [--json]
 *   status   [--projectid] [--json]
 *   down     [--projectid] [--keep-kael] [--json]
 *   doctor   [--projectid] [--json]
 *
 * Per-process state: .planning/.ecosystem/<process>.json
 * Logs:             .planning/.ecosystem/<process>.log
 *
 * Operator standing rule 2026-05-09: "I always want my ecosystem shit coming up
 * so let it come up." — ecosystem up is idempotent; skip already-running processes.
 *
 * Settings keys:
 *   ecosystem.auto_up_on_session_start  boolean  default false  scope: user
 *   ecosystem.kael_required             boolean  default true   scope: user
 *   ecosystem.daemons_required          boolean  default true   scope: user
 *   ecosystem.team_required             boolean  default false  scope: user
 */

const fs   = require('fs');
const path = require('path');
const net  = require('net');
const os   = require('os');
const { spawn, execFileSync } = require('child_process');
const { defineCommand } = require('citty');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const KAEL_PORT   = 1420;
const ECO_DIR     = path.join('.planning', '.ecosystem');

const PROCESSES = {
  kael:        { label: 'Kael desktop',      stateFile: 'kael.json',        logFile: 'kael.log'        },
  curator:     { label: 'Curator daemon',     stateFile: 'curator.json',     logFile: 'curator.log'     },
  'delta-train':{ label: 'Delta-train daemon',stateFile: 'delta-train.json', logFile: 'delta-train.log' },
  dispatcher:  { label: 'Team dispatcher',   stateFile: 'dispatcher.json',  logFile: 'dispatcher.log'  },
  'team-workers': { label: 'Team workers',  stateFile: 'team-workers.json', logFile: 'team-workers.log' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ts() { return new Date().toISOString(); }

function gadBin() {
  if (process.platform === 'win32') {
    const local = path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
      'Programs', 'gad', 'bin', 'gad.exe',
    );
    if (fs.existsSync(local)) return local;
  }
  return 'gad';
}

function ecoDir(baseDir) {
  return path.join(baseDir, ECO_DIR);
}

function stateFile(baseDir, key) {
  return path.join(ecoDir(baseDir), PROCESSES[key].stateFile);
}

function logFile(baseDir, key) {
  return path.join(ecoDir(baseDir), PROCESSES[key].logFile);
}

function ensureEcoDir(baseDir) {
  fs.mkdirSync(ecoDir(baseDir), { recursive: true });
}

function readState(baseDir, key) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(baseDir, key), 'utf8'));
  } catch { return null; }
}

function writeState(baseDir, key, data) {
  ensureEcoDir(baseDir);
  fs.writeFileSync(stateFile(baseDir, key), JSON.stringify(data, null, 2));
}

function clearState(baseDir, key) {
  try { fs.unlinkSync(stateFile(baseDir, key)); } catch {}
}

/** Check if a PID is alive (cross-platform best-effort). */
function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

/** TCP port probe — resolves true if port is listening. */
function portListening(port, timeout = 1000) {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: '127.0.0.1' });
    sock.setTimeout(timeout);
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error',   () => { sock.destroy(); resolve(false); });
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

/** Age of a heartbeat file in ms; Infinity if missing. */
function heartbeatAge(heartbeatPath) {
  try {
    const stat = fs.statSync(heartbeatPath);
    return Date.now() - stat.mtimeMs;
  } catch { return Infinity; }
}

/** Simple SITREP table for process rows. */
function renderTable(rows) {
  const cols = ['process', 'state', 'pid', 'info', 'log'];
  const widths = cols.map((c) => c.length);
  for (const r of rows) {
    cols.forEach((c, i) => { widths[i] = Math.max(widths[i], String(r[c] ?? '').length); });
  }
  const sep = widths.map((w) => '-'.repeat(w));
  const fmt = (r) => cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
  const lines = [fmt(Object.fromEntries(cols.map((c) => [c, c]))), fmt(Object.fromEntries(cols.map((c, i) => [c, sep[i]])))];
  for (const r of rows) lines.push(fmt(r));
  return lines.join('\n');
}

/**
 * Spawn a detached child process; return PID.
 * stdout + stderr → logPath.
 */
function spawnDetached(baseDir, cmd, cmdArgs, logPath) {
  ensureEcoDir(baseDir);
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(cmd, cmdArgs, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: baseDir,
    shell: false,
  });
  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

// ---------------------------------------------------------------------------
// Per-process up/down logic
// ---------------------------------------------------------------------------

async function upKael(baseDir) {
  // Check port first (already running)
  if (await portListening(KAEL_PORT)) {
    return { skipped: true, reason: `port ${KAEL_PORT} already listening` };
  }
  const state = readState(baseDir, 'kael');
  if (state && pidAlive(state.pid)) {
    return { skipped: true, reason: `pid ${state.pid} alive` };
  }
  const lf = logFile(baseDir, 'kael');
  const bin = gadBin();
  const pid = spawnDetached(baseDir, bin, ['dev', '--kael-only'], lf);
  writeState(baseDir, 'kael', { pid, started_at: ts(), mode: 'dev', log_path: lf });
  return { pid, log: lf };
}

async function upCurator(baseDir) {
  const pidfilePath = path.join(baseDir, '.planning', 'datasets-curator.pid');
  try {
    const pid = parseInt(fs.readFileSync(pidfilePath, 'utf8').trim(), 10);
    if (pid && pidAlive(pid)) return { skipped: true, reason: `pid ${pid} alive` };
  } catch {}
  const state = readState(baseDir, 'curator');
  if (state && pidAlive(state.pid)) return { skipped: true, reason: `pid ${state.pid} alive` };
  const lf = logFile(baseDir, 'curator');
  const bin = gadBin();
  const pid = spawnDetached(baseDir, bin, ['datasets', 'curate', '--detach'], lf);
  writeState(baseDir, 'curator', { pid, started_at: ts(), mode: 'detach', log_path: lf });
  return { pid, log: lf };
}

async function upDeltaTrain(baseDir) {
  const dtStatePath = path.join(baseDir, '.planning', 'delta-train-state.json');
  try {
    const st = JSON.parse(fs.readFileSync(dtStatePath, 'utf8'));
    if (st && st.pid && pidAlive(st.pid)) return { skipped: true, reason: `pid ${st.pid} alive` };
  } catch {}
  const state = readState(baseDir, 'delta-train');
  if (state && pidAlive(state.pid)) return { skipped: true, reason: `pid ${state.pid} alive` };
  const lf = logFile(baseDir, 'delta-train');
  const bin = gadBin();
  const pid = spawnDetached(baseDir, bin, ['delta-train', 'daemon', '--interval', '30m'], lf);
  writeState(baseDir, 'delta-train', { pid, started_at: ts(), mode: 'detach', log_path: lf });
  return { pid, log: lf };
}

async function upDispatcher(baseDir) {
  // Only attempt if a team config exists
  const teamConfigPath = path.join(baseDir, '.planning', 'team', 'config.json');
  if (!fs.existsSync(teamConfigPath)) {
    return { skipped: true, reason: 'no team config' };
  }
  const dispPidPath = path.join(baseDir, '.planning', 'team', 'dispatcher.pid.json');
  try {
    const dp = JSON.parse(fs.readFileSync(dispPidPath, 'utf8'));
    if (dp && dp.pid && pidAlive(dp.pid)) return { skipped: true, reason: `pid ${dp.pid} alive` };
  } catch {}
  const state = readState(baseDir, 'dispatcher');
  if (state && pidAlive(state.pid)) return { skipped: true, reason: `pid ${state.pid} alive` };
  const lf = logFile(baseDir, 'dispatcher');
  const bin = gadBin();
  const pid = spawnDetached(baseDir, bin, ['team', 'dispatcher', 'start'], lf);
  writeState(baseDir, 'dispatcher', { pid, started_at: ts(), mode: 'detach', log_path: lf });
  return { pid, log: lf };
}

async function upTeamWorkers(baseDir, projectid) {
  // Operator standing direction 2026-05-09: "are all the teams going to be
  // up and running with the ecosystem". Yes — when team config exists and
  // ecosystem.team_required=true, fire `gad team start` with the configured
  // profile. Parking was retired in phase 95-10 (just-try-it mode); workers
  // use per-handoff retry budget (isHandoffExhausted) instead of global
  // cooldown state. inner rotation has MAX_INNER_ROTATIONS=3 ceiling AND
  // worker-side completeHandoff prevents claim leak.
  const teamConfigPath = path.join(baseDir, '.planning', 'team', 'config.json');
  if (!fs.existsSync(teamConfigPath)) {
    return { skipped: true, reason: 'no team config' };
  }
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(teamConfigPath, 'utf8'));
  } catch {
    return { skipped: true, reason: 'team config unreadable' };
  }
  // Skip if any worker is already alive
  const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
  if (fs.existsSync(workersDir)) {
    let aliveCount = 0;
    try {
      for (const w of fs.readdirSync(workersDir)) {
        const sp = path.join(workersDir, w, 'status.json');
        if (!fs.existsSync(sp)) continue;
        try {
          const s = JSON.parse(fs.readFileSync(sp, 'utf8'));
          if (s.pid && pidAlive(s.pid) && s.state !== 'STOPPED') aliveCount++;
        } catch {}
      }
    } catch {}
    if (aliveCount > 0) {
      return { skipped: true, reason: `${aliveCount} workers already alive` };
    }
  }
  const profile = cfg.profile || 'default';
  const lf = logFile(baseDir, 'team-workers');
  const bin = gadBin();
  const args = ['team', 'start', '--profile', profile];
  if (projectid) args.push('--projectid', projectid);
  const pid = spawnDetached(baseDir, bin, args, lf);
  writeState(baseDir, 'team-workers', { pid, started_at: ts(), mode: 'detach', log_path: lf, profile });
  return { pid, log: lf, profile };
}

// ---------------------------------------------------------------------------
// Status probing
// ---------------------------------------------------------------------------

async function probeKael(baseDir) {
  const listening = await portListening(KAEL_PORT);
  const state = readState(baseDir, 'kael');
  const pid = state ? state.pid : null;
  if (listening) return { state: 'running', pid: pid || '?', info: `port ${KAEL_PORT}`, log: state ? state.log_path : '' };
  if (pid && pidAlive(pid)) return { state: 'running', pid, info: 'no port yet', log: state.log_path };
  return { state: 'stopped', pid: '', info: '', log: state ? state.log_path : '' };
}

async function probeCurator(baseDir) {
  const pidfilePath = path.join(baseDir, '.planning', 'datasets-curator.pid');
  let pid = null;
  try { pid = parseInt(fs.readFileSync(pidfilePath, 'utf8').trim(), 10); } catch {}
  const state = readState(baseDir, 'curator');
  if (!pid && state) pid = state.pid;
  const alive = pid && pidAlive(pid);
  const hbPath = path.join(baseDir, '.planning', 'datasets-curator-heartbeat.json');
  const hbAgeMs = heartbeatAge(hbPath);
  const hbLabel = hbAgeMs === Infinity ? 'no heartbeat' : `hb ${Math.round(hbAgeMs / 1000)}s ago`;
  return {
    state: alive ? 'running' : 'stopped',
    pid: alive ? String(pid) : '',
    info: alive ? hbLabel : '',
    log: state ? state.log_path : path.join(ecoDir(baseDir), PROCESSES.curator.logFile),
  };
}

async function probeDeltaTrain(baseDir) {
  const dtStatePath = path.join(baseDir, '.planning', 'delta-train-state.json');
  let pid = null;
  try {
    const st = JSON.parse(fs.readFileSync(dtStatePath, 'utf8'));
    pid = st && st.pid ? st.pid : null;
  } catch {}
  const state = readState(baseDir, 'delta-train');
  if (!pid && state) pid = state.pid;
  const alive = pid && pidAlive(pid);
  const hbPath = path.join(baseDir, '.planning', 'delta-train-heartbeat.json');
  const hbAgeMs = heartbeatAge(hbPath);
  const hbLabel = hbAgeMs === Infinity ? 'no heartbeat' : `hb ${Math.round(hbAgeMs / 1000)}s ago`;
  return {
    state: alive ? 'running' : 'stopped',
    pid: alive ? String(pid) : '',
    info: alive ? hbLabel : '',
    log: state ? state.log_path : path.join(ecoDir(baseDir), PROCESSES['delta-train'].logFile),
  };
}

async function probeDispatcher(baseDir) {
  const dispPidPath = path.join(baseDir, '.planning', 'team', 'dispatcher.pid.json');
  let pid = null;
  try {
    const dp = JSON.parse(fs.readFileSync(dispPidPath, 'utf8'));
    pid = dp && dp.pid ? dp.pid : null;
  } catch {}
  const state = readState(baseDir, 'dispatcher');
  if (!pid && state) pid = state.pid;
  const alive = pid && pidAlive(pid);
  const workerDir = path.join(baseDir, '.planning', 'team', 'workers');
  let workerCount = 0;
  try {
    workerCount = fs.readdirSync(workerDir).filter((d) => {
      try { return fs.statSync(path.join(workerDir, d)).isDirectory(); } catch { return false; }
    }).length;
  } catch {}
  return {
    state: alive ? 'running' : 'stopped',
    pid: alive ? String(pid) : '',
    info: alive ? `${workerCount} worker(s)` : '',
    log: state ? state.log_path : path.join(ecoDir(baseDir), PROCESSES.dispatcher.logFile),
  };
}

async function gatherStatus(baseDir) {
  const [kael, curator, deltaTrain, dispatcher] = await Promise.all([
    probeKael(baseDir),
    probeCurator(baseDir),
    probeDeltaTrain(baseDir),
    probeDispatcher(baseDir),
  ]);
  const ionosPresent = !!process.env.IONOS_API_KEY;
  const anthropicPresent = !!process.env.ANTHROPIC_API_KEY;
  const modalPresent = !!process.env.MODAL_VLLM_URL;
  return {
    processes: { kael, curator, 'delta-train': deltaTrain, dispatcher },
    env: { IONOS_API_KEY: ionosPresent, ANTHROPIC_API_KEY: anthropicPresent, MODAL_VLLM_URL: modalPresent },
  };
}

// ---------------------------------------------------------------------------
// Doctor checks
// ---------------------------------------------------------------------------

async function runDoctor(baseDir, projectid) {
  const status = await gatherStatus(baseDir);
  const todos = [];

  // Process checks
  for (const [key, proc] of Object.entries(status.processes)) {
    if (proc.state !== 'running') {
      todos.push({ type: 'process', item: key, message: `${PROCESSES[key].label} is not running — run \`gad ecosystem up\`` });
    }
  }

  // Env checks
  const envChecks = [
    { key: 'IONOS_API_KEY',      required: false },
    { key: 'ANTHROPIC_API_KEY',  required: false },
    { key: 'MODAL_VLLM_URL',     required: false },
  ];
  for (const { key } of envChecks) {
    if (!process.env[key]) {
      todos.push({ type: 'env', item: key, message: `${key} is not set in environment` });
    }
  }

  // Anomaly detection
  let anomalies = [];
  try {
    const { detectAnomalies, describeAnomaly } = require('../../lib/anomalies/detector.cjs');
    const raw = await detectAnomalies({ baseDir, projectid: projectid || '', lookback_h: 24 });
    anomalies = raw.map((a) => ({
      rule_id: a.rule_id,
      severity: a.severity,
      description: describeAnomaly(a),
      evidence: a.evidence,
    }));
  } catch (err) {
    anomalies = [{ rule_id: 'detector_error', severity: 'info', description: `Anomaly detector threw: ${err.message}`, evidence: {} }];
  }

  return { todos, status, anomalies };
}

// ---------------------------------------------------------------------------
// Command factory
// ---------------------------------------------------------------------------

function createEcosystemCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, outputError } = deps;

  function resolveBaseDir(args) {
    try {
      const repoRoot = findRepoRoot();
      const config = gadConfig.load(repoRoot);
      const projectid = (args && args.projectid) || '';
      const roots = resolveRoots({ projectid }, repoRoot, config.roots || []);
      const root = roots[0];
      if (!root) return repoRoot;
      const resolved = path.join(repoRoot, root.path);
      // Use path that actually has .planning
      if (fs.existsSync(path.join(resolved, '.planning'))) return resolved;
      if (fs.existsSync(path.join(repoRoot, '.planning'))) return repoRoot;
      return resolved;
    } catch {
      return process.cwd();
    }
  }

  // ── up ─────────────────────────────────────────────────────────────────────
  const upCmd = defineCommand({
    meta: { name: 'up', description: 'Bring up the full ecosystem (Kael + daemons + dispatcher). Idempotent.' },
    args: {
      projectid:   { type: 'string',  description: 'Project id', default: '' },
      'no-kael':   { type: 'boolean', description: 'Skip Kael desktop launch', default: false },
      'no-team':   { type: 'boolean', description: 'Skip team dispatcher launch', default: false },
      'no-daemons':{ type: 'boolean', description: 'Skip curator + delta-train daemons', default: false },
      detach:      { type: 'boolean', description: 'Return immediately (all spawns are already detached)', default: false },
      json:        { type: 'boolean', description: 'Emit JSON result', default: false },
    },
    async run({ args, rawArgs }) {
      const baseDir = resolveBaseDir(args);
      // citty strips 'no-' prefix for boolean args; use rawArgs for reliable detection
      const ra = Array.isArray(rawArgs) ? rawArgs : [];
      const noKael    = ra.includes('--no-kael');
      const noTeam    = ra.includes('--no-team');
      const noDaemons = ra.includes('--no-daemons');
      const useJson   = args.json || false;

      const results = {};

      if (!noKael) {
        results.kael = await upKael(baseDir);
      } else {
        results.kael = { skipped: true, reason: '--no-kael flag' };
      }

      if (!noDaemons) {
        results.curator      = await upCurator(baseDir);
        results['delta-train'] = await upDeltaTrain(baseDir);
      } else {
        results.curator        = { skipped: true, reason: '--no-daemons flag' };
        results['delta-train'] = { skipped: true, reason: '--no-daemons flag' };
      }

      if (!noTeam) {
        results.dispatcher    = await upDispatcher(baseDir);
        results['team-workers'] = await upTeamWorkers(baseDir, args.projectid || '');
      } else {
        results.dispatcher      = { skipped: true, reason: '--no-team flag' };
        results['team-workers'] = { skipped: true, reason: '--no-team flag' };
      }

      if (useJson) {
        process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + '\n');
        return;
      }

      // SITREP table
      const rows = Object.entries(results).map(([key, r]) => ({
        process: key,
        state:   r.skipped ? 'skipped' : (r.pid ? 'started' : 'n/a'),
        pid:     r.pid ? String(r.pid) : '',
        info:    r.reason || (r.log ? '' : ''),
        log:     r.log ? path.relative(baseDir, r.log) : '',
      }));
      console.log('\n=== gad ecosystem up ===\n');
      console.log(renderTable(rows));
      console.log('');
    },
  });

  // ── status ──────────────────────────────────────────────────────────────────
  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Report current ecosystem process state.' },
    args: {
      projectid: { type: 'string',  description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'Emit JSON', default: false },
    },
    async run({ args }) {
      const baseDir = resolveBaseDir(args);
      const result = await gatherStatus(baseDir);

      if (args.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        return;
      }

      console.log('\n=== gad ecosystem status ===\n');
      const rows = Object.entries(result.processes).map(([key, p]) => ({
        process: key,
        state:   p.state,
        pid:     p.pid,
        info:    p.info,
        log:     p.log ? path.relative(baseDir, p.log) : '',
      }));
      console.log(renderTable(rows));

      console.log('\nenv:');
      for (const [k, v] of Object.entries(result.env)) {
        console.log(`  ${k}: ${v ? 'SET' : 'MISSING'}`);
      }
      console.log('');
    },
  });

  // ── down ────────────────────────────────────────────────────────────────────
  const downCmd = defineCommand({
    meta: { name: 'down', description: 'Gracefully shut down supporting daemons. Leaves Kael running by default.' },
    args: {
      projectid:    { type: 'string',  description: 'Project id', default: '' },
      'keep-kael':  { type: 'boolean', description: 'Leave Kael running (default true)', default: true },
      'no-keep-kael':{ type: 'boolean', description: 'Also kill Kael', default: false },
      json:         { type: 'boolean', description: 'Emit JSON', default: false },
    },
    async run({ args, rawArgs }) {
      const baseDir = resolveBaseDir(args);
      const ra = Array.isArray(rawArgs) ? rawArgs : [];
      const killKael = ra.includes('--no-keep-kael');
      const results = {};

      const targets = ['curator', 'delta-train', 'dispatcher'];
      if (killKael) targets.unshift('kael');

      for (const key of targets) {
        const state = readState(baseDir, key);
        // Also check canonical pid files
        let pid = state ? state.pid : null;
        if (!pid) {
          // Try well-known pid locations
          if (key === 'curator') {
            try { pid = parseInt(fs.readFileSync(path.join(baseDir, '.planning', 'datasets-curator.pid'), 'utf8').trim(), 10); } catch {}
          } else if (key === 'delta-train') {
            try {
              const st = JSON.parse(fs.readFileSync(path.join(baseDir, '.planning', 'delta-train-state.json'), 'utf8'));
              pid = st && st.pid ? st.pid : null;
            } catch {}
          } else if (key === 'dispatcher') {
            try {
              const dp = JSON.parse(fs.readFileSync(path.join(baseDir, '.planning', 'team', 'dispatcher.pid.json'), 'utf8'));
              pid = dp && dp.pid ? dp.pid : null;
            } catch {}
          }
        }
        if (!pid || !pidAlive(pid)) {
          results[key] = { state: 'already-stopped' };
          clearState(baseDir, key);
          continue;
        }
        try {
          process.kill(pid, 'SIGTERM');
          results[key] = { state: 'stopped', pid };
          clearState(baseDir, key);
        } catch (err) {
          results[key] = { state: 'error', message: err.message };
        }
      }

      if (args.json) {
        process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + '\n');
        return;
      }

      console.log('\n=== gad ecosystem down ===\n');
      for (const [k, v] of Object.entries(results)) {
        console.log(`  ${k}: ${v.state}${v.pid ? ` (pid ${v.pid})` : ''}`);
      }
      if (!killKael) console.log('\n  (Kael left running; pass --no-keep-kael to stop it)');
      console.log('');
    },
  });

  // ── doctor ──────────────────────────────────────────────────────────────────
  const doctorCmd = defineCommand({
    meta: { name: 'doctor', description: 'Diagnose missing env vars, stopped processes, and configuration gaps.' },
    args: {
      projectid: { type: 'string',  description: 'Project id', default: '' },
      json:      { type: 'boolean', description: 'Emit JSON', default: false },
    },
    async run({ args }) {
      const baseDir = resolveBaseDir(args);
      const { todos, status, anomalies } = await runDoctor(baseDir, args.projectid || '');

      if (args.json) {
        process.stdout.write(JSON.stringify({ ok: todos.length === 0 && anomalies.length === 0, todos, status, anomalies }, null, 2) + '\n');
        return;
      }

      console.log('\n=== gad ecosystem doctor ===\n');
      if (todos.length === 0) {
        console.log('All process/env checks passed.');
      } else {
        for (const t of todos) {
          console.log(`  [${t.type.toUpperCase()}] ${t.message}`);
        }
      }

      console.log('\n=== ANOMALIES ===\n');
      if (!anomalies || anomalies.length === 0) {
        console.log('ANOMALIES: none');
      } else {
        for (const a of anomalies) {
          console.log(`  [${a.severity.toUpperCase()}] [${a.rule_id}] ${a.description}`);
        }
      }
      console.log('');
    },
  });

  // ── root ────────────────────────────────────────────────────────────────────
  return defineCommand({
    meta: { name: 'ecosystem', description: 'Manage the full operator ecosystem: Kael + daemons + dispatcher.' },
    subCommands: {
      up:     upCmd,
      status: statusCmd,
      down:   downCmd,
      doctor: doctorCmd,
    },
  });
}

module.exports = { createEcosystemCommand };
module.exports.register = (ctx) => ({ ecosystem: createEcosystemCommand(ctx.common) });
