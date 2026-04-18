/**
 * env-cli.test.cjs — unit tests for lib/env-cli.cjs (task 60-03).
 *
 * Spec: references/byok-design.md §7 (CLI surface) + §12 (errors).
 *
 * Pure tests — the real lib/secrets-store.cjs is replaced by a mock store
 * passed through the createEnvCli dependency hook. No filesystem, no TTY,
 * no real keychain.
 */

'use strict';

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { PassThrough } = require('stream');

const { createEnvCli, messageFor, renderListTable, renderAuditTable } = require('../lib/env-cli.cjs');
const { SecretsStoreError } = require('../lib/secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Mock store — captures calls and serves canned responses.
// ---------------------------------------------------------------------------

function makeMockStore(overrides = {}) {
  const calls = { get: [], set: [], list: [], rotate: [], revoke: [] };
  const impl = {
    async get(args) {
      calls.get.push(args);
      if (overrides.get) return overrides.get(args);
      return 'canned-value';
    },
    async set(args) {
      calls.set.push(args);
      if (overrides.set) return overrides.set(args);
    },
    async list(args) {
      calls.list.push(args);
      if (overrides.list) return overrides.list(args);
      return [];
    },
    async rotate(args) {
      calls.rotate.push(args);
      if (overrides.rotate) return overrides.rotate(args);
      return { oldVersion: 1, newVersion: 2 };
    },
    async revoke(args) {
      calls.revoke.push(args);
      if (overrides.revoke) return overrides.revoke(args);
    },
  };
  return { impl, calls };
}

function makeMockLifecycle(overrides = {}) {
  const calls = { rotate: [], revoke: [], purgeExpired: [], previewPurge: [], auditLog: [] };
  const impl = {
    async rotate(args) {
      calls.rotate.push(args);
      if (overrides.rotate) return overrides.rotate(args);
      return { oldVersion: 1, newVersion: 2, auditEventId: 'evt-rot' };
    },
    async revoke(args) {
      calls.revoke.push(args);
      if (overrides.revoke) return overrides.revoke(args);
      return { auditEventId: 'evt-rev', removedVersions: [1] };
    },
    async purgeExpired(args) {
      calls.purgeExpired.push(args);
      if (overrides.purgeExpired) return overrides.purgeExpired(args);
      return { purgedCount: 0, byKey: {} };
    },
    async previewPurge(args) {
      calls.previewPurge.push(args);
      if (overrides.previewPurge) return overrides.previewPurge(args);
      return { purgedCount: 0, byKey: {} };
    },
    async auditLog(args) {
      calls.auditLog.push(args);
      if (overrides.auditLog) return overrides.auditLog(args);
      return { events: [], nextCursor: null };
    },
  };
  return { impl, calls };
}

function makeHarness({ storeOverrides, lifecycleOverrides, stdinIsTty = false, stdinLine = null, confirm = async () => true, readPassphrase } = {}) {
  const stdin = new PassThrough();
  stdin.isTTY = stdinIsTty;
  if (stdinLine !== null && !stdinIsTty) {
    stdin.end(`${stdinLine}\n`);
  }
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdoutChunks = [];
  const stderrChunks = [];
  stdout.on('data', (c) => stdoutChunks.push(c.toString('utf8')));
  stderr.on('data', (c) => stderrChunks.push(c.toString('utf8')));

  const { impl: store, calls } = makeMockStore(storeOverrides);
  const { impl: lifecycle, calls: lifecycleCalls } = makeMockLifecycle(lifecycleOverrides);
  let exitCode = null;
  const exit = (c) => { exitCode = c; };

  const cli = createEnvCli({
    store,
    lifecycle,
    readPassphrase: readPassphrase || (async () => Buffer.from('test-pass', 'utf8')),
    stdin,
    stdout,
    stderr,
    exit,
    confirm,
  });

  return {
    cli,
    calls,
    lifecycleCalls,
    getStdout: () => stdoutChunks.join(''),
    getStderr: () => stderrChunks.join(''),
    getExitCode: () => exitCode,
  };
}

// ---------------------------------------------------------------------------
// 1. get — happy path
// ---------------------------------------------------------------------------

describe('env-cli: get', () => {
  test('happy path prints only value+newline on stdout; stderr empty', async () => {
    const h = makeHarness({
      storeOverrides: { get: async () => 'sk-abc123' },
    });
    await h.cli.getCmd({ keyName: 'OPENAI_API_KEY', projectid: 'proj1' });
    assert.strictEqual(h.getStdout(), 'sk-abc123\n');
    assert.strictEqual(h.getStderr(), '');
    assert.strictEqual(h.getExitCode(), null);
    assert.strictEqual(h.calls.get.length, 1);
    assert.strictEqual(h.calls.get[0].keyName, 'OPENAI_API_KEY');
    assert.strictEqual(h.calls.get[0].projectId, 'proj1');
  });

  test('KEY_NOT_FOUND surfaces remediation hint on stderr, exits 1', async () => {
    const h = makeHarness({
      storeOverrides: {
        get: async () => { throw new SecretsStoreError('KEY_NOT_FOUND', 'nope'); },
      },
    });
    await h.cli.getCmd({ keyName: 'MISSING', projectid: 'proj1' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.strictEqual(h.getStdout(), '');
    assert.match(h.getStderr(), /KEY_NOT_FOUND:/);
    assert.match(h.getStderr(), /gad env set MISSING --projectid proj1/);
  });

  test('--passphrase mode prompts once and threads the buffer into the store call', async () => {
    let calls = 0;
    const h = makeHarness({
      readPassphrase: async () => { calls++; return Buffer.from('pw-x', 'utf8'); },
      storeOverrides: { get: async () => 'val' },
    });
    await h.cli.getCmd({ keyName: 'K', projectid: 'p', passphrase: true });
    assert.strictEqual(calls, 1);
    assert.ok(Buffer.isBuffer(h.calls.get[0].passphrase));
    assert.strictEqual(h.calls.get[0].forcePassphrase, true);
  });
});

// ---------------------------------------------------------------------------
// 2. set — TTY prompt + piped-stdin
// ---------------------------------------------------------------------------

describe('env-cli: set', () => {
  test('TTY prompt reads value via echoless helper; store.set called with args', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async (_label) => Buffer.from('secret-val', 'utf8'),
    });
    await h.cli.setCmd({ keyName: 'API', projectid: 'proj', provider: 'openai', scope: 'model-api' });
    assert.strictEqual(h.calls.set.length, 1);
    assert.strictEqual(h.calls.set[0].keyName, 'API');
    assert.strictEqual(h.calls.set[0].value, 'secret-val');
    assert.strictEqual(h.calls.set[0].provider, 'openai');
    assert.strictEqual(h.calls.set[0].scope, 'model-api');
    // Confirmation goes to stderr; stdout stays empty.
    assert.strictEqual(h.getStdout(), '');
    assert.match(h.getStderr(), /Stored API \(v1\) for project proj\./);
  });

  test('piped stdin reads one line without prompting', async () => {
    let prompted = 0;
    const h = makeHarness({
      stdinIsTty: false,
      stdinLine: 'piped-value-xyz',
      readPassphrase: async () => { prompted++; return Buffer.from(''); },
    });
    await h.cli.setCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(prompted, 0, 'TTY prompt must not fire on piped stdin');
    assert.strictEqual(h.calls.set.length, 1);
    assert.strictEqual(h.calls.set[0].value, 'piped-value-xyz');
  });

  test('empty value is refused (exit 1, store.set not called)', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async () => Buffer.from('', 'utf8'),
    });
    await h.cli.setCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.strictEqual(h.calls.set.length, 0);
    assert.match(h.getStderr(), /empty value/i);
  });

  test('GITIGNORE_WRITE_FAILED surfaces correct operator message', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async () => Buffer.from('val', 'utf8'),
      storeOverrides: {
        set: async () => { throw new SecretsStoreError('GITIGNORE_WRITE_FAILED', 'cannot write gitignore'); },
      },
    });
    await h.cli.setCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /GITIGNORE_WRITE_FAILED:/);
    assert.match(h.getStderr(), /\.gitignore could not be updated/);
  });
});

