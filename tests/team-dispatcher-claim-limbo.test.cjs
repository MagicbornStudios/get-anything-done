'use strict';
/**
 * 273-15: Dispatcher claim-limbo routing fix
 *
 * Regression test proving that a handoff pre-claimed by the dispatcher
 * (sitting in claimed/ with claimed_by: handoff-dispatcher) is processed
 * by the worker — body is non-empty and no work-skip-empty-body is logged.
 *
 * Fix chosen: Option B — worker-loop, when claimHandoff throws ALREADY_CLAIMED,
 * falls back to readHandoff (which searches all buckets) and proceeds if the
 * handoff is still in claimed/ with a non-empty body.
 */

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const WORKER_LOOP_PATH = require.resolve('../lib/team/worker-loop.cjs');
const SUBPROCESS_PATH = require.resolve('../lib/team/subprocess.cjs');

const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;
const originalExistsSync = fs.existsSync;

function loadWorkerLoop() {
  delete require.cache[WORKER_LOOP_PATH];
  return require(WORKER_LOOP_PATH);
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
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

/**
 * Write a handoff file directly into a given bucket directory.
 * Simulates the dispatcher having pre-claimed the handoff (claimed_by: handoff-dispatcher).
 */
function writeHandoffToBucket(tmpDir, bucket, id, frontmatter, body) {
  const dir = path.join(tmpDir, '.planning', 'handoffs', bucket);
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    let serialized = v;
    if (serialized === null || serialized === undefined) serialized = 'null';
    else if (typeof serialized === 'object') serialized = JSON.stringify(serialized);
    lines.push(`${k}: ${serialized}`);
  }
  lines.push('---');
  lines.push('');
  fs.writeFileSync(path.join(dir, `${id}.md`), lines.join('\n') + (body || ''));
}

/**
 * Enqueue a mailbox message for a worker (simulates what the dispatcher does
 * after it routes a handoff to a worker mailbox).
 */
function enqueueMailboxMsg(tmpDir, workerId, msg) {
  const mailboxDir = path.join(tmpDir, '.planning', 'team', 'workers', workerId, 'mailbox');
  fs.mkdirSync(mailboxDir, { recursive: true });
  const seqFile = path.join(tmpDir, '.planning', 'team', 'dispatch.seq');
  fs.mkdirSync(path.dirname(seqFile), { recursive: true });
  const cur = fs.existsSync(seqFile) ? Number(fs.readFileSync(seqFile, 'utf8').trim()) : 0;
  const seq = String(cur + 1).padStart(4, '0');
  fs.writeFileSync(seqFile, String(cur + 1));
  const refSafe = String(msg.ref || 'unknown').replace(/[^A-Za-z0-9._-]/g, '_');
  const filename = `${seq}-handoff-${refSafe}.msg.json`;
  fs.writeFileSync(path.join(mailboxDir, filename), JSON.stringify(msg, null, 2));
}

/**
 * Read and parse worker log entries.
 */
