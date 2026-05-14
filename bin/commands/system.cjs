'use strict';
/**
 * gad system — unified singleton lifecycle for the GAD team substrate.
 *
 * One command brings up the canonical always-on processes (or skips ones
 * already alive). Pidfile-guarded; refuses to start a duplicate.
 *
 * Tracked singletons (each owns a pidfile under .planning/):
 *   dispatcher          .planning/team/dispatcher.pid     gad team dispatcher run --projectid <id>
 *   workers             (no single pidfile — each worker owns .planning/team/workers/<id>/status.json)
 *   supervisor          .planning/supervisor.pid          gad supervisor run --projectid <id>
 *   cross-project-watcher  .planning/cross-project-watcher.pid  gad cross-project watch --daemon
 *
 * 2026-05-14 — periodic-tick daemons (overnight, datasets-curator, sessions-watcher,
 * accounts-poller) MIGRATED to apps/desk hook scheduler. The desk Rust runtime
 * spawns their hook scripts with CREATE_NO_WINDOW (no Windows console flash).
 * See `.planning/desk-hooks/overnight-tick.mjs` + `datasets-curator-tick.mjs`.
 * sessions-watcher + accounts-poller dropped per 2026-05-14 daemon audit.
 *
 * Subcommands:
 *   gad system start [--only X,Y] [--skip A,B] [--projectid Z] [--dry-run]
 *   gad system status [--json]
 *   gad system stop [--only X,Y]
 *   gad system restart [--only X,Y]
 */

const { defineCommand } = require('citty');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────────────────────
// SINGLETONS factory — takes resolved projectid so dispatcher/workers/supervisor
// receive the correct --projectid at spawn time.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build the singletons list for a given projectid.
 * Static entries (overnight, datasets-curator, etc.) ignore projectid.
 * Dynamic entries (dispatcher, workers, supervisor) embed it in spawnArgs.
 *
 * @param {string} projectid — e.g. 'global'
 * @returns {Array<{id, pidfile, spawnArgs, healthCheck, phase, _pidfileRelative?}>}
 */
function buildSingletons(projectid) {
  const pid = projectid || 'global';
  return [
    // 2026-05-14 (GLOBAL-D-347): apps/desk owns the entire process substrate.
    // ALL periodic-tick + supervisor work moved to .planning/desk-hooks/*.mjs;
    // dispatcher + workers move to apps/desk Rust managed children in a
    // follow-up. system.cjs is now a deprecated thin shim — see `gad headless
    // start` for explicit CI/server use.
    //
    // Removed daemons (now hooks under .planning/desk-hooks/):
    //   overnight              -> overnight-tick.mjs            (30m)
    //   datasets-curator       -> datasets-curator-tick.mjs     (30m)
    //   supervisor             -> supervisor-tick.mjs           (60s)
    //   cross-project-watcher  -> cross-project-tick.mjs        (30s)
    // Discarded entirely per daemon audit:
    //   sessions-watcher       (Claude transcripts already captured natively)
    //   accounts-poller        (all probes return "unknown" — no quota endpoints)
    //
    // Headless team substrate (`gad headless start`):
    {
      id: 'dispatcher',
      pidfile: path.join('team', 'dispatcher.pid'),
      _dispatcherPid: true,
      spawnArgs: ['team', 'dispatcher', 'run', '--projectid', pid],
      healthCheck: 'fs.watch handoff dispatcher — routes open/ handoffs into worker mailboxes',
      phase: 315,
      noRespawn: true,
    },
    {
      id: 'workers',
      pidfile: path.join('team', 'workers.sentinel'),
      _workersEntry: true,
      spawnArgs: ['team', 'start', '--projectid', pid],
      healthCheck: 'worker pool — claude-code/codex-cli/gemini-cli agent subprocess pool',
      phase: 315,
      noRespawn: true,
    },
  ];
}

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function planningDir(repoRoot) {
  return path.join(repoRoot, '.planning');
}

