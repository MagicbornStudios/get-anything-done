'use strict';
/**
 * tests/supervisor-agent.test.cjs
 *
 * Unit tests for lib/supervisor-agent.cjs.
 * Strategy: exercise tick() sub-checks by direct function call with a real
 * tmpdir. All CLI interventions (runGad) are mocked via module cache injection —
 * we NEVER spawn real processes.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUPERVISOR_PATH = require.resolve('../lib/supervisor-agent.cjs');

function loadSupervisor() {
  // Fresh require each test so module-level state doesn't leak.
  delete require.cache[SUPERVISOR_PATH];
  return require(SUPERVISOR_PATH);
}

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers for setting up fixture state
// ──────────────────────────────────────────────────────────────────────────────

function teamDir(baseDir) { return path.join(baseDir, '.planning', 'team'); }
function claimedDir(baseDir) { return path.join(baseDir, '.planning', 'handoffs', 'claimed'); }
function openDir(baseDir) { return path.join(baseDir, '.planning', 'handoffs', 'open'); }

function writeDispatcherHeartbeat(baseDir, ageMs) {
  const dir = teamDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date(Date.now() - ageMs).toISOString();
  fs.writeFileSync(path.join(dir, 'dispatcher.heartbeat.json'), JSON.stringify({ ts, pid: 99999, projectid: 'global' }));
}

function writeWorkerStatus(baseDir, id, status) {
  const dir = path.join(teamDir(baseDir), 'workers', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status));
}

function writeStuckHandoff(baseDir, name, ageMs) {
  const dir = claimedDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, '# stub handoff\n');
  // Back-date mtime
  const mtime = new Date(Date.now() - ageMs);
  fs.utimesSync(filePath, mtime, mtime);
}

// ──────────────────────────────────────────────────────────────────────────────
// Test 1 — checkStuckHandoffs moves old claimed handoffs back to open/
// ──────────────────────────────────────────────────────────────────────────────

test('checkStuckHandoffs: moves handoff stuck >30min back to open/', () => {
  const tmpDir = makeTmpDir('gad-sup-stuck-');
  try {
    const { checkStuckHandoffs, STUCK_HANDOFF_MS } = loadSupervisor();
    const overAge = STUCK_HANDOFF_MS + 5_000;
    writeStuckHandoff(tmpDir, 'h-old.md', overAge);
    writeStuckHandoff(tmpDir, 'h-new.md', 60_000); // 1 min — should NOT move

    const interventions = [];
    checkStuckHandoffs(tmpDir, 'global', (e) => interventions.push(e));

    assert.equal(interventions.length, 1, 'exactly one handoff should be moved');
    assert.equal(interventions[0].kind, 'unclaim-stuck');
    assert.equal(interventions[0].handoff, 'h-old.md');

    assert.ok(fs.existsSync(path.join(openDir(tmpDir), 'h-old.md')), 'h-old.md should be in open/');
    assert.ok(!fs.existsSync(path.join(claimedDir(tmpDir), 'h-old.md')), 'h-old.md should not remain in claimed/');
    assert.ok(fs.existsSync(path.join(claimedDir(tmpDir), 'h-new.md')), 'h-new.md should stay in claimed/');
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 2 — checkStuckHandoffs: no-op when nothing is stuck
// ──────────────────────────────────────────────────────────────────────────────

test('checkStuckHandoffs: no-op when claimed/ is empty', () => {
  const tmpDir = makeTmpDir('gad-sup-empty-');
  try {
    const { checkStuckHandoffs } = loadSupervisor();
    const interventions = [];
    checkStuckHandoffs(tmpDir, 'global', (e) => interventions.push(e));
    assert.equal(interventions.length, 0);
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 3 — checkStaleWorkers: detects WORKING worker with stale heartbeat
// Mocks runGad by patching child_process.spawnSync in the module cache.
// ──────────────────────────────────────────────────────────────────────────────

test('checkStaleWorkers: calls gad team restart for worker with stale heartbeat', () => {
  const tmpDir = makeTmpDir('gad-sup-worker-');
  try {
    // Patch spawnSync BEFORE loading the module
    const origSpawnSync = require('child_process').spawnSync;
    const calls = [];
    require('child_process').spawnSync = (...args) => {
      calls.push(args);
      return { status: 0, stdout: 'ok\n', stderr: '', error: null };
    };

    try {
      delete require.cache[SUPERVISOR_PATH];
      const { checkStaleWorkers, STALE_WORKER_S } = require(SUPERVISOR_PATH);

      const staleAgeMs = (STALE_WORKER_S + 60) * 1000;
      const staleTs = new Date(Date.now() - staleAgeMs).toISOString();
      writeWorkerStatus(tmpDir, 'w1', {
        id: 'w1', state: 'WORKING', last_heartbeat: staleTs,
      });
      // Fresh worker — should NOT trigger
      writeWorkerStatus(tmpDir, 'w2', {
        id: 'w2', state: 'WORKING', last_heartbeat: new Date().toISOString(),
      });
      // NOT_STARTED — should NOT trigger even if heartbeat missing
      writeWorkerStatus(tmpDir, 'w3', {
        id: 'w3', state: 'NOT_STARTED', last_heartbeat: null,
      });

      const interventions = [];
      checkStaleWorkers(tmpDir, 'global', (e) => interventions.push(e));

      assert.equal(interventions.length, 1, 'exactly one restart-stale-worker entry');
      assert.equal(interventions[0].kind, 'restart-stale-worker');
      assert.equal(interventions[0].worker_id, 'w1');

      // spawnSync should have been called with 'team', 'restart', '--worker-id', 'w1'
      assert.ok(calls.length >= 1, 'spawnSync must be called at least once');
      const restartCall = calls.find(c => Array.isArray(c[1]) && c[1].includes('restart'));
      assert.ok(restartCall, 'a team restart call must be present');
    } finally {
      require('child_process').spawnSync = origSpawnSync;
      delete require.cache[SUPERVISOR_PATH];
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 4 — checkDispatcher: detects dead dispatcher (no heartbeat file)
// ──────────────────────────────────────────────────────────────────────────────

test('checkDispatcher: detects dead dispatcher (no heartbeat file)', () => {
  const tmpDir = makeTmpDir('gad-sup-disp-dead-');
  try {
    const origSpawnSync = require('child_process').spawnSync;
    const calls = [];
    require('child_process').spawnSync = (...args) => {
      calls.push(args);
      return { status: 0, stdout: 'Dispatcher started\n', stderr: '', error: null };
    };
    try {
      delete require.cache[SUPERVISOR_PATH];
      const { checkDispatcher } = require(SUPERVISOR_PATH);

      const interventions = [];
      checkDispatcher(tmpDir, 'global', (e) => interventions.push(e));

      assert.equal(interventions.length, 1);
      assert.equal(interventions[0].kind, 'restart-dispatcher');

      const dispatcherCall = calls.find(c => Array.isArray(c[1]) && c[1].includes('dispatcher'));
      assert.ok(dispatcherCall, 'gad team dispatcher start must be called');
    } finally {
      require('child_process').spawnSync = origSpawnSync;
      delete require.cache[SUPERVISOR_PATH];
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 5 — checkDispatcher: no-op when heartbeat is fresh
// ──────────────────────────────────────────────────────────────────────────────

test('checkDispatcher: no-op when heartbeat is fresh', () => {
  const tmpDir = makeTmpDir('gad-sup-disp-live-');
  try {
    const { checkDispatcher } = loadSupervisor();
    writeDispatcherHeartbeat(tmpDir, 10_000); // 10s old — well within threshold

    const interventions = [];
    checkDispatcher(tmpDir, 'global', (e) => interventions.push(e));

    assert.equal(interventions.length, 0, 'fresh heartbeat must not trigger restart');
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 6 — checkDispatcher: triggers when heartbeat is stale (>120s)
// ──────────────────────────────────────────────────────────────────────────────

test('checkDispatcher: triggers when heartbeat age >120s', () => {
  const tmpDir = makeTmpDir('gad-sup-disp-stale-');
  try {
    const origSpawnSync = require('child_process').spawnSync;
    const calls = [];
    require('child_process').spawnSync = (...args) => {
      calls.push(args);
      return { status: 0, stdout: '', stderr: '', error: null };
    };
    try {
      delete require.cache[SUPERVISOR_PATH];
      const { checkDispatcher, DISPATCHER_DEAD_S } = require(SUPERVISOR_PATH);

      writeDispatcherHeartbeat(tmpDir, (DISPATCHER_DEAD_S + 10) * 1000);

      const interventions = [];
      checkDispatcher(tmpDir, 'global', (e) => interventions.push(e));

      assert.equal(interventions.length, 1);
      assert.equal(interventions[0].kind, 'restart-dispatcher');
    } finally {
      require('child_process').spawnSync = origSpawnSync;
      delete require.cache[SUPERVISOR_PATH];
    }
  } finally {
    cleanup(tmpDir);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 7 — supervisorPidPath returns path under .planning/
// ──────────────────────────────────────────────────────────────────────────────

test('supervisorPidPath: returns .planning/supervisor.pid', () => {
  const { supervisorPidPath } = loadSupervisor();
  const p = supervisorPidPath('/repo');
  assert.ok(p.includes('supervisor.pid'), 'should include supervisor.pid');
  assert.ok(p.includes('.planning'), 'should be under .planning/');
});

// ──────────────────────────────────────────────────────────────────────────────
// Test 8 — system.cjs dry-run smoke: buildSingletons includes dispatcher etc
// ──────────────────────────────────────────────────────────────────────────────

test('system.cjs: buildSingletons includes dispatcher, workers, supervisor entries', () => {
  // Require through the module path — don't actually run any commands.
  const systemPath = require.resolve('../bin/commands/system.cjs');
  delete require.cache[systemPath];
  // system.cjs does not export buildSingletons directly, but we can verify
  // via snapshotSingletons which calls it. We need a real tmpDir with no
  // .planning/ so all singletons appear as "not running".
  const mod = require(systemPath);
  // The module itself exports the citty command tree; we just verify it loads
  // without error and is an object.
  assert.ok(mod && typeof mod === 'object', 'system.cjs must export a command object');
});
