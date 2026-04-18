/**
 * openai-client.test.cjs — unit tests for lib/openai-client.cjs (task 60-06).
 *
 * Spec: references/byok-design.md §14.
 * Decisions: gad-266 (BYOK A-H defaults), gad-260 (BYOK direction).
 *
 * Pure unit tests — no real network, no real secrets-store, no real logger.
 * Mock fetch + mock store + captured logger are injected via the
 * createOpenAIClient factory.
 *
 * Mandatory coverage (task spec):
 *   1. resolveApiKey — bag hit
 *   2. resolveApiKey — bag miss (KEY_NOT_FOUND) + env hit → warn logged
 *   3. resolveApiKey — bag miss (PROJECT_NOT_FOUND) + env hit
 *   4. resolveApiKey — bag miss (message-shape match) + env hit
 *   5. resolveApiKey — bag PASSPHRASE_INVALID propagates (no env fallback)
 *   6. resolveApiKey — bag BAG_CORRUPT propagates
 *   7. resolveApiKey — bag miss + env empty → KEY_UNRESOLVED
 *   8. chat happy path
 *   9. chat HTTP 401 → HTTP_ERROR with httpStatus
 *  10. chat network error → NETWORK_ERROR with .cause
 *  11. chat malformed response → MALFORMED_RESPONSE
 *  12. chat authorization header is exactly Bearer <key>, logger never sees key
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  createOpenAIClient,
  createApiKeyResolver,
  OpenAIClientError,
} = require('../lib/openai-client.cjs');
const { SecretsStoreError } = require('../lib/secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockStore({ value, error } = {}) {
  const calls = [];
  return {
    calls,
    async get({ projectId, keyName }) {
      calls.push({ projectId, keyName });
      if (error) throw error;
      return value;
    },
  };
}

function makeCapturingLogger() {
  const events = { warn: [], info: [], error: [] };
  return {
    events,
    warn: (...args) => { events.warn.push(args); },
    info: (...args) => { events.info.push(args); },
    error: (...args) => { events.error.push(args); },
  };
}

function makeMockFetch(implOrValue) {
  // Accepts either a function (full control) or a { status, body } response
  // object (returns an ok response with the given JSON body).
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (typeof implOrValue === 'function') return implOrValue(url, init);
    const resp = implOrValue || {};
    return makeFakeResponse(resp);
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function makeFakeResponse({ status = 200, jsonBody, textBody } = {}) {
  const ok = status >= 200 && status < 300;
  return {
    ok,
    status,
    async json() {
      if (jsonBody === undefined) throw new Error('no json body');
      if (jsonBody instanceof Error) throw jsonBody;
      return jsonBody;
    },
    async text() {
      if (textBody !== undefined) return textBody;
      if (jsonBody !== undefined && !(jsonBody instanceof Error)) {
        return JSON.stringify(jsonBody);
      }
      return '';
    },
  };
}

const VALID_CHAT_BODY = {
  id: 'chatcmpl-test',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'hello world' },
      finish_reason: 'stop',
    },
  ],
};

// ---------------------------------------------------------------------------
// 1. resolveApiKey — bag hit
// ---------------------------------------------------------------------------

describe('resolveApiKey: bag hit', () => {
  test('returns bag value verbatim, no env consulted', async () => {
    const store = makeMockStore({ value: 'sk-bag-xyz' });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-ambient-should-not-win' };
    const resolve = createApiKeyResolver({ store, env, logger });

    const got = await resolve({ projectId: 'llm-from-scratch' });

    assert.strictEqual(got, 'sk-bag-xyz');
    assert.strictEqual(store.calls.length, 1);
    assert.deepStrictEqual(store.calls[0], {
      projectId: 'llm-from-scratch',
      keyName: 'OPENAI_API_KEY',
    });
    assert.strictEqual(logger.events.warn.length, 0, 'no deprecation warning on bag hit');
  });
});

// ---------------------------------------------------------------------------
// 2. resolveApiKey — bag miss KEY_NOT_FOUND + env hit
// ---------------------------------------------------------------------------

describe('resolveApiKey: bag miss KEY_NOT_FOUND + env hit', () => {
  test('returns env value, logs deprecation warning with migration command', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('KEY_NOT_FOUND', 'key "OPENAI_API_KEY" not set for project "llm-from-scratch"'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-env-fallback' };
    const resolve = createApiKeyResolver({ store, env, logger });

    const got = await resolve({ projectId: 'llm-from-scratch' });

    assert.strictEqual(got, 'sk-env-fallback');
    assert.strictEqual(logger.events.warn.length, 1);
    const msg = String(logger.events.warn[0][0] || '');
    assert.match(msg, /resolved from process\.env/i);
    assert.match(msg, /gad env set OPENAI_API_KEY --projectid llm-from-scratch/);
    // Logger MUST NOT echo the actual key.
    assert.ok(!msg.includes('sk-env-fallback'), 'warning must not leak the key');
  });
});

// ---------------------------------------------------------------------------
// 3. resolveApiKey — bag miss PROJECT_NOT_FOUND + env hit
// ---------------------------------------------------------------------------

describe('resolveApiKey: bag miss PROJECT_NOT_FOUND + env hit', () => {
  test('PROJECT_NOT_FOUND also falls through to env', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('PROJECT_NOT_FOUND', 'no planning root found for projectid=ghost'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-env-2' };
    const resolve = createApiKeyResolver({ store, env, logger });

    const got = await resolve({ projectId: 'ghost' });

    assert.strictEqual(got, 'sk-env-2');
    assert.strictEqual(logger.events.warn.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. resolveApiKey — bag miss (message-shape match) + env hit
// ---------------------------------------------------------------------------

describe('resolveApiKey: bag miss via message shape + env hit', () => {
  test('plain Error with "no envelope for project" message falls through', async () => {
    // Defensive path: a legacy wrapper might emit a plain Error rather than
    // a SecretsStoreError. We match the envelope-missing message pattern.
    const raw = new Error('no envelope for project "llm-from-scratch" at .gad/secrets/llm-from-scratch.enc');
    const store = makeMockStore({ error: raw });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-env-3' };
    const resolve = createApiKeyResolver({ store, env, logger });

    const got = await resolve({ projectId: 'llm-from-scratch' });

    assert.strictEqual(got, 'sk-env-3');
    assert.strictEqual(logger.events.warn.length, 1);
  });
});

// ---------------------------------------------------------------------------
// 5. resolveApiKey — PASSPHRASE_INVALID does NOT fall through
// ---------------------------------------------------------------------------

describe('resolveApiKey: PASSPHRASE_INVALID propagates', () => {
  test('wrong passphrase must NOT silently use env key', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('PASSPHRASE_INVALID', 'master passphrase did not decrypt the envelope'),
    });
    const logger = makeCapturingLogger();
    // Env IS populated — the test is that we REFUSE to use it.
    const env = { OPENAI_API_KEY: 'sk-must-not-leak' };
    const resolve = createApiKeyResolver({ store, env, logger });

    await assert.rejects(
      () => resolve({ projectId: 'llm-from-scratch' }),
      (err) => {
        assert.ok(err instanceof SecretsStoreError, 'original error propagates unchanged');
        assert.strictEqual(err.code, 'PASSPHRASE_INVALID');
        return true;
      },
    );
    // No warning either — we never reached the env branch.
    assert.strictEqual(logger.events.warn.length, 0);
  });
});

// ---------------------------------------------------------------------------
// 6. resolveApiKey — BAG_CORRUPT does NOT fall through
// ---------------------------------------------------------------------------

describe('resolveApiKey: BAG_CORRUPT propagates', () => {
  test('corrupt envelope must fail loudly — no env fallback', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('BAG_CORRUPT', 'envelope is malformed or tampered'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-should-not-win' };
    const resolve = createApiKeyResolver({ store, env, logger });

    await assert.rejects(
      () => resolve({ projectId: 'llm-from-scratch' }),
      (err) => err.code === 'BAG_CORRUPT',
    );
    assert.strictEqual(logger.events.warn.length, 0);
  });

  test('KEYCHAIN_LOCKED also propagates (no env fallback)', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('KEYCHAIN_LOCKED', 'OS keychain rejected the unlock request'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-x' };
    const resolve = createApiKeyResolver({ store, env, logger });

    await assert.rejects(
      () => resolve({ projectId: 'proj' }),
      (err) => err.code === 'KEYCHAIN_LOCKED',
    );
  });
});

// ---------------------------------------------------------------------------
// 7. resolveApiKey — bag miss + env empty → KEY_UNRESOLVED
// ---------------------------------------------------------------------------

describe('resolveApiKey: bag miss + env empty', () => {
  test('throws KEY_UNRESOLVED with remediation command', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('KEY_NOT_FOUND', 'key "OPENAI_API_KEY" not set'),
    });
    const logger = makeCapturingLogger();
    const env = {}; // no OPENAI_API_KEY at all
    const resolve = createApiKeyResolver({ store, env, logger });

    await assert.rejects(
      () => resolve({ projectId: 'llm-from-scratch' }),
      (err) => {
        assert.ok(err instanceof OpenAIClientError);
        assert.strictEqual(err.code, 'KEY_UNRESOLVED');
        assert.match(err.message, /gad env set OPENAI_API_KEY --projectid llm-from-scratch/);
        return true;
      },
    );
  });

  test('empty-string env is treated as missing', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('KEY_NOT_FOUND', 'key not set'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: '' };
    const resolve = createApiKeyResolver({ store, env, logger });

    await assert.rejects(
      () => resolve({ projectId: 'x' }),
      (err) => err.code === 'KEY_UNRESOLVED',
    );
  });
});

// ---------------------------------------------------------------------------
// 8. chat happy path
// ---------------------------------------------------------------------------

describe('chat: happy path', () => {
  test('returns content string + raw parsed body', async () => {
    const store = makeMockStore({ value: 'sk-happy' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: VALID_CHAT_BODY });
    const client = createOpenAIClient({
      store,
      fetchImpl,
      env: {},
      logger: makeCapturingLogger(),
    });

    const { content, raw } = await client.chat({
      projectId: 'llm-from-scratch',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });

    assert.strictEqual(content, 'hello world');
    assert.deepStrictEqual(raw, VALID_CHAT_BODY);
    assert.strictEqual(fetchImpl.calls.length, 1);
    assert.strictEqual(fetchImpl.calls[0].url, 'https://api.openai.com/v1/chat/completions');
    const sentBody = JSON.parse(fetchImpl.calls[0].init.body);
    assert.strictEqual(sentBody.model, 'gpt-4o-mini');
    assert.deepStrictEqual(sentBody.messages, [{ role: 'user', content: 'hi' }]);
  });

  test('merges options into the request body', async () => {
    const store = makeMockStore({ value: 'sk-opts' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: VALID_CHAT_BODY });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await client.chat({
      projectId: 'p',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'x' }],
      options: { temperature: 0.2, max_tokens: 50 },
    });

    const sent = JSON.parse(fetchImpl.calls[0].init.body);
    assert.strictEqual(sent.temperature, 0.2);
    assert.strictEqual(sent.max_tokens, 50);
  });
});

// ---------------------------------------------------------------------------
// 9. chat HTTP 401 → HTTP_ERROR
// ---------------------------------------------------------------------------

describe('chat: HTTP 401', () => {
  test('throws HTTP_ERROR with httpStatus=401 and .cause preserving body', async () => {
    const store = makeMockStore({ value: 'sk-bad' });
    const fetchImpl = makeMockFetch({ status: 401, textBody: 'Incorrect API key provided' });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await assert.rejects(
      () => client.chat({
        projectId: 'p',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
      }),
      (err) => {
        assert.ok(err instanceof OpenAIClientError);
        assert.strictEqual(err.code, 'HTTP_ERROR');
        assert.strictEqual(err.httpStatus, 401);
        assert.ok(err.cause, '.cause preserved');
        assert.match(String(err.cause.message), /401/);
        assert.match(String(err.cause.message), /Incorrect API key provided/);
        return true;
      },
    );
  });

  test('HTTP 500 also surfaces as HTTP_ERROR with httpStatus', async () => {
    const store = makeMockStore({ value: 'sk-ok' });
    const fetchImpl = makeMockFetch({ status: 500, textBody: 'internal' });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await assert.rejects(
      () => client.chat({
        projectId: 'p',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
      }),
      (err) => err.code === 'HTTP_ERROR' && err.httpStatus === 500,
    );
  });
});

// ---------------------------------------------------------------------------
// 10. chat network error → NETWORK_ERROR
// ---------------------------------------------------------------------------

describe('chat: network error', () => {
  test('fetch rejection → NETWORK_ERROR with .cause', async () => {
    const store = makeMockStore({ value: 'sk-ok' });
    const boom = new Error('ECONNREFUSED 127.0.0.1:443');
    const fetchImpl = makeMockFetch(() => { throw boom; });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await assert.rejects(
      () => client.chat({
        projectId: 'p',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
      }),
      (err) => {
        assert.ok(err instanceof OpenAIClientError);
        assert.strictEqual(err.code, 'NETWORK_ERROR');
        assert.strictEqual(err.cause, boom);
        assert.match(err.message, /ECONNREFUSED/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// 11. chat malformed response → MALFORMED_RESPONSE
// ---------------------------------------------------------------------------

describe('chat: malformed response', () => {
  test('2xx but missing choices[0].message.content → MALFORMED_RESPONSE', async () => {
    const store = makeMockStore({ value: 'sk-ok' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: { choices: [{ index: 0 }] } });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await assert.rejects(
      () => client.chat({
        projectId: 'p',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
      }),
      (err) => {
        assert.ok(err instanceof OpenAIClientError);
        assert.strictEqual(err.code, 'MALFORMED_RESPONSE');
        return true;
      },
    );
  });

  test('2xx with non-JSON body → MALFORMED_RESPONSE', async () => {
    const store = makeMockStore({ value: 'sk-ok' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: new Error('unexpected token <') });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });

    await assert.rejects(
      () => client.chat({
        projectId: 'p',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'x' }],
      }),
      (err) => err.code === 'MALFORMED_RESPONSE',
    );
  });
});

// ---------------------------------------------------------------------------
// 12. Auth header format + no key echo in logs
// ---------------------------------------------------------------------------

describe('chat: auth header + logger hygiene', () => {
  test('Authorization header is exactly "Bearer <key>" and Content-Type is JSON', async () => {
    const store = makeMockStore({ value: 'sk-secret-12345' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: VALID_CHAT_BODY });
    const logger = makeCapturingLogger();
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger });

    await client.chat({
      projectId: 'p',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'x' }],
    });

    const { init } = fetchImpl.calls[0];
    assert.strictEqual(init.method, 'POST');
    assert.strictEqual(init.headers['Authorization'], 'Bearer sk-secret-12345');
    assert.strictEqual(init.headers['Content-Type'], 'application/json');
    // Logger never saw the key (no warn/info/error on happy path).
    const all = [
      ...logger.events.warn.flat(),
      ...logger.events.info.flat(),
      ...logger.events.error.flat(),
    ].map((x) => (typeof x === 'string' ? x : ''));
    for (const line of all) {
      assert.ok(!line.includes('sk-secret-12345'), `logger leaked key: ${line}`);
    }
  });

  test('env-fallback warn log never includes the resolved key value', async () => {
    const store = makeMockStore({
      error: new SecretsStoreError('KEY_NOT_FOUND', 'not set'),
    });
    const logger = makeCapturingLogger();
    const env = { OPENAI_API_KEY: 'sk-leak-check-67890' };
    const resolve = createApiKeyResolver({ store, env, logger });

    await resolve({ projectId: 'p' });

    assert.strictEqual(logger.events.warn.length, 1);
    const all = logger.events.warn.flat().map((x) => (typeof x === 'string' ? x : ''));
    for (const line of all) {
      assert.ok(!line.includes('sk-leak-check-67890'), `warn leaked key: ${line}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Extra: factory input validation (defensive — not mandatory coverage)
// ---------------------------------------------------------------------------

describe('createOpenAIClient: input validation', () => {
  test('rejects missing store', () => {
    assert.throws(
      () => createOpenAIClient({ store: null, fetchImpl: () => {}, env: {}, logger: makeCapturingLogger() }),
      /store must expose async get/,
    );
  });

  test('rejects store without get()', () => {
    assert.throws(
      () => createOpenAIClient({ store: {}, fetchImpl: () => {}, env: {}, logger: makeCapturingLogger() }),
      /store must expose async get/,
    );
  });

  test('resolveApiKey: rejects empty projectId', async () => {
    const store = makeMockStore({ value: 'x' });
    const resolve = createApiKeyResolver({ store, env: {}, logger: makeCapturingLogger() });
    await assert.rejects(() => resolve({ projectId: '' }), /projectId is required/);
  });

  test('chat: rejects empty messages', async () => {
    const store = makeMockStore({ value: 'sk-ok' });
    const fetchImpl = makeMockFetch({ status: 200, jsonBody: VALID_CHAT_BODY });
    const client = createOpenAIClient({ store, fetchImpl, env: {}, logger: makeCapturingLogger() });
    await assert.rejects(
      () => client.chat({ projectId: 'p', model: 'gpt-4o-mini', messages: [] }),
      /messages is required/,
    );
  });
});
