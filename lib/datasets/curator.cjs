'use strict';
/**
 * lib/datasets/curator.cjs — dataset curation library (Phase 170).
 *
 * Classifies events from three source kinds:
 *   - transcript (.planning/transcripts/<date>/<thread>.jsonl)
 *   - trace      (.planning/.trace-events.jsonl)
 *   - gad-log    (.planning/.gad-log/<date>.jsonl)
 *
 * Writes labeled tuples to .planning/datasets/<label>/<YYYY-MM-DD>.jsonl.
 *
 * Hardened per phase 159 pattern:
 *   - Module-scoped _runtime state with ticking flag + mtime cache
 *   - In-flight guard at the start of each runCuration call
 *   - Skip-if-no-changes via mtime comparison
 *
 * GLOBAL-T-246-04: gad-log events now classified via ML categorizer
 *   (DistilBERT zero-shot, falls back to regex when model unavailable or
 *    confidence < 0.5).
 */

const fs = require('node:fs');
const path = require('node:path');

// Lazy-loaded ML categorizer — optional dep, graceful fallback baked in
let _logCategorizer = null;
function getLogCategorizer() {
  if (_logCategorizer) return _logCategorizer;
  try {
    _logCategorizer = require('../ml/log-categorizer/index.cjs');
  } catch (_) {
    // If somehow the file is missing, return null — regexCategorize below covers it
    _logCategorizer = null;
  }
  return _logCategorizer;
}

// ─── Module-scoped runtime state ──────────────────────────────────────────────
// Intentionally preserved across repeated calls in the same process.

const _runtime = {
  /** In-flight guard: prevents concurrent overlapping curation runs. */
  ticking: false,
  /** Per-source mtime cache: keyed by absolute file path. */
  lastSourceMtime: Object.create(null),
};

// ─── Classification labels ────────────────────────────────────────────────────

const TRANSCRIPT_LABELS = ['tool-use', 'correction', 'refusal', 'success', 'failure', 'plain-chat'];
const TRACE_LABELS      = ['cli-call', 'edit', 'search', 'error'];
const GAD_LOG_LABELS    = ['dispatch', 'claim', 'complete', 'deviation'];

/**
 * Classify a single event object and return a label string.
 *
 * @param {{ kind: 'transcript'|'trace'|'gad-log', [key: string]: any }} event
 * @returns {string} label
 */
function classifyEvent(event) {
  if (!event || !event.kind) return 'plain-chat';

  switch (event.kind) {
    case 'transcript':
      return classifyTranscript(event);
    case 'trace':
      return classifyTrace(event);
    case 'gad-log':
      return classifyGadLog(event);
    default:
      return 'plain-chat';
  }
}

