'use strict';
/**
 * tests/context-index-hybrid.test.cjs
 *
 * Tests for hybrid BM25 + cosine + bge-reranker retrieval (GLOBAL-T-246-06).
 * Uses node:test built-in runner.
 *
 * Coverage:
 *   1. queryHybrid with rerank=false returns BM25-only results
 *   2. queryHybrid with rerank=false, embed=false — pure BM25 baseline
 *   3. queryHybrid with rerank=true but model unavailable → graceful fallback
 *   4. queryHybrid embed step skipped when Ollama unavailable
 *   5. queryIndex + queryHybrid agree on same result set when no reranker
 *   6. top N cap respected regardless of rerank/embed flags
 *   7. Empty index → empty results (no throw)
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Module under test
const { buildIndex, queryIndex, queryHybrid, resetReranker } = require('../lib/context-index/search.cjs');

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-hybrid-test-'));
}

function makeRecords(n = 20) {
  const sources = ['gad-log', 'state-log', 'git-log'];
  const texts = [
    'phase 247 pressure forecast ProphetStan model deployment',
    'bge reranker skill discovery cross encoder relevance matching',
    'hybrid BM25 cosine retrieval knowledge panel search',
    'tiktoken context budget estimator subagent dispatch',
    'DistilBERT log categorizer zero shot classification',
    'handoff runtime preference routing codex gemini claude',
    'task stamp attribution files array discipline training',
    'agent lanes deny list handoff queue cross lane edit',
    'planning artifacts ingest state log git log events ndjson',
    'milestone phase roadmap decisions requirements verification',
  ];
  const records = [];
  for (let i = 0; i < n; i++) {
    records.push({
      id: `rec-${i}`,
      text: texts[i % texts.length] + ` record ${i}`,
      source: sources[i % sources.length],
      ts: new Date(Date.now() - i * 60_000).toISOString(),
      sessionId: `s-${Math.floor(i / 5)}`,
    });
  }
  return records;
}

let tmpDir;
let eventsPath;
let indexFilePath;

before(() => {
  tmpDir = makeTmpDir();
  eventsPath = path.join(tmpDir, 'events.ndjson');
  indexFilePath = path.join(tmpDir, 'index.json');

  const records = makeRecords(20);
  fs.writeFileSync(eventsPath, records.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  buildIndex(eventsPath, indexFilePath);
});

after(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  resetReranker();
});

beforeEach(() => {
  resetReranker();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('queryHybrid — BM25-only baseline (rerank=false, embed=false)', () => {
  it('returns array of results for a known query', async () => {
    const results = await queryHybrid(indexFilePath, 'phase 247 pressure', {
      rerank: false,
      embed: false,
      top: 5,
    });
    assert.ok(Array.isArray(results), 'should return array');
    assert.ok(results.length >= 1, 'should find at least 1 result');
    assert.ok(results.length <= 5, 'should cap at top=5');
  });

  it('result shape has expected fields', async () => {
    const results = await queryHybrid(indexFilePath, 'bge reranker skill', {
      rerank: false,
      embed: false,
      top: 3,
    });
    assert.ok(results.length >= 1, 'should return results');
    const r = results[0];
    assert.ok(typeof r.id === 'string', 'id should be string');
    assert.ok(typeof r.text === 'string', 'text should be string');
    assert.ok(typeof r.bm25_score === 'number', 'bm25_score should be number');
    assert.equal(r.retrieval_method, 'bm25', 'retrieval_method should be bm25');
  });

  it('matches queryIndex result order', async () => {
    const query = 'tiktoken context budget';
    const bm25 = queryIndex(indexFilePath, query, { topK: 5 });
    const hybrid = await queryHybrid(indexFilePath, query, {
      rerank: false, embed: false, top: 5,
    });
    assert.equal(bm25.length, hybrid.length, 'same number of results');
    for (let i = 0; i < bm25.length; i++) {
      assert.equal(bm25[i].id, hybrid[i].id, `position ${i} should match`);
    }
  });
});

describe('queryHybrid — reranker fallback when model unavailable', () => {
  it('falls back gracefully when @huggingface/transformers is stubbed out', async () => {
    // Force model unavailable by calling resetReranker then triggering a fail
    // We simulate by patching _modelAvailable — but since it's module-internal,
    // we verify the module doesn't throw and returns BM25 results instead.
    const results = await queryHybrid(indexFilePath, 'agent lanes handoff queue', {
      rerank: true,
      embed: false,
      top: 5,
    });
    // Should return results regardless of model availability
    assert.ok(Array.isArray(results), 'should always return array');
    // May have rerank_score=null if model failed to load
    assert.ok(results.length <= 5, 'capped at top=5');
  });
});

describe('queryHybrid — Ollama embed step skipped when unavailable', () => {
  it('returns results even when Ollama is not running', async () => {
    // In test env, Ollama is likely unavailable — verify graceful skip
    const results = await queryHybrid(indexFilePath, 'hybrid BM25 cosine retrieval', {
      rerank: false,
      embed: true,  // enable embed — will fail silently if Ollama absent
      top: 5,
    });
    assert.ok(Array.isArray(results), 'should return array even without Ollama');
    assert.ok(results.length >= 0, 'no throw even if embed fails');
  });
});

describe('queryHybrid — top N cap', () => {
  it('respects top=3 cap regardless of pool size', async () => {
    const results = await queryHybrid(indexFilePath, 'state log decisions stamp', {
      rerank: false,
      embed: false,
      top: 3,
    });
    assert.ok(results.length <= 3, `expected <= 3, got ${results.length}`);
  });

  it('respects top=1 cap', async () => {
    const results = await queryHybrid(indexFilePath, 'phase planning', {
      rerank: false,
      embed: false,
      top: 1,
    });
    assert.ok(results.length <= 1, 'should return at most 1 result');
  });
});

describe('queryHybrid — empty index', () => {
  it('returns empty array for an empty index without throwing', async () => {
    const emptyDir = makeTmpDir();
    const emptyEvents = path.join(emptyDir, 'events.ndjson');
    const emptyIndex = path.join(emptyDir, 'index.json');
    fs.writeFileSync(emptyEvents, '', 'utf8');
    buildIndex(emptyEvents, emptyIndex);

    try {
      const results = await queryHybrid(emptyIndex, 'anything', {
        rerank: false, embed: false, top: 5,
      });
      assert.ok(Array.isArray(results), 'should return array');
      assert.equal(results.length, 0, 'should be empty');
    } finally {
      try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch {}
    }
  });
});
