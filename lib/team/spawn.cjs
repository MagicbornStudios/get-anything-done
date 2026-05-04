'use strict';
/**
 * lib/team/spawn.cjs — detached worker subprocess spawn.
 *
 * Returns pid. Caller captures into status.json. Worker stdout/stderr
 * redirect into log.jsonl via file descriptor.
 */

const fs = require('fs');
const childProcess = require('child_process');
const { workerDir, workerMailbox, workerOutDir, workerLog } = require('./paths.cjs');
const { pickNodeExecutable, resolveWorkerGadCli } = require('../node-exec.cjs');

function buildDetachedGadSpawn(baseDir, gadBinary, commandArgs, logFd, envExtra = {}) {
  const nodeCmd = pickNodeExecutable();
  const gadCliPath = resolveWorkerGadCli(gadBinary, { cwd: baseDir });
  return {
    command: nodeCmd,
    args: [gadCliPath, ...commandArgs],
    options: {
      cwd: baseDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
      shell: false,
      argv0: nodeCmd,
      windowsVerbatimArguments: false,
      env: { ...process.env, ...envExtra },
    },
  };
}

function spawnDetachedGadProcess(baseDir, gadBinary, commandArgs, logFilePath, envExtra = {}) {
  const logFd = fs.openSync(logFilePath, 'a');
  const spawnPlan = buildDetachedGadSpawn(baseDir, gadBinary, commandArgs, logFd, envExtra);
  const child = childProcess.spawn(spawnPlan.command, spawnPlan.args, spawnPlan.options);
  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

function spawnWorker(baseDir, id, gadBinary, options = {}) {
  const extraArgs = Array.isArray(options.cliArgs) ? options.cliArgs : [];
  fs.mkdirSync(workerDir(baseDir, id), { recursive: true });
  fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
  fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
  return spawnDetachedGadProcess(
    baseDir,
    gadBinary,
    ['team', 'work', '--worker-id', id, ...extraArgs],
    workerLog(baseDir, id),
    { GAD_TEAM_WORKER_ID: id },
  );
}

module.exports = { buildDetachedGadSpawn, spawnDetachedGadProcess, spawnWorker };
