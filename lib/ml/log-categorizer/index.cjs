'use strict';
/**
 * lib/ml/log-categorizer/index.cjs — gad-log event categorizer (GLOBAL-T-246-04)
 *
 * v1: zero-shot classification via @huggingface/transformers
 *     model: Xenova/distilbert-base-uncased-mnli (ONNX, runs in Node)
 *
 * Categories (4-class per task spec, extended to 10 for future fine-tuning):
 *   cli         — CLI invocation (gad command called)
 *   tool-call   — agent tool-use (Read, Edit, Bash, etc.)
 *   error       — command/tool failure, exit != 0
 *   state       — state-log, decision, task-stamp, handoff creation
 *   dispatch    — gad runtime dispatch / team worker launch
 *   commit      — git commit / version bump
 *   agent-msg   — agent discussion / assistant message
 *   noise       — debug output, noop, --help calls
 *
 * API:
 *   categorize(event)          -> Promise<{category, confidence, method}>
 *   categorizeBatch(events)    -> Promise<Array<{category, confidence, method}>>
 *   resetModel()               — for testing: tear down loaded pipeline
 *
 * Fallback: if model not available or confidence < CONF_THRESHOLD, falls back
 *           to regex heuristics (method='regex').
 */

const os = require('os');
const path = require('path');

// ─── Configuration ─────────────────────────────────────────────────────────────

const MODEL_ID = 'Xenova/distilbert-base-uncased-mnli';
const CONF_THRESHOLD = 0.50; // below this → use regex fallback
const CACHE_DIR = path.join(os.homedir(), '.cache', 'gad-models');

// Candidate labels for zero-shot classification
const CANDIDATE_LABELS = [
  'cli command invocation',
  'tool call by agent',
  'error or failure',
  'state change or decision',
  'runtime dispatch or worker launch',
  'git commit or version change',
  'agent discussion or message',
  'noise or debug output',
];

// Maps verbose label → short category token
const LABEL_MAP = {
  'cli command invocation': 'cli',
  'tool call by agent': 'tool-call',
  'error or failure': 'error',
  'state change or decision': 'state',
  'runtime dispatch or worker launch': 'dispatch',
  'git commit or version change': 'commit',
  'agent discussion or message': 'agent-msg',
  'noise or debug output': 'noise',
};

// ─── Module-scoped pipeline state ─────────────────────────────────────────────

let _pipeline = null;       // cached pipeline instance
let _loadPromise = null;    // in-flight load guard
let _modelAvailable = null; // tri-state: null=unknown, true, false

// ─── Regex fallback classifier ────────────────────────────────────────────────

/**
 * Fast regex-based categorizer (no I/O, no async).
 * Used when model is unavailable or confidence is low.
 */
function regexCategorize(event) {
  const cmd = String(event.cmd || event.command || '');
  const args = Array.isArray(event.args) ? event.args.join(' ') : String(event.args || '');
  const exitCode = typeof event.exit === 'number' ? event.exit : null;
  const type = String(event.type || event.event_type || '').toLowerCase();
  const summary = String(event.summary || '').toLowerCase();
  const text = (cmd + ' ' + args + ' ' + type + ' ' + summary).toLowerCase();

  // Error: non-zero exit or explicit error markers
  if (exitCode !== null && exitCode !== 0) return { category: 'error', confidence: 0.95, method: 'regex' };
  if (/error|fail|exception|crash|abort/.test(text)) return { category: 'error', confidence: 0.85, method: 'regex' };

  // Commit
  if (/git.commit|git.push|version.bump|ship|bump/.test(text)) return { category: 'commit', confidence: 0.90, method: 'regex' };

  // Dispatch / runtime launch
  if (/dispatch|runtime.launch|team.start|team.work|handoff/.test(text)) return { category: 'dispatch', confidence: 0.90, method: 'regex' };

  // State changes
  if (/tasks.stamp|state.log|decisions.add|handoffs.create|stamp/.test(text)) return { category: 'state', confidence: 0.90, method: 'regex' };

  // Tool calls (trace events with tool name)
  if (event.kind === 'trace' || /bash|edit|read|write|glob|grep|search|tool/.test(type)) return { category: 'tool-call', confidence: 0.85, method: 'regex' };

  // Agent message (check before noise — role is definitive)
  if (event.role === 'assistant' || event.role === 'user' || /message|discussion|chat/.test(type)) return { category: 'agent-msg', confidence: 0.75, method: 'regex' };

  // Noise: --help, --version, noop, empty summary
  if (/--help|--version|noop/.test(text) || (!summary && !cmd)) return { category: 'noise', confidence: 0.80, method: 'regex' };

  // Default: cli invocation
  return { category: 'cli', confidence: 0.70, method: 'regex' };
}

