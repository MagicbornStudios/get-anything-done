'use strict';
/**
 * hf-search.test.cjs — unit tests for gad hf command.
 *
 * Tests:
 *   1. Models search returns correct array shape from mocked fetch
 *   2. Datasets show returns metadata shape from mocked fetch
 *   3. Download errors clean when huggingface-cli missing (mock execFileSync)
 *
 * No real network requests or HF auth required.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const {
  searchModels,
  showDataset,
  runHfCli,
} = require('../bin/commands/hf.cjs');

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

function makeResponse(body, { status = 200 } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    text: async () => JSON.stringify(body),
  };
}

// ─── Test 1: Models search returns correct array shape ────────────────────────

describe('hf models search — array shape from mock', () => {
  beforeEach(() => {
    installMockFetch(async (url) => {
      if (url.includes('/api/models')) {
        return makeResponse([
          {
            modelId: 'NousResearch/Hermes-4-14B',
            downloads: 84200,
            likes: 312,
            lastModified: '2026-04-20T12:00:00Z',
            pipeline_tag: 'text-generation',
            tags: ['transformers', 'safetensors', 'qwen2', 'hermes'],
            private: false,
          },
          {
            modelId: 'NousResearch/NousCoder-14B',
            downloads: 52100,
            likes: 198,
            lastModified: '2026-04-15T08:30:00Z',
            pipeline_tag: 'text-generation',
            tags: ['transformers', 'safetensors', 'code'],
            private: false,
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(restoreFetch);

  test('returns result with query, total, and models array', async () => {
    const result = await searchModels('Hermes-4-14B', {
      limit: 5,
      apiBase: 'https://huggingface.co',
      token: '',
    });

    assert.strictEqual(result.query, 'Hermes-4-14B');
    assert.strictEqual(result.total, 2);
    assert.ok(Array.isArray(result.models), 'models should be an array');
  });

  test('each model has required shape fields', async () => {
    const result = await searchModels('Hermes-4-14B', {
      limit: 5,
      apiBase: 'https://huggingface.co',
      token: '',
    });

    const first = result.models[0];
    assert.strictEqual(first.id, 'NousResearch/Hermes-4-14B');
    assert.strictEqual(first.downloads, 84200);
    assert.strictEqual(first.likes, 312);
    assert.strictEqual(first.pipeline_tag, 'text-generation');
    assert.ok(Array.isArray(first.tags), 'tags should be array');
    assert.ok(first.tags.includes('hermes'), 'tags should include "hermes"');
    assert.strictEqual(first.private, false);
    assert.ok(first.lastModified, 'lastModified should be set');
  });

  test('second result also has correct shape', async () => {
    const result = await searchModels('Hermes-4-14B', {
      limit: 5,
      apiBase: 'https://huggingface.co',
      token: '',
    });

    const second = result.models[1];
    assert.strictEqual(second.id, 'NousResearch/NousCoder-14B');
    assert.strictEqual(second.downloads, 52100);
    assert.ok(second.tags.includes('code'), 'NousCoder tags should include "code"');
  });
});

// ─── Test 2: Datasets show returns metadata shape ─────────────────────────────

describe('hf datasets show — metadata shape from mock', () => {
  beforeEach(() => {
    installMockFetch(async (url) => {
      if (url.includes('/api/datasets/')) {
        return makeResponse({
          id: 'Anthropic/hh-rlhf',
          downloads: 180000,
          likes: 890,
          license: 'mit',
          tags: ['preference', 'dpo', 'rlhf', 'alignment'],
          lastModified: '2026-03-10T09:00:00Z',
          private: false,
        });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  });

  afterEach(restoreFetch);

  test('returns dataset with all required shape fields', async () => {
    const result = await showDataset('Anthropic/hh-rlhf', {
      apiBase: 'https://huggingface.co',
      token: '',
    });

    assert.strictEqual(result.id, 'Anthropic/hh-rlhf');
    assert.strictEqual(result.downloads, 180000);
    assert.strictEqual(result.likes, 890);
    assert.strictEqual(result.license, 'mit');
    assert.ok(Array.isArray(result.tags), 'tags should be an array');
    assert.ok(result.tags.includes('rlhf'), 'tags should include "rlhf"');
    assert.strictEqual(result.private, false);
    assert.ok(result.lastModified, 'lastModified should be present');
  });

  test('returns empty string for missing license gracefully', async () => {
    // Reinstall mock with no license field
    restoreFetch();
    installMockFetch(async () =>
      makeResponse({ id: 'test/no-license', downloads: 0, likes: 0, tags: [] })
    );

    const result = await showDataset('test/no-license', {
      apiBase: 'https://huggingface.co',
      token: '',
    });
    assert.strictEqual(result.license, '', 'missing license should be empty string');
    assert.strictEqual(result.private, false);
  });
});

// ─── Test 3: Download errors clean when huggingface-cli missing ───────────────

describe('hf download — clean error when huggingface-cli missing', () => {
  // We can't easily monkey-patch execFileSync inside hf.cjs since it's
  // required at module load. Instead we test the runHfCli function directly
  // by patching process.env to avoid real invocations, and we also verify
  // the error shape the CLI would produce.

  test('runHfCli throws CLI_MISSING error when binary not found', () => {
    // Override PATH to guarantee ENOENT
    const savedPath = process.env.PATH;
    process.env.PATH = '';

    try {
      runHfCli(['download', 'test/model', '--local-dir', '/tmp/test'], {});
      assert.fail('Should have thrown CLI_MISSING error');
    } catch (err) {
      assert.strictEqual(err.code, 'CLI_MISSING', `Expected CLI_MISSING, got: ${err.code} — ${err.message}`);
      assert.ok(
        err.message.includes('huggingface-cli not found'),
        `Expected "huggingface-cli not found" in message, got: ${err.message}`
      );
      assert.ok(
        err.message.includes('pip install'),
        `Expected pip install hint in message, got: ${err.message}`
      );
    } finally {
      process.env.PATH = savedPath;
    }
  });

  test('runHfCli error message includes install hint', () => {
    const savedPath = process.env.PATH;
    process.env.PATH = '';

    try {
      runHfCli(['upload', 'test/dataset', '.', '--repo-type', 'dataset'], {});
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(
        err.message.includes('huggingface_hub[cli]'),
        `Expected package name in hint, got: ${err.message}`
      );
    } finally {
      process.env.PATH = savedPath;
    }
  });
});
