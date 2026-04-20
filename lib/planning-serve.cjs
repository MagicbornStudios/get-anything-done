'use strict';
/**
 * planning-serve.cjs — shared logic for `gad planning serve` (phase 59 task 59-05).
 *
 * Decision gad-265 Q1: monorepo-only for phase 59; shell out to
 * `pnpm --filter @portfolio/planning-app <dev|start>`. The GAD binary only
 * spawns planning-app as a subprocess and never requires its internals
 * (phase 59 PLAN.md risk R8 — strict CJS/ESM boundary).
 *
 * Exports:
 *   - resolveWorkspaceRoot(startDir) — walk up from cwd to monorepo root.
 *   - decideReuseAction({ status, body, port }) — pure reuse-detection function,
 *     returned as enum { action: 'attach' | 'conflict' | 'spawn', reason }.
 *     Isolated from the network layer so it can be unit-tested.
 *   - probeHealth({ port, timeoutMs }) — HTTP GET /api/health, returns
 *     { status, body } or { error } on connection failure.
 *   - spawnPlanningApp(opts) — spawns pnpm filter, wires log file + SIGINT forwarding.
 *
 * Contract: deterministic in, deterministic out. No global state beyond
 * child_process handles. Callers own stdout/stderr.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const PLANNING_APP_MARKER = 'gad-planning-app';
const PLANNING_APP_WORKSPACE = '@portfolio/platform';
const DEFAULT_PORT = 3002;
const HEALTH_PROBE_TIMEOUT_MS = 5000;

/**
 * Walk upward from startDir looking for a monorepo root. Recognises either
 * a pnpm-workspace.yaml at root, OR a gad-config.toml / .planning/config.json
 * pair with an `apps/planning-app/package.json` inside.
 *
 * @param {string} [startDir] defaults to process.cwd()
 * @returns {{ root: string, planningAppDir: string } | null}
 */
function resolveWorkspaceRoot(startDir) {
  let dir = startDir || process.cwd();
  for (let i = 0; i < 12; i++) {
    const planningAppPkg = path.join(dir, 'apps', 'platform', 'package.json');
    if (fs.existsSync(planningAppPkg)) {
      return { root: dir, planningAppDir: path.join(dir, 'apps', 'platform') };
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Pure reuse-detection logic. Given the result of probing `/api/health` on
 * the target port, decide whether to attach, conflict, or spawn.
 *
 * Input shape (one of):
 *   { status: 200, body: '...'|object, port }
 *   { status: <other>, body, port }
 *   { error: '<connection error>', port }
 *
 * Output enum: { action: 'attach' | 'conflict' | 'spawn', reason: string }.
 *
 * - 'attach'   — planning-app already listening, safe to exit 0.
 * - 'conflict' — port held by something else on HTTP/200 but wrong marker.
 * - 'spawn'    — connection refused / timeout / non-200; proceed to spawn.
 */
function decideReuseAction(probe) {
  if (!probe) {
    return { action: 'spawn', reason: 'no probe result' };
  }
  const port = probe.port != null ? probe.port : DEFAULT_PORT;
  if (probe.error) {
    return { action: 'spawn', reason: `port ${port} not in use (${probe.error})` };
  }
  if (probe.status !== 200) {
    return {
      action: 'conflict',
      reason: `port ${port} responded HTTP ${probe.status} — not a planning-app instance`,
    };
  }
  // Normalise body — accept string or parsed JSON object.
  const body = probe.body;
  let bodyStr;
  if (typeof body === 'string') {
    bodyStr = body;
  } else if (body && typeof body === 'object') {
    try { bodyStr = JSON.stringify(body); } catch { bodyStr = ''; }
  } else {
    bodyStr = '';
  }
  if (bodyStr.includes(PLANNING_APP_MARKER)) {
    return { action: 'attach', reason: `planning-app already serving on port ${port}` };
  }
  return {
    action: 'conflict',
    reason: `port ${port} occupied by non-planning-app service (missing ${PLANNING_APP_MARKER} marker)`,
  };
}

/**
 * HTTP GET http://localhost:<port>/api/health with a short timeout.
 * Never throws; always resolves with a probe descriptor.
 *
 * @param {{ port: number, timeoutMs?: number }} opts
 * @returns {Promise<{ port: number, status?: number, body?: string, error?: string }>}
 */
function probeHealth({ port, timeoutMs = HEALTH_PROBE_TIMEOUT_MS }) {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: '127.0.0.1', port, path: '/api/health', timeout: timeoutMs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ port, status: res.statusCode, body });
        });
        res.on('error', (err) => resolve({ port, error: String(err && err.message || err) }));
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error('health probe timeout'));
    });
    req.on('error', (err) => {
      resolve({ port, error: String(err && err.message || err) });
    });
  });
}