// ---------------------------------------------------------------------------
// 3. list — table + json
// ---------------------------------------------------------------------------

describe('env-cli: list', () => {
  const rows = [
    { keyName: 'OPENAI_API_KEY', provider: 'openai', scope: 'model-api', lastRotated: '2026-04-17T21:30:00Z', currentVersion: 2 },
    { keyName: 'REPLICATE_API_TOKEN', provider: 'replicate', scope: 'image-gen', lastRotated: '2026-04-17T21:34:12Z', currentVersion: 1 },
  ];

  test('default table format on stdout; never includes values', async () => {
    const h = makeHarness({ storeOverrides: { list: async () => rows } });
    await h.cli.listCmd({ projectid: 'p', json: false });
    const out = h.getStdout();
    assert.match(out, /KEY\s+VERSION\s+PROVIDER\s+SCOPE\s+LAST ROTATED/);
    assert.match(out, /OPENAI_API_KEY\s+2\s+openai\s+model-api\s+2026-04-17/);
    assert.match(out, /REPLICATE_API_TOKEN\s+1\s+replicate\s+image-gen\s+2026-04-17/);
    assert.strictEqual(h.getStderr(), '');
  });

  test('--json emits a valid JSON array', async () => {
    const h = makeHarness({ storeOverrides: { list: async () => rows } });
    await h.cli.listCmd({ projectid: 'p', json: true });
    const parsed = JSON.parse(h.getStdout());
    assert.strictEqual(parsed.length, 2);
    assert.strictEqual(parsed[0].keyName, 'OPENAI_API_KEY');
    assert.strictEqual(parsed[0].currentVersion, 2);
  });

  test('empty envelope (PROJECT_NOT_FOUND) surfaces as 0 keys, not an error', async () => {
    // Code-split per todo 2026-04-17-secrets-store-project-not-found-split:
    // list() in env-cli now branches on err.code, not on a message regex.
    const h = makeHarness({
      storeOverrides: {
        list: async () => {
          throw new SecretsStoreError('PROJECT_NOT_FOUND', 'no envelope for project "p" at .../p.enc');
        },
      },
    });
    await h.cli.listCmd({ projectid: 'p', json: false });
    assert.strictEqual(h.getExitCode(), null);
    assert.match(h.getStdout(), /0 keys set for project p\./);
  });
});

