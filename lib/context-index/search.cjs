'use strict';
/**
 * search.cjs — MiniSearch BM25 index over events + planning artifacts
 *
 * Builds from events.ndjson + optional extra records.
 * Persists to .planning/context-index/index.json (gitignored).
 * query(text, opts) loads index (cached in-process) and returns top-N hits.
 */

const fs = require('node:fs');
const path = require('node:path');

let MiniSearch = null;

function loadMiniSearch() {
  if (MiniSearch) return MiniSearch;
  try {
    MiniSearch = require('minisearch');
    // minisearch exports default in CJS interop
    if (MiniSearch && MiniSearch.default) MiniSearch = MiniSearch.default;
    return MiniSearch;
  } catch (e) {
    throw new Error(`minisearch not installed. Run: npm install minisearch (in vendor/get-anything-done). Error: ${e.message}`);
  }
}

function makeIndex() {
  const MS = loadMiniSearch();
  return new MS({
    fields: ['text', 'source'],
    storeFields: ['id', 'text', 'source', 'ts', 'sessionId', 'score'],
    searchOptions: {
      boost: { text: 2 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
}

function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const records = [];
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
  for (const line of lines) {
    try { records.push(JSON.parse(line)); } catch {}
  }
  return records;
}

/**
 * Build and persist a MiniSearch index.
 *
 * @param {string} eventsPath  path to events.ndjson
 * @param {string} indexPath   path to write index.json
 * @param {Array}  extraRecords  additional records to include (not persisted to ndjson)
 * @returns {{ count: number }}
 */
function buildIndex(eventsPath, indexPath, extraRecords = []) {
  const MS = loadMiniSearch();
  const ms = makeIndex();

  const records = [...readNdjson(eventsPath), ...extraRecords];
  // Dedupe by id
  const seen = new Set();
  const unique = records.filter(r => {
    if (!r.id || seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  if (unique.length > 0) {
    ms.addAll(unique);
  }

  const serialized = JSON.stringify(MS.loadJSON ? ms.toJSON() : ms);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, serialized, 'utf8');

  return { count: unique.length };
}

// In-process cache: { indexPath -> { mtime, ms } }
const _cache = new Map();

function loadIndex(indexPath) {
  const MS = loadMiniSearch();

  if (!fs.existsSync(indexPath)) return null;

  const stat = fs.statSync(indexPath);
  const mtime = stat.mtimeMs;

  if (_cache.has(indexPath)) {
    const cached = _cache.get(indexPath);
    if (cached.mtime === mtime) return cached.ms;
  }

  const json = fs.readFileSync(indexPath, 'utf8');
  const ms = MS.loadJSON(json, {
    fields: ['text', 'source'],
    storeFields: ['id', 'text', 'source', 'ts', 'sessionId'],
  });

  _cache.set(indexPath, { mtime, ms });
  return ms;
}

/**
 * Query the persisted index.
 *
 * @param {string} indexPath
 * @param {string} queryText
 * @param {object} opts
 * @param {number} opts.topK  default 10
 * @param {string[]} opts.sources  filter by source kinds
 * @returns {Array<{id,text,source,ts,sessionId,score,snippet}>}
 */
function queryIndex(indexPath, queryText, opts = {}) {
  const ms = loadIndex(indexPath);
  if (!ms) return [];

  const topK = opts.topK || 10;
  let results;
  try {
    results = ms.search(queryText, { prefix: true, fuzzy: 0.2 });
  } catch {
    return [];
  }

  if (opts.sources && opts.sources.length) {
    results = results.filter(r => opts.sources.includes(r.source));
  }

  return results.slice(0, topK).map(r => ({
    id: r.id,
    text: r.text,
    source: r.source,
    ts: r.ts || null,
    sessionId: r.sessionId || null,
    score: r.score,
    snippet: (r.text || '').slice(0, 200),
  }));
}

// ── Hybrid retrieval helpers ──────────────────────────────────────────────────

// In-process reranker + embed availability cache
let _rerankerAvailable = null;  // null=unknown, true, false
let _rerankerPipeline = null;
let _rerankerLoadPromise = null;

const RERANKER_MODEL = 'Xenova/bge-reranker-base';
const RERANKER_CACHE = (() => {
  try { return require('path').join(require('os').homedir(), '.cache', 'gad-models'); }
  catch { return null; }
})();

async function loadRerankerPipeline() {
  if (_rerankerPipeline) return _rerankerPipeline;
  if (_rerankerLoadPromise) return _rerankerLoadPromise;
  if (_rerankerAvailable === false) return null;

  _rerankerLoadPromise = (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      if (RERANKER_CACHE) env.cacheDir = RERANKER_CACHE;
      const p = await pipeline('text-classification', RERANKER_MODEL, {
        progress_callback: () => {},
      });
      _rerankerPipeline = p;
      _rerankerAvailable = true;
      return p;
    } catch (_err) {
      _rerankerAvailable = false;
      _rerankerPipeline = null;
      return null;
    } finally {
      _rerankerLoadPromise = null;
    }
  })();
  return _rerankerLoadPromise;
}

async function scoreRerankerPair(clf, query, text) {
  try {
    const result = await clf(String(query), { text_pair: String(text).slice(0, 512) });
    if (Array.isArray(result) && result.length > 0) return result[0].score || 0;
    if (result && typeof result.score === 'number') return result.score;
    return 0;
  } catch (_) { return 0; }
}

/**
 * Fetch Ollama embedding vector for a text string.
 * Returns null if Ollama is unavailable or times out.
 */
async function fetchOllamaEmbedding(text) {
  let http;
  try { http = require('http'); } catch { return null; }
  return new Promise((resolve) => {
    const body = JSON.stringify({ model: 'nomic-embed-text', prompt: String(text).slice(0, 2048) });
    const req = http.request(
      { hostname: '127.0.0.1', port: 11434, path: '/api/embeddings', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(Array.isArray(parsed.embedding) ? parsed.embedding : null);
          } catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(3000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

function cosineSimVector(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Hybrid query: BM25 candidate pool → optional cosine rerank → optional bge rerank.
 *
 * @param {string} indexPath
 * @param {string} queryText
 * @param {object} opts
 * @param {number}  opts.top          final results to return (default 10)
 * @param {number}  opts.bm25Pool     BM25 candidate pool size (default 30)
 * @param {boolean} opts.rerank       enable bge-reranker (default true)
 * @param {boolean} opts.embed        enable Ollama cosine step (default false)
 * @param {string[]} opts.sources     filter by source kinds
 * @returns {Promise<Array<{id,text,source,ts,sessionId,score,snippet,bm25_score,cosine_score,rerank_score,retrieval_method}>>}
 */
async function queryHybrid(indexPath, queryText, opts = {}) {
  const top = opts.top || 10;
  const bm25Pool = opts.bm25Pool || 30;
  const doRerank = opts.rerank !== false; // default ON
  const doEmbed = !!opts.embed;           // default OFF

  // Step 1: BM25 candidate pool
  let candidates = queryIndex(indexPath, queryText, {
    topK: bm25Pool,
    sources: opts.sources,
  }).map(r => ({ ...r, bm25_score: r.score, cosine_score: null, rerank_score: null, retrieval_method: 'bm25' }));

  if (candidates.length === 0) return [];

  // Step 2: optional cosine rerank via Ollama nomic-embed-text
  if (doEmbed && candidates.length > 0) {
    const queryVec = await fetchOllamaEmbedding(queryText);
    if (queryVec) {
      const pool = candidates.slice(0, bm25Pool);
      const embedScored = await Promise.all(
        pool.map(async (r) => {
          const docVec = await fetchOllamaEmbedding(r.text || '');
          const sim = docVec ? cosineSimVector(queryVec, docVec) : 0;
          return { ...r, cosine_score: sim, retrieval_method: 'bm25+cosine' };
        })
      );
      // Sort by cosine score for top slice fed into reranker
      embedScored.sort((a, b) => (b.cosine_score || 0) - (a.cosine_score || 0));
      candidates = embedScored;
    }
    // If Ollama unavailable, skip silently — candidates stay BM25-ordered
  }

  // Step 3: optional bge-reranker over top-10 candidates
  if (doRerank) {
    const rerankPool = candidates.slice(0, 10);
    const clf = await loadRerankerPipeline();
    if (clf) {
      const reranked = await Promise.all(
        rerankPool.map(async (r) => {
          const score = await scoreRerankerPair(clf, queryText, r.text || '');
          return { ...r, rerank_score: score, retrieval_method: (r.retrieval_method || 'bm25') + '+rerank' };
        })
      );
      reranked.sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0));
      // Append any remaining candidates that weren't in the rerank pool
      const tail = candidates.slice(10);
      candidates = [...reranked, ...tail];
    }
    // If model unavailable, skip silently
  }

  return candidates.slice(0, top);
}

/**
 * Reset reranker pipeline state (for testing).
 */
function resetReranker() {
  _rerankerPipeline = null;
  _rerankerLoadPromise = null;
  _rerankerAvailable = null;
}

module.exports = { buildIndex, queryIndex, readNdjson, queryHybrid, resetReranker };