function classifyTranscript(event) {
  // Tool-use: assistant turn that has tool_calls
  if (Array.isArray(event.tool_calls) && event.tool_calls.length > 0) return 'tool-use';

  // Derive text from content_parts or direct content field
  const text = extractText(event).toLowerCase();

  if (!text) return 'plain-chat';

  // Correction: user/system flagging an error or asking to redo
  if (/\b(wrong|incorrect|mistake|undo|revert|redo|that's not|fix that|you said|actually)\b/.test(text)) return 'correction';

  // Refusal: model declining to perform an action
  if (/\b(i (can't|cannot|won't|will not)|i'm (unable|not able)|i refuse|i must decline|i should not)\b/.test(text)) return 'refusal';

  // Success: positive outcome markers
  if (/\b(success|done|completed|shipped|merged|deployed|works|fixed|passed)\b/.test(text)) return 'success';

  // Failure: error / failure outcome markers
  if (/\b(failed?|error|exception|broke|broken|crashed|timeout|abort)\b/.test(text)) return 'failure';

  return 'plain-chat';
}

function classifyTrace(event) {
  const type = String(event.type || event.event_type || '').toLowerCase();
  const tool = String(event.tool || event.toolName || event.name || '').toLowerCase();

  if (/error|fail|exception/.test(type) || event.error) return 'error';
  if (/edit|write|patch|replace|modify/.test(type) || /edit|write|patch/.test(tool)) return 'edit';
  if (/search|grep|glob|find|read/.test(type) || /search|grep|glob|find|read/.test(tool)) return 'search';

  // Fallback: anything with a command/cli is cli-call
  return 'cli-call';
}

function classifyGadLog(event) {
  // Use ML categorizer (regex fast-path + DistilBERT zero-shot for ambiguous events).
  // The categorizer is synchronous for the regex path; we surface the async BERT path
  // via _lastGadLogMeta for callers that want confidence metadata.
  const cat = getLogCategorizer();
  if (cat) {
    const result = cat.regexCategorize(event);
    // Attach metadata for tuple writer to consume
    event.__ml_category = result.category;
    event.__ml_confidence = result.confidence;
    event.__ml_method = result.method;
    return result.category;
  }

  // Fallback (categorizer module missing): original regex logic
  const action = String(event.action || event.type || event.op || '').toLowerCase();
  const cmd = String(event.command || event.cmd || '').toLowerCase();
  const text = (action + ' ' + cmd).toLowerCase();

  if (/dispatch|handoff|route/.test(text)) return 'dispatch';
  if (/claim/.test(text)) return 'claim';
  if (/complete|done|finish|stamp/.test(text)) return 'complete';
  if (/deviation|override|skip|bypass|wrong/.test(text)) return 'deviation';

  return 'dispatch';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(event) {
  if (typeof event.content === 'string') return event.content;
  if (Array.isArray(event.content_parts)) {
    return event.content_parts
      .filter((p) => p && p.type === 'text')
      .map((p) => String(p.text || ''))
      .join(' ');
  }
  if (typeof event.text === 'string') return event.text;
  return '';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function readJsonl(filePath) {
  try {
    return fs
      .readFileSync(filePath, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Return true if filePath's mtime is newer than what we cached.
 * Updates the cache as a side effect when newer.
 */
function sourceChanged(filePath) {
  let mtime = 0;
  try { mtime = fs.statSync(filePath).mtimeMs; } catch { return false; }
  const last = _runtime.lastSourceMtime[filePath] || 0;
  if (mtime > last) {
    _runtime.lastSourceMtime[filePath] = mtime;
    return true;
  }
  return false;
}

// ─── Source walkers ───────────────────────────────────────────────────────────

/**
 * Walk .planning/transcripts/<date>/<thread>.jsonl and yield classified events.
 */
function* walkTranscripts(planningDir) {
  const root = path.join(planningDir, 'transcripts');
  if (!fs.existsSync(root)) return;
  const dateDirs = fs.readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  for (const date of dateDirs) {
    const dir = path.join(root, date);
    let files;
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (!sourceChanged(filePath)) continue;
      const threadId = file.replace(/\.jsonl$/, '');
      const entries = readJsonl(filePath);
      for (const entry of entries) {
        yield {
          kind: 'transcript',
          date,
          thread_id: threadId,
          source_file: filePath,
          ...entry,
        };
      }
    }
  }
}

/**
 * Walk .planning/.trace-events.jsonl and yield classified events.
 */
function* walkTraces(planningDir) {
  const filePath = path.join(planningDir, '.trace-events.jsonl');
  if (!fs.existsSync(filePath)) return;
  if (!sourceChanged(filePath)) return;
  const entries = readJsonl(filePath);
  const today = todayIso();
  for (const entry of entries) {
    yield { kind: 'trace', date: today, source_file: filePath, ...entry };
  }
}

/**
 * Walk .planning/.gad-log/<date>.jsonl files and yield classified events.
 */
function* walkGadLog(planningDir) {
  const logDir = path.join(planningDir, '.gad-log');
  if (!fs.existsSync(logDir)) return;
  let files;
  try { files = fs.readdirSync(logDir).filter((f) => f.endsWith('.jsonl')); } catch { return; }
  for (const file of files) {
    const filePath = path.join(logDir, file);
    if (!sourceChanged(filePath)) continue;
    const date = file.replace(/\.jsonl$/, '').slice(0, 10); // YYYY-MM-DD from filename prefix
    const entries = readJsonl(filePath);
    for (const entry of entries) {
      yield { kind: 'gad-log', date, source_file: filePath, ...entry };
    }
  }
}

// ─── Required fields for training-ready check ─────────────────────────────────
// A tuple is "training-ready" if it has all required fields filled.

const REQUIRED_FIELDS = ['kind', 'label', 'date', 'source_file'];

function isTrainingReady(tuple) {
  return REQUIRED_FIELDS.every((f) => tuple[f] !== undefined && tuple[f] !== null && tuple[f] !== '');
}

// ─── Main curation function ────────────────────────────────────────────────────

/**
 * Run one curation pass: walk all source dirs, classify new events since last
 * cache, write labeled tuples to .planning/datasets/<label>/<YYYY-MM-DD>.jsonl.
 *
 * @param {object} params
 * @param {string[]} [params.projects]         - Array of {planningDir} objects
 * @param {(msg: string) => void} params.log   - Log sink
 * @param {boolean} [params.dryRun]            - If true, classify but don't write files
 *
 * @returns {{ counts: Object<string,number>, tuples_written: number, bytes_written: number }}
 */
async function runCuration({ projects = [], log, dryRun = false }) {
  // In-flight guard — mandatory per phase 159 hardening contract
  if (_runtime.ticking) {
    log('curator: skipped — previous curation still in progress');
    return { counts: {}, tuples_written: 0, bytes_written: 0, skipped: true };
  }

  _runtime.ticking = true;
  const t0 = Date.now();
  const mode = dryRun ? '[dry-run] ' : '';
  log(`curator: ${mode}starting curation pass`);

  const counts = Object.create(null);
  let tuplesWritten = 0;
  let bytesWritten = 0;

  // Buffer: label -> date -> [tuple lines]
  const buffer = Object.create(null);

  try {
    // Determine planning directories to walk
    const planningDirs = [];
    for (const p of projects) {
      if (p && p.planningDir) planningDirs.push(p.planningDir);
    }
    // If no explicit project list, fall back to auto-detect from cwd
    if (planningDirs.length === 0) {
      const fallback = path.join(process.cwd(), '.planning');
      if (fs.existsSync(fallback)) planningDirs.push(fallback);
    }

    let anySourceSeen = false;

    for (const planningDir of planningDirs) {
      // Walk all three source types
      const generators = [
        walkTranscripts(planningDir),
        walkTraces(planningDir),
        walkGadLog(planningDir),
      ];

      for (const gen of generators) {
        for (const event of gen) {
          anySourceSeen = true;
          const label = classifyEvent(event);
          const date = event.date || todayIso();

          counts[label] = (counts[label] || 0) + 1;

          const tuple = {
            kind: event.kind,
            label,
            date,
            source_file: event.source_file,
            thread_id: event.thread_id || undefined,
            ts: event.ts || event.timestamp || undefined,
            role: event.role || undefined,
            text: extractText(event).slice(0, 2048) || undefined,
            tool_calls: Array.isArray(event.tool_calls) && event.tool_calls.length > 0
              ? event.tool_calls.map((t) => t.toolName || t.name || t).slice(0, 10)
              : undefined,
            training_ready: isTrainingReady({ kind: event.kind, label, date, source_file: event.source_file }),
            _curated_at: new Date().toISOString(),
            // ML categorizer metadata (only present for gad-log events)
            _ml_confidence: event.__ml_confidence || undefined,
            _ml_method: event.__ml_method || undefined,
          };

          // Remove undefined fields
          for (const k of Object.keys(tuple)) {
            if (tuple[k] === undefined) delete tuple[k];
          }

          if (!buffer[label]) buffer[label] = Object.create(null);
          if (!buffer[label][date]) buffer[label][date] = [];
          buffer[label][date].push(JSON.stringify(tuple));
        }
      }
    }

    if (!anySourceSeen) {
      log('curator: skipped — no new sources (all mtimes unchanged)');
      return { counts: {}, tuples_written: 0, bytes_written: 0, skipped: true };
    }

    // Flush buffer to files
    if (!dryRun) {
      for (const planningDir of planningDirs) {
        const datasetsRoot = path.join(planningDir, 'datasets');
        for (const [label, dateMap] of Object.entries(buffer)) {
          const labelDir = path.join(datasetsRoot, label);
          fs.mkdirSync(labelDir, { recursive: true });
          for (const [date, lines] of Object.entries(dateMap)) {
            const outPath = path.join(labelDir, `${date}.jsonl`);
            const content = lines.join('\n') + '\n';
            fs.appendFileSync(outPath, content, 'utf8');
            tuplesWritten += lines.length;
            bytesWritten += Buffer.byteLength(content, 'utf8');
          }
        }
      }
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const countSummary = Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ');
    log(`curator: ${mode}done in ${elapsed}s — labels=[${countSummary}] tuples=${tuplesWritten} bytes=${bytesWritten}`);
  } finally {
    _runtime.ticking = false;
  }

  return { counts, tuples_written: tuplesWritten, bytes_written: bytesWritten };
}

module.exports = {
  classifyEvent,
  runCuration,
  _runtime, // exposed for testing / status inspection
  TRANSCRIPT_LABELS,
  TRACE_LABELS,
  GAD_LOG_LABELS,
};
