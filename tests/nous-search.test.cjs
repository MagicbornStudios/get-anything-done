'use strict';
/**
 * nous-search.test.cjs — unit tests for gad nous command.
 *
 * All GitHub API calls are mocked. No real network requests.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  fetchRepos,
  fetchReleases,
  apiFetch,
  parseRateLimit,
  cacheKey,
  readCache,
  writeCache,
} = require('../bin/commands/nous.cjs');

// ─── Mock fetch infrastructure ────────────────────────────────────────────────

let mockFetch = null;
const originalFetch = global.fetch;

function installMockFetch(impl) {
  mockFetch = impl;
  global.fetch = (...args) => mockFetch(...args);
}

function restoreFetch() {
  global.fetch = originalFetch;
  mockFetch = null;
}

function makeResponse(body, { status = 200, headers = {} } = {}) {
  const headerMap = {
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': '42',
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
    ...headers,
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k) => headerMap[k.toLowerCase()] || null,
    },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => JSON.stringify(body),
  };
}

// ─── Temp dir helpers ─────────────────────────────────────────────────────────

function createTempDir(prefix = 'nous-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ─── Test 1: repos returns correct array shape from mocked fetch ──────────────

describe('nous repos — array shape from mock', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir();
    installMockFetch(async (url) => {
      if (url.includes('/orgs/NousResearch/repos')) {
        return makeResponse([
          {
            name: 'Hermes-3',
            full_name: 'NousResearch/Hermes-3',
            description: 'Hermes-3 LLM',
            stargazers_count: 1200,
            forks_count: 88,
            language: 'Python',
            topics: ['llm', 'hermes'],
            pushed_at: '2026-05-01T10:00:00Z',
            html_url: 'https://github.com/NousResearch/Hermes-3',
            archived: false,
          },
          {
            name: 'Atropos',
            full_name: 'NousResearch/Atropos',
            description: 'RL training framework',
            stargazers_count: 3400,
            forks_count: 210,
            language: 'Python',
            topics: ['rl', 'training'],
            pushed_at: '2026-05-03T08:00:00Z',
            html_url: 'https://github.com/NousResearch/Atropos',
            archived: false,
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(() => {
    restoreFetch();
    cleanup(tmpDir);
  });

  test('returns array of repos with required shape fields', async () => {
    const result = await fetchRepos('NousResearch', { limit: 5, repoRoot: tmpDir, ttlSeconds: 300 });

    assert.strictEqual(result.org, 'NousResearch');
    assert.ok(Array.isArray(result.repos), 'repos should be an array');
    assert.strictEqual(result.repos.length, 2);

    const first = result.repos[0];
    assert.strictEqual(first.name, 'Hermes-3');
    assert.strictEqual(first.stars, 1200);
    assert.strictEqual(first.language, 'Python');
    assert.ok(Array.isArray(first.topics), 'topics should be array');
    assert.strictEqual(first.pushed_at, '2026-05-01T10:00:00Z');
    assert.strictEqual(first.archived, false);
    assert.ok(first.html_url.startsWith('https://'), 'html_url should be a URL');

    // Metadata shape
    assert.ok(result.metadata, 'metadata should be present');
    assert.ok(result.metadata.rateLimit, 'rateLimit should be present');
    assert.strictEqual(result.metadata.rateLimit.limit, 60);
    assert.strictEqual(result.metadata.rateLimit.remaining, 42);
    assert.ok(result.metadata.rateLimit.resetAt, 'resetAt should be set');
  });
});

// ─── Test 2: cache writes + reads within TTL (no second fetch) ────────────────

describe('nous cache — write+read within TTL avoids second fetch', () => {
  let tmpDir;
  let fetchCallCount;

  beforeEach(() => {
    tmpDir = createTempDir();
    fetchCallCount = 0;
    installMockFetch(async (url) => {
      fetchCallCount++;
      if (url.includes('/orgs/NousResearch/repos')) {
        return makeResponse([
          {
            name: 'repo-alpha',
            full_name: 'NousResearch/repo-alpha',
            description: '',
            stargazers_count: 10,
            forks_count: 0,
            language: null,
            topics: [],
            pushed_at: '2026-05-01T00:00:00Z',
            html_url: 'https://github.com/NousResearch/repo-alpha',
            archived: false,
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(() => {
    restoreFetch();
    cleanup(tmpDir);
  });

  test('second call within TTL reads from cache — fetch called exactly once', async () => {
    const opts = { limit: 5, repoRoot: tmpDir, ttlSeconds: 300 };

    // First call — hits real (mock) fetch
    const r1 = await fetchRepos('NousResearch', opts);
    assert.strictEqual(fetchCallCount, 1, 'fetch should be called once on first request');
    assert.strictEqual(r1.metadata.cached, false);

    // Second call — should hit cache, not fetch
    const r2 = await fetchRepos('NousResearch', opts);
    assert.strictEqual(fetchCallCount, 1, 'fetch should NOT be called again within TTL');
    assert.strictEqual(r2.metadata.cached, true);

    // Data should match
    assert.strictEqual(r1.repos.length, r2.repos.length);
    assert.strictEqual(r1.repos[0].name, r2.repos[0].name);
  });

  test('cache file is written to .planning/.nous-cache/', () => {
    const dir = path.join(tmpDir, '.planning', '.nous-cache');
    // writeCache helper directly
    writeCache(dir, 'testkey', { hello: 'world' });
    const files = fs.readdirSync(dir);
    assert.strictEqual(files.length, 1, 'exactly one cache file should exist');
    assert.ok(files[0].endsWith('.json'), 'cache file should be .json');

    // readCache within TTL returns data
    const got = readCache(dir, 'testkey', 300);
    assert.deepStrictEqual(got, { hello: 'world' });
  });

  test('cache miss after TTL expires returns null', () => {
    const dir = path.join(tmpDir, '.planning', '.nous-cache');
    fs.mkdirSync(dir, { recursive: true });
    // Write with a timestamp 10 minutes in the past
    const file = path.join(dir, 'expiredkey.json');
    fs.writeFileSync(file, JSON.stringify({ ts: Date.now() - 10 * 60 * 1000, data: { val: 1 } }));
    const got = readCache(dir, 'expiredkey', 300); // 5-min TTL → should miss
    assert.strictEqual(got, null, 'expired cache should return null');
  });
});

// ─── Test 3: rate-limit info parsed correctly from response headers ────────────

describe('nous rate-limit — parsed from response headers', () => {
  afterEach(restoreFetch);

  test('parseRateLimit extracts limit, remaining, resetAt', () => {
    const mockHeaders = {
      'x-ratelimit-limit': '5000',
      'x-ratelimit-remaining': '4987',
      'x-ratelimit-reset': '1746745200', // fixed epoch
    };
    // Simulate Headers object with .get()
    const headers = { get: (k) => mockHeaders[k] || null };

    const rl = parseRateLimit(headers);
    assert.strictEqual(rl.limit, 5000);
    assert.strictEqual(rl.remaining, 4987);
    assert.ok(rl.resetAt, 'resetAt should be present');
    assert.ok(rl.resetAt.includes('T'), 'resetAt should be ISO string');
  });

  test('rate-limit error surfaces resetAt on 403', async () => {
    let tmpDir = createTempDir();
    installMockFetch(async () => {
      return makeResponse(
        { message: 'API rate limit exceeded' },
        {
          status: 403,
          headers: {
            'x-ratelimit-limit': '60',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800),
          },
        }
      );
    });

    try {
      await apiFetch('https://api.github.com/orgs/NousResearch/repos', { repoRoot: tmpDir, ttlSeconds: 300 });
      assert.fail('Should have thrown rate-limit error');
    } catch (err) {
      assert.ok(err.message.includes('rate limit'), `Expected rate-limit message, got: ${err.message}`);
      assert.ok(err.message.includes('Resets at'), `Expected reset time in message, got: ${err.message}`);
      assert.ok(err.rateLimit, 'Error should carry rateLimit object');
      assert.strictEqual(err.rateLimit.remaining, 0);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('unauthenticated flag set when no GITHUB_TOKEN', () => {
    const saved = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    try {
      const headers = { get: () => null };
      const rl = parseRateLimit(headers);
      assert.strictEqual(rl.authenticated, false);
    } finally {
      if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    }
  });

  test('authenticated flag set when GITHUB_TOKEN present', () => {
    const saved = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = 'ghp_fake_token_for_test';
    try {
      const headers = { get: () => null };
      const rl = parseRateLimit(headers);
      assert.strictEqual(rl.authenticated, true);
    } finally {
      if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
      else delete process.env.GITHUB_TOKEN;
    }
  });
});