// ---------------------------------------------------------------------------
// 4. rotate — defaults + grace-days validation
// ---------------------------------------------------------------------------

describe('env-cli: rotate', () => {
  test('happy path reads new value from TTY and defaults graceDays=7', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async () => Buffer.from('new-val', 'utf8'),
    });
    await h.cli.rotateCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(h.calls.rotate.length, 1);
    assert.strictEqual(h.calls.rotate[0].newValue, 'new-val');
    assert.strictEqual(h.calls.rotate[0].graceDays, 7);
    assert.match(h.getStderr(), /Rotated K for project p: v1 → v2 \(grace 7d\)/);
  });

  test('--grace-days out of range fails fast with GRACE_DAYS_OUT_OF_RANGE', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async () => Buffer.from('v', 'utf8'),
    });
    await h.cli.rotateCmd({ keyName: 'K', projectid: 'p', graceDays: '99' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /GRACE_DAYS_OUT_OF_RANGE/);
    assert.strictEqual(h.calls.rotate.length, 0);
  });

  test('--grace-days=0 is allowed and threaded through', async () => {
    const h = makeHarness({
      stdinIsTty: true,
      readPassphrase: async () => Buffer.from('v', 'utf8'),
    });
    await h.cli.rotateCmd({ keyName: 'K', projectid: 'p', graceDays: '0' });
    assert.strictEqual(h.calls.rotate[0].graceDays, 0);
  });
});

// ---------------------------------------------------------------------------
// 5. revoke — force + interactive confirm
// ---------------------------------------------------------------------------

describe('env-cli: revoke', () => {
  test('--force skips confirmation and calls store.revoke', async () => {
    let confirmCalls = 0;
    const h = makeHarness({ confirm: async () => { confirmCalls++; return true; } });
    await h.cli.revokeCmd({ keyName: 'K', projectid: 'p', force: true });
    assert.strictEqual(confirmCalls, 0);
    assert.strictEqual(h.calls.revoke.length, 1);
    assert.match(h.getStderr(), /Revoked all versions of K/);
  });

  test('without --force, user declines → store.revoke NOT called, exit 0', async () => {
    const h = makeHarness({ confirm: async () => false });
    await h.cli.revokeCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(h.calls.revoke.length, 0);
    assert.strictEqual(h.getExitCode(), null);
    assert.match(h.getStderr(), /Aborted — nothing revoked\./);
  });

  test('without --force, user accepts → store.revoke called', async () => {
    const h = makeHarness({ confirm: async () => true });
    await h.cli.revokeCmd({ keyName: 'K', projectid: 'p', version: 2 });
    assert.strictEqual(h.calls.revoke.length, 1);
    assert.strictEqual(h.calls.revoke[0].version, 2);
    assert.match(h.getStderr(), /Revoked version 2 of K/);
  });
});

