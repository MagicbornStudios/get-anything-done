'use strict';
/**
 * Tests for dispatcher heartbeat write cadence and liveness classification.
 *
 * Strategy: stub fs.writeFileSync + setInterval to verify that:
 *   1. writeHeartbeat writes the correct JSON shape
 *   2. readHeartbeat classifies LIVE / STALE / DEAD correctly by age
 *   3. runDaemon registers a 10s setInterval that calls writeHeartbeat
 *
 * We do NOT actually run the daemon loop (it blocks forever); instead we
 * verify that the poll timer is set with pollMs=10000 and that the callback
 * invokes writeHeartbeat by inspecting fs writes in a minimal stub.
 */

const { test, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DISPATCHER_PATH = require.resolve('../dispatcher.cjs');

function loadDispatcher() {
  delete require.cache[DISPATCHER_PATH];
  return require(DISPATCHER_PATH);
}

// ---------- helpers ----------

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ---------- writeHeartbeat / readHeartbeat ----------

test('writeHeartbeat creates heartbeat file with correct shape', () => {
  const tmpDir = makeTmpDir('gad-hb-write-');
  try {
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    const before = Date.now();
    const { writeHeartbeat, dispatcherHeartbeatPath } = loadDispatcher();
    writeHeartbeat(tmpDir, 'global');
    const after = Date.now();
    const hbPath = dispatcherHeartbeatPath(tmpDir);
    assert.ok(fs.existsSync(hbPath), 'heartbeat file must exist after write');
    const raw = JSON.parse(fs.readFileSync(hbPath, 'utf8'));
    assert.ok(raw.ts, 'heartbeat must have ts field');
    assert.equal(raw.pid, process.pid, 'heartbeat must have current pid');
    assert.equal(raw.projectid, 'global', 'heartbeat must record projectid');
    const ts = Date.parse(raw.ts);
    assert.ok(ts >= before && ts <= after, 'ts must be within the write window');
  } finally {
    cleanup(tmpDir);
  }
});

test('readHeartbeat returns DEAD when file does not exist', () => {
  const tmpDir = makeTmpDir('gad-hb-dead-');
  try {
    const { readHeartbeat } = loadDispatcher();
    const result = readHeartbeat(tmpDir);
    assert.equal(result.state, 'DEAD');
    assert.equal(result.pid, null);
    assert.equal(result.last_heartbeat, null);
  } finally {
    cleanup(tmpDir);
  }
});

test('readHeartbeat returns LIVE for fresh heartbeat (age < 30s)', () => {
  const tmpDir = makeTmpDir('gad-hb-live-');
  try {
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    const { writeHeartbeat, readHeartbeat } = loadDispatcher();
    writeHeartbeat(tmpDir, 'global');
    const result = readHeartbeat(tmpDir);
    assert.equal(result.state, 'LIVE', `expected LIVE, got ${result.state} (age=${result.age_s}s)`);
    assert.ok(result.age_s < 30, `age_s should be < 30, got ${result.age_s}`);
    assert.equal(result.pid, process.pid);
    assert.equal(result.projectid, 'global');
  } finally {
    cleanup(tmpDir);
  }
});

test('readHeartbeat returns STALE for heartbeat aged 30-120s', () => {
  const tmpDir = makeTmpDir('gad-hb-stale-');
  try {
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    const { dispatcherHeartbeatPath, readHeartbeat } = loadDispatcher();
    // Write a ts 60 seconds ago
    const staleTs = new Date(Date.now() - 60_000).toISOString();
    fs.writeFileSync(dispatcherHeartbeatPath(tmpDir), JSON.stringify({ ts: staleTs, pid: 12345, projectid: 'global' }));
    const result = readHeartbeat(tmpDir);
    assert.equal(result.state, 'STALE', `expected STALE, got ${result.state} (age=${result.age_s}s)`);
    assert.ok(result.age_s >= 30 && result.age_s <= 120, `age_s ${result.age_s} should be 30-120`);
  } finally {
    cleanup(tmpDir);
  }
});

test('readHeartbeat returns DEAD for heartbeat aged > 120s', () => {
  const tmpDir = makeTmpDir('gad-hb-old-');
  try {
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    const { dispatcherHeartbeatPath, readHeartbeat } = loadDispatcher();
    const oldTs = new Date(Date.now() - 200_000).toISOString();
    fs.writeFileSync(dispatcherHeartbeatPath(tmpDir), JSON.stringify({ ts: oldTs, pid: 12345, projectid: 'global' }));
    const result = readHeartbeat(tmpDir);
    assert.equal(result.state, 'DEAD', `expected DEAD, got ${result.state} (age=${result.age_s}s)`);
    assert.ok(result.age_s > 120, `age_s ${result.age_s} should be > 120`);
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- runDaemon heartbeat cadence (setInterval stub) ----------

test('runDaemon registers a 10s setInterval that triggers writeHeartbeat', async () => {
  const tmpDir = makeTmpDir('gad-hb-daemon-');
  const teamDir = path.join(tmpDir, '.planning', 'team');
  const openDir = path.join(tmpDir, '.planning', 'handoffs', 'open');
  fs.mkdirSync(teamDir, { recursive: true });
  fs.mkdirSync(openDir, { recursive: true });

  const origSetInterval = global.setInterval;
  const origClearInterval = global.clearInterval;
  const origFsWatch = fs.watch;
  const origExitHandlers = process.listeners('SIGTERM').slice();

  const capturedIntervals = [];
  let pollCallback = null;
  let resolveTest;
  const testDone = new Promise((res) => { resolveTest = res; });

  try {
    // Stub setInterval: capture intervals + immediately invoke once for the 10s one
    global.setInterval = (fn, ms) => {
      capturedIntervals.push({ ms });
      if (ms === 10_000) {
        pollCallback = fn;
      }
      return { unref() {} };
    };
    global.clearInterval = () => {};

    // Stub fs.watch to avoid actual kernel watcher
    fs.watch = () => ({ close() {} });

    const { runDaemon } = loadDispatcher();

    // runDaemon never returns; run it and cancel via process exit stub
    // We use a short-circuit: after the first tick, we inspect the heartbeat and resolve
    const daemonPromise = runDaemon(tmpDir, { projectid: 'global' });

    // Wait a tick for synchronous startup to complete (initial writeHeartbeat)
    await new Promise((res) => setImmediate(res));

    // Verify that a 10s interval was registered
    const tenSecInterval = capturedIntervals.find((i) => i.ms === 10_000);
    assert.ok(tenSecInterval, `expected a 10s setInterval, got: ${JSON.stringify(capturedIntervals)}`);

    // Manually fire the poll callback (simulates 10s elapsing)
    assert.ok(typeof pollCallback === 'function', 'poll callback must be a function');
    pollCallback();

    // Allow microtasks to settle
    await new Promise((res) => setImmediate(res));

    // Verify heartbeat was written by reading the file
    const { dispatcherHeartbeatPath, readHeartbeat } = loadDispatcher();
    const hbPath = dispatcherHeartbeatPath(tmpDir);
    assert.ok(fs.existsSync(hbPath), 'heartbeat file must exist after poll tick');
    const result = readHeartbeat(tmpDir);
    assert.equal(result.state, 'LIVE', `expected LIVE after manual poll tick, got ${result.state}`);

    resolveTest();
    // Terminate daemon via SIGTERM handlers — find ours and clean up
    // (we do not actually send SIGTERM to avoid killing the test process)
    // Just let daemonPromise hang; test assertion already passed.
  } finally {
    global.setInterval = origSetInterval;
    global.clearInterval = origClearInterval;
    fs.watch = origFsWatch;
    // Remove any SIGTERM listeners the daemon added
    const newHandlers = process.listeners('SIGTERM');
    for (const h of newHandlers) {
      if (!origExitHandlers.includes(h)) process.removeListener('SIGTERM', h);
    }
    delete require.cache[DISPATCHER_PATH];
    cleanup(tmpDir);
  }

  await testDone;
});
