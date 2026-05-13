'use strict';
/**
 * tests/runtime-error-taxonomy.test.cjs
 *
 * Acceptance tests for GLOBAL-D-313 runtime error taxonomy.
 * Covers all 8 classes + real stderr fixtures S1-S6 from w2/log.jsonl.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');

const { classifyRuntimeError, parseCooldown } = require('../lib/team/rate-limit.cjs');

// ---------------------------------------------------------------------------
// parseCooldown
// ---------------------------------------------------------------------------
describe('parseCooldown', () => {
  test('parses XhYmZs duration — S1 fixture', () => {
    const ms = parseCooldown('Your quota will reset after 13h55m22s.');
    // 13*3600 + 55*60 + 22 = 46800 + 3300 + 22 = 50122 seconds
    assert.ok(ms !== null, 'should return a value');
    assert.ok(Math.abs(ms - 50122 * 1000) < 60 * 1000, `expected ~50122000ms, got ${ms}`);
  });

  test('parses Retry-After header', () => {
    const ms = parseCooldown('Retry-After: 300');
    assert.strictEqual(ms, 300 * 1000);
  });

  test('parses try again at HH:MM', () => {
    // Use a time far in the future to avoid flakiness on hour boundaries.
    const now = new Date();
    const futureH = (now.getHours() + 2) % 24;
    const text = `Please try again at ${String(futureH).padStart(2, '0')}:30`;
    const ms = parseCooldown(text);
    assert.ok(ms !== null && ms > 0, `expected positive ms, got ${ms}`);
    assert.ok(ms < 25 * 60 * 60 * 1000, 'should be less than 25h');
  });

  test('returns null for unrecognized text', () => {
    assert.strictEqual(parseCooldown('some random text'), null);
    assert.strictEqual(parseCooldown(''), null);
    assert.strictEqual(parseCooldown(null), null);
  });

  test('parses 0h15m0s → 900s', () => {
    const ms = parseCooldown('reset in 0h15m0s');
    assert.ok(ms !== null);
    assert.ok(Math.abs(ms - 900 * 1000) < 1000, `expected ~900000ms, got ${ms}`);
  });
});

// ---------------------------------------------------------------------------
// classifyRuntimeError — all 8 classes
// ---------------------------------------------------------------------------
describe('classifyRuntimeError — 8-class taxonomy', () => {

  // S1: quota_soft with extractable cooldown
  test('S1: quota_soft — exhausted capacity + duration', () => {
    const stderr = 'TerminalQuotaError: You have exhausted your capacity on this model. Your quota will reset after 13h55m22s.';
    const r = classifyRuntimeError(stderr, 1, 'gemini-cli');
    assert.strictEqual(r.class, 'quota_soft');
    assert.ok(r.cooldown_ms !== null, 'cooldown_ms should be set');
    // S1 acceptance: ~50122000 ±60s
    assert.ok(Math.abs(r.cooldown_ms - 50122 * 1000) < 60 * 1000, `expected ~50122000ms, got ${r.cooldown_ms}`);
    assert.ok(r.cooldown_until !== null, 'cooldown_until should be set');
  });

  // S2: quota_soft — Gaxios RESOURCE_EXHAUSTED
  test('S2: quota_soft — RESOURCE_EXHAUSTED in Gaxios error', () => {
    const stderr = 'Attempt 1 failed with status 429. Retrying with backoff... _GaxiosError: [{ "error": { "code": 429, "status": "RESOURCE_EXHAUSTED", "reason": "MODEL_CAPACITY_EXHAUSTED" } }]';
    const r = classifyRuntimeError(stderr, 1, 'gemini-cli');
    assert.strictEqual(r.class, 'quota_soft');
  });

  // S3: quota_soft — model-specific capacity
  test('S3: quota_soft — No capacity available for model', () => {
    const stderr = 'No capacity available for model gemini-3-flash-preview on the server';
    const r = classifyRuntimeError(stderr, 1, 'gemini-cli');
    assert.strictEqual(r.class, 'quota_soft');
  });

  // S4: output_unparseable — NOT quota (critical: must not be mis-classified)
  test('S4: output_unparseable — [object Object] without quota signals', () => {
    const stderr = 'An unexpected critical error occurred:[object Object]';
    const r = classifyRuntimeError(stderr, 0, 'gemini-cli');
    assert.strictEqual(r.class, 'output_unparseable', `expected output_unparseable, got ${r.class}`);
    // Must NOT be quota_soft or quota_hard_cap
    assert.notStrictEqual(r.class, 'quota_soft');
    assert.notStrictEqual(r.class, 'quota_hard_cap');
  });

  // S5: quota_soft — rateLimitExceeded in JSON body
  test('S5: quota_soft — rateLimitExceeded in Gaxios JSON body', () => {
    const stderr = '"reason": "rateLimitExceeded"';
    const r = classifyRuntimeError(stderr, 1, 'gemini-cli');
    assert.strictEqual(r.class, 'quota_soft');
  });

  // S6: runtime_crash — Windows PTY (must NOT be quota or unknown)
  test('S6: runtime_crash — AttachConsole failed (Windows PTY)', () => {
    const stderr = 'Error: AttachConsole failed at conpty_console_list_agent.js:11';
    const r = classifyRuntimeError(stderr, 1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash', `expected runtime_crash, got ${r.class}`);
    assert.notStrictEqual(r.class, 'quota_soft');
    assert.notStrictEqual(r.class, 'unknown');
  });

  // quota_hard_cap
  test('quota_hard_cap — Plan limit reached', () => {
    const r = classifyRuntimeError('Plan limit reached. Upgrade to Pro for more capacity.', 1, 'codex-cli');
    assert.strictEqual(r.class, 'quota_hard_cap');
    assert.ok(r.cooldown_ms === 4 * 60 * 60 * 1000, `expected 4h default, got ${r.cooldown_ms}`);
  });

  test("quota_hard_cap — You've hit your usage limit (codex-cli)", () => {
    const r = classifyRuntimeError("You've hit your usage limit", 1, 'codex-cli');
    assert.strictEqual(r.class, 'quota_hard_cap');
  });

  test('quota_hard_cap — usage limit generic', () => {
    const r = classifyRuntimeError('usage limit exceeded', 1, 'opencode');
    assert.strictEqual(r.class, 'quota_hard_cap');
  });

  // auth_failed
  test('auth_failed — 401 Unauthorized', () => {
    const r = classifyRuntimeError('401 Unauthorized: invalid token', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'auth_failed');
  });

  test('auth_failed — AUTH_EXPIRED', () => {
    const r = classifyRuntimeError('AUTH_EXPIRED: please re-authenticate', 1, 'codex-cli');
    assert.strictEqual(r.class, 'auth_failed');
  });

  test('auth_failed — Invalid API key', () => {
    const r = classifyRuntimeError('Invalid API key provided.', 1, null);
    assert.strictEqual(r.class, 'auth_failed');
  });

  // network_error
  test('network_error — ECONNRESET', () => {
    const r = classifyRuntimeError('ECONNRESET while fetching api.anthropic.com', 1, 'claude-code');
    assert.strictEqual(r.class, 'network_error');
  });

  test('network_error — getaddrinfo', () => {
    const r = classifyRuntimeError('Error: getaddrinfo ENOTFOUND api.openai.com', 1, null);
    assert.strictEqual(r.class, 'network_error');
  });

  // malformed_argv
  test('malformed_argv — exit 2 + Unknown option', () => {
    const r = classifyRuntimeError('Unknown option: --frobble', 2, 'codex-cli');
    assert.strictEqual(r.class, 'malformed_argv');
  });

  test('malformed_argv does NOT trigger on exit 1', () => {
    const r = classifyRuntimeError('Unknown option: --frobble', 1, 'codex-cli');
    // Without exit code 2, it should not classify as malformed_argv
    assert.notStrictEqual(r.class, 'malformed_argv');
  });

  // runtime_crash
  test('runtime_crash — exit 139 (segfault)', () => {
    const r = classifyRuntimeError('', 139, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash');
  });

  test('runtime_crash — exit < 0', () => {
    const r = classifyRuntimeError('', -1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash');
  });

  test('runtime_crash — conpty in stderr', () => {
    const r = classifyRuntimeError('conpty initialization failed', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash');
  });

  // EMFILE: gemini-cli walks Rust target/ dirs, hits open-file limit — must NOT be quota
  test('runtime_crash — EMFILE (too many open files)', () => {
    const r = classifyRuntimeError('Error: EMFILE: too many open files, open \'/home/user/project/target/debug/.fingerprint/foo\'', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash', `expected runtime_crash, got ${r.class}`);
    assert.notStrictEqual(r.class, 'quota_soft');
    assert.notStrictEqual(r.class, 'quota_hard_cap');
    assert.notStrictEqual(r.class, 'unknown');
    assert.strictEqual(r.cooldown_ms, null, 'EMFILE should have no cooldown');
  });

  test('runtime_crash — EMFILE bare keyword', () => {
    const r = classifyRuntimeError('EMFILE: too many open files', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash');
    assert.strictEqual(r.cooldown_ms, null);
  });

  test('runtime_crash — ENFILE (file table overflow)', () => {
    const r = classifyRuntimeError('ENFILE: file table overflow', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'runtime_crash');
  });

  // output_unparseable
  test('output_unparseable — [object Object] only', () => {
    const r = classifyRuntimeError('[object Object]', 0, null);
    assert.strictEqual(r.class, 'output_unparseable');
  });

  // unknown
  test('unknown — empty stderr, exit 1', () => {
    const r = classifyRuntimeError('', 1, 'gemini-cli');
    assert.strictEqual(r.class, 'unknown');
  });

  test('unknown — unrecognized error text', () => {
    const r = classifyRuntimeError('something went wrong with the frozzle', 1, null);
    assert.strictEqual(r.class, 'unknown');
  });

  // back-compat: isRateLimited should still work for quota classes
  test('isRateLimited back-compat via quota_soft classification', () => {
    const { isRateLimited } = require('../lib/team/rate-limit.cjs');
    // RESOURCE_EXHAUSTED should still return true from legacy function
    assert.strictEqual(isRateLimited('RESOURCE_EXHAUSTED: quota', ''), true);
  });
});

// ---------------------------------------------------------------------------
// runtime-substrate-core.mjs integration (ESM via dynamic import)
// ---------------------------------------------------------------------------
describe('runtime-substrate-core.mjs normalizeErrorCode', () => {
  test('normalizeErrorCode returns code field matching classifyRuntimeError.class', async () => {
    // Dynamic import of ESM module from a CJS test
    const substrateUrl = new URL('../scripts/runtime-substrate-core.mjs', `file://${__dirname}/`);
    const substrate = await import(substrateUrl.href);
    const result = substrate.normalizeErrorCode('AttachConsole failed at conpty.js:1', 1, 'gemini-cli');
    assert.strictEqual(result.code, 'runtime_crash');
  });

  test('normalizeErrorCode quota_soft with cooldown', async () => {
    const substrateUrl = new URL('../scripts/runtime-substrate-core.mjs', `file://${__dirname}/`);
    const substrate = await import(substrateUrl.href);
    const result = substrate.normalizeErrorCode('Your quota will reset after 1h0m0s', 1, 'gemini-cli');
    assert.strictEqual(result.code, 'quota_soft');
    assert.strictEqual(result.cooldown_ms, 3600 * 1000);
  });
});