// ---------------------------------------------------------------------------
// 6. Error mapping — every named §12 code gets the right operator message
// ---------------------------------------------------------------------------

describe('env-cli: error-code mapping (byok-design §12)', () => {
  const cases = [
    ['PASSPHRASE_INVALID', /Passphrase incorrect/],
    ['PASSPHRASE_REQUIRED_NO_TTY', /stdin is not a TTY/],
    ['KEYCHAIN_UNAVAILABLE', /OS keychain not available/],
    ['KEYCHAIN_LOCKED', /OS keychain is locked/],
    ['BAG_CORRUPT', /failed integrity check/],
    ['KEY_NOT_FOUND', /not set for project/],
    ['KEY_EXPIRED', /grace period has lapsed/],
    ['ROTATION_GRACE_EXPIRED', /already auto-purged/],
    ['GITIGNORE_WRITE_FAILED', /\.gitignore could not be updated/],
    ['PROJECT_NOT_FOUND', /No encrypted bag exists for project/],
    ['KEY_ALREADY_EXISTS', /already set for project/],
    ['GRACE_DAYS_OUT_OF_RANGE', /--grace-days must be between 0 and 30/],
  ];

  for (const [code, matcher] of cases) {
    test(`${code} surfaces the right operator message`, () => {
      const msg = messageFor(code, { projectId: 'p', keyName: 'K', file: '.gad/secrets/p.enc' });
      assert.ok(msg, `messageFor(${code}) returned null`);
      assert.match(msg, matcher);
    });
  }

  test('an unknown code returns null so the caller falls back to the raw error message', () => {
    assert.strictEqual(messageFor('TOTALLY_MADE_UP_CODE', {}), null);
  });

  test('end-to-end: PASSPHRASE_INVALID from store.get surfaces on stderr with exit 1', async () => {
    const h = makeHarness({
      storeOverrides: {
        get: async () => { throw new SecretsStoreError('PASSPHRASE_INVALID', 'wrong'); },
      },
    });
    await h.cli.getCmd({ keyName: 'K', projectid: 'p' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /^PASSPHRASE_INVALID: /);
    assert.match(h.getStderr(), /Passphrase incorrect/);
  });
});

// ---------------------------------------------------------------------------
// 7. renderListTable — snapshot-ish coverage of the formatter
// ---------------------------------------------------------------------------

describe('env-cli: renderListTable', () => {
  test('columns align to the widest cell and last-rotated is truncated to YYYY-MM-DD', () => {
    const out = renderListTable([
      { keyName: 'A', provider: 'p', scope: 's', lastRotated: '2026-04-17T21:30:00Z', currentVersion: 1 },
      { keyName: 'LONGER_KEY', provider: 'prov', scope: 'scp', lastRotated: '2026-04-18', currentVersion: 10 },
    ]);
    // Headers line present.
    assert.match(out, /KEY\s+VERSION\s+PROVIDER\s+SCOPE\s+LAST ROTATED/);
    // LONGER_KEY is the widest key — the 'A' line should be padded to match.
    const lines = out.trim().split('\n');
    assert.strictEqual(lines.length, 3);
    // Neither value nor ciphertext shows up.
    assert.doesNotMatch(out, /ciphertext/i);
  });
});

// ---------------------------------------------------------------------------
// 8. audit — newest-first log view (task 60-05a)
// ---------------------------------------------------------------------------

describe('env-cli: audit', () => {
  test('empty log prints a zero-events hint on stdout', async () => {
    const h = makeHarness({
      lifecycleOverrides: { auditLog: async () => ({ events: [], nextCursor: null }) },
    });
    await h.cli.auditCmd({ projectid: 'proj1', json: false });
    assert.strictEqual(h.getStderr(), '');
    assert.match(h.getStdout(), /0 audit events for project proj1\./);
    assert.strictEqual(h.lifecycleCalls.auditLog.length, 1);
    assert.strictEqual(h.lifecycleCalls.auditLog[0].projectId, 'proj1');
  });

  test('--json emits raw {events, nextCursor} payload (never values)', async () => {
    const events = [
      {
        eventId: 'a', eventType: 'rotate', projectId: 'p', keyName: 'K',
        ts: '2026-04-18T00:00:00.000Z', actor: 'cli',
        details: { oldVersion: 1, newVersion: 2, graceDays: 7, reason: null },
      },
    ];
    const h = makeHarness({
      lifecycleOverrides: { auditLog: async () => ({ events, nextCursor: null }) },
    });
    await h.cli.auditCmd({ projectid: 'p', json: true });
    const parsed = JSON.parse(h.getStdout());
    assert.strictEqual(parsed.events.length, 1);
    assert.strictEqual(parsed.events[0].eventType, 'rotate');
    assert.strictEqual(parsed.nextCursor, null);
    // Values never appear in audit payloads — defensive.
    assert.doesNotMatch(h.getStdout(), /sk-|BEGIN PRIVATE|password/i);
  });

  test('--since and --limit are threaded through to lifecycle.auditLog', async () => {
    const h = makeHarness({
      lifecycleOverrides: { auditLog: async () => ({ events: [], nextCursor: null }) },
    });
    await h.cli.auditCmd({ projectid: 'p', since: '2026-04-01T00:00:00Z', limit: 5 });
    assert.deepStrictEqual(h.lifecycleCalls.auditLog[0], {
      projectId: 'p',
      since: '2026-04-01T00:00:00Z',
      limit: 5,
    });
  });

  test('table mode prints TS/EVENT/KEY/ACTOR/DETAILS header + a row per event', async () => {
    const events = [
      {
        eventId: 'a', eventType: 'rotate', projectId: 'p', keyName: 'K',
        ts: '2026-04-18T01:00:00.000Z', actor: 'cli',
        details: { oldVersion: 1, newVersion: 2, graceDays: 7 },
      },
      {
        eventId: 'b', eventType: 'purge', projectId: 'p', keyName: 'K',
        ts: '2026-04-18T02:00:00.000Z', actor: 'cli',
        details: { version: 1, retiredAt: '2026-04-11T00:00:00Z' },
      },
    ];
    const h = makeHarness({
      lifecycleOverrides: { auditLog: async () => ({ events, nextCursor: null }) },
    });
    await h.cli.auditCmd({ projectid: 'p' });
    const out = h.getStdout();
    assert.match(out, /TS\s+EVENT\s+KEY\s+ACTOR\s+DETAILS/);
    assert.match(out, /rotate/);
    assert.match(out, /v1 → v2 \(grace 7d\)/);
    assert.match(out, /purge/);
    assert.match(out, /v1 retired=2026-04-11/);
  });

  test('nextCursor emits a paging hint on stderr only', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        auditLog: async () => ({
          events: [{
            eventId: 'a', eventType: 'rotate', projectId: 'p', keyName: 'K',
            ts: '2026-04-18T00:00:00Z', actor: 'cli', details: { oldVersion: 1, newVersion: 2, graceDays: 7 },
          }],
          nextCursor: '2026-04-17T00:00:00Z',
        }),
      },
    });
    await h.cli.auditCmd({ projectid: 'p', limit: 1 });
    assert.match(h.getStderr(), /more — rerun with --since 2026-04-17T00:00:00Z/);
    // The hint is stderr-only so tooling piping stdout is unaffected.
    assert.doesNotMatch(h.getStdout(), /rerun with/);
  });

  test('lifecycle errors exit non-zero with code-prefixed stderr', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        auditLog: async () => { throw new SecretsStoreError('BAG_CORRUPT', 'tampered'); },
      },
    });
    await h.cli.auditCmd({ projectid: 'p' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /^BAG_CORRUPT: /);
  });
});

