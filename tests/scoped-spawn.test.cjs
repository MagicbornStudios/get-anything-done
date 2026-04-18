/**
 * scoped-spawn.test.cjs — unit tests for lib/scoped-spawn.cjs (task 60-04).
 *
 * Spec: references/byok-design.md §8 (scoped-spawn wrapper).
 * Decisions: gad-266 G (merge default), gad-263 (offload consumer).
 *
 * Pure unit tests — no real child process, no real disk, no real keychain.
 * The secrets store and child_process module are both injected as mocks via
 * the createScopedSpawner factory.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  createScopedSpawner,
  scopedSpawn,
  ScopedSpawnError,
} = require('../lib/scoped-spawn.cjs');
const { SecretsStoreError } = require('../lib/secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockStore({ bag = null, getError = null, listError = null } = {}) {
  // `bag` is a plain { KEY: value } map representing the project's decrypted
  // current-version keys. `null` models "no envelope yet" — both list() and
  // get() throw the no-envelope shape.
  const calls = { list: [], get: [] };
  const store = {
    async list({ projectId }) {
      calls.list.push({ projectId });
      if (listError) throw listError;
      if (bag === null) {
        throw new SecretsStoreError('KEY_NOT_FOUND', `no envelope for project "${projectId}"`);
      }
      return Object.keys(bag).map((keyName) => ({
        keyName,
        provider: '',
        scope: '',
        lastRotated: '2026-04-17T00:00:00Z',
        currentVersion: 1,
      }));
    },
    async get({ projectId, keyName }) {
      calls.get.push({ projectId, keyName });
      if (getError) throw getError;
      if (bag === null) {
        throw new SecretsStoreError('KEY_NOT_FOUND', `no envelope for project "${projectId}"`);
      }
      if (!(keyName in bag)) {
        throw new SecretsStoreError('KEY_NOT_FOUND', `key "${keyName}" not set for project "${projectId}"`);
      }
      return bag[keyName];
    },
  };
  return { store, calls };
}

function makeMockChildProcess({ spawnError = null } = {}) {
  const calls = [];
  const fakeChild = { pid: 9999, __fake: true };
  const cp = {
    spawn(command, args, options) {
      calls.push({ command, args, options });
      if (spawnError) throw spawnError;
      return fakeChild;
    },
  };
  return { cp, calls, fakeChild };
}

// Snapshot process.env so tests can assert non-mutation.
function snapshotEnv() {
  return JSON.parse(JSON.stringify(process.env));
}

// ---------------------------------------------------------------------------
// 1. Happy path — one key
// ---------------------------------------------------------------------------

describe('scoped-spawn: happy path', () => {
  test('single key merges into child env; parent env untouched', async () => {
    const { store } = makeMockStore({ bag: { OPENAI_API_KEY: 'sk-one' } });
    const { cp, calls, fakeChild } = makeMockChildProcess();
    const envBefore = snapshotEnv();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    const child = await spawner.spawn({
      projectId: 'proj-a',
      command: 'node',
      args: ['-e', 'console.log(1)'],
    });

    assert.strictEqual(child, fakeChild, 'returns the child handle');
    assert.strictEqual(calls.length, 1);
    const { command, args, options } = calls[0];
    assert.strictEqual(command, 'node');
    assert.deepStrictEqual(args, ['-e', 'console.log(1)']);
    assert.strictEqual(options.env.OPENAI_API_KEY, 'sk-one');
    assert.strictEqual(options.env.GAD_PROJECT_ID, 'proj-a');
    // Parent env untouched.
    assert.deepStrictEqual(snapshotEnv(), envBefore);
    assert.strictEqual(process.env.OPENAI_API_KEY, envBefore.OPENAI_API_KEY);
  });
});

// ---------------------------------------------------------------------------
// 2. Multiple keys
// ---------------------------------------------------------------------------

describe('scoped-spawn: multiple keys', () => {
  test('keyNames: [K1,K2] merges both into child env', async () => {
    const { store, calls } = makeMockStore({
      bag: { K1: 'val1', K2: 'val2', K3: 'val3' },
    });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({
      projectId: 'proj-b',
      command: 'echo',
      keyNames: ['K1', 'K2'],
    });

    assert.strictEqual(calls.list.length, 0, 'keyNames bypasses list');
    assert.strictEqual(calls.get.length, 2);
    const env = cpCalls[0].options.env;
    assert.strictEqual(env.K1, 'val1');
    assert.strictEqual(env.K2, 'val2');
    assert.strictEqual(env.K3, undefined, 'K3 not requested → not in child env');
    assert.strictEqual(env.GAD_PROJECT_ID, 'proj-b');
  });
});

// ---------------------------------------------------------------------------
// 3. keyNames unspecified → list + fetch all
// ---------------------------------------------------------------------------

describe('scoped-spawn: enumerate via list', () => {
  test('no keyNames → calls store.list + fetches every listed key', async () => {
    const { store, calls } = makeMockStore({
      bag: { ALPHA: 'a', BETA: 'b', GAMMA: 'g' },
    });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({ projectId: 'proj-c', command: 'echo' });

    assert.strictEqual(calls.list.length, 1);
    assert.strictEqual(calls.get.length, 3);
    const env = cpCalls[0].options.env;
    assert.strictEqual(env.ALPHA, 'a');
    assert.strictEqual(env.BETA, 'b');
    assert.strictEqual(env.GAMMA, 'g');
    assert.strictEqual(env.GAD_PROJECT_ID, 'proj-c');
  });
});

// ---------------------------------------------------------------------------
// 4. Parent env untouched (deep assertion)
// ---------------------------------------------------------------------------

describe('scoped-spawn: parent env isolation', () => {
  test('process.env deep-equal before/after spawn', async () => {
    const { store } = makeMockStore({ bag: { SECRET: 'shh' } });
    const { cp } = makeMockChildProcess();

    const before = snapshotEnv();
    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({ projectId: 'proj-d', command: 'node' });
    const after = snapshotEnv();

    assert.deepStrictEqual(after, before);
    assert.strictEqual(process.env.SECRET, undefined, 'SECRET leaked into parent');
    assert.strictEqual(process.env.GAD_PROJECT_ID, before.GAD_PROJECT_ID);
  });
});

// ---------------------------------------------------------------------------
// 5. Collision — project overrides parent
// ---------------------------------------------------------------------------

describe('scoped-spawn: env collision', () => {
  test('project bag overrides parent env on name collision (gad-266 G)', async () => {
    process.env.__GAD_TEST_COLLIDE__ = 'parent-value';
    try {
      const { store } = makeMockStore({ bag: { __GAD_TEST_COLLIDE__: 'bag-value' } });
      const { cp, calls: cpCalls } = makeMockChildProcess();

      const spawner = createScopedSpawner({ store, childProcess: cp });
      await spawner.spawn({ projectId: 'proj-e', command: 'node' });

      const env = cpCalls[0].options.env;
      assert.strictEqual(env.__GAD_TEST_COLLIDE__, 'bag-value',
        'project bag must override parent on name collision');
      // Parent env still has parent-value.
      assert.strictEqual(process.env.__GAD_TEST_COLLIDE__, 'parent-value');
    } finally {
      delete process.env.__GAD_TEST_COLLIDE__;
    }
  });
});

// ---------------------------------------------------------------------------
// 6. PROJECT_NOT_FOUND default → proceed with empty projectEnv
// ---------------------------------------------------------------------------

describe('scoped-spawn: missing envelope (default mode)', () => {
  test('store has no envelope → spawn still fires with parent env + GAD_PROJECT_ID', async () => {
    const { store } = makeMockStore({ bag: null });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    const child = await spawner.spawn({ projectId: 'proj-missing', command: 'node' });

    assert.ok(child);
    assert.strictEqual(cpCalls.length, 1, 'spawn still happened');
    const env = cpCalls[0].options.env;
    assert.strictEqual(env.GAD_PROJECT_ID, 'proj-missing');
    // Parent env keys still present (PATH is a good cross-platform canary).
    assert.ok(env.PATH !== undefined || env.Path !== undefined || process.env.PATH === undefined);
  });
});

// ---------------------------------------------------------------------------
// 7. PROJECT_NOT_FOUND with requireBag → throws
// ---------------------------------------------------------------------------

describe('scoped-spawn: missing envelope (requireBag)', () => {
  test('requireBag=true + no envelope → throws ScopedSpawnError PROJECT_NOT_FOUND', async () => {
    const { store } = makeMockStore({ bag: null });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await assert.rejects(
      () => spawner.spawn({ projectId: 'proj-strict', command: 'node', requireBag: true }),
      (err) => {
        assert.ok(err instanceof ScopedSpawnError, 'wraps into ScopedSpawnError');
        assert.strictEqual(err.code, 'PROJECT_NOT_FOUND');
        assert.strictEqual(err.projectId, 'proj-strict');
        assert.ok(err.cause instanceof SecretsStoreError,
          'original store error preserved as .cause');
        return true;
      },
    );
    assert.strictEqual(cpCalls.length, 0, 'spawn never fires when requireBag throws');
  });
});

// ---------------------------------------------------------------------------
// 8. DECRYPT_FAILED — rewraps PASSPHRASE_INVALID
// ---------------------------------------------------------------------------

describe('scoped-spawn: decrypt failure propagation', () => {
  test('store.list throws PASSPHRASE_INVALID → rewrapped as DECRYPT_FAILED', async () => {
    const passErr = new SecretsStoreError('PASSPHRASE_INVALID', 'wrong');
    const { store } = makeMockStore({ listError: passErr });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await assert.rejects(
      () => spawner.spawn({ projectId: 'proj-f', command: 'node' }),
      (err) => {
        assert.ok(err instanceof ScopedSpawnError);
        assert.strictEqual(err.code, 'DECRYPT_FAILED');
        assert.ok(err.cause, '.cause preserved');
        assert.strictEqual(err.cause.code, 'PASSPHRASE_INVALID');
        return true;
      },
    );
    assert.strictEqual(cpCalls.length, 0, 'spawn never fires on decrypt failure');
  });

  test('store.get throws BAG_CORRUPT on an explicit keyNames fetch → DECRYPT_FAILED', async () => {
    const corruptErr = new SecretsStoreError('BAG_CORRUPT', 'tamper detected');
    const { store } = makeMockStore({
      bag: { OK: 'value' }, // list succeeds; but we override get
      getError: corruptErr,
    });
    const { cp } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await assert.rejects(
      () => spawner.spawn({ projectId: 'proj-corrupt', command: 'node', keyNames: ['OK'] }),
      (err) => {
        assert.strictEqual(err.code, 'DECRYPT_FAILED');
        assert.strictEqual(err.cause.code, 'BAG_CORRUPT');
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// 9. SPAWN_FAILED — childProcess.spawn throws synchronously
// ---------------------------------------------------------------------------

describe('scoped-spawn: spawn failure', () => {
  test('synchronous spawn error → throws SPAWN_FAILED with .cause', async () => {
    const { store } = makeMockStore({ bag: { X: 'y' } });
    const spawnErr = new Error('ENOENT: spawn node not found');
    const { cp } = makeMockChildProcess({ spawnError: spawnErr });

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await assert.rejects(
      () => spawner.spawn({ projectId: 'proj-g', command: 'nonexistent' }),
      (err) => {
        assert.ok(err instanceof ScopedSpawnError);
        assert.strictEqual(err.code, 'SPAWN_FAILED');
        assert.strictEqual(err.command, 'nonexistent');
        assert.strictEqual(err.cause, spawnErr, '.cause is the raw error');
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// 10. GAD_PROJECT_ID injection — present in every happy path
// ---------------------------------------------------------------------------

describe('scoped-spawn: GAD_PROJECT_ID injection', () => {
  test('GAD_PROJECT_ID is present even when the bag tries to shadow it', async () => {
    // If someone stored GAD_PROJECT_ID in their bag (silly but possible),
    // the injection still wins because it's spread LAST.
    const { store } = makeMockStore({
      bag: { GAD_PROJECT_ID: 'wrong-id', OTHER: 'x' },
    });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({ projectId: 'correct-id', command: 'node' });

    assert.strictEqual(cpCalls[0].options.env.GAD_PROJECT_ID, 'correct-id',
      'injection must win over bag value');
    assert.strictEqual(cpCalls[0].options.env.OTHER, 'x');
  });

  test('empty bag still gets GAD_PROJECT_ID', async () => {
    const { store } = makeMockStore({ bag: {} });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({ projectId: 'empty-bag', command: 'node' });

    assert.strictEqual(cpCalls[0].options.env.GAD_PROJECT_ID, 'empty-bag');
  });
});

// ---------------------------------------------------------------------------
// 11. Options passthrough + factory contract
// ---------------------------------------------------------------------------

describe('scoped-spawn: options + API shape', () => {
  test('caller options (cwd/stdio/shell) pass through; env is replaced', async () => {
    const { store } = makeMockStore({ bag: { K: 'v' } });
    const { cp, calls: cpCalls } = makeMockChildProcess();

    const spawner = createScopedSpawner({ store, childProcess: cp });
    await spawner.spawn({
      projectId: 'proj-opt',
      command: 'node',
      args: [],
      options: { cwd: '/tmp', stdio: 'inherit', env: { IGNORED: 'yes' } },
    });

    const opts = cpCalls[0].options;
    assert.strictEqual(opts.cwd, '/tmp');
    assert.strictEqual(opts.stdio, 'inherit');
    // Our env wins over the caller's options.env.
    assert.strictEqual(opts.env.K, 'v');
    assert.strictEqual(opts.env.IGNORED, undefined,
      'caller-supplied env must not leak — scoped-spawn owns env');
  });

  test('createScopedSpawner enforces dep shape', () => {
    assert.throws(() => createScopedSpawner({}), /store must expose/);
    assert.throws(
      () => createScopedSpawner({ store: { get: () => {}, list: () => {} } }),
      /childProcess must expose spawn/,
    );
  });

  test('default scopedSpawn export is a function', () => {
    assert.strictEqual(typeof scopedSpawn, 'function');
    assert.strictEqual(typeof createScopedSpawner, 'function');
    assert.strictEqual(typeof ScopedSpawnError, 'function');
  });

  test('TypeError on empty projectId or command', async () => {
    const { store } = makeMockStore({ bag: {} });
    const { cp } = makeMockChildProcess();
    const spawner = createScopedSpawner({ store, childProcess: cp });

    await assert.rejects(
      () => spawner.spawn({ projectId: '', command: 'node' }),
      /projectId is required/,
    );
    await assert.rejects(
      () => spawner.spawn({ projectId: 'p', command: '' }),
      /command is required/,
    );
  });
});
