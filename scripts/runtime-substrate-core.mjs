/**
 * scripts/runtime-substrate-core.mjs
 *
 * Runtime substrate error-code normalization and telemetry envelope helpers
 * for the GAD eval/species pipeline.
 *
 * Wires into lib/team/rate-limit.cjs classifyRuntimeError so the substrate path
 * and the worker path agree on error taxonomy (GLOBAL-D-313 / GAD-T-75-11).
 *
 * normalizeErrorCode(stderr, exitCode, runtimeId) → {
 *   code: string,           // 8-class enum (see taxonomy below)
 *   cooldown_ms: number|null,
 *   cooldown_until: number|null,
 *   reason_text: string,
 * }
 *
 * buildTelemetryPayload(runtimeId, stdout, opts?) → {
 *   model_id: string|null,   // extracted from response payload (null if unknown)
 *   tokens_in: number|null,  // input/prompt tokens from usage stats
 *   tokens_out: number|null, // output/completion tokens from usage stats
 * }
 *
 * 8-class taxonomy:
 *   quota_soft       — model capacity exhausted, cooldown extractable
 *   quota_hard_cap   — billing/plan cap, 4h default cooldown
 *   auth_failed      — credentials expired/missing/invalid
 *   network_error    — transient connectivity (ECONNRESET, ETIMEDOUT, …)
 *   malformed_argv   — exit 2 + unknown-option / missing-required
 *   runtime_crash    — Windows PTY (AttachConsole), segfault, exit 139, exit<0
 *   output_unparseable — exit 0 but stdout not parseable JSON / [object Object]
 *   unknown          — default, not auto-classified
 */

import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);

// Resolve the rate-limit module relative to this script so it works both
// from the vendor submodule directory and from the monorepo root.
const rateLimitPath = path.join(__dirname, '..', 'lib', 'team', 'rate-limit.cjs');
const { classifyRuntimeError, parseCooldown } = require(rateLimitPath);

/**
 * Normalize a runtime exit to a typed error code understood by the eval/
 * species pipeline and the worker dispatcher.
 *
 * @param {string}      stderr
 * @param {number|null} exitCode
 * @param {string|null} runtimeId  e.g. 'gemini-cli', 'codex-cli'
 * @returns {{ code: string, cooldown_ms: number|null, cooldown_until: number|null, reason_text: string }}
 */
export function normalizeErrorCode(stderr, exitCode, runtimeId = null) {
  const classification = classifyRuntimeError(stderr, exitCode, runtimeId);
  return {
    code: classification.class,
    cooldown_ms: classification.cooldown_ms,
    cooldown_until: classification.cooldown_until,
    reason_text: classification.reason_text,
  };
}

/**
 * Re-export parseCooldown for callers that need to extract duration from
 * a raw stderr string without going through the full classifier.
 */
export { parseCooldown };

/**
 * Re-export classifyRuntimeError for callers that want the full object.
 */
export { classifyRuntimeError };

/**
 * Convenience: returns true if the error code is a quota-related class.
 */
export function isQuotaClass(code) {
  return code === 'quota_soft' || code === 'quota_hard_cap';
}

/**
 * Convenience: returns true if the error is safe to retry with exponential backoff.
 */
export function isRetryableClass(code) {
  return code === 'network_error';
}

/**
 * Convenience: returns true if the error needs immediate operator attention
 * (auth bug, adapter bug, unknown failure).
 */
export function needsOperatorAttention(code) {
  return code === 'auth_failed' || code === 'malformed_argv' || code === 'output_unparseable' || code === 'unknown';
}

// ---------------------------------------------------------------------------
// Telemetry envelope helpers (GAD-T-35-13)
// ---------------------------------------------------------------------------

// Lazy-loaded adapter cache so we don't import all four adapters on every call.
const _adapterCache = new Map();

