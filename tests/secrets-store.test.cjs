/**
 * secrets-store.test.cjs — unit tests for lib/secrets-store.cjs (task 60-02).
 *
 * Spec: references/byok-design.md §13.
 *
 * These tests are pure — no real filesystem outside a tmp dir, no real OS
 * keychain, no TTY. A mock keychain is injected via _setKeychainForTest.
 *
 * Mandatory coverage (from task spec):
 *   1. set+get round-trip byte-for-byte
 *   2. list exposes metadata but never values
 *   3. rotate graceDays=0 instant retire; get returns new
 *   4. rotate graceDays=7 keeps old decryptable for grace
 *   5. revoke removes key; get throws KEY_NOT_FOUND
 *   6. AAD slot-swap detection → BAG_CORRUPT
 *   7. gitignore fail-closed → GITIGNORE_WRITE_FAILED and no .enc written
 *   8. ciphertext byte-mutation → BAG_CORRUPT
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('../lib/secrets-store.cjs');
const { SecretsStoreError } = require('../lib/secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const PASSPHRASE = 'correct horse battery staple';

function makeMockKeychain() {
  const store = new Map();
  return {
    _store: store,
    async get(service, account) {
      const v = store.get(`${service}::${account}`);
      return v ? Buffer.from(v) : null;
    },
    async set(service, account, bytes) {
      store.set(`${service}::${account}`, Buffer.from(bytes));
    },
    async delete(service, account) {
      store.delete(`${service}::${account}`);
    },
    async isAvailable() {
      return true;
    },
  };
}

function makeUnavailableKeychain() {
  return {
    async get() { return null; },
    async set() { throw new Error('unavailable'); },
    async delete() {},
    async isAvailable() { return false; },
  };
}

let tmpRoot;
const PROJECT_ID = 'test-project';

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-secrets-test-'));
  // Seed a gitignore-compatible root. Tests that need fail-closed will
  // override.
  store._setProjectRootForTest(PROJECT_ID, tmpRoot);
  store._setKeychainForTest(makeUnavailableKeychain()); // default: passphrase path
  store._setClockForTest(null);
});

afterEach(() => {
  store._setProjectRootForTest(PROJECT_ID, null);
  store._setKeychainForTest(null);
  store._setClockForTest(null);
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('secrets-store: round-trip', () => {
  test('set then get returns the stored value byte-for-byte', async () => {
    const value = 'sk-test-abc123_!@#unicode-测试-';
    await store.set({ projectId: PROJECT_ID, keyName: 'OPENAI_API_KEY', value, passphrase: PASSPHRASE });
    const got = await store.get({ projectId: PROJECT_ID, keyName: 'OPENAI_API_KEY', passphrase: PASSPHRASE });
    assert.strictEqual(got, value);
  });

  test('envelope file is created at .gad/secrets/<id>.enc and is valid JSON', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'X', value: 'y', passphrase: PASSPHRASE });
    const p = store.envelopePath(PROJECT_ID);
    assert.ok(fs.existsSync(p), 'envelope should exist on disk');
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(parsed.schemaVersion, 1);
    assert.strictEqual(parsed.projectId, PROJECT_ID);
    assert.strictEqual(parsed.cipher, 'AES-256-GCM');
    assert.strictEqual(parsed.kdf, 'PBKDF2');
    assert.strictEqual(parsed.kdfParams.iterations, 600000);
    assert.ok(parsed.keys.X);
    // Ciphertext must NOT be the plaintext.
    const ct = Buffer.from(parsed.keys.X.versions['1'].ciphertextB64, 'base64').toString('utf8');
    assert.notStrictEqual(ct, 'y');
  });

  test('set refuses an existing key (use rotate)', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v1', passphrase: PASSPHRASE });
    await assert.rejects(
      () => store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v2', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'KEY_ALREADY_EXISTS',
    );
  });
});

describe('secrets-store: list', () => {
  test('list exposes metadata only — no values, no ciphertext', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'va', provider: 'openai', scope: 'model-api', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'B', value: 'vb', provider: 'replicate', scope: 'image-gen', passphrase: PASSPHRASE });
    const out = await store.list({ projectId: PROJECT_ID, passphrase: PASSPHRASE });
    assert.strictEqual(out.length, 2);
    for (const row of out) {
      assert.ok(row.keyName);
      assert.ok('provider' in row);
      assert.ok('scope' in row);
      assert.ok('lastRotated' in row);
      assert.ok('currentVersion' in row);
      assert.ok(!('value' in row));
      assert.ok(!('ciphertextB64' in row));
      assert.ok(!('nonceB64' in row));
    }
    const a = out.find(r => r.keyName === 'A');
    assert.strictEqual(a.provider, 'openai');
    assert.strictEqual(a.scope, 'model-api');
    assert.strictEqual(a.currentVersion, 1);
  });
});

describe('secrets-store: rotation', () => {
  test('rotate graceDays=0 retires old immediately; get returns new', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v1', passphrase: PASSPHRASE });
    const { oldVersion, newVersion } = await store.rotate({
      projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: 0, passphrase: PASSPHRASE,
    });
    assert.strictEqual(oldVersion, 1);
    assert.strictEqual(newVersion, 2);
    const got = await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE });
    assert.strictEqual(got, 'v2');
    // Old version should be purged.
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', version: 1, passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'ROTATION_GRACE_EXPIRED',
    );
  });

  test('rotate graceDays=7 keeps old decryptable for grace window', async () => {
    // Freeze the clock so we can assert grace behavior deterministically.
    const t0 = new Date('2026-04-17T12:00:00.000Z');
    store._setClockForTest(() => t0);
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v1', passphrase: PASSPHRASE });

    // Rotate at t0 with 7-day grace.
    await store.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: 7, passphrase: PASSPHRASE });

    // Jump forward 3 days — old still valid.
    store._setClockForTest(() => new Date('2026-04-20T12:00:00.000Z'));
    const v1Mid = await store.get({ projectId: PROJECT_ID, keyName: 'K', version: 1, passphrase: PASSPHRASE });
    assert.strictEqual(v1Mid, 'v1');

    // Jump forward 8 days — old retired, purged on next access.
    store._setClockForTest(() => new Date('2026-04-25T12:00:00.000Z'));
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', version: 1, passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && (err.code === 'ROTATION_GRACE_EXPIRED' || err.code === 'KEY_EXPIRED'),
    );

    // Current version still works.
    const v2 = await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE });
    assert.strictEqual(v2, 'v2');
  });
});

describe('secrets-store: revoke', () => {
  test('revoke removes the key; get throws KEY_NOT_FOUND', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    await store.revoke({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE });
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'KEY_NOT_FOUND',
    );
  });

  test('revoke with version removes just that version', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v1', passphrase: PASSPHRASE });
    await store.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: 7, passphrase: PASSPHRASE });
    await store.revoke({ projectId: PROJECT_ID, keyName: 'K', version: 1, passphrase: PASSPHRASE });
    const got = await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE });
    assert.strictEqual(got, 'v2');
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', version: 1, passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError,
    );
  });
});

describe('secrets-store: integrity', () => {
  test('AAD slot-swap detection — swapping two ciphertexts on disk triggers BAG_CORRUPT', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'alpha-value', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'B', value: 'bravo-value', passphrase: PASSPHRASE });
    const p = store.envelopePath(PROJECT_ID);
    const env = JSON.parse(fs.readFileSync(p, 'utf8'));
    const aEntry = env.keys.A.versions['1'];
    const bEntry = env.keys.B.versions['1'];
    // Swap ciphertext + tag + nonce. AAD is still A|1 / B|1 per keyName.
    const tmp = { n: aEntry.nonceB64, c: aEntry.ciphertextB64, t: aEntry.authTagB64 };
    aEntry.nonceB64 = bEntry.nonceB64; aEntry.ciphertextB64 = bEntry.ciphertextB64; aEntry.authTagB64 = bEntry.authTagB64;
    bEntry.nonceB64 = tmp.n; bEntry.ciphertextB64 = tmp.c; bEntry.authTagB64 = tmp.t;
    fs.writeFileSync(p, JSON.stringify(env, null, 2) + '\n');
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'A', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'BAG_CORRUPT',
    );
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'B', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'BAG_CORRUPT',
    );
  });

  test('mutated ciphertext triggers BAG_CORRUPT', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    const p = store.envelopePath(PROJECT_ID);
    const env = JSON.parse(fs.readFileSync(p, 'utf8'));
    const entry = env.keys.K.versions['1'];
    const ct = Buffer.from(entry.ciphertextB64, 'base64');
    ct[0] = ct[0] ^ 0x01; // flip one bit
    entry.ciphertextB64 = ct.toString('base64');
    fs.writeFileSync(p, JSON.stringify(env, null, 2) + '\n');
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'BAG_CORRUPT',
    );
  });

  test('wrong passphrase fails with PASSPHRASE_INVALID', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: 'wrong-passphrase' }),
      (err) => err instanceof SecretsStoreError && err.code === 'PASSPHRASE_INVALID',
    );
  });
});

describe('secrets-store: gitignore fail-closed', () => {
  test('gitignore write failure aborts set AND leaves no .enc on disk', async () => {
    // Place a .gitignore that we will make unwritable. On Windows, setting
    // the file as read-only via fs.chmodSync is honored by node's writeFile.
    const gi = path.join(tmpRoot, '.gitignore');
    fs.writeFileSync(gi, '# existing\nnode_modules\n');
    // Make read-only. On Windows mode 0o444 makes the FILE attribute
    // read-only and fs.writeFileSync errors with EPERM. On POSIX, chmod
    // 0o444 plus being non-root also errors.
    fs.chmodSync(gi, 0o444);
    try {
      await assert.rejects(
        () => store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE }),
        (err) => err instanceof SecretsStoreError && err.code === 'GITIGNORE_WRITE_FAILED',
      );
      // CRITICAL: no envelope should have been written.
      assert.strictEqual(fs.existsSync(store.envelopePath(PROJECT_ID)), false, 'envelope file must not exist after gitignore failure');
    } finally {
      // Restore write so afterEach cleanup can rm the tree.
      fs.chmodSync(gi, 0o644);
    }
  });

  test('gitignore is created and populated if absent', async () => {
    // No gitignore yet.
    const gi = path.join(tmpRoot, '.gitignore');
    assert.strictEqual(fs.existsSync(gi), false);
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    assert.ok(fs.existsSync(gi));
    const contents = fs.readFileSync(gi, 'utf8');
    assert.match(contents, /\.gad\//);
  });

  test('gitignore is not re-appended if .gad/ already present', async () => {
    const gi = path.join(tmpRoot, '.gitignore');
    fs.writeFileSync(gi, 'node_modules\n.gad/\n');
    const before = fs.readFileSync(gi, 'utf8');
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    const after = fs.readFileSync(gi, 'utf8');
    assert.strictEqual(after, before);
  });
});

describe('secrets-store: audit log', () => {
  test('set/rotate/revoke append events to .audit.jsonl', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v1', provider: 'openai', scope: 'model-api', passphrase: PASSPHRASE });
    await store.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: 7, passphrase: PASSPHRASE });
    await store.revoke({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE });
    const events = fs.readFileSync(store.auditPath(PROJECT_ID), 'utf8')
      .trim().split('\n').map(JSON.parse);
    const kinds = events.map(e => e.event);
    assert.ok(kinds.includes('envset'));
    assert.ok(kinds.includes('envrotate'));
    assert.ok(kinds.includes('envrevoke'));
    // envset records provider + scope
    const envset = events.find(e => e.event === 'envset');
    assert.strictEqual(envset.provider, 'openai');
    assert.strictEqual(envset.scope, 'model-api');
  });
});

describe('secrets-store: keychain round-trip', () => {
  test('mock keychain: first set persists derived key; second get skips passphrase', async () => {
    const mockKc = makeMockKeychain();
    store._setKeychainForTest(mockKc);
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    // Keychain should now contain the derived key.
    assert.strictEqual(mockKc._store.size, 1);
    // get without passphrase: should succeed via keychain.
    const got = await store.get({ projectId: PROJECT_ID, keyName: 'K' });
    assert.strictEqual(got, 'v');
  });

  test('keychain hit with stale key (envelope re-created under different passphrase) falls through to passphrase', async () => {
    const mockKc = makeMockKeychain();
    store._setKeychainForTest(mockKc);
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    // Simulate envelope re-creation: delete the envelope + audit, set a
    // different value under a new passphrase. The keychain still has the
    // OLD derived key.
    fs.rmSync(path.join(tmpRoot, '.gad'), { recursive: true, force: true });
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v2', passphrase: 'different-passphrase' });
    // Explicitly restore the stale cached key in the mock.
    const [svcKey] = mockKc._store.keys();
    mockKc._store.set(svcKey, Buffer.alloc(32, 0x99)); // definitely wrong
    // get with the correct passphrase should still succeed via fallback.
    const got = await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: 'different-passphrase' });
    assert.strictEqual(got, 'v2');
  });
});

describe('secrets-store: input validation', () => {
  test('rotate with graceDays out of range throws GRACE_DAYS_OUT_OF_RANGE', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', passphrase: PASSPHRASE });
    await assert.rejects(
      () => store.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: 31, passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'GRACE_DAYS_OUT_OF_RANGE',
    );
    await assert.rejects(
      () => store.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'v2', graceDays: -1, passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'GRACE_DAYS_OUT_OF_RANGE',
    );
  });

  test('get on missing envelope throws PROJECT_NOT_FOUND (envelope absent)', async () => {
    // Code-split per todo 2026-04-17-secrets-store-project-not-found-split:
    // PROJECT_NOT_FOUND  = no envelope file on disk
    // KEY_NOT_FOUND      = envelope exists but the key is absent
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'X', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'PROJECT_NOT_FOUND',
    );
  });

  test('get on existing envelope but missing key throws KEY_NOT_FOUND', async () => {
    // Seed the envelope by setting one key, then ask for a different one.
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'a1', passphrase: PASSPHRASE });
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'NOPE', passphrase: PASSPHRASE }),
      (err) => err instanceof SecretsStoreError && err.code === 'KEY_NOT_FOUND',
    );
  });

  test('decryptAll returns all current-version values', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'a1', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'B', value: 'b1', passphrase: PASSPHRASE });
    const all = await store.decryptAll({ projectId: PROJECT_ID, passphrase: PASSPHRASE });
    assert.deepStrictEqual(all, { A: 'a1', B: 'b1' });
  });
});

// ---------------------------------------------------------------------------
// 60-07b: scope path resolution + per-scope isolation
// ---------------------------------------------------------------------------

describe('secrets-store: scope path resolution', () => {
  test('normalizeScope rejects path traversal + illegal segments', () => {
    assert.throws(() => store.normalizeScope('../etc'), (err) => err.code === 'VALIDATION');
    assert.throws(() => store.normalizeScope('foo/..'), (err) => err.code === 'VALIDATION');
    assert.throws(() => store.normalizeScope('/abs'), (err) => err.code === 'VALIDATION');
    assert.throws(() => store.normalizeScope('trailing/'), (err) => err.code === 'VALIDATION');
    assert.throws(() => store.normalizeScope('back\\slash'), (err) => err.code === 'VALIDATION');
    assert.throws(() => store.normalizeScope('has space'), (err) => err.code === 'VALIDATION');
    assert.strictEqual(store.normalizeScope('eval-x'), 'eval-x');
    assert.strictEqual(store.normalizeScope('eval-x/grime-time'), 'eval-x/grime-time');
    assert.strictEqual(store.normalizeScope(null), null);
    assert.strictEqual(store.normalizeScope(undefined), null);
    assert.strictEqual(store.normalizeScope(''), null);
  });

  test('envelopePath nests scoped bags under the projectId dir', () => {
    const planning = store.envelopePath(PROJECT_ID);
    assert.ok(planning.endsWith(`${PROJECT_ID}.enc`));
    const eval1 = store.envelopePath(PROJECT_ID, 'eval-x');
    assert.ok(eval1.includes(path.join(PROJECT_ID, 'eval-x.enc')));
    const species = store.envelopePath(PROJECT_ID, 'eval-x/grime-time');
    assert.ok(species.includes(path.join(PROJECT_ID, 'eval-x', 'grime-time.enc')));
  });

  test('keychainAccount uses legacy id for planning, ::scope for scoped', () => {
    assert.strictEqual(store.keychainAccount(PROJECT_ID), PROJECT_ID);
    assert.strictEqual(store.keychainAccount(PROJECT_ID, 'eval-x'), `${PROJECT_ID}::eval-x`);
    assert.strictEqual(store.keychainAccount(PROJECT_ID, 'eval-x/grime-time'), `${PROJECT_ID}::eval-x/grime-time`);
  });
});

describe('secrets-store: per-scope isolation', () => {
  test('writes to one scope do not appear in another', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'planning', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'eval-c', scopeBag: 'eval-x', passphrase: PASSPHRASE });
    assert.strictEqual(
      await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE }),
      'planning',
    );
    assert.strictEqual(
      await store.get({ projectId: PROJECT_ID, keyName: 'K', scope: 'eval-x', passphrase: PASSPHRASE }),
      'eval-c',
    );
  });

  test('scoped envelope file lands at .gad/secrets/<projectId>/<scope>.enc', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'v', scopeBag: 'eval-x/grime-time', passphrase: PASSPHRASE });
    const p = store.envelopePath(PROJECT_ID, 'eval-x/grime-time');
    assert.ok(fs.existsSync(p), `expected scoped envelope at ${p}`);
    // planning bag should NOT have been created.
    assert.ok(!fs.existsSync(store.envelopePath(PROJECT_ID)));
  });

  test('listChain merges parents and marks shadowed scopes', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'COMMON', value: 'planning-c', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'PLANNING_ONLY', value: 'po', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'COMMON', value: 'eval-c', scopeBag: 'eval-x', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'EVAL_ONLY', value: 'eo', scopeBag: 'eval-x', passphrase: PASSPHRASE });
    const rows = await store.listChain({
      projectId: PROJECT_ID,
      scopeChain: ['eval-x', null],
      passphrase: PASSPHRASE,
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.keyName, r]));
    assert.strictEqual(byKey.COMMON.scopeBag, 'eval-x');
    assert.deepStrictEqual(byKey.COMMON.shadows, [null]);
    assert.strictEqual(byKey.EVAL_ONLY.scopeBag, 'eval-x');
    assert.deepStrictEqual(byKey.EVAL_ONLY.shadows, []);
    assert.strictEqual(byKey.PLANNING_ONLY.scopeBag, null);
    assert.deepStrictEqual(byKey.PLANNING_ONLY.shadows, []);
  });

  test('decryptChain — most-specific wins, sparse parents tolerated', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'planning-a', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'B', value: 'planning-b', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'A', value: 'eval-a', scopeBag: 'eval-x', passphrase: PASSPHRASE });
    const merged = await store.decryptChain({
      projectId: PROJECT_ID,
      scopeChain: ['eval-x/missing-species', 'eval-x', null],
      passphrase: PASSPHRASE,
    });
    assert.deepStrictEqual(merged, { A: 'eval-a', B: 'planning-b' });
  });

  test('revoke targets the scoped bag, not planning', async () => {
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'planning', passphrase: PASSPHRASE });
    await store.set({ projectId: PROJECT_ID, keyName: 'K', value: 'eval', scopeBag: 'eval-x', passphrase: PASSPHRASE });
    await store.revoke({ projectId: PROJECT_ID, keyName: 'K', scope: 'eval-x', passphrase: PASSPHRASE });
    // planning still has it
    assert.strictEqual(
      await store.get({ projectId: PROJECT_ID, keyName: 'K', passphrase: PASSPHRASE }),
      'planning',
    );
    await assert.rejects(
      () => store.get({ projectId: PROJECT_ID, keyName: 'K', scope: 'eval-x', passphrase: PASSPHRASE }),
      (err) => err.code === 'KEY_NOT_FOUND',
    );
  });
});
