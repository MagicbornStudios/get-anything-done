'use strict';

const { beforeEach, afterEach, describe, test } = require('node:test');
const assert = require('node:assert');
const { EventEmitter } = require('node:events');

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
      'midstream detection should be logged',
    );
  });
});
