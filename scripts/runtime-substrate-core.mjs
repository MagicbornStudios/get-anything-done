/**
 * scripts/runtime-substrate-core.mjs
 *
 * Runtime substrate error-code normalization for the GAD eval/species pipeline.
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
import { fileURLToPath } from 'url';
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
