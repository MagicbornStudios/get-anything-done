/**
 * secrets-lifecycle.test.cjs — unit tests for lib/secrets-lifecycle.cjs.
 *
 * Task: 60-05. Spec: references/byok-design.md §9.
 *
 * Strategy:
 *   - Mocked store (not the real secrets-store). Each test controls the
 *     store's behavior directly (success / throw / envelope content).
 *   - Tmp-dir-backed audit log for happy-path tests so we exercise the
 *     real fs-append code. Fail-closed tests inject a throwing fs stub.
 *   - Deterministic uuid + frozen clock for reproducible event IDs + ts.
 *
 * The lifecycle module is a thin wrapper by design — these tests focus
 * on the wrapper's contract (ordering, event shape, purge algorithm,
 * log streaming) rather than re-testing store primitives.
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  createSecretsLifecycle,
  LIFECYCLE_EVENT_TYPES,
  AuditWriteError,
} = require('../lib/secrets-lifecycle.cjs');
const envelopeLib = require('../lib/envelope.cjs');
const kdf = require('../lib/kdf.cjs');
const { SecretsStoreError } = require('../lib/secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const PROJECT_ID = 'lifecycle-test-project';
const FROZEN_NOW = new Date('2026-04-17T12:00:00.000Z');

let tmpRoot;
let uuidCounter;

function nextUuid() {
  uuidCounter += 1;
  return `uuid-${String(uuidCounter).padStart(4, '0')}`;
}

function mockStorePaths() {
  return {
    envelopePath() { return path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`); },
    auditPath() { return path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.audit.jsonl`); },
  };
}

function makeSuccessStore(opts = {}) {
  const behavior = opts.behavior || {};
  return {
    ...mockStorePaths(),
    rotateCalls: [],
    revokeCalls: [],
    async rotate(args) {
      this.rotateCalls.push(args);
      if (behavior.rotateThrows) throw behavior.rotateThrows;
      return behavior.rotateResult || { oldVersion: 1, newVersion: 2 };
    },
    async revoke(args) {
      this.revokeCalls.push(args);
      if (behavior.revokeThrows) throw behavior.revokeThrows;
    },
  };
}

/**
 * Build a real (parseable) envelope on disk for purge tests. We use the
 * real kdf + envelope helpers so a post-purge decrypt of the surviving
 * current version still works (critical test assertion).
 */
function seedEnvelope({ keys = {} } = {}) {
  // Build master key via kdf helpers so the envelope verifier slot is
  // valid — tests can then round-trip decrypt if they want.
  const passBuf = Buffer.from('test-passphrase', 'utf8');
  const salt = kdf.generateSalt();
  const masterKey = kdf.deriveMasterKey(passBuf, salt);

  const env = envelopeLib.createEmptyEnvelope(PROJECT_ID, salt, FROZEN_NOW, masterKey);

  for (const [keyName, keyDef] of Object.entries(keys)) {
    const versionsOut = {};
    for (const [vStr, vDef] of Object.entries(keyDef.versions || {})) {
      const vNum = Number(vStr);
      const entry = envelopeLib.encryptValue({
        projectId: PROJECT_ID,
        keyName,
        version: vNum,
        plaintext: vDef.plaintext,
        masterKey,
        now: vDef.addedAt ? new Date(vDef.addedAt) : FROZEN_NOW,
        retiresAt: vDef.retiresAt || null,
      });
      versionsOut[vStr] = entry;
    }
    env.keys[keyName] = {
      currentVersion: keyDef.currentVersion,
      versions: versionsOut,
      provider: keyDef.provider || '',
      scope: keyDef.scope || '',
      lastRotated: keyDef.lastRotated || FROZEN_NOW.toISOString(),
    };
  }

  const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, envelopeLib.serializeEnvelope(env));

  return { env, masterKey };
}