async function _loadAdapter(runtimeId) {
  if (_adapterCache.has(runtimeId)) return _adapterCache.get(runtimeId);

  const adapterDir = path.join(__dirname, 'runtime-adapters');
  // Map runtime id to adapter filename
  const fileMap = {
    'claude-code': 'claude-code.mjs',
    'codex-cli':   'codex-cli.mjs',
    'gemini-cli':  'gemini-cli.mjs',
    'opencode':    'opencode.mjs',
  };
  const filename = fileMap[runtimeId];
  if (!filename) {
    _adapterCache.set(runtimeId, null);
    return null;
  }

  const adapterPath = path.join(adapterDir, filename);
  let adapter;
  try {
    adapter = await import(pathToFileURL(adapterPath).href);
  } catch {
    adapter = null;
  }
  _adapterCache.set(runtimeId, adapter);
  return adapter;
}

/**
 * Build a telemetry payload { model_id, tokens_in, tokens_out } from a
 * CLI stdout response string by delegating to the appropriate runtime adapter.
 *
 * Called on the **success path** only — on failure, normalizeErrorCode applies.
 *
 * @param {string}  runtimeId  e.g. 'claude-code', 'codex-cli', 'gemini-cli', 'opencode'
 * @param {string}  stdout     raw stdout from the CLI invocation
 * @param {object}  [opts]     passed through to the adapter (e.g. configPath for opencode)
 * @returns {Promise<{ model_id: string|null, tokens_in: number|null, tokens_out: number|null }>}
 */
export async function buildTelemetryPayload(runtimeId, stdout, opts = {}) {
  const empty = { model_id: null, tokens_in: null, tokens_out: null };
  if (!runtimeId) return empty;

  const adapter = await _loadAdapter(runtimeId);
  if (!adapter || typeof adapter.parseResponse !== 'function') return empty;

  try {
    const result = await adapter.parseResponse(stdout, opts);
    return {
      model_id:   (result && result.model_id  != null) ? result.model_id  : null,
      tokens_in:  (result && result.tokens_in  != null) ? Number(result.tokens_in)  || null : null,
      tokens_out: (result && result.tokens_out != null) ? Number(result.tokens_out) || null : null,
    };
  } catch {
    return empty;
  }
}

/**
 * Synchronous variant of buildTelemetryPayload for callers that cannot await.
 * Uses dynamic require + sync-compatible adapters. Falls back to the async
 * path if the adapter is ESM-only (returns a Promise, caller must handle it).
 *
 * In practice, all four adapters are pure-computation (no I/O on the hot path
 * for claude/codex/gemini), so this resolves synchronously in those cases.
 * For opencode (reads config file via fs.readFileSync), it is also sync.
 *
 * Returns { model_id, tokens_in, tokens_out } synchronously if possible,
 * or null if the adapter is not available.
 */
export function buildTelemetryPayloadSync(runtimeId, stdout, opts = {}) {
  // We cannot use dynamic `await import()` synchronously, so we do a
  // best-effort check using a pre-warmed cache from a prior async call.
  if (!runtimeId) return { model_id: null, tokens_in: null, tokens_out: null };
  const cached = _adapterCache.get(runtimeId);
  if (cached && typeof cached.parseResponse === 'function') {
    try {
      const result = cached.parseResponse(stdout, opts);
      // If the adapter returned a Promise (shouldn't happen), return null.
      if (result && typeof result.then === 'function') {
        return { model_id: null, tokens_in: null, tokens_out: null };
      }
      return {
        model_id:   (result && result.model_id  != null) ? result.model_id  : null,
        tokens_in:  (result && result.tokens_in  != null) ? Number(result.tokens_in)  || null : null,
        tokens_out: (result && result.tokens_out != null) ? Number(result.tokens_out) || null : null,
      };
    } catch {
      return { model_id: null, tokens_in: null, tokens_out: null };
    }
  }
  // Adapter not yet loaded — caller should await buildTelemetryPayload instead.
  return { model_id: null, tokens_in: null, tokens_out: null };
}
