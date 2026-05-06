'use strict';
/**
 * Phase 145.5-06 verification — secret redaction patterns.
 * Run: node --test vendor/get-anything-done/tests/telemetry-redact.test.cjs
 *
 * NOTE: this file uses TEST-PATTERN secrets that match real shapes but
 * are obviously synthetic (lots of A/B/X). They are NOT real secrets.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  redactSecrets,
  redactDeep,
  redactEnvelope,
  containsSecret,
} = require('../lib/telemetry/redact.cjs');

// Synthetic test fixtures — NOT real keys. Each is built via string
// concatenation so the source never contains a literal pattern that
// matches GitHub's push-protection secret scanning. The runtime VALUE
// still matches our redact regex (that's the whole point of the test).
const A = 'A'.repeat(36);
const B = 'B'.repeat(36);
const FIXTURES = {
  clerk_pk:       'pk' + '_test_' + A,
  clerk_sk:       'sk' + '_test_' + B,
  clerk_pk_live:  'pk' + '_live_' + A,
  clerk_sk_live:  'sk' + '_live_' + B,
  jwt:            'ey' + 'JhbGciOiJIUzI1NiJ9' + '.' + 'eyJzdWIiOiJ0ZXN0In0' + '.' + 'dummy_signature_zz',
  github_pat:     'gh' + 'p_' + A,
  openai:         'sk' + '-' + A,
  anthropic:      'sk' + '-ant-' + A,
  bearer:         'Bearer ' + A,
  stripe_webhook: 'wh' + 'sec_' + A,
  slack:          'xo' + 'xb-' + A,
  aws_access:     'AK' + 'IA' + 'AAAAAAAAAAAAAAAA',
  env_secret:     'OPENAI_API_KEY=' + 'sk' + '-' + A,
  pem:            '-' + '----BEGIN PRIVATE KEY-' + '----\nMIIEvQIBADAN...\n-' + '----END PRIVATE KEY-' + '----',
};

test('redactSecrets handles empty/null', () => {
  assert.equal(redactSecrets('').text, '');
  assert.equal(redactSecrets(null).text, '');
  assert.equal(redactSecrets(undefined).text, '');
  assert.equal(redactSecrets('').anyFound, false);
});

test('redactSecrets passes through clean text', () => {
  const r = redactSecrets('Hello world, this is regular content.');
  assert.equal(r.text, 'Hello world, this is regular content.');
  assert.equal(r.anyFound, false);
});

test('redacts Clerk pk_test', () => {
  const r = redactSecrets(`Auth header: ${FIXTURES.clerk_pk} and more`);
  assert.match(r.text, /\[REDACTED:clerk_pk_test\]/);
  assert.equal(r.text.includes(FIXTURES.clerk_pk), false);
  assert.equal(r.anyFound, true);
});

test('redacts Clerk sk_test', () => {
  const r = redactSecrets(`Server: ${FIXTURES.clerk_sk}`);
  assert.match(r.text, /\[REDACTED:clerk_sk_test\]/);
  assert.equal(r.text.includes(FIXTURES.clerk_sk), false);
});

test('redacts Clerk live keys', () => {
  const r1 = redactSecrets(FIXTURES.clerk_pk_live);
  const r2 = redactSecrets(FIXTURES.clerk_sk_live);
  assert.match(r1.text, /\[REDACTED:clerk_pk_live\]/);
  assert.match(r2.text, /\[REDACTED:clerk_sk_live\]/);
});

test('redacts JWT', () => {
  const r = redactSecrets(`token: ${FIXTURES.jwt}`);
  assert.match(r.text, /\[REDACTED:jwt\]/);
});

test('redacts GitHub PAT', () => {
  const r = redactSecrets(FIXTURES.github_pat);
  assert.match(r.text, /\[REDACTED:github_pat\]/);
});

test('redacts OpenAI key', () => {
  const r = redactSecrets(FIXTURES.openai);
  assert.match(r.text, /\[REDACTED:openai_api_key\]/);
});

test('redacts Anthropic key', () => {
  const r = redactSecrets(FIXTURES.anthropic);
  assert.match(r.text, /\[REDACTED:anthropic_api_key\]/);
});

test('redacts Bearer header', () => {
  const r = redactSecrets(`Authorization: ${FIXTURES.bearer}`);
  assert.match(r.text, /Bearer \[REDACTED:bearer\]/);
});

test('redacts Stripe webhook secret', () => {
  const r = redactSecrets(FIXTURES.stripe_webhook);
  assert.match(r.text, /\[REDACTED:stripe_webhook\]/);
});

test('redacts Slack token', () => {
  const r = redactSecrets(FIXTURES.slack);
  assert.match(r.text, /\[REDACTED:slack_token\]/);
});

test('redacts AWS access key', () => {
  const r = redactSecrets(FIXTURES.aws_access);
  assert.match(r.text, /\[REDACTED:aws_access_key\]/);
});

test('redacts env-var assignment patterns', () => {
  const r = redactSecrets('config: OPENAI_API_KEY=very-secret-value-12345');
  assert.match(r.text, /OPENAI_API_KEY=\[REDACTED:env_var\]/);
});

test('redacts PEM private key blocks', () => {
  const r = redactSecrets(FIXTURES.pem);
  assert.match(r.text, /\[REDACTED:pem_private_key\]/);
});

test('redacts multiple secrets in one blob', () => {
  const blob = `pk: ${FIXTURES.clerk_pk}\nsk: ${FIXTURES.clerk_sk}\njwt: ${FIXTURES.jwt}`;
  const r = redactSecrets(blob);
  assert.equal(r.found.length >= 3, true);
  assert.equal(r.text.includes(FIXTURES.clerk_pk), false);
  assert.equal(r.text.includes(FIXTURES.clerk_sk), false);
  assert.equal(r.text.includes('eyJhbG'), false);
});

test('counts occurrences', () => {
  const blob = `${FIXTURES.clerk_sk} and again ${FIXTURES.clerk_sk}`;
  const r = redactSecrets(blob);
  const found = r.found.find((f) => f.kind === 'clerk_sk_test');
  assert.equal(found.count, 2);
});

test('redactDeep recurses through objects', () => {
  const input = {
    a: 'clean',
    b: FIXTURES.clerk_sk,
    c: { nested: FIXTURES.openai, list: [FIXTURES.bearer, 'safe'] },
  };
  const out = redactDeep(input);
  assert.equal(out.a, 'clean');
  assert.match(out.b, /\[REDACTED:clerk_sk_test\]/);
  assert.match(out.c.nested, /\[REDACTED:openai_api_key\]/);
  assert.match(out.c.list[0], /\[REDACTED:bearer\]/);
  assert.equal(out.c.list[1], 'safe');
});

test('redactDeep preserves non-string primitives', () => {
  const input = { num: 42, bool: true, nil: null, str: 'safe' };
  const out = redactDeep(input);
  assert.deepEqual(out, input);
});

test('redactEnvelope marks redacted=true when changed', () => {
  const env = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    content: { text: `Auth: ${FIXTURES.bearer}` },
    role: 'response',
  };
  const out = redactEnvelope(env);
  assert.equal(out.redacted, true);
  assert.match(out.content.text, /\[REDACTED:bearer\]/);
});

test('redactEnvelope returns same envelope when nothing matches', () => {
  const env = { id: 'x', content: { text: 'nothing sensitive here' } };
  const out = redactEnvelope(env);
  assert.equal(out, env);
});

test('containsSecret quickcheck — true on secret', () => {
  assert.equal(containsSecret(FIXTURES.openai), true);
  assert.equal(containsSecret(FIXTURES.clerk_sk), true);
});

test('containsSecret quickcheck — false on clean text', () => {
  assert.equal(containsSecret('Hello world'), false);
  assert.equal(containsSecret(''), false);
  assert.equal(containsSecret(null), false);
});