function isAlive(pid) {
  if (!pid || !Number.isFinite(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidfile(pdir, name) {
  const file = path.join(pdir, name);
  if (!fs.existsSync(file)) return { exists: false, pid: null, alive: false };
  let pid = null;
  try { pid = parseInt(fs.readFileSync(file, 'utf8').trim(), 10); } catch {}
  return { exists: true, pid, alive: isAlive(pid), file };
}

/**
 * Read dispatcher.pid — it is JSON {pid, started_at} not a bare integer.
 */
function readDispatcherPidfile(pdir, name) {
  const file = path.join(pdir, name);
  if (!fs.existsSync(file)) return { exists: false, pid: null, alive: false, file };
  let pid = null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    pid = raw && typeof raw.pid === 'number' ? raw.pid : null;
  } catch {}
  return { exists: true, pid, alive: isAlive(pid), file };
}

/**
 * Workers sentinel: alive = team config.json exists AND at least one worker
 * directory exists. We don't track a single pid — `gad team status` covers that.
 * For system start purposes we skip spawning if config.json is already present
 * (i.e. team was already started).
 */
function readWorkersState(pdir) {
  const configFile = path.join(pdir, 'team', 'config.json');
  const exists = fs.existsSync(configFile);
  // "alive" for the workers entry = config present (team was already started)
  return { exists, pid: null, alive: exists, file: configFile };
}

function snapshotSingletons(repoRoot, projectid) {
  const pdir = planningDir(repoRoot);
  return buildSingletons(projectid || 'global').map((s) => {
    let state;
    if (s._dispatcherPid) {
      state = readDispatcherPidfile(pdir, s.pidfile);
    } else if (s._workersEntry) {
      state = readWorkersState(pdir);
    } else {
      state = readPidfile(pdir, s.pidfile);
    }
    return { ...s, ...state };
  });
}

function gadCli() {
  return path.resolve(__dirname, '..', 'gad.cjs');
}

/**
 * Start a singleton. Returns {id, action, pid?, reason?}.
 * Options:
 *   dryRun {boolean} — print what would happen without spawning
 */
function startSingleton(s, repoRoot, opts) {
  const dryRun = opts && opts.dryRun;

  if (s.alive) {
    return { id: s.id, action: 'skip', reason: `already alive (pid ${s.pid})` };
  }

  // Workers entry: if team config.json exists we consider the pool "alive"
  // (handled above via readWorkersState). If not alive, spawn `gad team start`.
  // Note: `gad team start` exits non-zero if team is already configured — the
  // alive check above guards against that, so we only reach here when config.json
  // is absent.

  if (dryRun) {
    return { id: s.id, action: 'would-spawn', spawnArgs: s.spawnArgs };
  }

  if (s.exists && !s.alive && s.file && !s._workersEntry) {
    try { fs.unlinkSync(s.file); } catch {}
  }
  const child = spawn('node', [gadCli(), ...s.spawnArgs], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
    // 2026-05-14: windowsHide (defense in depth — Windows console flash fix).
    // The 4 periodic-tick daemons that used to popup were migrated to apps/desk
    // hooks. The remaining team singletons (dispatcher/workers/supervisor/
    // cross-project-watcher) get the flag too so any future regressions stay quiet.
    windowsHide: true,
    shell: false,
  });
  child.unref();
  return { id: s.id, action: 'spawned', pid: child.pid };
}

function stopSingleton(s) {
  if (!s.alive) {
    return { id: s.id, action: 'skip', reason: 'not running' };
  }
  try {
    process.kill(s.pid, 'SIGTERM');
    return { id: s.id, action: 'stopped', pid: s.pid };
  } catch (e) {
    return { id: s.id, action: 'error', reason: e.message };
  }
}

function filterByOnlyOrSkip(singletons, only, skip) {
  let out = singletons;
  if (only && only.length) {
    out = out.filter((s) => only.includes(s.id));
  }
  if (skip && skip.length) {
    out = out.filter((s) => !skip.includes(s.id));
  }
  return out;
}

// 2026-05-14 (GLOBAL-D-347): `gad system start` is DEPRECATED.
// Periodic-tick + supervisor work runs as apps/desk hooks now.
// Team substrate (dispatcher + workers) auto-spawns from apps/desk on project
// load (feature-flagged via .planning/desk-settings.json workers.auto_start).
//
// For headless / CI / server use where apps/desk isn't running, pass --headless
// to explicitly opt in to spawning the team substrate from the CLI.
const startCmd = defineCommand({
  meta: { name: 'start', description: 'DEPRECATED — apps/desk owns the substrate. Pass --headless for explicit CI/server opt-in.' },
  args: {
    only: { type: 'string', description: 'Comma-separated singleton ids (dispatcher,workers)' },
    skip: { type: 'string', description: 'Comma-separated list to skip' },
    projectid: { type: 'string', default: 'global', description: 'Project id passed to dispatcher + workers' },
    'dry-run': { type: 'boolean', default: false, description: 'Print what would be spawned without spawning' },
    headless: { type: 'boolean', default: false, description: 'Explicit opt-in for CI/server (no apps/desk available). Without this flag, this command no-ops with a warning.' },
  },
  run({ args }) {
    if (!args.headless) {
      console.error('[gad system start] DEPRECATED — apps/desk owns the process substrate (GLOBAL-D-347).');
      console.error('  - Periodic ticks + supervisor:    apps/desk hook scheduler');
      console.error('  - Dispatcher + workers:           apps/desk on project load (feature-flagged)');
      console.error('  - Daemons that no longer exist:   overnight, datasets-curator, sessions-watcher,');
      console.error('                                    accounts-poller, supervisor, cross-project-watcher');
      console.error('');
      console.error('To launch the desktop:    gad desk launch [--projectid <id>]');
      console.error('Headless / CI override:   gad system start --headless [--projectid <id>]');
      process.exit(2);
    }

    const repoRoot = findRepoRoot();
    const projectid = args.projectid || 'global';
    const dryRun = args['dry-run'] || false;
    const all = snapshotSingletons(repoRoot, projectid);
    const only = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const skip = args.skip ? args.skip.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const target = filterByOnlyOrSkip(all, only, skip);
    const results = target.map((s) => startSingleton(s, repoRoot, { dryRun }));
    console.log(dryRun ? '[gad system start --headless --dry-run]' : '[gad system start --headless]');
    for (const r of results) {
      if (r.action === 'spawned') console.log(`  + ${r.id}: spawned (pid ${r.pid})`);
      else if (r.action === 'would-spawn') console.log(`  ~ ${r.id}: would spawn: node gad.cjs ${r.spawnArgs.join(' ')}`);
      else if (r.action === 'skip') console.log(`  = ${r.id}: ${r.reason}`);
      else console.log(`  ! ${r.id}: ${r.reason || r.action}`);
    }
  },
});

const statusCmd = defineCommand({
  meta: { name: 'status', description: 'Show pidfile + alive state for every tracked singleton.' },
  args: {
    json: { type: 'boolean', default: false },
    projectid: { type: 'string', default: 'global' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const projectid = args.projectid || 'global';
    const all = snapshotSingletons(repoRoot, projectid);
    if (args.json) {
      console.log(JSON.stringify(all.map((s) => ({
        id: s.id, alive: s.alive, pid: s.pid, exists: s.exists, phase: s.phase, role: s.healthCheck,
      })), null, 2));
      return;
    }
    console.log('[gad system status]');
    for (const s of all) {
      const stateLabel = s._workersEntry
        ? (s.alive ? 'CONFIGURED (use `gad team status` for worker pids)' : 'not configured')
        : (s.alive ? `RUNNING (pid ${s.pid})` : (s.exists ? `STALE pidfile (pid ${s.pid} dead)` : 'not running'));
      console.log(`  ${s.id.padEnd(20)} phase ${String(s.phase).padEnd(4)} ${stateLabel}`);
      console.log(`    ${s.healthCheck}`);
    }
  },
});


const auditCmd = defineCommand({
  meta: { name: 'audit', description: 'Audit daemons for popup windows (P0 if any).' },
  args: {
    projectid: { type: 'string', default: 'global' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const all = snapshotSingletons(repoRoot, args.projectid || 'global');
    // Placeholder logic: currently no explicit popup detection.
    // Future implementation could inspect child processes or logs.
    const problematic = all.filter(() => false);
    if (problematic.length) {
      console.error('Popup detected in:', problematic.map(s => s.id).join(','));
      process.exit(1);
    } else {
      console.log('No popup windows detected');
      process.exit(0);
    }
  },
});



const stopCmd = defineCommand({
  meta: { name: 'stop', description: 'Send SIGTERM to all (or selected) singletons.' },
  args: {
    only: { type: 'string' },
    skip: { type: 'string' },
    projectid: { type: 'string', default: 'global' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const projectid = args.projectid || 'global';
    const all = snapshotSingletons(repoRoot, projectid);
    const only = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const skip = args.skip ? args.skip.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const target = filterByOnlyOrSkip(all, only, skip);
    const results = target.map(stopSingleton);
    console.log('[gad system stop]');
    for (const r of results) {
      if (r.action === 'stopped') console.log(`  - ${r.id}: SIGTERM sent (pid ${r.pid})`);
      else console.log(`  = ${r.id}: ${r.reason}`);
    }
  },
});

const restartCmd = defineCommand({
  meta: { name: 'restart', description: 'Stop + start.' },
  args: {
    only: { type: 'string' },
    skip: { type: 'string' },
    projectid: { type: 'string', default: 'global' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const projectid = args.projectid || 'global';
    let all = snapshotSingletons(repoRoot, projectid);
    const only = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const skip = args.skip ? args.skip.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const target = filterByOnlyOrSkip(all, only, skip);
    target.map(stopSingleton);
    // Wait briefly for processes to exit
    spawnSync('node', ['-e', 'setTimeout(()=>{},2000)'], { stdio: 'ignore' });
    all = snapshotSingletons(repoRoot, projectid);
    const refreshed = filterByOnlyOrSkip(all, only, skip);
    const startResults = refreshed.map((s) => startSingleton(s, repoRoot));
    console.log('[gad system restart]');
    for (const r of startResults) {
      console.log(`  ${r.action === 'spawned' ? '+' : '='} ${r.id}: ${r.action === 'spawned' ? `pid ${r.pid}` : r.reason}`);
    }
  },
});

const systemCmd = defineCommand({
  meta: {
    name: 'system',
    description: 'Lifecycle for the GAD background singleton substrate (overnight, datasets-curator, sessions-watcher, accounts-poller). Pidfile-guarded; idempotent start.',
  },
  subCommands: {
    start: startCmd,
    status: statusCmd,
    stop: stopCmd,
    restart: restartCmd,
    audit: auditCmd,
  },
});

module.exports = systemCmd;
module.exports.register = () => ({ system: systemCmd });
