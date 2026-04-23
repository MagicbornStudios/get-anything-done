'use strict';
/**
 * gad team dispatcher — control the persistent dispatcher daemon.
 * `dispatcher start` spawns a detached node subprocess running
 * lib/team/dispatcher.cjs::runDaemon. `stop` signals the pid. `status`
 * reports alive/dead. `run` is the internal entry the subprocess uses.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { defineCommand } = require('citty');
const { readConfig } = require('../../../lib/team/config.cjs');
const { dispatcherPidPath, dispatcherLogPath, readPid, clearPid, pidAlive, runDaemon } = require('../../../lib/team/dispatcher.cjs');
const { supervisorLog } = require('../../../lib/team/paths.cjs');
const { appendJsonl } = require('../../../lib/team/io.cjs');
const { pickNodeExecutable, resolveWorkerGadCli } = require('../../../lib/node-exec.cjs');

function createDispatcherCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, getLastActiveProjectid, outputError } = deps;

  function resolveTeamBaseDir(args) {
    const repoRoot = findRepoRoot();
    const config = gadConfig.load(repoRoot);
    const pidArg = args && args.projectid ? args.projectid : (getLastActiveProjectid ? getLastActiveProjectid() || '' : '');
    const roots = resolveRoots({ projectid: pidArg }, repoRoot, config.roots);
    const root = roots[0];
    if (!root) return repoRoot;
    return path.join(repoRoot, root.path);
  }

  const PROJECTID_ARG = { type: 'string', description: 'Target project id (resolves .planning/team/ path)', default: '' };

  const startCmd = defineCommand({
    meta: { name: 'start', description: 'Spawn a detached dispatcher daemon that watches .planning/handoffs/open/ and routes new handoffs into worker mailboxes.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      if (!readConfig(baseDir)) { outputError('No team configured. Run `gad team start` first.'); process.exit(1); }
      const current = readPid(baseDir);
      if (current && pidAlive(current.pid)) {
        console.log(`Dispatcher already running (pid=${current.pid}, started ${current.started_at}).`);
        return;
      }
      if (current) clearPid(baseDir); // stale

      const logFd = fs.openSync(dispatcherLogPath(baseDir), 'a');
      const gadBinary = path.resolve(__dirname, '..', '..', 'gad.cjs');
      const child = spawn(
        pickNodeExecutable(),
        [resolveWorkerGadCli(gadBinary, { cwd: baseDir }), 'team', 'dispatcher', 'run'],
        {
          cwd: baseDir,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          windowsHide: true,
          env: { ...process.env, GAD_TEAM_DISPATCHER: '1' },
        },
      );
      child.unref();
      fs.closeSync(logFd);
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'dispatcher-start', pid: child.pid });
      console.log(`Dispatcher started (pid=${child.pid}). Log: ${path.relative(baseDir, dispatcherLogPath(baseDir))}`);
    },
  });

  const stopCmd = defineCommand({
    meta: { name: 'stop', description: 'Signal the dispatcher daemon to exit.' },
    args: { projectid: PROJECTID_ARG },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const current = readPid(baseDir);
      if (!current) { console.log('Dispatcher not running (no pid file).'); return; }
      if (!pidAlive(current.pid)) {
        console.log(`Stale pid file (pid=${current.pid} not alive). Clearing.`);
        clearPid(baseDir);
        return;
      }
      try { process.kill(current.pid, 'SIGTERM'); }
      catch (err) { outputError(`Kill failed: ${err.message}`); process.exit(1); }
      appendJsonl(supervisorLog(baseDir), { ts: new Date().toISOString(), kind: 'dispatcher-stop', pid: current.pid });
      console.log(`Sent SIGTERM to dispatcher pid=${current.pid}.`);
    },
  });

  const statusCmd = defineCommand({
    meta: { name: 'status', description: 'Report whether the dispatcher daemon is alive.' },
    args: {
      projectid: PROJECTID_ARG,
      json: { type: 'boolean', default: false },
    },
    run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      const current = readPid(baseDir);
      const alive = current && pidAlive(current.pid);
      if (args.json) {
        console.log(JSON.stringify({ running: Boolean(alive), ...(current || {}) }, null, 2));
        return;
      }
      if (!current) { console.log('Dispatcher: not running (no pid file).'); return; }
      console.log(`Dispatcher: ${alive ? 'running' : 'STALE (pid file present, process dead)'}  pid=${current.pid}  started=${current.started_at}`);
      console.log(`Log: ${path.relative(baseDir, dispatcherLogPath(baseDir))}`);
    },
  });

  const runCmd = defineCommand({
    meta: { name: 'run', description: 'Internal: daemon loop entry. Invoked by `dispatcher start` as a detached subprocess.' },
    args: { projectid: PROJECTID_ARG },
    async run({ args }) {
      const baseDir = resolveTeamBaseDir(args);
      await runDaemon(baseDir);
    },
  });

  return defineCommand({
    meta: { name: 'dispatcher', description: 'Persistent handoff dispatcher daemon (fs.watch, sub-100ms pickup).' },
    subCommands: { start: startCmd, stop: stopCmd, status: statusCmd, run: runCmd },
  });
}

module.exports = { createDispatcherCommand };
