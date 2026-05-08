'use strict';
/**
 * gad system — unified singleton lifecycle for the GAD background substrate.
 *
 * One command brings up the canonical always-on processes (or skips ones
 * already alive). Pidfile-guarded; refuses to start a duplicate.
 *
 * Tracked singletons (each owns a pidfile under .planning/):
 *   mcp-server          .planning/mcp-server.pid     gad mcp serve
 *   overnight           .planning/overnight.pid       gad overnight start
 *   datasets-curator    .planning/datasets-curator.pid  gad datasets curate --daemon
 *   sessions-watcher    .planning/sessions-watcher.pid  gad sessions watch --daemon
 *   accounts-poller     .planning/accounts-poller.pid   gad accounts poll --daemon
 *
 * Subcommands:
 *   gad system start [--only X,Y] [--skip A,B] [--projectid Z]
 *   gad system status [--json]
 *   gad system stop [--only X,Y]
 *   gad system restart [--only X,Y]
 */

const { defineCommand } = require('citty');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SINGLETONS = [
  {
    id: 'overnight',
    pidfile: 'overnight.pid',
    spawnArgs: ['overnight', 'start', '--detach', '--tick-minutes', '30'],
    healthCheck: 'ambient curation + handoff sweep + provenance build',
    phase: 159,
  },
  {
    id: 'datasets-curator',
    pidfile: 'datasets-curator.pid',
    spawnArgs: ['datasets', 'curate', '--daemon', '--tick-minutes', '30'],
    healthCheck: 'real-time dataset curation (transcripts + traces -> labeled tuples)',
    phase: 170,
  },
  {
    id: 'sessions-watcher',
    pidfile: 'sessions-watcher.pid',
    spawnArgs: ['sessions', 'watch', '--daemon'],
    healthCheck: 'tails Claude Code transcripts -> session telemetry',
    phase: 89,
  },
  {
    id: 'accounts-poller',
    pidfile: 'accounts-poller.pid',
    spawnArgs: ['accounts', 'poll', '--daemon'],
    healthCheck: 'periodic per-account quota probes -> auto-flip rate-limit state',
    phase: 110,
  },
  // mcp-server is on-demand by Claude/Cursor MCP clients; we don't auto-start
  // it here unless --include-mcp. It runs over stdio when an MCP client connects.
];

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

function snapshotSingletons(repoRoot) {
  const pdir = planningDir(repoRoot);
  return SINGLETONS.map((s) => {
    const state = readPidfile(pdir, s.pidfile);
    return { ...s, ...state };
  });
}

function gadCli() {
  return path.resolve(__dirname, '..', 'gad.cjs');
}

function startSingleton(s, repoRoot) {
  if (s.alive) {
    return { id: s.id, action: 'skip', reason: `already alive (pid ${s.pid})` };
  }
  if (s.exists && !s.alive) {
    try { fs.unlinkSync(s.file); } catch {}
  }
  const child = spawn('node', [gadCli(), ...s.spawnArgs], {
    cwd: repoRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
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

const startCmd = defineCommand({
  meta: { name: 'start', description: 'Start all singleton background processes that are not already running. Idempotent.' },
  args: {
    only: { type: 'string', description: 'Comma-separated list of singletons to start (overnight,datasets-curator,sessions-watcher,accounts-poller)' },
    skip: { type: 'string', description: 'Comma-separated list to skip' },
    projectid: { type: 'string', default: 'global' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const all = snapshotSingletons(repoRoot);
    const only = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const skip = args.skip ? args.skip.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const target = filterByOnlyOrSkip(all, only, skip);
    const results = target.map((s) => startSingleton(s, repoRoot));
    console.log('[gad system start]');
    for (const r of results) {
      if (r.action === 'spawned') console.log(`  + ${r.id}: spawned (pid ${r.pid})`);
      else if (r.action === 'skip') console.log(`  = ${r.id}: ${r.reason}`);
      else console.log(`  ! ${r.id}: ${r.reason || r.action}`);
    }
  },
});

const statusCmd = defineCommand({
  meta: { name: 'status', description: 'Show pidfile + alive state for every tracked singleton.' },
  args: {
    json: { type: 'boolean', default: false },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const all = snapshotSingletons(repoRoot);
    if (args.json) {
      console.log(JSON.stringify(all.map((s) => ({
        id: s.id, alive: s.alive, pid: s.pid, exists: s.exists, phase: s.phase, role: s.healthCheck,
      })), null, 2));
      return;
    }
    console.log('[gad system status]');
    for (const s of all) {
      const stateLabel = s.alive ? `RUNNING (pid ${s.pid})` : (s.exists ? `STALE pidfile (pid ${s.pid} dead)` : 'not running');
      console.log(`  ${s.id.padEnd(20)} phase ${String(s.phase).padEnd(4)} ${stateLabel}`);
      console.log(`    ${s.healthCheck}`);
    }
  },
});

const stopCmd = defineCommand({
  meta: { name: 'stop', description: 'Send SIGTERM to all (or selected) singletons.' },
  args: {
    only: { type: 'string' },
    skip: { type: 'string' },
  },
  run({ args }) {
    const repoRoot = findRepoRoot();
    const all = snapshotSingletons(repoRoot);
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
    let all = snapshotSingletons(repoRoot);
    const only = args.only ? args.only.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const skip = args.skip ? args.skip.split(',').map((s) => s.trim()).filter(Boolean) : null;
    const target = filterByOnlyOrSkip(all, only, skip);
    target.map(stopSingleton);
    // Wait briefly for processes to exit
    spawnSync('node', ['-e', 'setTimeout(()=>{},2000)'], { stdio: 'ignore' });
    all = snapshotSingletons(repoRoot);
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
  },
});

module.exports = systemCmd;
module.exports.register = () => ({ system: systemCmd });