function readAuditFileLines() {
  const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.audit.jsonl`);
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean);
}

function buildLifecycle(opts = {}) {
  return createSecretsLifecycle({
    store: opts.store,
    now: () => FROZEN_NOW,
    uuid: nextUuid,
    fsOverride: opts.fsOverride,
    readAuditLog: opts.readAuditLog,
    appendAuditLog: opts.appendAuditLog,
    actor: opts.actor,
  });
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-lifecycle-test-'));
  uuidCounter = 0;
});

afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('secrets-lifecycle: rotate', () => {
  test('rotate happy path — store.rotate called + audit event appended', async () => {
    const store = makeSuccessStore({ behavior: { rotateResult: { oldVersion: 3, newVersion: 4 } } });
    const lc = buildLifecycle({ store });

    const result = await lc.rotate({
      projectId: PROJECT_ID,
      keyName: 'OPENAI_API_KEY',
      newValue: 'sk-new',
      graceDays: 5,
      passphrase: 'p',
      reason: 'scheduled',
    });

    // Wrapper forwarded args to store.rotate verbatim.
    assert.strictEqual(store.rotateCalls.length, 1);
    assert.deepStrictEqual(store.rotateCalls[0], {
      projectId: PROJECT_ID,
      keyName: 'OPENAI_API_KEY',
      newValue: 'sk-new',
      graceDays: 5,
      passphrase: 'p',
      forcePassphrase: undefined,
    });
    assert.strictEqual(result.oldVersion, 3);
    assert.strictEqual(result.newVersion, 4);
    assert.strictEqual(result.auditEventId, 'uuid-0001');

    const lines = readAuditFileLines();
    assert.strictEqual(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.strictEqual(event.eventId, 'uuid-0001');
    assert.strictEqual(event.eventType, 'rotate');
    assert.strictEqual(event.projectId, PROJECT_ID);
    assert.strictEqual(event.keyName, 'OPENAI_API_KEY');
    assert.strictEqual(event.ts, FROZEN_NOW.toISOString());
    assert.strictEqual(event.actor, 'cli');
    assert.deepStrictEqual(event.details, {
      oldVersion: 3,
      newVersion: 4,
      graceDays: 5,
      reason: 'scheduled',
    });
  });

  test('rotate fail — audit log unchanged when store.rotate throws', async () => {
    const store = makeSuccessStore({
      behavior: { rotateThrows: new SecretsStoreError('KEY_NOT_FOUND', 'no such key') },
    });
    const lc = buildLifecycle({ store });

    await assert.rejects(
      () => lc.rotate({ projectId: PROJECT_ID, keyName: 'MISSING', newValue: 'x' }),
      (err) => err instanceof SecretsStoreError && err.code === 'KEY_NOT_FOUND',
    );

    // Audit log must not exist — store threw before we could append.
    assert.strictEqual(readAuditFileLines().length, 0);
  });
});

describe('secrets-lifecycle: revoke', () => {
  test('revoke happy path — snapshot + store.revoke + audit event', async () => {
    // Seed envelope so the pre-revoke snapshot can find versions 1..3.
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 3,
          versions: {
            '1': { plaintext: 'a', retiresAt: '2026-04-10T00:00:00.000Z' },
            '2': { plaintext: 'b', retiresAt: '2026-04-13T00:00:00.000Z' },
            '3': { plaintext: 'c', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const result = await lc.revoke({
      projectId: PROJECT_ID,
      keyName: 'K',
      passphrase: 'p',
      reason: 'compromised',
    });

    assert.strictEqual(store.revokeCalls.length, 1);
    assert.deepStrictEqual(result.removedVersions, [1, 2, 3]);
    assert.strictEqual(result.auditEventId, 'uuid-0001');

    const lines = readAuditFileLines();
    assert.strictEqual(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.strictEqual(event.eventType, 'revoke');
    assert.strictEqual(event.keyName, 'K');
    assert.deepStrictEqual(event.details, {
      removedVersions: [1, 2, 3],
      version: null,
      reason: 'compromised',
    });
  });

  test('revoke with specific version records that version in details', async () => {
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'a', retiresAt: '2026-04-20T00:00:00.000Z' },
            '2': { plaintext: 'b', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    await lc.revoke({ projectId: PROJECT_ID, keyName: 'K', version: 1 });

    const event = JSON.parse(readAuditFileLines()[0]);
    assert.strictEqual(event.details.version, 1);
    assert.deepStrictEqual(event.details.removedVersions, [1]);
  });

  test('revoke fail — audit log unchanged when store.revoke throws', async () => {
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 1,
          versions: { '1': { plaintext: 'v', retiresAt: null } },
        },
      },
    });
    const store = makeSuccessStore({
      behavior: { revokeThrows: new SecretsStoreError('KEY_NOT_FOUND', 'boom') },
    });
    const lc = buildLifecycle({ store });

    await assert.rejects(
      () => lc.revoke({ projectId: PROJECT_ID, keyName: 'K' }),
      (err) => err instanceof SecretsStoreError && err.code === 'KEY_NOT_FOUND',
    );
    assert.strictEqual(readAuditFileLines().length, 0);
  });
});

describe('secrets-lifecycle: purgeExpired', () => {
  test('no expired — noop, audit + envelope unchanged', async () => {
    const future = new Date(FROZEN_NOW.getTime() + 3 * 24 * 3600 * 1000).toISOString();
    const { env: beforeEnv } = seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'v1', retiresAt: future },
            '2': { plaintext: 'v2', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.strictEqual(result.purgedCount, 0);
    assert.deepStrictEqual(result.byKey, {});
    assert.strictEqual(readAuditFileLines().length, 0);

    // Envelope file unchanged structurally (same keys, same versions).
    const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`);
    const reread = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(Object.keys(reread.keys.K.versions).sort(), ['1', '2']);
    // And the verifier block was not touched.
    assert.deepStrictEqual(reread.verifier, beforeEnv.verifier);
  });

  test('one expired — removed, audit appended, current decrypt still works', async () => {
    const past = new Date(FROZEN_NOW.getTime() - 24 * 3600 * 1000).toISOString();
    const { masterKey } = seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'old-value', retiresAt: past },
            '2': { plaintext: 'current-value', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.strictEqual(result.purgedCount, 1);
    assert.deepStrictEqual(result.byKey, { K: [1] });

    const lines = readAuditFileLines();
    assert.strictEqual(lines.length, 1);
    const event = JSON.parse(lines[0]);
    assert.strictEqual(event.eventType, 'purge');
    assert.strictEqual(event.keyName, 'K');
    assert.strictEqual(event.details.version, 1);
    assert.strictEqual(event.details.gracePeriodExpired, true);
    assert.strictEqual(event.details.retiredAt, past);

    // Current version 2 must still decrypt cleanly with the original key
    // (no re-encryption happened — we only deleted the v1 JSON entry).
    const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`);
    const reread = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(reread.keys.K.currentVersion, 2);
    assert.deepStrictEqual(Object.keys(reread.keys.K.versions), ['2']);
    const surviving = envelopeLib.decryptValue({
      projectId: PROJECT_ID,
      keyName: 'K',
      version: 2,
      entry: reread.keys.K.versions['2'],
      masterKey,
    });
    assert.strictEqual(surviving, 'current-value');
  });

  test('multiple keys, each with expired versions — all purged, N events', async () => {
    const past = new Date(FROZEN_NOW.getTime() - 24 * 3600 * 1000).toISOString();
    seedEnvelope({
      keys: {
        A: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'a1', retiresAt: past },
            '2': { plaintext: 'a2', retiresAt: null },
          },
        },
        B: {
          currentVersion: 3,
          versions: {
            '1': { plaintext: 'b1', retiresAt: past },
            '2': { plaintext: 'b2', retiresAt: past },
            '3': { plaintext: 'b3', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.strictEqual(result.purgedCount, 3);
    assert.deepStrictEqual(result.byKey.A, [1]);
    assert.deepStrictEqual(result.byKey.B.sort((a, b) => a - b), [1, 2]);
    assert.strictEqual(readAuditFileLines().length, 3);
  });

  test('current version NEVER purged even if retiresAt in past (malformed envelope guard)', async () => {
    // This is defense — per §9.1 invariants, the current version's
    // retiresAt should always be null. If a malformed envelope has a
    // past retiresAt on the current version, purge must NOT remove it
    // (that would leave the key orphaned).
    const past = new Date(FROZEN_NOW.getTime() - 24 * 3600 * 1000).toISOString();
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 1,
          versions: {
            '1': { plaintext: 'only-version', retiresAt: past },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.strictEqual(result.purgedCount, 0);
    assert.deepStrictEqual(result.byKey, {});

    const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`);
    const reread = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(reread.keys.K.currentVersion, 1);
    assert.ok(reread.keys.K.versions['1']);
  });

  test('missing envelope — noop, no throw', async () => {
    // No envelope written. purgeExpired should return zero-counts.
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });
    const result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.deepStrictEqual(result, { purgedCount: 0, byKey: {} });
    assert.strictEqual(readAuditFileLines().length, 0);
  });

  test('asOf override — use explicit cutoff instead of now()', async () => {
    // retiresAt is in the future relative to FROZEN_NOW, but in the past
    // relative to an asOf way past. asOf lets callers fast-forward.
    const shortlyFuture = new Date(FROZEN_NOW.getTime() + 24 * 3600 * 1000).toISOString();
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'a', retiresAt: shortlyFuture },
            '2': { plaintext: 'b', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    // No purge at now().
    let result = await lc.purgeExpired({ projectId: PROJECT_ID });
    assert.strictEqual(result.purgedCount, 0);

    // Purge at asOf in the far future.
    const farFuture = new Date(FROZEN_NOW.getTime() + 365 * 24 * 3600 * 1000);
    result = await lc.purgeExpired({ projectId: PROJECT_ID, asOf: farFuture });
    assert.strictEqual(result.purgedCount, 1);
    assert.deepStrictEqual(result.byKey, { K: [1] });
  });
});