/** Default log dir: ~/.gad/logs/ (user home, not repo). */
function defaultLogDir() {
  return path.join(os.homedir(), '.gad', 'logs');
}

/** Build log filename: planning-app-YYYY-MM-DD.jsonl (daily rotation by name). */
function logFileName(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `planning-app-${y}-${m}-${d}.jsonl`;
}

/** Append a single JSONL line: { ts, stream, line }. Non-throwing. */
function appendLogLine(logFile, stream, line) {
  try {
    const rec = { ts: new Date().toISOString(), stream, line };
    fs.appendFileSync(logFile, JSON.stringify(rec) + '\n');
  } catch {
    // Log write failures must never crash the serve loop.
  }
}

/**
 * Split a buffer into complete lines, preserving the trailing partial.
 * Returns { lines, rest }. No line includes a trailing '\n'.
 */
function splitLines(buf) {
  const parts = buf.split(/\r?\n/);
  const rest = parts.pop();
  return { lines: parts, rest: rest == null ? '' : rest };
}

/**
 * Spawn pnpm --filter @portfolio/planning-app <dev|start> with PORT env set.
 * Wires stdio to both the operator's terminal (via console.log) AND the log
 * file. Traps SIGINT on the parent, forwards to child, waits up to 10s, then
 * SIGKILL.
 *
 * @param {{
 *   workspaceRoot: string,
 *   port: number,
 *   prod: boolean,
 *   logFile: string,
 *   onExit?: (code: number|null, signal: string|null) => void,
 * }} opts
 * @returns {import('child_process').ChildProcess}
 */
function spawnPlanningApp(opts) {
  const { spawn } = require('child_process');
  const { workspaceRoot, port, prod, logFile, onExit } = opts;

  const script = prod ? 'start' : 'dev';
  const env = { ...process.env, PORT: String(port) };

  // Windows pnpm is pnpm.cmd — shell:true lets spawn resolve the right binary
  // via PATHEXT without us hardcoding .cmd. Args are whitespace-free tokens,
  // so shell interpolation risk is nil here.
  const args = ['--filter', PLANNING_APP_WORKSPACE, script];
  const child = spawn('pnpm', args, {
    cwd: workspaceRoot,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });

  let stdoutRest = '';
  let stderrRest = '';

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const { lines, rest } = splitLines(stdoutRest + chunk.toString('utf8'));
    stdoutRest = rest;
    for (const line of lines) appendLogLine(logFile, 'stdout', line);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
    const { lines, rest } = splitLines(stderrRest + chunk.toString('utf8'));
    stderrRest = rest;
    for (const line of lines) appendLogLine(logFile, 'stderr', line);
  });

  // SIGINT forwarding with 10s grace, then SIGKILL.
  let shuttingDown = false;
  function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n[gad planning serve] SIGINT received — forwarding to planning-app (10s grace)');
    try { child.kill('SIGINT'); } catch {}
    const killTimer = setTimeout(() => {
      console.log('[gad planning serve] grace expired — SIGKILL');
      try { child.kill('SIGKILL'); } catch {}
    }, 10_000);
    // Prevent the timer from keeping the process alive after child exits.
    if (typeof killTimer.unref === 'function') killTimer.unref();
  }
  process.on('SIGINT', shutdown);
  // Windows sends SIGBREAK for Ctrl+Break; treat the same.
  process.on('SIGBREAK', shutdown);

  child.on('exit', (code, signal) => {
    // Flush any trailing partial lines.
    if (stdoutRest) appendLogLine(logFile, 'stdout', stdoutRest);
    if (stderrRest) appendLogLine(logFile, 'stderr', stderrRest);
    appendLogLine(logFile, 'stderr', `[gad planning serve] child exited code=${code} signal=${signal}`);
    if (typeof onExit === 'function') onExit(code, signal);
  });

  return child;
}

/** Ensure the log dir exists, creating it recursively if needed. */
function ensureLogDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* best-effort */ }
}

// TODO(59-05.followup): structured metrics (spawn latency, heartbeat cadence)
// live alongside the JSONL tail once phase 60 BYOK lands its audit-log shape.
// Don't add here — keep the log contract dumb until a consumer exists.

module.exports = {
  DEFAULT_PORT,
  PLANNING_APP_MARKER,
  PLANNING_APP_WORKSPACE,
  HEALTH_PROBE_TIMEOUT_MS,
  resolveWorkspaceRoot,
  decideReuseAction,
  probeHealth,
  spawnPlanningApp,
  defaultLogDir,
  logFileName,
  ensureLogDir,
  appendLogLine,
};
