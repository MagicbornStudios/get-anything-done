'use strict';
/**
 * gad dev — daily companion launcher.
 *
 * Opens Kael (the operator's internal Tauri shell) and optionally the
 * consumer-facing surfaces (web, platform) based on detected cwd context.
 *
 * Context detection (checked in order):
 *   monorepo — has both apps/desktop AND apps/platform present
 *   desktop  — cwd IS apps/desktop (or has package.json name @gad/desktop)
 *   unrelated gad project — has .planning/ but no apps/desktop
 *
 * Resolution:
 *   monorepo   → tauri-dev for kael (via gad desktop launch) + browser for
 *                consumer-web (:1420 vite) + platform (:3002)
 *   desktop    → tauri-dev for kael only
 *   unrelated  → global Kael build if found; error otherwise
 *
 * Configuration (gad-config.toml):
 *   [[dev.surfaces]]
 *   name        = "consumer-web"
 *   mode        = "browser"
 *   url         = "http://localhost:1420"
 *   command     = "pnpm --filter @gad/desktop dev:vite"
 *   description = "Consumer web/desktop preview"
 *
 *   [[dev.surfaces]]
 *   name        = "platform"
 *   mode        = "browser"
 *   url         = "http://localhost:3002"
 *   command     = "pnpm --filter @gad/platform dev"
 *   description = "Consumer platform/landing"
 *
 * Settings keys (registered in settings-registry.cjs):
 *   dev.kael.auto_launch.enabled         (boolean, default true, scope: user)
 *   dev.consumer_web.auto_open_browser   (boolean, default true, scope: user)
 *   dev.surfaces.parallel_launch         (boolean, default true, scope: project)
 *
 * Subcommands:
 *   gad dev          — launch (default)
 *   gad dev watch    — watch .planning/ and re-run refs verify (legacy behaviour)
 *
 * Options for launch:
 *   --projectid <id>       forwarded for BYOK resolution
 *   --no-kael              skip Kael launch
 *   --kael-only            only launch Kael, skip other surfaces
 *   --mode <auto|dev|build> override kael launch mode (default auto)
 *   --surfaces <csv>       override surface list (comma-separated names)
 *   --dry-run              print resolution as SITREP table, no spawn
 *   --json                 print resolution as JSON and exit (implies --dry-run)
 */

const { defineCommand } = require('citty');
const { spawn, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk up from cwd to find the monorepo root (contains pnpm-workspace.yaml). */
function findMonorepoRoot(from) {
  let dir = from;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Detect cwd context.
 * Returns one of: 'monorepo' | 'desktop' | 'gad-project' | 'unknown'
 */
function detectContext(cwd) {
  // Is cwd itself apps/desktop?
  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name === '@gad/desktop') return 'desktop';
    } catch {}
  }

  // Is this a monorepo root?
  const hasDesktop  = fs.existsSync(path.join(cwd, 'apps', 'desktop'));
  const hasPlatform = fs.existsSync(path.join(cwd, 'apps', 'platform'));
  if (hasDesktop && hasPlatform) return 'monorepo';
  if (hasDesktop) return 'monorepo'; // partial monorepo still resolves to tauri-dev

  // Unrelated gad project?
  if (fs.existsSync(path.join(cwd, '.planning'))) return 'gad-project';

  return 'unknown';
}

