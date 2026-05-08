'use strict';
/**
 * gad desktop — launch the apps/desktop Kael shell from anywhere.
 *
 * Reads BYOK ANTHROPIC_API_KEY for the active project, injects it into the
 * spawned process env as VITE_ANTHROPIC_API_KEY (Vite's env-prefix rule).
 *
 * DEFAULT (no flags): spawns `pnpm --filter @gad/desktop dev` (tauri dev —
 * native frameless window). Requires Rust toolchain (cargo) in PATH. If cargo
 * is not found, prints a clear error and suggests --browser mode.
 *
 * --browser: spawns `pnpm --filter @gad/desktop dev:vite` (browser at :1420).
 *   Original behaviour; no Rust needed.
 *
 * Log capture:
 *   Tauri  mode → .planning/.desktop-tauri.log   (in monorepo root .planning/)
 *   Browser mode → .planning/.kael-launch.log    (existing convention)
 *
 * Subcommands:
 *   gad desktop launch [--projectid X] [--browser] [--detach] [--dry-run]
 *   gad desktop status   — Tauri process alive y/n + vite port :1420 bound y/n
 *   gad desktop stop     — kill both modes cleanly
 */

const { defineCommand } = require('citty');
const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 1420;
const TAURI_LOG_NAME  = '.desktop-tauri.log';
const VITE_LOG_NAME   = '.kael-launch.log';

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

// Best-effort BYOK fetch. Exits 1 if missing — treat as "not set", continue.
function tryGetByok(keyName, projectId) {
  try {
    const r = spawnSync('node', [path.join(__dirname, '..', 'gad.cjs'), 'env', 'get', keyName, '--projectid', projectId], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 4 * 1024 * 1024,
    });
    if (r.status === 0) return (r.stdout || '').trim();
  } catch {}
  return null;
}

function buildEnv(projectId) {
  const env = { ...process.env };
  if (!env.VITE_ANTHROPIC_API_KEY) {
    const byok = tryGetByok('ANTHROPIC_API_KEY', projectId)
              || env.ANTHROPIC_API_KEY
              || tryGetByok('VITE_ANTHROPIC_API_KEY', projectId);
    if (byok) env.VITE_ANTHROPIC_API_KEY = byok;
  }
  if (!env.VITE_KAEL_USE_SLM && env.KAEL_USE_SLM) {
    env.VITE_KAEL_USE_SLM = env.KAEL_USE_SLM;
  }
  return env;
}

function isPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return out.trim().length > 0;
    }
    const out = execSync(`lsof -i :${port} -P -n -sTCP:LISTEN 2>/dev/null || true`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect whether the Rust toolchain (cargo) is available in PATH.
 * Returns true if found, false otherwise.
 */
function hasRustToolchain() {
  try {
    const r = spawnSync('cargo', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return r.status === 0;
  } catch {
    return false;
  }
}

/**
 * Detect whether a Tauri dev process is running.
 * Heuristic: look for a process whose command line contains "tauri" + "dev".
 * Falls back to checking whether the pid file we wrote is still alive.
 */
function isTauriRunning(repoRoot) {
  const pidFile = path.join(repoRoot, '.planning', '.desktop-tauri.pid');
  if (!fs.existsSync(pidFile)) return false;
  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    if (!pid || isNaN(pid)) return false;
    // process.kill(pid, 0) throws if the process is not alive
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const launchCmd = defineCommand({
  meta: {
    name: 'launch',
    description:
      'Launch apps/desktop Kael shell. Default: Tauri native window (requires Rust). --browser: vite-only at :1420. Auto-injects BYOK ANTHROPIC_API_KEY.',
  },
  args: {
    projectid: { type: 'string', description: 'Project for BYOK secrets', default: 'global' },
    browser:   { type: 'boolean', description: 'Launch vite-only browser mode at :1420 instead of Tauri native window', default: false },
    detach:    { type: 'boolean', description: 'Fork into background and write logs to .planning/', default: false },
    'dry-run': { type: 'boolean', description: 'Print what would be spawned without actually spawning', default: false },
    // Legacy --tauri kept for back-compat but now is a no-op (Tauri is default)
    tauri:     { type: 'boolean', description: '[deprecated] Kept for back-compat. Tauri is now the default.', default: false },
  },
  run({ args }) {
    const dryRun = args['dry-run'];
    const browserMode = !!args.browser;
    const repoRoot = findRepoRoot();
    const desktopDir = path.join(repoRoot, 'apps', 'desktop');

    if (!fs.existsSync(desktopDir)) {
      console.error(`[gad desktop] ERROR: apps/desktop not found at ${desktopDir}. Are you in a gad monorepo?`);
      process.exit(1);
    }

    // ── Rust check (only for Tauri mode) ──────────────────────────────────────
    if (!browserMode && !dryRun) {
      if (!hasRustToolchain()) {
        console.error('[gad desktop] ERROR: Rust toolchain not found (cargo not in PATH).');
        console.error('[gad desktop] Tauri mode requires a Rust toolchain.');
        console.error('[gad desktop] Install: https://rustup.rs/');
        console.error('[gad desktop] Or run without Rust:  gad desktop launch --browser');
        process.exit(1);
      }
    }

    // ── BYOK env injection ────────────────────────────────────────────────────
    const env = buildEnv(args.projectid);
    if (!env.VITE_ANTHROPIC_API_KEY) {
      console.warn('[gad desktop] WARN: VITE_ANTHROPIC_API_KEY not set. Capture via: gad env set ANTHROPIC_API_KEY --projectid ' + args.projectid);
      console.warn('[gad desktop] Kael chat will show a banner until the key is set.');
    } else {
      console.log('[gad desktop] BYOK ANTHROPIC_API_KEY injected into spawned env (VITE_ prefix).');
    }

    // ── Port check (browser/vite mode) ───────────────────────────────────────
    if (browserMode && isPortInUse(DEFAULT_PORT)) {
      console.warn(`[gad desktop] WARN: port ${DEFAULT_PORT} already in use. Stop the existing dev server first: gad desktop stop`);
    }

    // ── Determine spawn args ──────────────────────────────────────────────────
    const cmdName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    let cmdArgs;
    let modeLabel;
    let logFile;

    if (browserMode) {
      cmdArgs  = ['--filter', '@gad/desktop', 'dev:vite'];
      modeLabel = `vite (browser at http://localhost:${DEFAULT_PORT}/kael)`;
      logFile   = path.join(repoRoot, '.planning', VITE_LOG_NAME);
    } else {
      cmdArgs  = ['--filter', '@gad/desktop', 'dev'];
      modeLabel = 'tauri (native desktop window)';
      logFile   = path.join(repoRoot, '.planning', TAURI_LOG_NAME);
    }

    // ── Dry-run: print and exit ───────────────────────────────────────────────
    if (dryRun) {
      console.log('[gad desktop] DRY-RUN — would execute:');
      console.log(`  command : ${cmdName} ${cmdArgs.join(' ')}`);
      console.log(`  cwd     : ${repoRoot}`);
      console.log(`  mode    : ${modeLabel}`);
      console.log(`  log     : ${logFile}`);
      console.log(`  detach  : ${!!args.detach}`);
      console.log(`  VITE_ANTHROPIC_API_KEY: ${env.VITE_ANTHROPIC_API_KEY ? '*** (set)' : '(not set)'}`);
      return;
    }

    // ── Spawn ─────────────────────────────────────────────────────────────────
    console.log(`[gad desktop] launching: ${cmdName} ${cmdArgs.join(' ')}`);
    console.log(`[gad desktop] cwd      : ${repoRoot}`);
    console.log(`[gad desktop] mode     : ${modeLabel}`);
    console.log(`[gad desktop] log      : ${logFile}`);

    let stdio;
    let outFd, errFd;

    if (args.detach) {
      // Ensure .planning dir exists
      const planningDir = path.join(repoRoot, '.planning');
      if (!fs.existsSync(planningDir)) fs.mkdirSync(planningDir, { recursive: true });
      outFd   = fs.openSync(logFile, 'a');
      errFd   = fs.openSync(logFile, 'a');
      stdio   = ['ignore', outFd, errFd];
    } else {
      stdio = 'inherit';
    }

    const child = spawn(cmdName, cmdArgs, {
      cwd: repoRoot,
      env,
      stdio,
      detached: !!args.detach,
      shell: process.platform === 'win32',
    });

    if (args.detach) {
      if (outFd !== undefined) try { fs.closeSync(outFd); } catch {}
      if (errFd !== undefined && errFd !== outFd) try { fs.closeSync(errFd); } catch {}
      child.unref();
      // Write pid file for status/stop commands
      const pidFile = path.join(repoRoot, '.planning', browserMode ? '.desktop-vite.pid' : '.desktop-tauri.pid');
      fs.writeFileSync(pidFile, String(child.pid), 'utf8');
      console.log(`[gad desktop] detached. pid=${child.pid}. logs → ${logFile}`);
      process.exit(0);
    } else {
      // Foreground: write pid file so status/stop can find the process
      const pidFile = path.join(repoRoot, '.planning', browserMode ? '.desktop-vite.pid' : '.desktop-tauri.pid');
      try {
        const planningDir = path.join(repoRoot, '.planning');
        if (!fs.existsSync(planningDir)) fs.mkdirSync(planningDir, { recursive: true });
        fs.writeFileSync(pidFile, String(child.pid), 'utf8');
      } catch {}
      child.on('exit', (code) => {
        try { fs.unlinkSync(pidFile); } catch {}
        process.exit(code ?? 0);
      });
    }
  },
});

const statusCmd = defineCommand({
  meta: { name: 'status', description: 'Report Tauri process alive (pid file) + vite port :1420 bound.' },
  args: {},
  run() {
    const repoRoot = findRepoRoot();

    // Tauri status via pid file
    const tauriPidFile = path.join(repoRoot, '.planning', '.desktop-tauri.pid');
    const tauriAlive = isTauriRunning(repoRoot);
    if (tauriAlive) {
      const pid = fs.existsSync(tauriPidFile) ? fs.readFileSync(tauriPidFile, 'utf8').trim() : '?';
      const logFile = path.join(repoRoot, '.planning', TAURI_LOG_NAME);
      console.log(`[gad desktop] tauri    : RUNNING  pid=${pid}  log=${logFile}`);
    } else {
      console.log(`[gad desktop] tauri    : not running. Launch with: gad desktop launch`);
    }

    // Vite / browser status via port
    if (isPortInUse(DEFAULT_PORT)) {
      const vitePidFile = path.join(repoRoot, '.planning', '.desktop-vite.pid');
      const viteLog = path.join(repoRoot, '.planning', VITE_LOG_NAME);
      const pid = fs.existsSync(vitePidFile) ? fs.readFileSync(vitePidFile, 'utf8').trim() : '?';
      console.log(`[gad desktop] vite     : RUNNING  :${DEFAULT_PORT}  pid=${pid}  log=${viteLog}`);
      console.log(`[gad desktop] open     : http://localhost:${DEFAULT_PORT}/kael`);
    } else {
      console.log(`[gad desktop] vite     : port :${DEFAULT_PORT} not bound. Launch with: gad desktop launch --browser`);
    }
  },
});

const stopCmd = defineCommand({
  meta: { name: 'stop', description: 'Kill Tauri process (pid file) + any process bound to vite port :1420.' },
  args: {},
  run() {
    const repoRoot = findRepoRoot();
    let stopped = false;

    // Stop Tauri via pid file
    const tauriPidFile = path.join(repoRoot, '.planning', '.desktop-tauri.pid');
    if (fs.existsSync(tauriPidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(tauriPidFile, 'utf8').trim(), 10);
        if (pid && !isNaN(pid)) {
          if (process.platform === 'win32') {
            try { execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' }); } catch {}
          } else {
            try { process.kill(pid, 'SIGTERM'); } catch {}
          }
          console.log(`[gad desktop] killed tauri pid=${pid}`);
          stopped = true;
        }
      } catch {}
      try { fs.unlinkSync(tauriPidFile); } catch {}
    }

    // Stop vite / browser via port
    try {
      if (process.platform === 'win32') {
        const out = execSync(`netstat -ano | findstr :${DEFAULT_PORT}`, { encoding: 'utf8' });
        const pids = new Set(
          out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p))
        );
        for (const pid of pids) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); console.log(`[gad desktop] killed vite pid=${pid}`); stopped = true; } catch {}
        }
      } else {
        execSync(`lsof -ti :${DEFAULT_PORT} | xargs -r kill -9`, { stdio: 'ignore' });
        stopped = true;
      }
    } catch {}

    // Clean up vite pid file
    const vitePidFile = path.join(repoRoot, '.planning', '.desktop-vite.pid');
    try { fs.unlinkSync(vitePidFile); } catch {}

    if (stopped) {
      console.log('[gad desktop] stopped.');
    } else {
      console.log('[gad desktop] no running desktop processes found.');
    }
  },
});

const desktopCmd = defineCommand({
  meta: {
    name: 'desktop',
    description: 'Launch / status / stop the apps/desktop Kael shell — no cd needed. Default: Tauri native window. Use --browser for vite-only.',
  },
  subCommands: {
    launch: launchCmd,
    status: statusCmd,
    stop:   stopCmd,
  },
});

module.exports = desktopCmd;
module.exports.register = () => ({ desktop: desktopCmd });
