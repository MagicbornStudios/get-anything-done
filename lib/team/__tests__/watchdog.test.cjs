'use strict';
/**
 * Tests for lib/team/watchdog.cjs
 *
 * Strategy:
 *  1. Verify runWithWatchdog calls fn() on startup.
 *  2. Verify restartFn fires when heartbeat mtime is stale (DEAD state injected).
 *  3. Verify storm prevention: after STORM_MAX restarts, watchdog stops polling.
 *  4. Verify stop() cancels the poll timer.
 *
 * We do NOT spawn real processes. We inject stub fn/restartFn and manipulate
 * the heartbeat file directly to simulate stale states.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WATCHDOG_PATH = require.resolve('../watchdog.cjs');
const DISPATCHER_PATH = require.resolve('../dispatcher.cjs');

function loadWatchdog() {
  delete require.cache[WATCHDOG_PATH];
  delete require.cache[DISPATCHER_PATH];
  return require(WATCHDOG_PATH);
}

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function writeDeadHeartbeat(baseDir) {
  // Write a heartbeat that is > 200s old (DEAD state)
  const teamDir = path.join(baseDir, '.planning', 'team');
  fs.mkdirSync(teamDir, { recursive: true });
  const { dispatcherHeartbeatPath } = require(DISPATCHER_PATH);
  const oldTs = new Date(Date.now() - 200_000).toISOString();
  fs.writeFileSync(dispatcherHeartbeatPath(baseDir), JSON.stringify({ ts: oldTs, pid: 99999, projectid: 'global' }));
}

// ---------- startup fn called ----------

test('runWithWatchdog calls fn() on startup', () => {
  const tmpDir = makeTmpDir('gad-wd-start-');
  try {
    const { runWithWatchdog } = loadWatchdog();
    let fnCalled = 0;
    const { stop } = runWithWatchdog(() => { fnCalled++; }, {
      baseDir: tmpDir,
      projectid: 'global',
      pollMs: 100_000, // very long — won't fire during test
    });
    assert.equal(fnCalled, 1, 'fn must be called exactly once on startup');
    stop();
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- stop() cancels polling ----------

test('stop() prevents further polling', async () => {
  const tmpDir = makeTmpDir('gad-wd-stop-');
  try {
    const { runWithWatchdog } = loadWatchdog();
    let restartCount = 0;

    // Write a DEAD heartbeat so restart would fire if poll ran
    writeDeadHeartbeat(tmpDir);

    const { stop } = runWithWatchdog(() => {}, {
      baseDir: tmpDir,
      projectid: 'global',
      restartFn: () => { restartCount++; },
      staleSec: 1, // stale after 1s (heartbeat is 200s old — triggers immediately)
      pollMs: 5,   // very short poll
    });

    // Immediately stop before any timer fires
    stop();

    // Wait a bit longer than pollMs to confirm no restart fired
    await new Promise((res) => setTimeout(res, 30));
    assert.equal(restartCount, 0, 'stop() must prevent restartFn from firing');
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- restartFn fires on DEAD heartbeat ----------

test('restartFn fires when heartbeat is stale (DEAD)', async () => {
  const tmpDir = makeTmpDir('gad-wd-restart-');
  try {
    const { runWithWatchdog } = loadWatchdog();
    let restartCount = 0;

    writeDeadHeartbeat(tmpDir);

    const { stop } = runWithWatchdog(() => {}, {
      baseDir: tmpDir,
      projectid: 'global',
      restartFn: () => { restartCount++; },
      staleSec: 1,   // heartbeat is 200s old — definitely stale
      pollMs: 10,    // check quickly
    });

    // Wait for at least one poll cycle
    await new Promise((res) => setTimeout(res, 80));
    stop();

    assert.ok(restartCount >= 1, `restartFn should have fired at least once, got ${restartCount}`);
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- onStall callback fires ----------

test('onStall callback is invoked when heartbeat is stale', async () => {
  const tmpDir = makeTmpDir('gad-wd-onstall-');
  try {
    const { runWithWatchdog } = loadWatchdog();
    let stallAgeS = null;

    writeDeadHeartbeat(tmpDir);

    const { stop } = runWithWatchdog(() => {}, {
      baseDir: tmpDir,
      projectid: 'global',
      onStall: (ageS) => { stallAgeS = ageS; },
      restartFn: () => {},
      staleSec: 1,
      pollMs: 10,
    });

    await new Promise((res) => setTimeout(res, 80));
    stop();

    assert.ok(stallAgeS != null, 'onStall must have been called');
    assert.ok(stallAgeS > 1, `ageS should be > 1 (got ${stallAgeS})`);
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- storm prevention: watchdog stops after STORM_MAX ----------

test('watchdog stops restarting after STORM_MAX restarts', async () => {
  const tmpDir = makeTmpDir('gad-wd-storm-');
  try {
    // Pre-saturate the restart log so the NEXT call to checkAndLogRestart is blocked
    const { logRestart, STORM_MAX } = require('../restart-log.cjs');
    for (let i = 0; i < STORM_MAX; i++) {
      logRestart(tmpDir, { projectid: 'global', reason: 'no-heartbeat', success: true });
    }

    writeDeadHeartbeat(tmpDir);

    const { runWithWatchdog } = loadWatchdog();
    let restartCount = 0;

    const { stop } = runWithWatchdog(() => {}, {
      baseDir: tmpDir,
      projectid: 'global',
      restartFn: () => { restartCount++; },
      staleSec: 1,
      pollMs: 10,
    });

    // Wait for a couple of cycles
    await new Promise((res) => setTimeout(res, 80));
    stop();

    // Storm blocked — restartFn must not have fired
    assert.equal(restartCount, 0, 'restartFn must be blocked by storm prevention');

    // Alarm file must exist
    const { dispatcherAlarmPath } = require('../restart-log.cjs');
    const alarmPath = dispatcherAlarmPath(tmpDir);
    assert.ok(fs.existsSync(alarmPath), 'dispatcher.alarm.json must be written on storm block');
    const alarm = JSON.parse(fs.readFileSync(alarmPath, 'utf8'));
    assert.ok(alarm.message, 'alarm must have a message field');
  } finally {
    cleanup(tmpDir);
  }
});
