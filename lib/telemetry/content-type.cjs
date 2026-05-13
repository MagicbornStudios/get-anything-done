'use strict';
/**
 * Phase 145 follow-up — task GLOBAL-T-145-05 (content-type derivation).
 *
 * Adds a `content_type` axis to telemetry envelopes so the Phase 148
 * per-domain LoRA registry can train domain-specialised adapters
 * (planning vs code vs site vs eval vs narrative vs meta).
 *
 * NOT a schema bump — this is an OPTIONAL inferred field on schema_v=1.
 * Adapters call deriveContentType(envelope) before emit; downstream
 * consumers may also call it on already-built envelopes (passthrough if
 * already populated).
 *
 * Inference precedence:
 *   1. envelope.content_type already set -> return it (passthrough)
 *   2. inspect content for file paths (tool_call inputs.file_path,
 *      tool_call inputs.path, content.source_file, content.prompt_file)
 *      -> match path against PATH_RULES (table-driven, first match wins)
 *   3. fall back to 'meta'
 *
 * Reference: lib/telemetry/envelope.cjs (DO NOT MODIFY beyond adding
 * VALID_CONTENT_TYPES + content_type to OPTIONAL_FIELDS).
 */

const VALID_CONTENT_TYPES = new Set([
  'planning',
  'code',
  'site',
  'eval',
  'narrative',
  'meta',
]);

/**
 * Path-match rule table. Each rule is `{ test, type }` where `test` is a
 * function `(normalizedPath: string) => boolean`. First matching rule
 * wins. Paths are pre-normalised to forward-slashes and lower-cased
 * before matching.
 *
 * Ordering matters — narrower rules go first (narrative & eval & site
 * before bare code / planning).
 */
const PATH_RULES = [
  // narrative artefacts (story content, souls, books)
  {
    type: 'narrative',
    test: (p) => (
      /(^|\/)narrative\//.test(p) ||
      /(^|\/)souls?\//.test(p) ||
      /(^|\/)books?\//.test(p) ||
      /\.story\.md$/.test(p) ||
      /(^|\/)soul\.md$/.test(p)
    ),
  },
  // eval / species / generations
  {
    type: 'eval',
    test: (p) => (
      /(^|\/)evals?\//.test(p) ||
      /(^|\/)species\//.test(p) ||
      /(^|\/)generations?\//.test(p) ||
      /(^|\/)bestiary\//.test(p)
    ),
  },
  // site / marketing surfaces (must come before code rule because
  // sites/foo/app/page.tsx is .tsx but we want it as 'site')
  {
    type: 'site',
    test: (p) => (
      /(^|\/)sites\/[^/]+\//.test(p) ||
      /(^|\/)apps\/[^/]+\/site\//.test(p) ||
      /(^|\/)marketing\//.test(p) ||
      /\(marketing\)/.test(p)
    ),
  },
  // planning artefacts (under .planning/, planning docs, handoffs)
  {
    type: 'planning',
    test: (p) => (
      /(^|\/)\.planning\//.test(p) && /\.(md|xml|toml|ya?ml|json)$/.test(p)
    ) || (
      /(^|\/)handoffs?\//.test(p) && /\.md$/.test(p)
    ),
  },
  // code (broad — runs after the more specific rules above)
  {
    type: 'code',
    test: (p) => /\.(ts|tsx|js|jsx|cjs|mjs|py|rs|go|java|c|cpp|h|hpp|rb|php|swift|kt|scala|lua|sh|bash|ps1)$/.test(p),
  },
];

/**
 * Normalise a path for matching: forward slashes, lowercase. Returns
 * empty string for non-string input.
 */
function normalisePath(p) {
  if (typeof p !== 'string') return '';
  return p.replace(/\\/g, '/').toLowerCase();
}

/**
 * Classify a single path string. Returns one of the 6 content types,
 * or null if no rule matches (caller decides the fallback).
 */
function inferFromPath(rawPath) {
  const p = normalisePath(rawPath);
  if (!p) return null;
  for (const rule of PATH_RULES) {
    if (rule.test(p)) return rule.type;
  }
  return null;
}

/**
 * Pull candidate file paths out of an envelope's content. Returns an
 * array of strings (may be empty). Handles the four shapes adapters
 * actually emit:
 *   - tool_call inputs: { file_path, path, paths[], file, files[], pattern }
 *   - tool_result outputs (sometimes carries file_path on Read/Edit)
 *   - prompt-file content: { source_file, prompt_file }
 *   - worker-log meta: { ref } (handoff filename)
 */
function extractPathsFromContent(content) {
  if (!content || typeof content !== 'object') return [];
  const out = [];

  // tool_call shape: { tool, inputs: {...}, scope? }
  if (content.inputs && typeof content.inputs === 'object') {
    const i = content.inputs;
    for (const k of ['file_path', 'path', 'file', 'notebook_path', 'pattern']) {
      if (typeof i[k] === 'string') out.push(i[k]);
    }
    for (const k of ['paths', 'files']) {
      if (Array.isArray(i[k])) {
        for (const v of i[k]) if (typeof v === 'string') out.push(v);
      }
    }
  }

  // tool_result shape sometimes echoes file_path in outputs
  if (content.outputs && typeof content.outputs === 'object') {
    const o = content.outputs;
    if (typeof o.file_path === 'string') out.push(o.file_path);
    if (typeof o.path === 'string') out.push(o.path);
  }

  // prompt-files / worker-log shape
  if (typeof content.source_file === 'string') out.push(content.source_file);
  if (typeof content.prompt_file === 'string') out.push(content.prompt_file);

  // worker-log meta carrying handoff ref filename
  if (typeof content.ref === 'string') out.push(content.ref);

  // gad-log shape: args array sometimes contains a path target
  if (Array.isArray(content.args)) {
    for (const v of content.args) if (typeof v === 'string' && /[\/\\]/.test(v)) out.push(v);
  }

  return out;
}

/**
 * Derive content_type for an envelope (or partial envelope-like object
 * with at least .content). Passthrough if already set.
 *
 * Returns one of: 'planning' | 'code' | 'site' | 'eval' | 'narrative' | 'meta'.
 * Always returns a valid value — fallback is 'meta'.
 */
function deriveContentType(env) {
  if (!env || typeof env !== 'object') return 'meta';

  // (a) passthrough
  if (typeof env.content_type === 'string' && VALID_CONTENT_TYPES.has(env.content_type)) {
    return env.content_type;
  }

  // (b) infer from content paths
  const paths = extractPathsFromContent(env.content);
  for (const p of paths) {
    const t = inferFromPath(p);
    if (t) return t;
  }

  // task_id / handoff_id are weak signals but currently default to
  // 'meta' if nothing else matched — Phase 148 may add task-id-prefix
  // rules, kept simple here.

  // (c) fallback
  return 'meta';
}

module.exports = {
  VALID_CONTENT_TYPES,
  PATH_RULES,
  deriveContentType,
  inferFromPath,
  extractPathsFromContent,
  normalisePath,
};
