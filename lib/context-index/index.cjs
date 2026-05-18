'use strict';
/**
 * lib/context-index/index.cjs — public API contract
 *
 * Sources: gad-log, state-log, git-log, planning-artifacts, transcripts (stub)
 * Storage: .planning/context-index/  (per-project, follows planning dir convention)
 *   events.ndjson     — append-only event stream (gitignored)
 *   index.json        — MiniSearch serialized (gitignored)
 *   summaries/<id>.md — condensed session summaries (committed, audit trail)
 *
 * All functions are async, return plain objects.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ingestGadLog }            = require('./sources/gad-log.cjs');
const { ingestStateLog }          = require('./sources/state-log.cjs');
const { ingestGitLog }            = require('./sources/git-log.cjs');
const { ingestPlanningArtifacts } = require('./sources/planning-artifacts.cjs');
const { ingestBenchResults }      = require('./sources/bench-results.cjs');
const { summarizeSessions }       = require('./summarizer.cjs');
const { buildIndex, queryIndex, readNdjson, queryHybrid, resetReranker } = require('./search.cjs');

const ALL_SOURCES = ['gad-log', 'state-log', 'git-log', 'planning-artifacts', 'bench-results'];

function storeDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'context-index');
}

function eventsPath(projectRoot) {
  return path.join(storeDir(projectRoot), 'events.ndjson');
}

function indexPath(projectRoot) {
  return path.join(storeDir(projectRoot), 'index.json');
}

function ensureDir(projectRoot) {
  const d = storeDir(projectRoot);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  const s = path.join(d, 'summaries');
  if (!fs.existsSync(s)) fs.mkdirSync(s, { recursive: true });
}

/**
 * Ingest events from sources into events.ndjson (append-only, deduped by id).
 *
 * @param {object} opts
 * @param {string} opts.projectRoot  absolute path to project root
 * @param {string[]} opts.sources    which source kinds to run (default: all)
 * @param {string}   opts.since      ISO timestamp; skip events before this
 * @returns {Promise<{ingested: number, total: number}>}
 */
async function ingest(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const sources = opts.sources || ALL_SOURCES;
  const sinceOpts = opts.since ? { since: opts.since } : {};

  ensureDir(projectRoot);

  const newRecords = [];

  if (sources.includes('gad-log')) {
    newRecords.push(...ingestGadLog(projectRoot, sinceOpts));
  }
  if (sources.includes('state-log')) {
    newRecords.push(...ingestStateLog(projectRoot, sinceOpts));
  }
  if (sources.includes('git-log')) {
    newRecords.push(...ingestGitLog(projectRoot, sinceOpts));
  }
  if (sources.includes('planning-artifacts')) {
    newRecords.push(...ingestPlanningArtifacts(projectRoot, sinceOpts));
  }
  if (sources.includes('bench-results')) {
    newRecords.push(...ingestBenchResults(projectRoot, sinceOpts));
  }
  // transcripts: stub — dir may not exist yet
  // if (sources.includes('transcripts')) { ... }

  if (newRecords.length === 0) {
    const existing = readNdjson(eventsPath(projectRoot));
    return { ingested: 0, total: existing.length };
  }

  // Load existing to dedupe
  const existing = readNdjson(eventsPath(projectRoot));
  const existingIds = new Set(existing.map(r => r.id));

  const fresh = newRecords.filter(r => !existingIds.has(r.id));

  if (fresh.length > 0) {
    const lines = fresh.map(r => JSON.stringify(r)).join('\n') + '\n';
    fs.appendFileSync(eventsPath(projectRoot), lines, 'utf8');
  }

  return { ingested: fresh.length, total: existing.length + fresh.length };
}

/**
 * Query the search index. Rebuilds from events.ndjson if index doesn't exist.
 *
 * When rerank=true (default) or embed=true, delegates to queryHybrid which
 * layers cosine + bge-reranker steps over the BM25 candidate pool.
 *
 * Result shape: {id, text, source, ts, sessionId, score, snippet,
 *               [bm25_score], [cosine_score], [rerank_score], [retrieval_method]}
 *
 * @param {string} queryText
 * @param {object} opts
 * @param {string}   opts.projectRoot
 * @param {number}   opts.topK      final result cap (default 10)
 * @param {string[]} opts.sources   filter by source kind
 * @param {string}   opts.since     ISO timestamp filter (post-search)
 * @param {boolean}  opts.rerank    enable bge-reranker (default true)
 * @param {boolean}  opts.embed     enable Ollama cosine step (default false)
 * @returns {Promise<Array>}
 */
async function query(queryText, opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  const iPath = indexPath(projectRoot);

  // Auto-rebuild if index missing
  if (!fs.existsSync(iPath)) {
    await rebuild({ projectRoot });
  }

  const doRerank = opts.rerank !== false; // default ON
  const doEmbed = !!opts.embed;           // default OFF

  let results;

  if (doRerank || doEmbed) {
    results = await queryHybrid(iPath, queryText, {
      top: opts.topK || 10,
      bm25Pool: 30,
      rerank: doRerank,
      embed: doEmbed,
      sources: opts.sources,
    });
  } else {
    results = queryIndex(iPath, queryText, {
      topK: opts.topK || 10,
      sources: opts.sources,
    });
  }

  if (opts.since) {
    const sinceMs = new Date(opts.since).getTime();
    results = results.filter(r => r.ts && new Date(r.ts).getTime() >= sinceMs);
  }

  return results;
}

/**
 * Generate Ollama-backed handoff summaries for each unique sessionId.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @param {string} opts.since   only consider events newer than this
 * @param {boolean} opts.force  re-generate even if summary unchanged
 * @returns {Promise<{written: string[], skipped: string[], error: string|null}>}
 */
async function summarize(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  ensureDir(projectRoot);

  // Ingest first to ensure events.ndjson is fresh
  await ingest({ projectRoot, since: opts.since });

  let events = readNdjson(eventsPath(projectRoot));
  if (opts.since) {
    const sinceMs = new Date(opts.since).getTime();
    events = events.filter(e => e.ts && new Date(e.ts).getTime() >= sinceMs);
  }

  return summarizeSessions(events, storeDir(projectRoot), { force: opts.force });
}

/**
 * Re-ingest all sources then rebuild the MiniSearch index from scratch.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot
 * @returns {Promise<{events: number, indexed: number}>}
 */
async function rebuild(opts = {}) {
  const projectRoot = opts.projectRoot || process.cwd();
  ensureDir(projectRoot);

  // Full re-ingest (no since filter — rebuild means start from scratch)
  const ingestStats = await ingest({ projectRoot });

  const { count } = buildIndex(eventsPath(projectRoot), indexPath(projectRoot));

  return { events: ingestStats.total, indexed: count };
}

module.exports = { ingest, query, summarize, rebuild, resetReranker };
