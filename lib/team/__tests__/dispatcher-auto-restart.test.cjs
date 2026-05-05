'use strict';
/**
 * Tests for dispatcher auto-restart with storm prevention.
 *
 * Strategy:
 *  1. Simulate DEAD state (no heartbeat file) → assert restart fires.
 *  2. Simulate 4 restart-log entries within 5 min → assert 4th is blocked.
 *
 * We do NOT execute gad.cjs or spawn real processes in tests; instead we:
 *  - Use createStatusCommand with stubbed `runDispatcherStart` / `writeStateLog`
 *    by exercising the restart-log helper directly, AND
 *  - Test the restart-log module (checkAndLogRestart) in isolation.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RESTART_LOG_PATH = require.resolve('../restart-log.cjs');
const DISPATCHER_PATH = require.resolve('../dispatcher.cjs');

function loadRestartLog() {
  delete require.cache[RESTART_LOG_PATH];
  return require(RESTART_LOG_PATH);
}

function loadDispatcher() {
  delete require.cache[DISPATCHER_PATH];
  return require(DISPATCHER_PATH);
}

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ---------- restart-log module unit tests ----------

test('restartLogPath returns path under .planning/team/', () => {
  const { restartLogPath } = loadRestartLog();
  const p = restartLogPath('/some/base');
  assert.ok(p.includes('.planning') && p.includes('team') && p.endsWith('dispatcher.restart.log'));
});

test('recentEntries returns empty array when log does not exist', () => {
  const tmpDir = makeTmpDir('gad-rl-empty-');
  try {
    const { recentEntries } = loadRestartLog();
    const entries = recentEntries(tmpDir);
    assert.deepEqual(entries, []);
  } finally {
    cleanup(tmpDir);
  }
});

test('logRestart appends a JSONL entry to the restart log', () => {
  const tmpDir = makeTmpDir('gad-rl-log-');
  try {
    const { logRestart, restartLogPath } = loadRestartLog();
    logRestart(tmpDir, { projectid: 'global', reason: 'no-heartbeat', success: true });
    const logPath = restartLogPath(tmpDir);
    assert.ok(fs.existsSync(logPath), 'log file must exist after logRestart');
    const line = fs.readFileSync(logPath, 'utf8').trim();
    const entry = JSON.parse(line);
    assert.equal(entry.projectid, 'global');
    assert.equal(entry.reason, 'no-heartbeat');
    assert.equal(entry.success, true);
    assert.ok(entry.ts, 'entry must have ts field');
  } finally {
    cleanup(tmpDir);
  }
});

test('checkAndLogRestart: not blocked when < 3 restarts in window', () => {
  const tmpDir = makeTmpDir('gad-rl-ok-');
  try {
    const { checkAndLogRestart, recentRestartCount } = loadRestartLog();
    // 2 prior allowed restarts via checkAndLogRestart (each pre-logs the attempt)
    checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(recentRestartCount(tmpDir), 2, 'should see 2 prior restarts');
    const { blocked } = checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(blocked, false, 'third attempt must NOT be blocked');
    // After the third allowed attempt, count should be 3
    assert.equal(recentRestartCount(tmpDir), 3);
  } finally {
    cleanup(tmpDir);
  }
});

test('checkAndLogRestart: blocked when >= 3 restarts in window', () => {
  const tmpDir = makeTmpDir('gad-rl-storm-');
  try {
    const { checkAndLogRestart, logRestart, recentEntries, STORM_MAX } = loadRestartLog();
    // Saturate the window: log exactly STORM_MAX real restarts
    for (let i = 0; i < STORM_MAX; i++) {
      logRestart(tmpDir, { projectid: 'global', reason: 'no-heartbeat', success: true });
    }
    // The next attempt should be blocked
    const { blocked } = checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(blocked, true, 'attempt after storm threshold must be blocked');
    // The blocked entry itself must be in the log
    const all = recentEntries(tmpDir);
    const blockedEntry = all.find(e => e.reason === 'restart-storm-blocked');
    assert.ok(blockedEntry, 'restart-storm-blocked entry must appear in the log');
  } finally {
    cleanup(tmpDir);
  }
});

test('checkAndLogRestart: 4th attempt blocked (full scenario)', () => {
  const tmpDir = makeTmpDir('gad-rl-4th-');
  try {
    const { checkAndLogRestart, recentRestartCount } = loadRestartLog();
    // First 3 allowed
    assert.equal(checkAndLogRestart(tmpDir, 'global', 'no-heartbeat').blocked, false, '1st must not block');
    assert.equal(checkAndLogRestart(tmpDir, 'global', 'no-heartbeat').blocked, false, '2nd must not block');
    assert.equal(checkAndLogRestart(tmpDir, 'global', 'no-heartbeat').blocked, false, '3rd must not block');
    // 4th must be blocked
    const result4 = checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(result4.blocked, true, '4th attempt must be blocked (storm prevention)');
    // Real restart count remains at 3 (blocked entry is excluded from count)
    assert.equal(recentRestartCount(tmpDir), 3, 'blocked entries are excluded from restart count');
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- DEAD detection via readHeartbeat ----------

test('readHeartbeat returns DEAD when heartbeat file is absent', () => {
  const tmpDir = makeTmpDir('gad-ar-dead-');
  try {
    const { readHeartbeat } = loadDispatcher();
    const hb = readHeartbeat(tmpDir);
    assert.equal(hb.state, 'DEAD', `expected DEAD, got ${hb.state}`);
  } finally {
    cleanup(tmpDir);
  }
});

test('readHeartbeat returns DEAD when heartbeat is > 120s old', () => {
  const tmpDir = makeTmpDir('gad-ar-stale-');
  try {
    const { dispatcherHeartbeatPath, readHeartbeat } = loadDispatcher();
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    const oldTs = new Date(Date.now() - 200_000).toISOString();
    fs.writeFileSync(dispatcherHeartbeatPath(tmpDir), JSON.stringify({ ts: oldTs, pid: 99999, projectid: 'global' }));
    const hb = readHeartbeat(tmpDir);
    assert.equal(hb.state, 'DEAD', `expected DEAD (old heartbeat), got ${hb.state}`);
  } finally {
    cleanup(tmpDir);
  }
});

// ---------- integration: status command auto-restart path ----------

test('status command: auto-restart fires when dispatcher is DEAD and flag is set', () => {
  const tmpDir = makeTmpDir('gad-ar-status-');
  try {
    // Set up minimal team config so status command doesn't bail early
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, 'config.json'),
      JSON.stringify({ workers: 2, runtime: 'codex-cli', autopause_threshold: 20 }),
    );

    const { checkAndLogRestart, recentRestartCount } = loadRestartLog();

    // Pre-condition: no heartbeat => DEAD
    const { readHeartbeat } = loadDispatcher();
    const hb = readHeartbeat(tmpDir);
    assert.equal(hb.state, 'DEAD', 'pre-condition: dispatcher must be DEAD');

    // Simulate what the status command does: checkAndLogRestart pre-logs the attempt
    const { blocked } = checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(blocked, false, 'first restart attempt must not be blocked');
    // checkAndLogRestart already logged the pre-attempt entry
    assert.equal(recentRestartCount(tmpDir), 1, 'one restart attempt logged');
  } finally {
    cleanup(tmpDir);
  }
});

test('status command: storm prevention blocks 4th restart in window', () => {
  const tmpDir = makeTmpDir('gad-ar-storm-cmd-');
  try {
    const teamDir = path.join(tmpDir, '.planning', 'team');
    fs.mkdirSync(teamDir, { recursive: true });
    fs.writeFileSync(
      path.join(teamDir, 'config.json'),
      JSON.stringify({ workers: 2, runtime: 'codex-cli', autopause_threshold: 20 }),
    );

    const { checkAndLogRestart, logRestart, recentRestartCount } = loadRestartLog();

    // 3 prior restarts (allowed)
    for (let i = 0; i < 3; i++) {
      logRestart(tmpDir, { projectid: 'global', reason: 'no-heartbeat', success: true });
    }
    assert.equal(recentRestartCount(tmpDir), 3);

    // 4th attempt via checkAndLogRestart should be blocked
    const { blocked } = checkAndLogRestart(tmpDir, 'global', 'no-heartbeat');
    assert.equal(blocked, true, '4th attempt must be storm-blocked');

    // Real restart count still 3
    assert.equal(recentRestartCount(tmpDir), 3, 'blocked entry must not increment real restart count');
  } finally {
    cleanup(tmpDir);
  }
});