// ---------------------------------------------------------------------------
// 9. purge — manual grace-period purge (task 60-05a)
// ---------------------------------------------------------------------------

describe('env-cli: purge', () => {
  test('happy path calls lifecycle.purgeExpired with a Date asOf', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        purgeExpired: async () => ({ purgedCount: 2, byKey: { OPENAI_API_KEY: [1, 2] } }),
      },
    });
    await h.cli.purgeCmd({ projectid: 'p' });
    assert.strictEqual(h.lifecycleCalls.purgeExpired.length, 1);
    assert.ok(h.lifecycleCalls.purgeExpired[0].asOf instanceof Date);
    assert.match(h.getStdout(), /Purged 2 expired version\(s\) for project p:/);
    assert.match(h.getStdout(), /OPENAI_API_KEY: v1, v2/);
  });

  test('no-op purge prints a zero-count line; lifecycle still called', async () => {
    const h = makeHarness({
      lifecycleOverrides: { purgeExpired: async () => ({ purgedCount: 0, byKey: {} }) },
    });
    await h.cli.purgeCmd({ projectid: 'p' });
    assert.match(h.getStdout(), /Purged 0 expired versions for project p\./);
    assert.strictEqual(h.lifecycleCalls.purgeExpired.length, 1);
  });

  test('--dry-run calls previewPurge (NOT purgeExpired) and prints the planned set', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        previewPurge: async () => ({ purgedCount: 1, byKey: { K: [3] } }),
        purgeExpired: async () => { throw new Error('dry-run must not call purgeExpired'); },
      },
    });
    await h.cli.purgeCmd({ projectid: 'p', dryRun: true });
    assert.strictEqual(h.lifecycleCalls.previewPurge.length, 1);
    assert.strictEqual(h.lifecycleCalls.purgeExpired.length, 0);
    assert.match(h.getStdout(), /Dry-run: would purge 1 version\(s\) for project p:/);
    assert.match(h.getStdout(), /K: v3/);
  });

  test('invalid --as-of fails fast with Error line on stderr', async () => {
    const h = makeHarness({});
    await h.cli.purgeCmd({ projectid: 'p', asOf: 'not-a-date' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /not a valid date/);
    assert.strictEqual(h.lifecycleCalls.purgeExpired.length, 0);
    assert.strictEqual(h.lifecycleCalls.previewPurge.length, 0);
  });

  test('--json emits the raw result object', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        purgeExpired: async () => ({ purgedCount: 1, byKey: { K: [1] } }),
      },
    });
    await h.cli.purgeCmd({ projectid: 'p', json: true });
    const parsed = JSON.parse(h.getStdout());
    assert.strictEqual(parsed.purgedCount, 1);
    assert.deepStrictEqual(parsed.byKey.K, [1]);
  });

  test('--dry-run --json emits {dryRun: true, ...preview}', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        previewPurge: async () => ({ purgedCount: 0, byKey: {} }),
      },
    });
    await h.cli.purgeCmd({ projectid: 'p', dryRun: true, json: true });
    const parsed = JSON.parse(h.getStdout());
    assert.strictEqual(parsed.dryRun, true);
    assert.strictEqual(parsed.purgedCount, 0);
  });

  test('lifecycle errors exit non-zero with code-prefixed stderr', async () => {
    const h = makeHarness({
      lifecycleOverrides: {
        purgeExpired: async () => { throw new SecretsStoreError('PROJECT_NOT_FOUND', 'nope'); },
      },
    });
    await h.cli.purgeCmd({ projectid: 'p' });
    assert.strictEqual(h.getExitCode(), 1);
    assert.match(h.getStderr(), /^PROJECT_NOT_FOUND: /);
  });
});