// ─── Model loader ─────────────────────────────────────────────────────────────

async function loadPipeline() {
  if (_pipeline) return _pipeline;
  if (_loadPromise) return _loadPromise;
  if (_modelAvailable === false) return null;

  _loadPromise = (async () => {
    try {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Point cache at our custom dir
      env.cacheDir = CACHE_DIR;
      const p = await pipeline('zero-shot-classification', MODEL_ID, {
        progress_callback: () => {}, // suppress download progress noise
      });
      _pipeline = p;
      _modelAvailable = true;
      return p;
    } catch (err) {
      _modelAvailable = false;
      _pipeline = null;
      // Swallow — callers fall back to regex
      return null;
    } finally {
      _loadPromise = null;
    }
  })();

  return _loadPromise;
}

// ─── Event → text serializer ──────────────────────────────────────────────────

function eventToText(event) {
  const parts = [];
  if (event.cmd || event.command) parts.push(String(event.cmd || event.command));
  if (Array.isArray(event.args) && event.args.length > 0) parts.push(event.args.join(' '));
  if (event.type || event.event_type) parts.push(String(event.type || event.event_type));
  if (event.summary) parts.push(String(event.summary));
  if (event.role) parts.push(`role:${event.role}`);
  if (typeof event.exit === 'number') parts.push(`exit:${event.exit}`);
  return parts.join(' | ').slice(0, 512) || 'unknown event';
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Categorize a single gad-log event.
 *
 * @param {object} event - Raw event from .gad-log/*.jsonl or .trace-events.jsonl
 * @returns {Promise<{category: string, confidence: number, method: 'bert'|'regex'}>}
 */
async function categorize(event) {
  // Fast path: definitive signals don't need the model
  const quick = regexCategorize(event);
  if (quick.confidence >= 0.90) return quick;

  // Attempt model classification
  const clf = await loadPipeline();
  if (!clf) return { ...quick, method: 'regex' };

  try {
    const text = eventToText(event);
    const result = await clf(text, CANDIDATE_LABELS, { multi_label: false });
    const topLabel = result.labels[0];
    const topScore = result.scores[0];
    const category = LABEL_MAP[topLabel] || 'noise';

    if (topScore >= CONF_THRESHOLD) {
      return { category, confidence: topScore, method: 'bert' };
    }
    // Low confidence — fall back to regex
    return { ...quick, method: 'regex' };
  } catch (_) {
    return { ...quick, method: 'regex' };
  }
}

/**
 * Categorize a batch of events efficiently.
 *
 * @param {object[]} events
 * @returns {Promise<Array<{category: string, confidence: number, method: string}>>}
 */
async function categorizeBatch(events) {
  if (!events || events.length === 0) return [];

  // Pre-warm model once before batch
  await loadPipeline();

  // Run in series to avoid OOM on large batches; pipeline is stateful
  const results = [];
  for (const event of events) {
    results.push(await categorize(event));
  }
  return results;
}

/**
 * Reset loaded pipeline (for testing / memory management).
 */
function resetModel() {
  _pipeline = null;
  _loadPromise = null;
  _modelAvailable = null;
}

module.exports = {
  categorize,
  categorizeBatch,
  resetModel,
  regexCategorize,   // exposed for unit tests
  CANDIDATE_LABELS,
  LABEL_MAP,
  CONF_THRESHOLD,
};
