'use strict';

const { beforeEach, afterEach, describe, test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

// S1-S6 real stderr fixtures from .planning/team/workers/w2/log.jsonl
const FIXTURE_S1 = 'TerminalQuotaError: You have exhausted your capacity on this model. Your quota will reset after 13h55m22s.';
const FIXTURE_S2 = 'Attempt 1 failed with status 429. Retrying with backoff... _GaxiosError: [{ "error": { "code": 429, "status": "RESOURCE_EXHAUSTED", "reason": "MODEL_CAPACITY_EXHAUSTED" } }]';
const FIXTURE_S3 = 'No capacity available for model gemini-3-flash-preview on the server';
const FIXTURE_S4 = 'An unexpected critical error occurred:[object Object]';
const FIXTURE_S5 = '"reason": "rateLimitExceeded"';
const FIXTURE_S6 = 'Error: AttachConsole failed at conpty_console_list_agent.js:11';

const MODULE_PATH = require.resolve('../lib/team/subprocess.cjs');
const CHILD_PROCESS_PATH = require.resolve('child_process');

let originalSpawn;

class FakeStream extends EventEmitter {}

class FakeChild extends EventEmitter {
  constructor({ naturalExitMs = 5000 } = {}) {
    super();
    this.stdout = new FakeStream();
    this.stderr = new FakeStream();
    this.killCalls = [];
    this.naturalExitMs = naturalExitMs;
    this.naturalExitTimer = null;
  }

  start() {
    this.naturalExitTimer = setTimeout(() => {
      this.emit('close', 0);
    }, this.naturalExitMs);
    if (this.naturalExitTimer.unref) this.naturalExitTimer.unref();
  }

  kill(signal) {
    this.killCalls.push({ signal, at: Date.now() });
    if (signal === 'SIGTERM') {
      setTimeout(() => {
        if (this.naturalExitTimer) clearTimeout(this.naturalExitTimer);
        this.emit('close', 143);
      }, 50);
    }
    return true;
  }
}

function loadRunSubprocessWithSpawn(spawnImpl) {
  delete require.cache[MODULE_PATH];
  delete require.cache[CHILD_PROCESS_PATH];
  const childProcess = require('child_process');
  childProcess.spawn = spawnImpl;
  return require('../lib/team/subprocess.cjs').runSubprocess;
}

describe('team subprocess rate-limit handling', () => {
  beforeEach(() => {
    originalSpawn = require('child_process').spawn;
  });

  afterEach(() => {
    const childProcess = require('child_process');
    childProcess.spawn = originalSpawn;
    delete require.cache[MODULE_PATH];
  });

  test('kills a rate-limited child midstream and resolves before its natural exit', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const startedAt = Date.now();
    const resultPromise = runSubprocess(
      process.cwd(),
      'w5',
      'gemini-cli --prompt',
      'prompt.md',
      (entry) => logEntries.push({ ...entry, at: Date.now() }),
    );

    setTimeout(() => {
      fakeChild.stderr.emit('data', Buffer.from('RESOURCE_EXHAUSTED: quota will reset later\n'));
    }, 25);

    const result = await resultPromise;
    const elapsedMs = Date.now() - startedAt;

    assert.ok(fakeChild, 'fake child created');
    assert.strictEqual(result.rate_limited, true);
    assert.match(result.stderr, /RESOURCE_EXHAUSTED/);
    assert.ok(elapsedMs < 2000, `expected early resolve, got ${elapsedMs}ms`);
    assert.ok(elapsedMs < fakeChild.naturalExitMs, 'resolved before natural exit');
    assert.deepStrictEqual(fakeChild.killCalls.map((call) => call.signal), ['SIGTERM']);
    assert.ok(
      logEntries.some((entry) => entry.kind === 'rate-limit-detected-midstream'),
      'midstream detection should be logged (legacy back-compat)',
    );
    assert.ok(
      logEntries.some((entry) => entry.kind === 'runtime-failure-classified'),
      'new classification log entry should also be emitted',
    );
  });

  // S1: quota_soft — exhausted capacity + parseable duration
  test('S1: terminates on quota_soft (exhausted + reset duration) and logs classification', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', (e) => logEntries.push(e));
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S1)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.rate_limited, true);
    assert.ok(result.classification, 'classification should be present');
    assert.strictEqual(result.classification.class, 'quota_soft');
    assert.ok(result.classification.cooldown_ms !== null, 'cooldown_ms should be extracted');
    assert.ok(Math.abs(result.classification.cooldown_ms - 50122 * 1000) < 60 * 1000, `expected ~50122000ms, got ${result.classification.cooldown_ms}`);
  });

  // S2: quota_soft — RESOURCE_EXHAUSTED in Gaxios error
  test('S2: terminates on RESOURCE_EXHAUSTED / MODEL_CAPACITY_EXHAUSTED', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', (e) => logEntries.push(e));
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S2)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.rate_limited, true);
    assert.strictEqual(result.classification.class, 'quota_soft');
  });

  // S3: quota_soft — model-specific capacity
  test('S3: terminates on No capacity available for model', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', () => {});
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S3)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.rate_limited, true);
    assert.strictEqual(result.classification.class, 'quota_soft');
  });

  // S4: output_unparseable — must NOT be quota
  test('S4: output_unparseable ([object Object]) is NOT quota', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', () => {});
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S4)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.classification.class, 'output_unparseable', `expected output_unparseable, got ${result.classification.class}`);
    assert.notStrictEqual(result.classification.class, 'quota_soft');
    assert.notStrictEqual(result.classification.class, 'quota_hard_cap');
  });

  // S5: quota_soft — rateLimitExceeded
  test('S5: terminates on rateLimitExceeded in JSON body', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', () => {});
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S5)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.rate_limited, true);
    assert.strictEqual(result.classification.class, 'quota_soft');
  });

  // S6: runtime_crash — Windows PTY (must NOT be quota or unknown)
  test('S6: runtime_crash (AttachConsole failed) is NOT quota or unknown', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', () => {});
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S6)), 25);
    const result = await resultPromise;

    assert.strictEqual(result.classification.class, 'runtime_crash', `expected runtime_crash, got ${result.classification.class}`);
    assert.notStrictEqual(result.classification.class, 'quota_soft');
    assert.notStrictEqual(result.classification.class, 'unknown');
  });

  // Back-compat: legacy kind still emitted
  test('legacy kind rate-limit-detected-midstream still emitted for quota_soft', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 5000 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', (e) => logEntries.push(e));
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S1)), 25);
    await resultPromise;

    assert.ok(logEntries.some((e) => e.kind === 'rate-limit-detected-midstream'), 'legacy kind must still be emitted');
    assert.ok(logEntries.some((e) => e.kind === 'runtime-failure-classified'), 'new kind must also be emitted');
  });
});