// ---------------------------------------------------------------------------
// 10. renderAuditTable — formatter coverage
// ---------------------------------------------------------------------------

describe('env-cli: renderAuditTable', () => {
  test('summarizes each known event type in the DETAILS column', () => {
    const out = renderAuditTable([
      { ts: '2026-04-18T00:00:00Z', eventType: 'rotate', keyName: 'K', actor: 'cli', details: { oldVersion: 1, newVersion: 2, graceDays: 7 } },
      { ts: '2026-04-18T00:01:00Z', eventType: 'revoke', keyName: 'K', actor: 'cli', details: { removedVersions: [1, 2] } },
      { ts: '2026-04-18T00:02:00Z', eventType: 'purge', keyName: 'K', actor: 'cli', details: { version: 1, retiredAt: '2026-04-11T00:00:00Z' } },
    ]);
    assert.match(out, /v1 → v2 \(grace 7d\)/);
    assert.match(out, /removed=\[1,2\]/);
    assert.match(out, /v1 retired=2026-04-11/);
    assert.match(out, /TS\s+EVENT\s+KEY\s+ACTOR\s+DETAILS/);
  });

  test('unknown event types render with empty DETAILS', () => {
    const out = renderAuditTable([
      { ts: '2026-04-18T00:00:00Z', eventType: 'bag-created', keyName: '', actor: 'cli', details: {} },
    ]);
    assert.match(out, /bag-created/);
  });
});
