'use strict';
/**
 * lib/ml/skill-reranker/index.cjs — cross-encoder reranker for skill discovery (GLOBAL-T-246-05)
 *
 * Uses Xenova/bge-reranker-base (ONNX cross-encoder) to re-rank the top-N
 * skill candidates produced by the BM25/token-overlap stage in
 * lib/skills/relevance-match.cjs.
 *
 * API:
 *   rerankSkills(query, candidates, opts)  — rerank skill records
 *   resetModel()                           — tear down for testing
 *
 * Lazy model load; cached in ~/.cache/gad-models/
 * Graceful fallback: if model unavailable, returns candidates in original order.
 */

const os = require('os');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const MODEL_ID = 'Xenova/bge-reranker-base';
const CACHE_DIR = path.join(os.homedir(), '.cache', 'gad-models');
const DEFAULT_TOP_N = 10;  // candidates fed into reranker
const SCORE_FIELD = 'rerank_score';

// ─── Pipeline state ───────────────────────────────────────────────────────────

let _pipeline = null;
let _loadPromise = null;
let _modelAvailable = null; // null=unknown, true, false

// ─── Model loader ─────────────────────────────────────────────────────────────

async function loadPipeline() {
  if (_pipeline) return _pipeline;
  if (_loadPromise) return _loadPromise;
  if (_modelAvailable === false) return null;

  _loadPromise = (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheDir = CACHE_DIR;
      const p = await pipeline('text-classification', MODEL_ID, {
        progress_callback: () => {},
      });
      _pipeline = p;
      _modelAvailable = true;
      return p;
    } catch (_err) {
      _modelAvailable = false;
      _pipeline = null;
      return null;
    } finally {
      _loadPromise = null;
    }
  })();

  return _loadPromise;
}

// ─── Score a single (query, passage) pair ────────────────────────────────────

/**
 * Score a (query, text) pair using the cross-encoder.
 * bge-reranker-base outputs a single logit; higher = more relevant.
 *
 * @param {object} clf   - loaded pipeline
 * @param {string} query
 * @param {string} text  - skill description/name text
 * @returns {Promise<number>}
 */
async function scoreOnePair(clf, query, text) {
  try {
    // Pipeline input for cross-encoder: [query, passage] as text_pair
    const result = await clf(query, { text_pair: text });
    // Result is [{label, score}]; for reranker, score is relevance logit
    if (Array.isArray(result) && result.length > 0) {
      return typeof result[0].score === 'number' ? result[0].score : 0;
    }
    if (result && typeof result.score === 'number') return result.score;
    return 0;
  } catch (_) {
    return 0;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rerank skill candidates using bge-reranker-base cross-encoder.
 *
 * Candidates arrive with a BM25/token-overlap `score` field. Mandatory
 * skills (score=100) bypass reranking and are always returned first.
 *
 * @param {string} query     - task goal / handoff body / query text
 * @param {Array}  candidates - skill records from matchRelevantSkills()
 * @param {object} [opts]
 * @param {number} [opts.topN=10]   - how many candidates to feed to the reranker
 * @param {number} [opts.limit]     - final result cap (defaults to candidates.length)
 * @returns {Promise<Array>}  candidates with added `rerank_score` + sorted by it
 */
async function rerankSkills(query, candidates, opts = {}) {
  if (!candidates || candidates.length === 0) return [];

  const topN = opts.topN || DEFAULT_TOP_N;
  const limit = opts.limit || candidates.length;

  // Mandatory skills skip reranking (score=100 sentinel)
  const mandatory = candidates.filter(c => c.score === 100);
  const rankable = candidates.filter(c => c.score !== 100).slice(0, topN);

  if (rankable.length === 0) {
    return mandatory.slice(0, limit);
  }

  const clf = await loadPipeline();

  if (!clf) {
    // Fallback: return original order with rerank_score = original score
    const fallback = [...mandatory, ...rankable].map(c => ({
      ...c,
      [SCORE_FIELD]: c.score,
      rerank_method: 'fallback',
    }));
    return fallback.slice(0, limit);
  }

  // Score each candidate
  const scored = await Promise.all(
    rankable.map(async (candidate) => {
      const text = buildCandidateText(candidate);
      const score = await scoreOnePair(clf, String(query || ''), text);
      return { ...candidate, [SCORE_FIELD]: score, rerank_method: 'bge' };
    })
  );

  // Sort by rerank_score descending
  scored.sort((a, b) => b[SCORE_FIELD] - a[SCORE_FIELD]);

  const mandatoryWithScore = mandatory.map(c => ({
    ...c,
    [SCORE_FIELD]: 999,
    rerank_method: 'mandatory',
  }));

  return [...mandatoryWithScore, ...scored].slice(0, limit);
}

/**
 * Build a compact text representation of a skill for the cross-encoder passage.
 */
function buildCandidateText(candidate) {
  const parts = [];
  if (candidate.slug) parts.push(`skill: ${candidate.slug}`);
  if (candidate.frontmatter && candidate.frontmatter.name) {
    parts.push(`name: ${candidate.frontmatter.name}`);
  }
  if (candidate.frontmatter && candidate.frontmatter.description) {
    parts.push(`description: ${candidate.frontmatter.description}`);
  }
  // Include first 200 chars of body for context
  if (candidate.body) {
    parts.push(String(candidate.body).slice(0, 200).replace(/\n+/g, ' '));
  }
  return parts.join('. ').slice(0, 512);
}

/**
 * Reset loaded model (for testing / memory management).
 */
function resetModel() {
  _pipeline = null;
  _loadPromise = null;
  _modelAvailable = null;
}

module.exports = {
  rerankSkills,
  resetModel,
  loadPipeline,
  buildCandidateText,
  MODEL_ID,
  CACHE_DIR,
};