/** Resolve global Kael exe. Returns path string or null. */
function findGlobalKaelBuild() {
  const candidates = [];
  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Kael', 'Kael.exe'));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'gad-desktop', 'gad-desktop.exe'));
    candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'GAD Desktop', 'GAD Desktop.exe'));
  }
  const home = os.homedir();
  candidates.push(path.join(home, 'Applications', 'Kael.app', 'Contents', 'MacOS', 'Kael'));
  candidates.push('/usr/local/bin/kael');
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/** Open URL in the system default browser (no-throw). */
function openBrowser(url) {
  try {
    const cmd = process.platform === 'win32' ? 'start'
      : process.platform === 'darwin' ? 'open'
      : 'xdg-open';
    if (process.platform === 'win32') {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    } else {
      spawn(cmd, [url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  } catch {}
}

/**
 * Read [[dev.surfaces]] array from gad-config.toml (minimal parser — handles
 * TOML array-of-tables). Returns array of surface objects or null if absent.
 */
function readDevSurfaces(repoRoot) {
  const tomlPath = path.join(repoRoot, 'gad-config.toml');
  if (!fs.existsSync(tomlPath)) return null;
  let text;
  try { text = fs.readFileSync(tomlPath, 'utf8'); } catch { return null; }

  const surfaces = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '[[dev.surfaces]]') {
      if (current) surfaces.push(current);
      current = {};
      continue;
    }
    if (line.startsWith('[[') && current) {
      // Entering a different array-of-tables block — finalize current
      surfaces.push(current);
      current = null;
    }
    if (!current) continue;
    const eq = line.indexOf('=');
    if (eq === -1 || line.startsWith('#')) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    current[k] = v;
  }
  if (current) surfaces.push(current);
  return surfaces.length ? surfaces : null;
}

/** Default surfaces for a full monorepo context. */
function defaultMonorepoSurfaces(repoRoot) {
  return [
    {
      name: 'consumer-web',
      mode: 'browser',
      url: 'http://localhost:1420',
      command: `pnpm --filter @gad/desktop dev:vite`,
      description: 'Consumer web/desktop preview',
      _pkg: path.join(repoRoot, 'apps', 'desktop', 'package.json'),
    },
    {
      name: 'platform',
      mode: 'browser',
      url: 'http://localhost:3002',
      command: `pnpm --filter @gad/platform dev`,
      description: 'Consumer platform/landing',
      _pkg: path.join(repoRoot, 'apps', 'platform', 'package.json'),
    },
  ];
}

/** Ensure .planning/.dev-launch/ dir exists. */
function ensureDevLaunchDir(repoRoot) {
  const d = path.join(repoRoot, '.planning', '.dev-launch');
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

/**
 * Spawn a surface as a detached background process.
 * Returns { pid, logFile } or null on error.
 */
function spawnSurface(surface, repoRoot, envExtra) {
  const launchDir = ensureDevLaunchDir(repoRoot);
  const logFile = path.join(launchDir, `${surface.name}.log`);
  let outFd, errFd;
  try {
    outFd = fs.openSync(logFile, 'a');
    errFd = fs.openSync(logFile, 'a');
  } catch (e) {
    console.error(`[gad dev] warn: could not open log file ${logFile}: ${e.message}`);
    outFd = 'ignore';
    errFd = 'ignore';
  }

  const isWindows = process.platform === 'win32';
  const parts = surface.command.trim().split(/\s+/);
  let cmd = parts[0];
  const args = parts.slice(1);

  // On Windows, pnpm must be invoked as pnpm.cmd
  if (isWindows && cmd === 'pnpm') cmd = 'pnpm.cmd';

  const env = { ...process.env, ...envExtra };

  try {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env,
      stdio: ['ignore', outFd, errFd],
      detached: true,
      shell: isWindows,
      windowsHide: true,
    });
    if (typeof outFd === 'number') try { fs.closeSync(outFd); } catch {}
    if (typeof errFd === 'number' && errFd !== outFd) try { fs.closeSync(errFd); } catch {}
    child.unref();
    return { pid: child.pid, logFile };
  } catch (e) {
    if (typeof outFd === 'number') try { fs.closeSync(outFd); } catch {}
    if (typeof errFd === 'number' && errFd !== outFd) try { fs.closeSync(errFd); } catch {}
    console.error(`[gad dev] error spawning ${surface.name}: ${e.message}`);
    return null;
  }
}

