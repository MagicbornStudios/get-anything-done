'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');

const WORKER_LOOP_PATH = require.resolve('../lib/team/worker-loop.cjs');

const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const originalExistsSync = fs.existsSync;

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

afterEach(() => {
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  fs.existsSync = originalExistsSync;
  delete require.cache[WORKER_LOOP_PATH];
});

test('runWorker uses gemini runtime tick override when idle', async () => {
  const tmpDir = createTempDir('gad-team-worker-loop-');
  const sleepCalls = [];
  let stopChecks = 0;

  try {
    writeTeamConfig(tmpDir, {
      workers: 1,
      roles: ['executor'],
      workers_spec: [{ id: 'w5', role: 'executor', lane: null, runtime: 'gemini-cli', runtime_cmd: null }],
      runtime: 'claude-code',
      runtime_cmd: null,
      autopause_threshold: 20,
      tick_ms: 2000,
      runtime_tick_overrides: { 'gemini-cli': 8000, 'codex-cli': 2000 },
      created_at: '2026-05-03T00:00:00.000Z',
      supervisor_pid: 1,
    });
    ensureWorkerDirs(tmpDir, 'w5');

    global.setTimeout = (fn, ms, ...args) => {
      sleepCalls.push(ms);
      return originalSetTimeout(() => fn(...args), 0);
    };
    global.setInterval = () => ({ unref() {} });
    global.clearInterval = () => {};
    fs.existsSync = (targetPath) => {
      if (String(targetPath).endsWith(path.join('workers', 'w5', 'stop.flag'))) {
        stopChecks += 1;
        return stopChecks > 1;
      }
      return originalExistsSync(targetPath);
    };

    const { runWorker } = loadWorkerLoop();
    await runWorker(tmpDir, 'w5');

    assert.ok(sleepCalls.includes(8000), `expected worker to sleep 8000ms, got [${sleepCalls.join(', ')}]`);
  } finally {
    cleanup(tmpDir);
  }
});
