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
      windowsHide: true,
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
      windowsHide: true,
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
    windowed:  { type: 'boolean', description: 'Windows only: spawn Windows Terminal (wt.exe) with vertical-split panes — left runs the dev server, right tails kael/tauri/curator/w1 logs. Operator-owned lifecycle (Ctrl+C in either pane).', default: false },
    'dry-run': { type: 'boolean', description: 'Print what would be spawned without actually spawning', default: false },
    // Legacy --tauri kept for back-compat but now is a no-op (Tauri is default)
    tauri:     { type: 'boolean', description: '[deprecated] Kept for back-compat. Tauri is now the default.', default: false },
  },
  run({ args }) {
    const dryRun = args['dry-run'];
    const browserMode = !!args.browser;
    const windowedMode = !!args.windowed;
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
      console.log(`  windowed: ${windowedMode}`);
      console.log(`  VITE_ANTHROPIC_API_KEY: ${env.VITE_ANTHROPIC_API_KEY ? '*** (set)' : '(not set)'}`);
      return;
    }

    // ── Windowed mode (Windows only): spawn wt.exe with split panes ──────────
    // Operator UX 2026-05-09: "i need a way for this to reload and i see the
    // fucking logs ... in another terminal with all processes running
    // concurrently or broken up between different terminals. ... i will use a
    // gad cli command to run the desktop in dev mode if we have it accessible
    // somehow."
    //
    // Pane left  : pnpm --filter @gad/desktop dev    (or dev:vite if --browser)
    // Pane right : pnpm --filter @gad/desktop logs:all
    //
    // Operator owns lifecycle (Ctrl+C in either pane stops that pane cleanly).
    // Falls back to printed instructions if wt.exe is missing.
    if (windowedMode) {
      if (process.platform !== 'win32') {
        console.error('[gad desktop] --windowed is Windows-only (uses wt.exe / Windows Terminal).');
        console.error('[gad desktop] On macOS/Linux, run two terminals manually:');
        console.error(`  pane 1: pnpm --filter @gad/desktop ${browserMode ? 'dev:vite' : 'dev'}`);
        console.error('  pane 2: pnpm --filter @gad/desktop logs:all');
        process.exit(1);
      }
      // Probe wt.exe availability.
      const wtProbe = spawnSync('wt.exe', ['-h'], { stdio: 'ignore', windowsHide: true });
      if (wtProbe.status !== 0 && wtProbe.status !== 1) {
        console.error('[gad desktop] Windows Terminal (wt.exe) not found on PATH.');
        console.error('[gad desktop] Install: https://aka.ms/terminal');
        console.error('[gad desktop] OR run manually in two terminals:');
        console.error(`  pane 1: pnpm --filter @gad/desktop ${browserMode ? 'dev:vite' : 'dev'}`);
        console.error('  pane 2: pnpm --filter @gad/desktop logs:all');
        process.exit(1);
      }
      const devScript = browserMode ? 'dev:vite' : 'dev';
      // 2026-05-09 fix: wt CLI does NOT do PATH search for the command, so
      // `cmd` (not `cmd.exe`) returns 0x80070002 ENOENT. Also `pnpm` on
      // Windows is `pnpm.cmd` (batch file) — invoking just `pnpm` from a
      // non-shell context fails with the same code. Resolution: invoke
      // `pnpm.cmd` directly, no shell wrapper.
      const wtArgs = [
        '-w', '0',
        '-d', repoRoot,
        'new-tab',
        '--title', 'kael-dev',
        'pnpm.cmd', '--filter', '@gad/desktop', devScript,
        ';',
        'split-pane',
        '--vertical',
        '--size', '0.5',
        '--title', 'kael-logs',
        'pnpm.cmd', '--filter', '@gad/desktop', 'logs:all',
      ];
      console.log(`[gad desktop] spawning Windows Terminal with kael-dev + kael-logs panes…`);
      console.log(`[gad desktop] mode     : ${modeLabel}`);
      console.log(`[gad desktop] cwd      : ${repoRoot}`);
      const wtChild = spawn('wt.exe', wtArgs, {
        stdio: 'inherit',
        windowsHide: false,
        detached: true,
        env,
      });
      wtChild.unref();
      console.log('[gad desktop] new Windows Terminal window opened. Operator owns Ctrl+C in either pane.');
      process.exit(0);
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
      windowsHide: true,
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
