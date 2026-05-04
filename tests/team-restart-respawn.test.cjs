'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempDir, cleanup } = require('./helpers.cjs');

const WORKER_LOOP_PATH = require.resolve('../lib/team/worker-loop.cjs');

function loadWorkerLoop() {
  delete require.cache[WORKER_LOOP_PATH];
  return require(WORKER_LOOP_PATH);
}

function writeTeamConfig(tmpDir, cfg) {
  const file = path.join(tmpDir, '.planning', 'team', 'config.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

function ensureWorkerDirs(tmpDir, id) {
  fs.mkdirSync(path.join(tmpDir, '.planning', 'team', 'workers', id, 'mailbox'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'team', 'workers', id, 'out'), { recursive: true });
}

test('runWorker clears stop.flag on start (regression test for restart-respawn bug)', async () => {
  const tmpDir = createTempDir('gad-team-restart-respawn-');
  try {
    const id = 'w1';
    writeTeamConfig(tmpDir, {
      workers: 1,
      roles: ['executor'],
      workers_spec: [{ id, role: 'executor', lane: null, runtime: 'gemini-cli' }],
      tick_ms: 50,
      created_at: '2026-05-04T00:00:00.000Z',
      supervisor_pid: 1,
    });
    ensureWorkerDirs(tmpDir, id);

    const stopFlag = path.join(tmpDir, '.planning', 'team', 'workers', id, 'stop.flag');
    fs.writeFileSync(stopFlag, 'stale stop flag');

    const { runWorker } = loadWorkerLoop();
    
    let loopStarted = false;
    let newStopFlagWritten = false;

    // We'll poll for the flag being cleared.
    const pollInterval = setInterval(() => {
        if (!fs.existsSync(stopFlag) && !newStopFlagWritten) {
            loopStarted = true;
            newStopFlagWritten = true;
            fs.writeFileSync(stopFlag, 'new stop flag');
            clearInterval(pollInterval);
        }
    }, 10);

    // If it doesn't clear the flag, it will exit immediately.
    // If it does clear the flag, it will wait for the new one we write.
    await runWorker(tmpDir, id);
    clearInterval(pollInterval);

    assert.ok(loopStarted, 'Worker loop should have started (cleared stale stop.flag)');
    assert.ok(!fs.existsSync(stopFlag), 'stop.flag should be unlinked at the end');

  } finally {
    cleanup(tmpDir);
  }
});
