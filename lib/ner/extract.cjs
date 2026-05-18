'use strict';
/**
 * lib/ner/extract.cjs — GLiNER-backed NER with regex fallback (task 246-09)
 *
 * Primary path: @huggingface/transformers with Xenova/gliner-small-v2.1 (lazy load).
 * Fallback path: regex-based extraction of canonical GAD entity types.
 *
 * Entity types extracted:
 *   PHASE_ID    — e.g. 246, phase 80, phase-80
 *   TASK_ID     — e.g. GLOBAL-T-246-07, 246-07
 *   DECISION_ID — e.g. GLOBAL-D-293, gad-293
 *   FILE_PATH   — Unix/Windows paths with extension
 *   URL         — http(s) URLs
 *   HANDOFF_ID  — h-<ISO>-<project>-<phase> pattern
 *   RUNTIME     — codex-cli, claude, gemini, opencode
 *
 * Exports:
 *   extractEntities(text, opts)  — Array<{type, value, start, end}>
 *   extractEntitiesRegex(text)   — regex-only variant (always sync)
 */

// ---------------------------------------------------------------------------
// Regex patterns (canonical GAD entity grammar)
// ---------------------------------------------------------------------------

const PATTERNS = [
  {
    type: 'HANDOFF_ID',
    re: /\bh-\d{4}-\d{2}-\d{2}T[\d-]+-[a-z][\w-]+-\d+\b/g,
  },
  {
    type: 'TASK_ID',
    // GLOBAL-T-246-07 or 246-07 or PROJ-T-80-04
    re: /\b(?:[A-Z][A-Z0-9_]+-T-\d+-\d+|\d{2,3}-\d{2})\b/g,
  },
  {
    type: 'DECISION_ID',
    // GLOBAL-D-293 or gad-293 or GLOBAL-D-293
    re: /\b(?:[A-Z][A-Z0-9_]+-D-\d+|gad-\d{2,4})\b/g,
  },
  {
    type: 'PHASE_ID',
    // "phase 80", "phase-80", bare integers in planning context only
    re: /\b(?:phase[-\s]?\d{1,4}|\bphase\b\s+\d{1,4})\b/gi,
  },
  {
    type: 'FILE_PATH',
    // Unix-style paths with common extensions
    re: /\b([a-zA-Z0-9_./-]+\/[a-zA-Z0-9_./-]+\.(?:cjs|ts|tsx|js|mjs|json|md|py|toml|yaml|yml|sh))\b/g,
  },
  {
    type: 'URL',
    re: /https?:\/\/[^\s"'`,;)>]+/g,
  },
  {
    type: 'RUNTIME',
    re: /\b(?:codex-cli|codex|claude-code|claude|gemini|opencode)\b/g,
  },
];

/**
 * Extract entities using regex patterns only.
 * @param {string} text
 * @returns {Array<{type:string, value:string, start:number, end:number}>}
 */
function extractEntitiesRegex(text) {
  const results = [];
  const seen = new Set(); // deduplicate by span

  for (const { type, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      // FILE_PATH pattern captures in group 1
      const value = m[1] !== undefined ? m[1] : m[0];
      const start = m[1] !== undefined ? m.index + m[0].indexOf(m[1]) : m.index;
      const end   = start + value.length;
      const key   = `${start}:${end}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ type, value: value.trim(), start, end });
      }
    }
  }

  return results.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// GLiNER / @huggingface/transformers path (lazy, best-effort)
// ---------------------------------------------------------------------------

let _pipelinePromise = null;

const GLINER_MODEL = 'Xenova/gliner-small-v2.1';
const GLINER_LABELS = ['phase', 'task', 'decision', 'file path', 'url', 'runtime', 'handoff'];

const GLINER_TYPE_MAP = {
  'phase':    'PHASE_ID',
  'task':     'TASK_ID',
  'decision': 'DECISION_ID',
  'file path': 'FILE_PATH',
  'url':      'URL',
  'runtime':  'RUNTIME',
  'handoff':  'HANDOFF_ID',
};

async function getGlinerPipeline() {
  if (_pipelinePromise) return _pipelinePromise;
  _pipelinePromise = (async () => {
    try {
      // @huggingface/transformers is an optional dep — may not be installed
      const { pipeline } = await import('@huggingface/transformers');
      return await pipeline('token-classification', GLINER_MODEL, { aggregation_strategy: 'simple' });
    } catch {
      return null; // fall back to regex
    }
  })();
  return _pipelinePromise;
}

/**
 * Extract entities — tries GLiNER first, falls back to regex.
 * @param {string} text
 * @param {object} [opts]
 * @param {boolean} [opts.regexOnly=false]  — skip GLiNER attempt
 * @returns {Promise<Array<{type:string, value:string, start:number, end:number}>>}
 */
async function extractEntities(text, { regexOnly = false } = {}) {
  if (!regexOnly) {
    try {
      const pipe = await getGlinerPipeline();
      if (pipe) {
        const raw = await pipe(text, { labels: GLINER_LABELS });
        const results = (raw || []).map((e) => ({
          type:  GLINER_TYPE_MAP[e.entity_group] || e.entity_group.toUpperCase(),
          value: e.word,
          start: e.start,
          end:   e.end,
        }));
        if (results.length > 0) return results;
      }
    } catch { /* fall through to regex */ }
  }

  return extractEntitiesRegex(text);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { extractEntities, extractEntitiesRegex, PATTERNS, GLINER_LABELS };
