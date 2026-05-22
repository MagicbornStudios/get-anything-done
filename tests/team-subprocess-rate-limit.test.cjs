'use strict';

const { beforeEach, afterEach, describe, test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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
  constructor({ naturalExitMs = 50, naturalExitCode = 0 } = {}) {
    super();
    this.stdout = new FakeStream();
    this.stderr = new FakeStream();
    this.killCalls = [];
    this.naturalExitMs = naturalExitMs;
    this.naturalExitCode = naturalExitCode;
    this.naturalExitTimer = null;
  }

  start() {
    this.naturalExitTimer = setTimeout(() => {
      this.emit('close', this.naturalExitCode);
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

  test('midstream quota stderr followed by exit 0 is not classified as failure', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 0 });
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
    assert.strictEqual(result.rate_limited, false);
    assert.strictEqual(result.classification.class, 'unknown');
    assert.match(result.stderr, /RESOURCE_EXHAUSTED/);
    assert.ok(elapsedMs >= fakeChild.naturalExitMs, `expected natural exit, got ${elapsedMs}ms`);
    assert.deepStrictEqual(fakeChild.killCalls, []);
    assert.ok(!logEntries.some((entry) => entry.kind === 'rate-limit-detected-midstream'));
    assert.ok(!logEntries.some((entry) => entry.kind === 'runtime-failure-classified'));
  });

  // S1: quota_soft — exhausted capacity + parseable duration
  test('S1: exit failure with quota_soft stderr is classified terminally', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
  test('S2: exit failure with RESOURCE_EXHAUSTED is quota_soft', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
  test('S3: exit failure with model capacity text is quota_soft', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
  test('S5: exit failure with rateLimitExceeded in JSON body is quota_soft', async () => {
    let fakeChild = null;
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
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
  test('legacy kind rate-limit-detected-midstream still emitted for terminal quota_soft failures', async () => {
    let fakeChild = null;
    const logEntries = [];
    const runSubprocess = loadRunSubprocessWithSpawn(() => {
      fakeChild = new FakeChild({ naturalExitMs: 40, naturalExitCode: 1 });
      fakeChild.start();
      return fakeChild;
    });

    const resultPromise = runSubprocess(process.cwd(), 'w5', 'gemini-cli', 'prompt.md', (e) => logEntries.push(e));
    setTimeout(() => fakeChild.stderr.emit('data', Buffer.from(FIXTURE_S1)), 25);
    await resultPromise;

    assert.ok(logEntries.some((e) => e.kind === 'rate-limit-detected-midstream'), 'legacy kind must still be emitted');
    assert.ok(logEntries.some((e) => e.kind === 'runtime-failure-classified'), 'new kind must also be emitted');
  });

  test('launching with an isolated codex profile does not rewrite canonical auth.json', async () => {
    let spawnCall = null;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-team-subprocess-'));
    const canonicalHome = path.join(tmpDir, 'home');
    const canonicalAuthDir = path.join(canonicalHome, '.codex');
    const canonicalAuthPath = path.join(canonicalAuthDir, 'auth.json');
    const profileDir = path.join(tmpDir, '.planning', 'team', 'workers', 'w5', 'accounts', 'codex-cli', 'secondary');
    const runtimeEnv = {
      HOME: profileDir,
      USERPROFILE: profileDir,
      XDG_CONFIG_HOME: path.join(profileDir, '.config'),
      CODEX_HOME: path.join(profileDir, '.codex'),
      GAD_RUNTIME_ACCOUNT_LABEL: 'secondary',
      GAD_RUNTIME_ACCOUNT_FILE: path.join(profileDir, '.codex', 'auth.json'),
    };

    fs.mkdirSync(canonicalAuthDir, { recursive: true });
    fs.mkdirSync(path.dirname(runtimeEnv.GAD_RUNTIME_ACCOUNT_FILE), { recursive: true });
    fs.writeFileSync(canonicalAuthPath, '{"token":"canonical"}', 'utf8');
    fs.writeFileSync(runtimeEnv.GAD_RUNTIME_ACCOUNT_FILE, '{"token":"secondary"}', 'utf8');

    const runSubprocess = loadRunSubprocessWithSpawn((command, args, options) => {
      spawnCall = { command, args, options };
      const fakeChild = new FakeChild({ naturalExitMs: 5, naturalExitCode: 0 });
      fakeChild.start();
      return fakeChild;
    });

    await runSubprocess(tmpDir, 'w5', 'codex exec', 'prompt.md', () => {}, runtimeEnv, { runtimeId: 'codex-cli' });

    assert.ok(spawnCall, 'spawn should be invoked');
    assert.equal(spawnCall.options.env.CODEX_HOME, runtimeEnv.CODEX_HOME);
    assert.equal(spawnCall.options.env.HOME, runtimeEnv.HOME);
    assert.equal(spawnCall.options.env.GAD_RUNTIME_ACCOUNT_LABEL, 'secondary');
    assert.equal(fs.readFileSync(canonicalAuthPath, 'utf8'), '{"token":"canonical"}');
  });
});
