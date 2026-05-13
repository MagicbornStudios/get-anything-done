'use strict';
/**
 * Phase 145 task GLOBAL-T-145-01 verification.
 * Run: node --test vendor/get-anything-done/tests/telemetry-envelope.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  SCHEMA_V,
  VALID_RUNTIMES,
  VALID_ROLES,
  VALID_CONTENT_TYPES,
  OPTIONAL_FIELDS,
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  runIdPrefix,
} = require('../lib/telemetry/envelope.cjs');

const baseEnv = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  ts: '2026-05-06T09:30:00.000Z',
  run_id: 'cc-test-2026-05-06T09:30:00.000Z',
  project: 'global',
  runtime: 'claude-code',
  role: 'response',
  content: { text: 'hello' },
  seq: 1,
  schema_v: 1,
};

test('SCHEMA_V is 1', () => {
  assert.equal(SCHEMA_V, 1);
});

test('valid envelope passes validation', () => {
  const r = validateEnvelope(baseEnv);
  assert.equal(r.ok, true, JSON.stringify(r.errors || []));
});

test('rejects null/undefined envelope', () => {
  assert.equal(validateEnvelope(null).ok, false);
  assert.equal(validateEnvelope(undefined).ok, false);
});

test('rejects missing required fields', () => {
  for (const f of ['id', 'ts', 'run_id', 'project', 'runtime', 'role', 'content', 'seq']) {
    const env = { ...baseEnv };
    delete env[f];
    const r = validateEnvelope(env);
    assert.equal(r.ok, false, `should reject missing ${f}`);
  }
});

test('rejects bad runtime', () => {
  const env = { ...baseEnv, runtime: 'unknown-runtime' };
  assert.equal(validateEnvelope(env).ok, false);
});

test('rejects bad role', () => {
  const env = { ...baseEnv, role: 'made-up' };
  assert.equal(validateEnvelope(env).ok, false);
});

test('rejects bad ts', () => {
  const env = { ...baseEnv, ts: 'not-a-date' };
  assert.equal(validateEnvelope(env).ok, false);
});

test('rejects negative seq', () => {
  const env = { ...baseEnv, seq: -1 };
  assert.equal(validateEnvelope(env).ok, false);
});

test('all 6 roles are valid', () => {
  for (const role of ['prompt', 'reasoning', 'tool_call', 'tool_result', 'response', 'meta']) {
    const env = { ...baseEnv, role };
    assert.equal(validateEnvelope(env).ok, true, `role ${role} should be valid`);
  }
});

test('all 5 runtimes are valid', () => {
  for (const runtime of ['claude-code', 'codex-cli', 'gemini-cli', 'opencode', 'gad-cli']) {
    const env = { ...baseEnv, runtime };
    assert.equal(validateEnvelope(env).ok, true, `runtime ${runtime} should be valid`);
  }
});

test('VALID_RUNTIMES + VALID_ROLES exposed as Sets', () => {
  assert.ok(VALID_RUNTIMES instanceof Set);
  assert.ok(VALID_ROLES instanceof Set);
});

test('JSON round-trip is idempotent', () => {
  const env = makeEnvelope(baseEnv);
  const round = JSON.parse(JSON.stringify(env));
  assert.deepEqual(round, env);
});

test('makeEnvelope freezes output', () => {
  const env = makeEnvelope(baseEnv);
  assert.throws(() => { env.role = 'meta'; }, /(read.only|object is not extensible|Cannot assign)/);
});

test('makeEnvelope fills optional fields with null', () => {
  const env = makeEnvelope(baseEnv);
  assert.equal(env.task_id, null);
  assert.equal(env.handoff_id, null);
  assert.equal(env.model, null);
  assert.equal(env.parent_id, null);
  assert.equal(env.agent_id, null);
});

test('makeEnvelope throws on invalid input', () => {
  assert.throws(() => makeEnvelope({ ...baseEnv, runtime: 'bad' }));
});

test('deriveEnvelopeId is deterministic', () => {
  const a = deriveEnvelopeId('worker-log|w1|2026-05-06T08:04:11.067Z');
  const b = deriveEnvelopeId('worker-log|w1|2026-05-06T08:04:11.067Z');
  assert.equal(a, b);
});

test('deriveEnvelopeId produces uuid-shaped output', () => {
  const id = deriveEnvelopeId('any-key');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('deriveEnvelopeId different keys → different ids', () => {
  const a = deriveEnvelopeId('key-one');
  const b = deriveEnvelopeId('key-two');
  assert.notEqual(a, b);
});

test('deriveEnvelopeId throws on empty key', () => {
  assert.throws(() => deriveEnvelopeId(''));
  assert.throws(() => deriveEnvelopeId(null));
});

test('runIdPrefix maps each runtime', () => {
  assert.equal(runIdPrefix('claude-code'), 'cc');
  assert.equal(runIdPrefix('codex-cli'), 'cx');
  assert.equal(runIdPrefix('gemini-cli'), 'gm');
  assert.equal(runIdPrefix('opencode'), 'oc');
  assert.equal(runIdPrefix('gad-cli'), 'gd');
  assert.equal(runIdPrefix('something-else'), 'xx');
});

test('makeRunId formats correctly', () => {
  const id = makeRunId('claude-code', 'sess-abc', '2026-05-06T09:30:00.000Z');
  assert.equal(id, 'cc-sess-abc-2026-05-06T09:30:00.000Z');
});

test('makeRunId sanitises bad chars in session id', () => {
  const id = makeRunId('codex-cli', 'sess/with bad?chars', '2026-05-06T09:30:00.000Z');
  assert.match(id, /^cx-sess_with_bad_chars-/);
});

// ---------------------------------------------------------------------------
// content_type validation (Phase 145 follow-up)
// ---------------------------------------------------------------------------

test('content_type listed in OPTIONAL_FIELDS', () => {
  assert.ok(OPTIONAL_FIELDS.includes('content_type'));
});

test('VALID_CONTENT_TYPES is a Set with 6 entries', () => {
  assert.ok(VALID_CONTENT_TYPES instanceof Set);
  assert.equal(VALID_CONTENT_TYPES.size, 6);
});

test('valid envelope with each content_type passes validation', () => {
  for (const ct of ['planning', 'code', 'site', 'eval', 'narrative', 'meta']) {
    const env = { ...baseEnv, content_type: ct };
    assert.equal(validateEnvelope(env).ok, true, `content_type ${ct} should validate`);
  }
});

test('envelope validation rejects invalid content_type', () => {
  const env = { ...baseEnv, content_type: 'not-a-real-type' };
  const r = validateEnvelope(env);
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /content_type/);
});

test('envelope validation accepts null content_type', () => {
  const env = { ...baseEnv, content_type: null };
  assert.equal(validateEnvelope(env).ok, true);
});

test('envelope validation accepts missing content_type', () => {
  const env = { ...baseEnv };
  delete env.content_type;
  assert.equal(validateEnvelope(env).ok, true);
});

test('makeEnvelope defaults content_type to null', () => {
  const env = makeEnvelope(baseEnv);
  assert.equal(env.content_type, null);
});

test('makeEnvelope passes content_type through', () => {
  const env = makeEnvelope({ ...baseEnv, content_type: 'planning' });
  assert.equal(env.content_type, 'planning');
});

test('makeEnvelope rejects invalid content_type', () => {
  assert.throws(() => makeEnvelope({ ...baseEnv, content_type: 'bogus' }));
});