/** Best-effort BYOK API key fetch from gad env store. */
function tryGetByok(gadBin, keyName, projectId) {
  try {
    const r = spawnSync(process.execPath, [gadBin, 'env', 'get', keyName, '--projectid', projectId], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5000,
      windowsHide: true,
    });
    if (r.status === 0) return (r.stdout || '').trim() || null;
  } catch {}
  return null;
}

// ---------------------------------------------------------------------------
// Launch command (the default `gad dev` behaviour)
// ---------------------------------------------------------------------------

const launchCmd = defineCommand({
  meta: {
    name: 'launch',
    description:
      'Launch Kael daily companion. Detects monorepo/desktop/project context and opens the right surfaces.',
  },
  args: {
    projectid:  { type: 'string',  description: 'Project for BYOK resolution', default: 'global' },
    'no-kael':  { type: 'boolean', description: 'Skip Kael launch', default: false },
    'kael-only':{ type: 'boolean', description: 'Only launch Kael, skip other surfaces', default: false },
    mode:       { type: 'string',  description: 'Kael launch mode: auto | dev | build', default: 'auto' },
    surfaces:   { type: 'string',  description: 'Override surfaces list (csv of names)', default: '' },
    'dry-run':  { type: 'boolean', description: 'Print resolution, no spawn', default: false },
    json:       { type: 'boolean', description: 'Print resolution as JSON (implies --dry-run)', default: false },
  },
  run({ args }) {
    const cwd     = process.cwd();
    const dryRun  = args['dry-run'] || args.json;
    const kaelOnly = args['kael-only'];
    const noKael  = args['no-kael'];
    const projectId = args.projectid || 'global';

    // --- Context detection ---
    const context = detectContext(cwd);
    let repoRoot = cwd;
    if (context === 'monorepo') {
      repoRoot = cwd;
    } else if (context === 'desktop') {
      repoRoot = findMonorepoRoot(cwd) || cwd;
    } else {
      const found = findMonorepoRoot(cwd);
      repoRoot = found || cwd;
    }

    // --- Resolve Kael launch path ---
    let kaelMode = args.mode || 'auto';
    let kaelResolution = null;
    const gadBin = path.resolve(__dirname, '..', 'gad.cjs');

    if (!noKael) {
      if (kaelMode === 'auto') {
        if (context === 'monorepo' || context === 'desktop') {
          kaelMode = 'tauri-dev';
        } else {
          kaelMode = 'global-build';
        }
      }

      if (kaelMode === 'build' || (kaelMode === 'global-build' && context !== 'monorepo' && context !== 'desktop')) {
        const globalExe = findGlobalKaelBuild();
        if (!globalExe) {
          const msg =
            'No Kael build found. Global search found no Kael.exe / Kael.app.\n' +
            'Options:\n' +
            '  1. Run from monorepo root to use tauri dev: cd /path/to/monorepo && gad dev\n' +
            '  2. Build + install Kael globally: cd apps/desktop && pnpm build\n' +
            '  3. Use browser mode: gad desktop launch --browser\n';
          if (args.json) {
            console.log(JSON.stringify({ error: 'no-kael-build', detail: msg.trim() }, null, 2));
          } else {
            console.error('[gad dev] ERROR: ' + msg);
          }
          if (!dryRun) process.exit(1);
          return;
        }
        kaelResolution = {
          name: 'kael-internal',
          mode: 'global-build',
          exe: globalExe,
          command: globalExe,
          description: 'Kael global build (operator internal)',
          envExtra: { GAD_PROJECT_ROOT: repoRoot },
        };
      } else {
        // tauri-dev (default for monorepo/desktop)
        kaelResolution = {
          name: 'kael-internal',
          mode: 'tauri-dev',
          command: 'pnpm --filter @gad/desktop dev',
          devUrl: 'http://localhost:1420/kael',
          description: 'Kael internal Tauri dev shell',
          envExtra: {},
        };
      }
    }

    // --- Resolve other surfaces ---
    let otherSurfaces = [];
    if (!kaelOnly && (context === 'monorepo')) {
      // Read config overrides or fall back to defaults
      const configSurfaces = readDevSurfaces(repoRoot);
      let candidates = configSurfaces
        ? configSurfaces.filter(s => s.name !== 'kael-internal')
        : defaultMonorepoSurfaces(repoRoot);

      // Apply --surfaces filter
      if (args.surfaces) {
        const names = args.surfaces.split(',').map(s => s.trim()).filter(Boolean);
        candidates = candidates.filter(s => names.includes(s.name));
      }

      // Skip surfaces whose package doesn't exist in workspace
      otherSurfaces = candidates.filter(s => {
        if (s._pkg) return fs.existsSync(s._pkg);
        // For config-supplied surfaces, just trust the command
        return true;
      });
    }

    // --- BYOK env injection for Kael ---
    let kaelEnv = {};
    if (!dryRun && kaelResolution) {
      if (!process.env.VITE_ANTHROPIC_API_KEY) {
        const byok = tryGetByok(gadBin, 'ANTHROPIC_API_KEY', projectId)
                  || process.env.ANTHROPIC_API_KEY
                  || tryGetByok(gadBin, 'VITE_ANTHROPIC_API_KEY', projectId);
        if (byok) {
          kaelEnv.VITE_ANTHROPIC_API_KEY = byok;
        } else {
          console.warn('[gad dev] WARN: VITE_ANTHROPIC_API_KEY not set. Set via: gad env set ANTHROPIC_API_KEY --projectid ' + projectId);
        }
      }
    }
    if (kaelResolution) {
      kaelResolution.envExtra = { ...kaelResolution.envExtra, ...kaelEnv };
    }

    // --- Build full resolution object ---
    const resolution = {
      context,
      cwd,
      repoRoot,
      kael: kaelResolution,
      surfaces: otherSurfaces.map(s => ({
        name: s.name,
        mode: s.mode || 'browser',
        command: s.command,
        url: s.url || null,
        description: s.description || '',
      })),
    };

    // --- JSON / dry-run output ---
    if (args.json) {
      console.log(JSON.stringify(resolution, null, 2));
      return;
    }

    if (dryRun) {
      console.log('[gad dev] DRY-RUN — resolution SITREP');
      console.log('');
      console.log(`  context   : ${context}`);
      console.log(`  repoRoot  : ${repoRoot}`);
      console.log('');
      if (kaelResolution) {
        console.log(`  KAEL`);
        console.log(`    mode    : ${kaelResolution.mode}`);
        console.log(`    command : ${kaelResolution.command}`);
        if (kaelResolution.devUrl) console.log(`    url     : ${kaelResolution.devUrl}`);
      } else {
        console.log('  KAEL: skipped (--no-kael)');
      }
      for (const s of otherSurfaces) {
        console.log('');
        console.log(`  SURFACE: ${s.name}`);
        console.log(`    mode    : ${s.mode || 'browser'}`);
        console.log(`    command : ${s.command}`);
        if (s.url) console.log(`    url     : ${s.url}`);
      }
      if (!kaelResolution && otherSurfaces.length === 0) {
        console.log('  (nothing to launch)');
      }
      return;
    }

    // --- State tracking ---
    const launchDir = ensureDevLaunchDir(repoRoot);
    const state = { launched_at: new Date().toISOString(), pid_per_surface: {}, mode_per_surface: {} };

    // --- Spawn Kael ---
    if (kaelResolution) {
      console.log(`[gad dev] launching kael (${kaelResolution.mode}) ...`);
      console.log(`[gad dev]   command: ${kaelResolution.command}`);

      if (kaelResolution.mode === 'global-build') {
        const child = spawn(kaelResolution.exe, [], {
          cwd: repoRoot,
          env: { ...process.env, ...kaelResolution.envExtra },
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        });
        child.unref();
        state.pid_per_surface['kael-internal'] = child.pid;
        state.mode_per_surface['kael-internal'] = 'global-build';
        console.log(`[gad dev]   kael pid=${child.pid}`);
      } else {
        // tauri-dev — route through gad desktop launch for consistent BYOK + log handling
        const gadArgs = ['desktop', 'launch', '--projectid', projectId, '--detach'];
        const r = spawnSync(process.execPath, [gadBin, ...gadArgs], {
          cwd: repoRoot,
          env: { ...process.env, ...kaelResolution.envExtra },
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 15000,
          windowsHide: true,
        });
        if (r.stderr) process.stderr.write(r.stderr);
        if (r.stdout) process.stdout.write(r.stdout);
        state.mode_per_surface['kael-internal'] = 'tauri-dev';
        console.log(`[gad dev]   kael tauri-dev dispatched → .planning/.desktop-tauri.log`);
      }
    }

    // --- Spawn other surfaces ---
    for (const s of otherSurfaces) {
      console.log(`[gad dev] launching surface: ${s.name} ...`);
      console.log(`[gad dev]   command: ${s.command}`);
      const result = spawnSurface(s, repoRoot, {});
      if (result) {
        state.pid_per_surface[s.name] = result.pid;
        state.mode_per_surface[s.name] = s.mode || 'browser';
        console.log(`[gad dev]   ${s.name} pid=${result.pid}  log → ${result.logFile}`);
      }
    }

    // --- Write state ---
    try {
      fs.writeFileSync(path.join(launchDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');
    } catch {}

    // --- Open browser for consumer surfaces ---
    const autoOpenBrowser = process.env.GAD_DEV_NO_BROWSER !== '1';
    if (autoOpenBrowser) {
      for (const s of otherSurfaces) {
        if (s.url && (s.mode === 'browser' || !s.mode)) {
          console.log(`[gad dev] opening browser: ${s.url}`);
          openBrowser(s.url);
        }
      }
    }

    // --- Final SITREP ---
    const allSurfaces = [
      ...(kaelResolution ? [{ name: 'kael-internal', mode: kaelResolution.mode, url: kaelResolution.devUrl || null }] : []),
      ...otherSurfaces.map(s => ({ name: s.name, mode: s.mode || 'browser', url: s.url || null })),
    ];

    console.log('');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│  gad dev — surfaces launched                                    │');
    console.log('├──────────────────────┬──────────────┬──────────────────────────┤');
    console.log('│  surface             │  mode        │  url / pid               │');
    console.log('├──────────────────────┼──────────────┼──────────────────────────┤');
    for (const s of allSurfaces) {
      const pid = state.pid_per_surface[s.name];
      const loc = s.url || (pid ? `pid=${pid}` : '(dispatched)');
      const nm  = s.name.padEnd(20).slice(0, 20);
      const md  = (s.mode || '').padEnd(12).slice(0, 12);
      const lc  = loc.slice(0, 24);
      console.log(`│  ${nm}  │  ${md}  │  ${lc.padEnd(24)}  │`);
    }
    console.log('└──────────────────────┴──────────────┴──────────────────────────┘');
    console.log('');
    if (kaelResolution && kaelResolution.mode === 'tauri-dev') {
      console.log('[gad dev] Kael compiling — check .planning/.desktop-tauri.log for progress.');
      console.log('[gad dev] Kael window will open once Tauri build completes.');
    }
    console.log('[gad dev] state → .planning/.dev-launch/state.json');
  },
});

// ---------------------------------------------------------------------------
// Watch subcommand — legacy planning-file watcher (preserved from original dev.cjs)
// ---------------------------------------------------------------------------

const watchCmd = defineCommand({
  meta: { name: 'watch', description: 'Watch .planning/ files and re-run refs verify on changes (JSON output)' },
  args: {
    debounce:   { type: 'string',  description: 'Debounce interval in ms (default: 500)', default: '500' },
    poll:       { type: 'boolean', description: 'Use polling instead of fs.watch', default: false },
    once:       { type: 'boolean', description: 'Run verify once and exit (no watch)', default: false },
    projectid:  { type: 'string',  description: 'Scope to one project by id', default: '' },
  },
  run({ args }) {
    const { startWatch, runVerify } = require('../../lib/watch-planning.cjs');
    // findRepoRoot in watch-planning resolves from cwd — no factory dep needed here
    let baseDir = process.cwd();
    // Walk up to find a repo root with pnpm-workspace.yaml
    const found = (() => {
      let d = baseDir;
      while (d !== path.dirname(d)) {
        if (fs.existsSync(path.join(d, 'pnpm-workspace.yaml'))) return d;
        d = path.dirname(d);
      }
      return null;
    })();
    if (found) baseDir = found;
    const debounceMs = parseInt(args.debounce) || 500;

    if (args.once) {
      const result = runVerify(baseDir, 'once', (obj) => console.log(JSON.stringify(obj)));
      process.exit(result.ok ? 0 : 1);
      return;
    }

    console.error(`gad dev watch — watching .planning/ files (debounce: ${debounceMs}ms, mode: ${args.poll ? 'poll' : 'fs.watch'})`);
    console.error('Press Ctrl+C to stop.\n');

    const { stop } = startWatch(baseDir, { debounceMs, poll: args.poll });
    process.on('SIGINT', () => {
      stop();
      console.error('\ngad dev watch stopped.');
      process.exit(0);
    });
  },
});

// ---------------------------------------------------------------------------
// Root command
//
// Citty routes positional argv as subcommand names when `subCommands` is
// declared and a `run` callback is also provided — but `--projectid global`
// would make citty think "global" is a subcommand name. To avoid that, we
// inspect raw process.argv here and decide at registration time:
//   - argv contains "watch" after "dev" → expose only watchCmd (citty shows its --help)
//   - otherwise → use launchCmd directly as the "dev" command (no subCommands routing)
//
// The `gad dev watch` form is preserved via a sub-entry in subCommands that
// citty can route to when the word "watch" appears as the first positional.
// ---------------------------------------------------------------------------

function createDevCommand(_deps) {
  // Detect whether the caller is invoking `gad dev watch [...]`.
  // We look at raw process.argv so citty hasn't yet consumed the positional.
  const rawArgv = process.argv.slice(2); // everything after node + gad.cjs
  const devIdx = rawArgv.findIndex((a) => a === 'dev');
  const nextArg = devIdx >= 0 ? rawArgv[devIdx + 1] : undefined;
  const isWatchSubcommand = nextArg === 'watch';

  if (isWatchSubcommand) {
    // Return the watch command directly — citty will handle its args.
    return defineCommand({
      meta: {
        name: 'dev',
        description: 'Daily companion. Use `gad dev watch` for the planning-file watcher.',
      },
      subCommands: { watch: watchCmd },
    });
  }

  // Default: bare `gad dev [flags]` → launchCmd
  return defineCommand({
    meta: {
      name: 'dev',
      description:
        'Daily companion: launch Kael + consumer surfaces from any gad project directory. ' +
        'Detects monorepo / desktop / standalone-project context automatically. ' +
        'Subcommand: `gad dev watch` — legacy planning-file watcher.',
    },
    args: {
      projectid:   { type: 'string',  description: 'Project for BYOK resolution', default: 'global' },
      'no-kael':   { type: 'boolean', description: 'Skip Kael launch', default: false },
      'kael-only': { type: 'boolean', description: 'Only launch Kael, skip other surfaces', default: false },
      mode:        { type: 'string',  description: 'Kael launch mode: auto | dev | build', default: 'auto' },
      surfaces:    { type: 'string',  description: 'Override surfaces list (csv of names)', default: '' },
      'dry-run':   { type: 'boolean', description: 'Print resolution, no spawn', default: false },
      json:        { type: 'boolean', description: 'Print resolution as JSON (implies --dry-run)', default: false },
    },
    run({ args }) {
      launchCmd.run({ args });
    },
  });
}

module.exports = { createDevCommand };
module.exports.register = (ctx) => ({ dev: createDevCommand(ctx.common) });
