/**
 * scripts/runtime-adapters/gemini-cli.mjs
 *
 * Response parser for the gemini-cli runtime (Google Gemini CLI).
 *
 * Gemini CLI invoked with `--output-format json` emits a single JSON object
 * (or a JSONL stream) containing:
 *   - modelVersion                              → model_id  (e.g. "gemini-3-flash-preview", "gemini-2.5-pro")
 *   - usageMetadata.promptTokenCount            → tokens_in
 *   - usageMetadata.candidatesTokenCount        → tokens_out
 *
 * Some Gemini API response shapes also use:
 *   - model                                     → model_id  (fallback)
 *   - usageMetadata.totalTokenCount             → total (informational only)
 *   - usageMetadata.thoughtsTokenCount          → part of output for think models
 *
 * Known model ids (non-exhaustive): gemini-3-flash-preview, gemini-2.5-pro, gemini-2.0-flash
 */

/**
 * Parse a raw stdout string from `gemini --output-format json` into a
 * { model_id, tokens_in, tokens_out } telemetry payload.
 *
 * @param {string} stdout  - raw stdout captured from the gemini CLI invocation
 * @returns {{ model_id: string|null, tokens_in: number|null, tokens_out: number|null }}
 */
export function parseResponse(stdout) {
  const result = {
    model_id: null,
    tokens_in: null,
    tokens_out: null,
  };

  if (typeof stdout !== 'string' || !stdout.trim()) return result;

  // Try whole-document JSON first
  const fullTrimmed = stdout.trim();
  if (fullTrimmed.startsWith('{') || fullTrimmed.startsWith('[')) {
    try {
      const obj = JSON.parse(fullTrimmed);
      // Gemini may return an array of candidate objects
      const candidate = Array.isArray(obj) ? obj[0] : obj;
      _extractFromObject(candidate, result);
      if (result.model_id) return result;
    } catch { /* fall through to JSONL scan */ }
  }

  // JSONL scan
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;

    _extractFromObject(entry, result);
    if (result.model_id) break;
  }

  return result;
}

function _extractFromObject(obj, result) {
  if (!obj || typeof obj !== 'object') return result;

  // modelVersion is the canonical field in the Gemini CLI --output-format json response
  if (obj.modelVersion && !result.model_id) {
    result.model_id = String(obj.modelVersion);
  }
  // Fallback: flat model field
  if (obj.model && !result.model_id) {
    result.model_id = String(obj.model);
  }

  // usageMetadata (Gemini API shape)
  const usage = obj.usageMetadata || null;
  if (usage && typeof usage === 'object') {
    if (usage.promptTokenCount != null && result.tokens_in === null) {
      result.tokens_in = Number(usage.promptTokenCount) || null;
    }
    // candidatesTokenCount = output tokens (excludes thoughts for Flash Thinking)
    // thoughtsTokenCount is additional output tokens (only some models)
    if (usage.candidatesTokenCount != null && result.tokens_out === null) {
      const base = Number(usage.candidatesTokenCount) || 0;
      const thoughts = Number(usage.thoughtsTokenCount) || 0;
      result.tokens_out = base + thoughts || null;
    }
  }

  return result;
}