describe('secrets-lifecycle: previewPurge (task 60-05a)', () => {
  test('returns same {purgedCount,byKey} shape as purgeExpired without mutating envelope or audit', async () => {
    const past = new Date(FROZEN_NOW.getTime() - 24 * 3600 * 1000).toISOString();
    const { env: beforeEnv } = seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'old', retiresAt: past },
            '2': { plaintext: 'current', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    const preview = await lc.previewPurge({ projectId: PROJECT_ID });
    assert.strictEqual(preview.purgedCount, 1);
    assert.deepStrictEqual(preview.byKey, { K: [1] });

    // Envelope file is untouched — key '1' still present.
    const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.enc`);
    const reread = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.deepStrictEqual(Object.keys(reread.keys.K.versions).sort(), ['1', '2']);
    assert.deepStrictEqual(reread.verifier, beforeEnv.verifier);

    // Audit log has no new events.
    assert.strictEqual(readAuditFileLines().length, 0);
  });

  test('missing envelope — zero preview, no throw', async () => {
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });
    const preview = await lc.previewPurge({ projectId: PROJECT_ID });
    assert.deepStrictEqual(preview, { purgedCount: 0, byKey: {} });
  });

  test('current version is never included in preview even with past retiresAt', async () => {
    const past = new Date(FROZEN_NOW.getTime() - 24 * 3600 * 1000).toISOString();
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 1,
          versions: {
            '1': { plaintext: 'only', retiresAt: past },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });
    const preview = await lc.previewPurge({ projectId: PROJECT_ID });
    assert.strictEqual(preview.purgedCount, 0);
  });

  test('asOf override threads through preview walk', async () => {
    const shortlyFuture = new Date(FROZEN_NOW.getTime() + 24 * 3600 * 1000).toISOString();
    seedEnvelope({
      keys: {
        K: {
          currentVersion: 2,
          versions: {
            '1': { plaintext: 'a', retiresAt: shortlyFuture },
            '2': { plaintext: 'b', retiresAt: null },
          },
        },
      },
    });
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });

    let preview = await lc.previewPurge({ projectId: PROJECT_ID });
    assert.strictEqual(preview.purgedCount, 0);

    const farFuture = new Date(FROZEN_NOW.getTime() + 365 * 24 * 3600 * 1000);
    preview = await lc.previewPurge({ projectId: PROJECT_ID, asOf: farFuture });
    assert.strictEqual(preview.purgedCount, 1);
    assert.deepStrictEqual(preview.byKey, { K: [1] });
  });
});

describe('secrets-lifecycle: audit log streaming', () => {
  test('auditLog returns events newest-first; limit respected', async () => {
    // Seed some rotate events directly through the wrapper to populate
    // the log deterministically.
    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });
    for (let i = 0; i < 5; i++) {
      await lc.rotate({
        projectId: PROJECT_ID,
        keyName: 'K',
        newValue: 'x',
        graceDays: 1,
      });
    }

    const all = await lc.auditLog({ projectId: PROJECT_ID });
    assert.strictEqual(all.events.length, 5);

    // Newest-first — with same ts (frozen clock), order is reverse of
    // append order. eventIds are monotonic (uuid-0001..uuid-0005), so
    // newest-first should be 0005 → 0001.
    assert.strictEqual(all.events[0].eventId, 'uuid-0005');
    assert.strictEqual(all.events[4].eventId, 'uuid-0001');

    const limited = await lc.auditLog({ projectId: PROJECT_ID, limit: 2 });
    assert.strictEqual(limited.events.length, 2);
    assert.strictEqual(limited.events[0].eventId, 'uuid-0005');
    assert.strictEqual(limited.events[1].eventId, 'uuid-0004');
    assert.ok(limited.nextCursor, 'nextCursor should be set when limit truncates');
  });

  test('auditLog since filter excludes older events', async () => {
    // Two events at different timestamps. Use a custom now() that
    // advances.
    const store = makeSuccessStore();
    let clockMs = FROZEN_NOW.getTime();
    const lc = createSecretsLifecycle({
      store,
      now: () => new Date(clockMs),
      uuid: nextUuid,
    });

    await lc.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'x' });
    clockMs += 60 * 1000;
    await lc.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'y' });

    const cutoff = new Date(FROZEN_NOW.getTime() + 30 * 1000);
    const since = await lc.auditLog({ projectId: PROJECT_ID, since: cutoff });
    assert.strictEqual(since.events.length, 1);
    assert.strictEqual(since.events[0].eventId, 'uuid-0002');
  });

  test('auditLog tolerates malformed/torn lines during read', async () => {
    // Write a valid event, then a torn line (simulating a concurrent
    // appender that hasn't flushed the trailing newline yet), then
    // another valid event.
    const p = path.join(tmpRoot, '.gad', 'secrets', `${PROJECT_ID}.audit.jsonl`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const ev1 = { eventId: 'a', eventType: 'rotate', projectId: PROJECT_ID, keyName: 'K', ts: FROZEN_NOW.toISOString(), actor: 'cli', details: {} };
    const ev2 = { eventId: 'b', eventType: 'revoke', projectId: PROJECT_ID, keyName: 'K', ts: FROZEN_NOW.toISOString(), actor: 'cli', details: {} };
    fs.writeFileSync(
      p,
      JSON.stringify(ev1) + '\n' +
      '{"eventId":"half-written",' + '\n' + // torn — invalid JSON
      JSON.stringify(ev2) + '\n',
    );

    const store = makeSuccessStore();
    const lc = buildLifecycle({ store });
    const result = await lc.auditLog({ projectId: PROJECT_ID });
    // Expect the 2 valid events (newest-first); torn line silently skipped.
    assert.strictEqual(result.events.length, 2);
    const ids = result.events.map((e) => e.eventId).sort();
    assert.deepStrictEqual(ids, ['a', 'b']);
  });
});

describe('secrets-lifecycle: constants + error types', () => {
  test('LIFECYCLE_EVENT_TYPES is frozen and lists exactly the 4 expected entries', () => {
    assert.ok(Object.isFrozen(LIFECYCLE_EVENT_TYPES));
    assert.deepStrictEqual(
      [...LIFECYCLE_EVENT_TYPES].sort(),
      ['bag-created', 'purge', 'revoke', 'rotate'],
    );
    assert.strictEqual(LIFECYCLE_EVENT_TYPES.length, 4);
    // Exhaustiveness: every event emitted by the wrapper must be in the
    // frozen list.
    const emittedTypes = new Set(['rotate', 'revoke', 'purge']);
    for (const t of emittedTypes) {
      assert.ok(LIFECYCLE_EVENT_TYPES.includes(t), `emitted type ${t} must be in LIFECYCLE_EVENT_TYPES`);
    }
  });
});

describe('secrets-lifecycle: fail-closed ordering', () => {
  test('audit-append failure AFTER successful rotate throws AuditWriteError; store op stays committed', async () => {
    const store = makeSuccessStore({ behavior: { rotateResult: { oldVersion: 1, newVersion: 2 } } });
    // Inject an appendAuditLog that always throws. The store.rotate call
    // still ran (and in production would have mutated the envelope) — the
    // caller must see an AuditWriteError without rollback.
    const lc = createSecretsLifecycle({
      store,
      now: () => FROZEN_NOW,
      uuid: nextUuid,
      appendAuditLog() {
        throw new AuditWriteError('simulated disk failure', new Error('ENOSPC'));
      },
    });

    await assert.rejects(
      () => lc.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'x' }),
      (err) => err instanceof AuditWriteError && err.code === 'AUDIT_WRITE_FAILED' && err.cause instanceof Error,
    );

    // Critical: store.rotate WAS called (state committed) even though
    // audit append failed. The trade-off is documented in the source —
    // audit events are at-least-once, not exactly-once.
    assert.strictEqual(store.rotateCalls.length, 1);
  });

  test('AuditWriteError default append surfaces fs error cause', async () => {
    // Use a throwing fsOverride to exercise the default appendAuditLog
    // code path and confirm the cause propagates.
    const throwingFs = {
      existsSync: fs.existsSync,
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
      mkdirSync() { throw new Error('EACCES: mkdir denied'); },
      appendFileSync() { throw new Error('should not reach'); },
      renameSync: fs.renameSync,
      unlinkSync: fs.unlinkSync,
    };
    const store = makeSuccessStore();
    const lc = createSecretsLifecycle({
      store,
      now: () => FROZEN_NOW,
      uuid: nextUuid,
      fsOverride: throwingFs,
    });

    await assert.rejects(
      () => lc.rotate({ projectId: PROJECT_ID, keyName: 'K', newValue: 'x' }),
      (err) => err instanceof AuditWriteError
        && err.code === 'AUDIT_WRITE_FAILED'
        && err.cause instanceof Error
        && /EACCES/.test(err.cause.message),
    );
  });
});