function readWorkerLog(tmpDir, workerId) {
  const logFile = path.join(tmpDir, '.planning', 'team', 'workers', workerId, 'log.jsonl');
  if (!fs.existsSync(logFile)) return [];
  return fs.readFileSync(logFile, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

afterEach(() => {
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  fs.existsSync = originalExistsSync;
  delete require.cache[WORKER_LOOP_PATH];
  delete require.cache[SUBPROCESS_PATH];
});

test('dispatcher-routed handoff in claimed/ is processed without work-skip-empty-body', async () => {
  const tmpDir = createTempDir('gad-claim-limbo-');
  const workerId = 'w1';
  const handoffId = 'h-2026-01-01T00-00-00-global-273';
  const handoffBody = 'Fix the widget module per task GLOBAL-T-273-15.';

  try {
    // Setup: team config with one worker
    writeTeamConfig(tmpDir, {
      workers: 1,
      roles: ['executor'],
      workers_spec: [{ id: workerId, role: 'executor', lane: null, runtime: 'codex-cli', runtime_cmd: 'echo ok' }],
      runtime: 'codex-cli',
      runtime_cmd: 'echo ok',
      autopause_threshold: 20,
      tick_ms: 50,
      created_at: '2026-01-01T00:00:00.000Z',
      supervisor_pid: 1,
    });
    ensureWorkerDirs(tmpDir, workerId);

    // Pre-condition: handoff is in claimed/ with claimed_by: handoff-dispatcher
    // (simulates dispatcher having reserved it but before worker picked it up)
    writeHandoffToBucket(tmpDir, 'claimed', handoffId, {
      id: handoffId,
      projectid: 'global',
      phase: '273',
      task_id: 'GLOBAL-T-273-15',
      created_at: '2026-01-01T00:00:00.000Z',
      created_by: 'operator',
      claimed_by: 'handoff-dispatcher',
      claimed_at: '2026-01-01T00:00:01.000Z',
      completed_at: 'null',
      priority: 'normal',
      estimated_context: 'prescribed',
      risk: 'safe',
      time: 'standard',
      surface: 'local',
    }, handoffBody);

    // Dispatcher also drops a mailbox message for this worker
    enqueueMailboxMsg(tmpDir, workerId, {
      kind: 'handoff',
      ref: handoffId,
      projectid: 'global',
      priority: 'normal',
      runtime_preference: null,
      enqueued_at: '2026-01-01T00:00:01.000Z',
      enqueued_by: 'dispatcher',
    });

    // Stub subprocess to succeed immediately with a minimal stdout
    let subprocessPromptFile = null;
    let subprocessBodySeen = null;
    delete require.cache[SUBPROCESS_PATH];
    const subprocessMod = require(SUBPROCESS_PATH);
    const originalRunSubprocess = subprocessMod.runSubprocess;
    subprocessMod.runSubprocess = async (_baseDir, _workerId, _cmd, promptFile) => {
      subprocessPromptFile = promptFile;
      // Read the prompt file to verify body was non-empty
      try { subprocessBodySeen = fs.readFileSync(promptFile, 'utf8'); } catch {}
      return { code: 0, stdout: '', stderr: '', rate_limited: false };
    };

    // Stub timers: sleep immediately, heartbeat interval is a no-op
    const sleepCalls = [];
    global.setTimeout = (fn, ms, ...args) => {
      sleepCalls.push(ms);
      return originalSetTimeout(() => fn(...args), 0);
    };
    global.setInterval = () => ({ unref() {} });
    global.clearInterval = () => {};

    // Stop after first useful iteration: allow exactly 2 stop-flag checks
    // (first check false = enter loop; second check true = exit)
    let stopChecks = 0;
    fs.existsSync = (targetPath) => {
      const p = String(targetPath);
      if (p.endsWith(path.join('workers', workerId, 'stop.flag'))) {
        stopChecks += 1;
        return stopChecks > 1;
      }
      return originalExistsSync(targetPath);
    };

    const { runWorker } = loadWorkerLoop();
    await runWorker(tmpDir, workerId);

    // Restore subprocess
    subprocessMod.runSubprocess = originalRunSubprocess;

    // Assertions
    const logEntries = readWorkerLog(tmpDir, workerId);
    const skipEntries = logEntries.filter(e => e.kind === 'work-skip-empty-body');
    const claimViaDispatcher = logEntries.filter(e => e.kind === 'claim-via-dispatcher-preempt');
    const workStart = logEntries.filter(e => e.kind === 'work-start');
    const workComplete = logEntries.filter(e => e.kind === 'work-complete');

    assert.equal(
      skipEntries.length, 0,
      `Expected 0 work-skip-empty-body entries, got ${skipEntries.length}: ${JSON.stringify(skipEntries)}`,
    );

    assert.equal(
      claimViaDispatcher.length, 1,
      `Expected 1 claim-via-dispatcher-preempt log entry, got ${claimViaDispatcher.length}`,
    );

    assert.equal(
      workStart.length, 1,
      `Expected 1 work-start entry, got ${workStart.length}`,
    );

    assert.equal(
      workComplete.length, 1,
      `Expected 1 work-complete entry, got ${workComplete.length}`,
    );

    assert.ok(
      subprocessPromptFile !== null,
      'Subprocess should have been invoked with a prompt file',
    );

    // Verify the prompt contained the handoff body (non-empty)
    assert.ok(
      subprocessBodySeen && subprocessBodySeen.includes(handoffBody),
      `Prompt file should contain handoff body. Got: ${subprocessBodySeen ? subprocessBodySeen.slice(0, 200) : '(null)'}`,
    );
  } finally {
    cleanup(tmpDir);
  }
});
