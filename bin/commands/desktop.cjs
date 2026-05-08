'use strict';
/**
 * gad desktop — launch the apps/desktop Kael shell from anywhere.
 *
 * Reads BYOK ANTHROPIC_API_KEY for the active project, injects it into the
 * spawned process env as VITE_ANTHROPIC_API_KEY (Vite's env-prefix rule),
 * spawns `pnpm --filter @gad/desktop dev:vite` (or `tauri dev` with --tauri)
 * from the monorepo root.
 *
 * No more "cd apps/desktop" — operator just runs `gad desktop launch`.
 *
 * Subcommands:
 *   gad desktop launch [--projectid X] [--tauri] [--mode dev|build]
 *   gad desktop status                  — is dev server running on the port
 *   gad desktop stop                    — kill any process holding the port
 */

const { defineCommand } = require('citty');
const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 1420;

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

// Best-effort BYOK fetch. Calls `gad env get <key> --projectid <id>` which
// exits 1 if missing — we treat missing as "not set" and continue without
// it (the desktop still starts; chat will just show a banner).
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
  // ANTHROPIC_API_KEY → VITE_ANTHROPIC_API_KEY (Vite needs the VITE_ prefix
  // to expose env vars to the renderer). If already set on the parent, keep
  // the parent's value (operator override wins). Else pull from BYOK.
  if (!env.VITE_ANTHROPIC_API_KEY) {
    const byok = tryGetByok('ANTHROPIC_API_KEY', projectId)
              || env.ANTHROPIC_API_KEY
              || tryGetByok('VITE_ANTHROPIC_API_KEY', projectId);
    if (byok) {
      env.VITE_ANTHROPIC_API_KEY = byok;
    }
  }
  // SLM proxy URL passthrough (phase 171). If operator wants Kael to route
  // via the platform's /api/llm/chat instead of direct anthropic, set this.
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

const launchCmd = defineCommand({
  meta: { name: 'launch', description: 'Launch apps/desktop Kael shell. Auto-injects BYOK ANTHROPIC_API_KEY as VITE_ANTHROPIC_API_KEY. Spawns from anywhere — no cd required.' },
  args: {
    projectid: { type: 'string', description: 'Project for BYOK secrets', default: 'global' },
    tauri: { type: 'boolean', description: 'Spawn full Tauri dev (slower, native window). Default: vite dev only (faster, browser).', default: false },
    mode: { type: 'string', description: 'dev|build', default: 'dev' },
    detach: { type: 'boolean', description: 'Fork into background (vite-only)', default: false },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const desktopDir = path.join(repoRoot, 'apps', 'desktop');
    if (!fs.existsSync(desktopDir)) {
      console.error(`apps/desktop not found at ${desktopDir}. Are you in a gad monorepo?`);
      process.exit(1);
    }

    const env = buildEnv(args.projectid);
    if (!env.VITE_ANTHROPIC_API_KEY) {
      console.warn('[gad desktop] WARN: VITE_ANTHROPIC_API_KEY not set. Capture via: gad env set ANTHROPIC_API_KEY --projectid ' + args.projectid);
      console.warn('[gad desktop] Kael chat will show a banner until the key is set.');
    } else {
      console.log('[gad desktop] BYOK ANTHROPIC_API_KEY injected into spawned env (VITE_ prefix).');
    }

    if (isPortInUse(DEFAULT_PORT)) {
      console.warn(`[gad desktop] WARN: port ${DEFAULT_PORT} already in use. Stop the existing dev server first: gad desktop stop`);
    }

    const cmdName = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
    const cmdArgs = args.tauri
      ? ['--filter', '@gad/desktop', 'tauri', args.mode]
      : ['--filter', '@gad/desktop', args.mode === 'build' ? 'build:frontend' : 'dev:vite'];

    console.log(`[gad desktop] launching: ${cmdName} ${cmdArgs.join(' ')}`);
    console.log(`[gad desktop] cwd: ${repoRoot}`);
    if (args.tauri) console.log('[gad desktop] mode: tauri (native frameless window)');
    else console.log(`[gad desktop] mode: vite (open http://localhost:${DEFAULT_PORT}/kael in browser)`);

    const child = spawn(cmdName, cmdArgs, {
      cwd: repoRoot,
      env,
      stdio: args.detach ? 'ignore' : 'inherit',
      detached: args.detach,
      shell: process.platform === 'win32',
    });
    if (args.detach) {
      child.unref();
      console.log(`[gad desktop] detached. pid=${child.pid}. logs go to terminal output until reattached.`);
      process.exit(0);
    }
    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  },
});

const statusCmd = defineCommand({
  meta: { name: 'status', description: `Check if the desktop dev server is running on port ${DEFAULT_PORT}.` },
  args: {},
  run() {
    if (isPortInUse(DEFAULT_PORT)) {
      console.log(`[gad desktop] dev server: RUNNING on :${DEFAULT_PORT}`);
      console.log(`[gad desktop] open: http://localhost:${DEFAULT_PORT}/kael`);
    } else {
      console.log(`[gad desktop] dev server: not running. Launch with: gad desktop launch`);
    }
  },
});

const stopCmd = defineCommand({
  meta: { name: 'stop', description: `Kill any process bound to the desktop dev port (${DEFAULT_PORT}).` },
  args: {},
  run() {
    try {
      if (process.platform === 'win32') {
        const out = execSync(`netstat -ano | findstr :${DEFAULT_PORT}`, { encoding: 'utf8' });
        const pids = new Set(
          out.split(/\r?\n/).map((l) => l.trim().split(/\s+/).pop()).filter((p) => /^\d+$/.test(p))
        );
        for (const pid of pids) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); console.log(`Killed pid ${pid}`); } catch {}
        }
      } else {
        execSync(`lsof -ti :${DEFAULT_PORT} | xargs -r kill -9`, { stdio: 'ignore' });
      }
      console.log('[gad desktop] stopped.');
    } catch (e) {
      console.log('[gad desktop] no running dev server.');
    }
  },
});

const desktopCmd = defineCommand({
  meta: {
    name: 'desktop',
    description: 'Launch / status / stop the apps/desktop Kael shell — no cd needed. Auto-injects BYOK ANTHROPIC_API_KEY.',
  },
  subCommands: {
    launch: launchCmd,
    status: statusCmd,
    stop: stopCmd,
  },
});

module.exports = desktopCmd;
module.exports.register = () => ({ desktop: desktopCmd });
