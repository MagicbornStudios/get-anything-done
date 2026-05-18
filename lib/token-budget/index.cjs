'use strict';

/**
 * token-budget — pre-send token gating for LLM calls.
 *
 * Uses js-tiktoken (cl100k_base) when available; falls back to the same
 * heuristic used by lib/token-estimator.cjs (chars/3.5).
 *
 * Public API:
 *   estimateTokens(text, encoding?)  → integer
 *   checkBudget(prompt, budget)      → {tokens, budget, withinBudget, overBy}
 *   truncateToBudget(text, budget, encoding?)  → string (head + tail preserved)
 *   MODEL_BUDGETS                    → per-model default budgets map
 *
 * Phase 246-03.
 */

// ── Per-model input-token budgets ────────────────────────────────────────────

const MODEL_BUDGETS = {
  // Anthropic
  'claude-opus-4':         200_000,
  'claude-opus-4-5':       200_000,
  'claude-sonnet-4-6':     128_000,
  'claude-sonnet-4-5':     128_000,
  'claude-haiku-3-5':       64_000,
  'claude-haiku':           48_000,
  // OpenAI
  'gpt-4o':                128_000,
  'gpt-4-turbo':           128_000,
  'gpt-3.5-turbo':          16_000,
  // Small / local Ollama models — conservative
  'default-small':           8_000,
  // Catch-all
  'default':               128_000,
};

function budgetForModel(modelId) {
  if (!modelId) return MODEL_BUDGETS.default;
  // Try exact match first, then prefix match (e.g. 'claude-sonnet-4-6-20250514')
  if (MODEL_BUDGETS[modelId] != null) return MODEL_BUDGETS[modelId];
  for (const key of Object.keys(MODEL_BUDGETS)) {
    if (key !== 'default' && key !== 'default-small' && modelId.startsWith(key)) {
      return MODEL_BUDGETS[key];
    }
  }
  return MODEL_BUDGETS.default;
}

// ── Tiktoken lazy loader ─────────────────────────────────────────────────────

let _encCache = {};

function getEncoder(encodingName) {
  encodingName = encodingName || 'cl100k_base';
  if (_encCache[encodingName]) return _encCache[encodingName];
  try {
    const tk = require('js-tiktoken');
    const enc = tk.getEncoding(encodingName);
    _encCache[encodingName] = enc;
    return enc;
  } catch {
    return null;
  }
}

// ── Core API ─────────────────────────────────────────────────────────────────

const CHARS_PER_TOKEN = 3.5; // heuristic fallback

/**
 * estimateTokens(text, encoding?)
 * Returns integer token count. Uses tiktoken when available, else heuristic.
 */
function estimateTokens(text, encoding) {
  if (!text) return 0;
  const str = typeof text === 'string' ? text : JSON.stringify(text);
  if (!str) return 0;
  const enc = getEncoder(encoding);
  if (enc) return enc.encode(str).length;
  return Math.ceil(str.length / CHARS_PER_TOKEN);
}

/**
 * checkBudget(prompt, budget)
 * prompt: string or {system, user} object
 * budget: integer token limit (use budgetForModel() to get a per-model default)
 * Returns {tokens, budget, withinBudget, overBy}
 */
function checkBudget(prompt, budget) {
  const text = typeof prompt === 'string'
    ? prompt
    : [prompt.system || '', prompt.user || ''].join('\n');
  const tokens = estimateTokens(text);
  const overBy = Math.max(0, tokens - budget);
  return { tokens, budget, withinBudget: overBy === 0, overBy };
}

/**
 * truncateToBudget(text, budget, encoding?)
 * Keeps the head and tail of text, removes the middle, until it fits within
 * budget tokens. Returns the (possibly truncated) string.
 */
function truncateToBudget(text, budget, encoding) {
  if (!text) return text;
  if (estimateTokens(text, encoding) <= budget) return text;

  // Binary-search a split that fits: keep HEAD_RATIO of budget at the front,
  // the rest at the tail; collapse the middle.
  const HEAD_RATIO = 0.6;
  const headTokens = Math.floor(budget * HEAD_RATIO);
  const tailTokens = budget - headTokens;

  const enc = getEncoder(encoding);

  if (enc) {
    const ids = enc.encode(text);
    if (ids.length <= budget) return text;
    const headIds = ids.slice(0, headTokens);
    const tailIds = ids.slice(ids.length - tailTokens);
    // js-tiktoken enc.decode() returns a string directly
    const head = enc.decode(headIds);
    const tail = enc.decode(tailIds);
    return head + '\n...[truncated]...\n' + tail;
  }

  // Heuristic path: approximate by chars
  const headChars = Math.floor(headTokens * CHARS_PER_TOKEN);
  const tailChars = Math.floor(tailTokens * CHARS_PER_TOKEN);
  if (headChars + tailChars >= text.length) return text;
  return text.slice(0, headChars) + '\n...[truncated]...\n' + text.slice(text.length - tailChars);
}

module.exports = {
  estimateTokens,
  checkBudget,
  truncateToBudget,
  budgetForModel,
  MODEL_BUDGETS,
};
