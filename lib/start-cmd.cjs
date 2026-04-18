'use strict';
/**
 * start-cmd.cjs — shared logic for `gad start` / `gad dashboard` (phase 59
 * task 59-06, decision gad-262).
 *
 * Flow:
 *   1. Probe /api/health on target port.
 *   2. If already serving a gad-planning-app: skip spawn.
 *      If port busy but wrong service: exit 1 with conflict message.
 *      Else: spawn `gad planning serve` detached, poll health until 200
 *            with timeout.
 *   3. Open the default browser to /my-projects (unless --no-browser).
 *
 * Keeps router-agnostic. Caller owns logging and exit codes.
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const {
  DEFAULT_PORT,
  decideReuseAction,
  probeHealth,
} = require('./planning-serve.cjs');

const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_POLL_MS = 500;

/**
 * Platform-appropriate "open URL in default browser" command.
 * Returns null on unsupported platforms.
 */
function resolveBrowserOpener() {
  const plat = process.platform;
  if (plat === 'win32') return { cmd: 'cmd', args: ['/c', 'start', '""'] }; // `start ""  URL`
  if (plat === 'darwin') return { cmd: 'open', args: [] };
  if (plat === 'linux') return { cmd: 'xdg-open', args: [] };
  return null;
}

function openBrowser(url) {
  const opener = resolveBrowserOpener();
  if (!opener) return { ok: false, reason: `no browser opener for platform ${process.platform}` };
  try {
    const child = spawn(opener.cmd, [...opener.args, url], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32', // cmd /c start needs shell on Windows
    });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || String(err) };
  }
}

/**
 * Locate the gad binary to spawn for `planning serve`. Preference:
 *   1. process.execPath when it's a gad SEA binary (installed).
 *   2. node + this file's parent bin/gad.cjs (source checkout).
 *
 * Falls back to just `'gad'` and lets PATH resolve — worst case fails clean.
 */
function resolveGadExecPath() {
  const exec = process.execPath || '';
  if (/gad(\.exe)?$/i.test(path.basename(exec))) {
    return { cmd: exec, args: [], shell: false };
  }
  const sourceCli = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
  try {
    require('fs').statSync(sourceCli);
    return { cmd: process.execPath, args: [sourceCli], shell: false };
  } catch {
    /* fall through */
  }
  return { cmd: 'gad', args: [], shell: process.platform === 'win32' };
}

/**
 * Spawn `gad planning serve --port <port>` in detached mode. Child is
 * unref'd so the parent can exit after browser-open. stdio: 'ignore' —
 * logs go to the planning-serve log file per 59-05 design.
 */
function spawnPlanningServeDetached({ port }) {
  const { cmd, args, shell } = resolveGadExecPath();
  const fullArgs = [...args, 'planning', 'serve'];
  if (port && port !== DEFAULT_PORT) fullArgs.push('--port', String(port));
  const child = spawn(cmd, fullArgs, {
    detached: true,
    stdio: 'ignore',
    shell,
    windowsHide: true,
  });
  child.unref();
  return { pid: child.pid };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Poll /api/health until attach-action probe returns, or timeout.
 * Returns { ready: true } on success, { ready: false, reason } on timeout.
 */
async function waitForHealth({ port, timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS, pollMs = DEFAULT_HEALTH_POLL_MS }) {
  const deadline = Date.now() + timeoutMs;
  let lastReason = 'no probe yet';
  while (Date.now() < deadline) {
    const probe = await probeHealth({ port });
    const decision = decideReuseAction({ ...probe, port });
    if (decision.action === 'attach') return { ready: true };
    if (decision.action === 'conflict') return { ready: false, reason: decision.reason };
    lastReason = decision.reason;
    await sleep(pollMs);
  }
  return { ready: false, reason: `timeout after ${timeoutMs}ms (last: ${lastReason})` };
}

/**
 * Main entry invoked by the CLI command handler.
 *
 * @returns {Promise<{ action: 'attach' | 'spawn' | 'conflict', url: string, browserOpened: boolean }>}
 */
async function runStart({ port = DEFAULT_PORT, noBrowser = false, stdout, stderr }) {
  const url = `http://localhost:${port}/my-projects`;
  const log = (msg) => (stderr || process.stderr).write(`${msg}\n`);

  // Probe once up front.
  const probe = await probeHealth({ port });
  const decision = decideReuseAction({ ...probe, port });

  if (decision.action === 'attach') {
    log(`gad start: planning-app already serving on port ${port}`);
  } else if (decision.action === 'conflict') {
    log(`gad start: port ${port} is busy with a different service (${decision.reason}). Free the port or use --port.`);
    return { action: 'conflict', url, browserOpened: false };
  } else {
    log(`gad start: spawning planning-app on port ${port}...`);
    spawnPlanningServeDetached({ port });
    const wait = await waitForHealth({ port });
    if (!wait.ready) {
      log(`gad start: planning-app did not become healthy (${wait.reason}). Check ~/.gad/logs/planning-app-*.jsonl.`);
      return { action: 'spawn', url, browserOpened: false };
    }
    log(`gad start: planning-app ready on port ${port}`);
  }

  if (noBrowser) {
    log(`gad start: --no-browser — open ${url} in your browser to view the dashboard.`);
    return { action: decision.action === 'attach' ? 'attach' : 'spawn', url, browserOpened: false };
  }

  const open = openBrowser(url);
  if (open.ok) {
    log(`gad start: opened ${url}`);
    return { action: decision.action === 'attach' ? 'attach' : 'spawn', url, browserOpened: true };
  }

  log(`gad start: failed to open browser (${open.reason}). Visit ${url} manually.`);
  return { action: decision.action === 'attach' ? 'attach' : 'spawn', url, browserOpened: false };
}

module.exports = {
  DEFAULT_HEALTH_TIMEOUT_MS,
  DEFAULT_HEALTH_POLL_MS,
  resolveBrowserOpener,
  openBrowser,
  resolveGadExecPath,
  spawnPlanningServeDetached,
  waitForHealth,
  runStart,
};
