'use strict';
/**
 * lib/team/spawn.cjs — detached worker subprocess spawn.
 *
 * Returns pid. Caller captures into status.json. Worker stdout/stderr
 * redirect into log.jsonl via file descriptor.
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { workerDir, workerMailbox, workerOutDir, workerLog } = require('./paths.cjs');
const { pickNodeExecutable } = require('../node-exec.cjs');

function spawnWorker(baseDir, id, gadBinary) {
  fs.mkdirSync(workerDir(baseDir, id), { recursive: true });
  fs.mkdirSync(workerMailbox(baseDir, id), { recursive: true });
  fs.mkdirSync(workerOutDir(baseDir, id), { recursive: true });
  const logFd = fs.openSync(workerLog(baseDir, id), 'a');
  const child = spawn(
    pickNodeExecutable(),
    [gadBinary, 'team', 'work', '--worker-id', id],
    {
      cwd: baseDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
      env: { ...process.env, GAD_TEAM_WORKER_ID: id },
    },
  );
  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

module.exports = { spawnWorker };
