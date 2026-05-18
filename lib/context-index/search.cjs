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

module.exports = { buildIndex, queryIndex, readNdjson };
