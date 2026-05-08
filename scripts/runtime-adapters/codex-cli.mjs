/**
 * scripts/runtime-adapters/codex-cli.mjs
 *
 * Response parser for the codex-cli runtime (OpenAI codex CLI / gpt-based).
 *
 * Codex can be invoked with `--json` flag for machine-readable output.
 * The response may contain:
 *   - model                         → model_id  (e.g. "gpt-5", "gpt-5.5", "o4-mini")
 *   - usage.prompt_tokens           → tokens_in
 *   - usage.completion_tokens       → tokens_out
 *   OR OpenAI-style:
 *   - usage.input_tokens            → tokens_in  (newer API shape)
 *   - usage.output_tokens           → tokens_out
 *
 * Codex may also emit a JSONL stream; we scan all lines and take the first
 * entry that has a model field.
 *
 * Known model ids (non-exhaustive): gpt-5, gpt-5.5, o4-mini, gpt-4o
 */

/**
 * Parse a raw stdout string from `codex exec --json` into a
 * { model_id, tokens_in, tokens_out } telemetry payload.
 *
 * @param {string} stdout  - raw stdout captured from the codex CLI invocation
 * @returns {{ model_id: string|null, tokens_in: number|null, tokens_out: number|null }}
 */
export function parseResponse(stdout) {
  const result = {
    model_id: null,
    tokens_in: null,
    tokens_out: null,
  };

  if (typeof stdout !== 'string' || !stdout.trim()) return result;

  // Try whole-document JSON first (single-object output)
  const fullTrimmed = stdout.trim();
  if (fullTrimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(fullTrimmed);
      return _extractFromObject(obj, result);
    } catch { /* fall through to JSONL scan */ }
  }

  // JSONL scan — take first line with a model field
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;

    _extractFromObject(entry, result);
    // Stop once we have a model_id
    if (result.model_id) break;
  }

  return result;
}

function _extractFromObject(obj, result) {
  if (!obj || typeof obj !== 'object') return result;

  // model field (top-level or nested under choices[0].message)
  if (obj.model && !result.model_id) {
    result.model_id = String(obj.model);
  }

  // usage (OpenAI completion API shape)
  const usage = obj.usage || null;
  if (usage && typeof usage === 'object') {
    // Prefer input_tokens (newer) over prompt_tokens (legacy)
    if (usage.input_tokens != null && result.tokens_in === null) {
      result.tokens_in = Number(usage.input_tokens) || null;
    } else if (usage.prompt_tokens != null && result.tokens_in === null) {
      result.tokens_in = Number(usage.prompt_tokens) || null;
    }

    if (usage.output_tokens != null && result.tokens_out === null) {
      result.tokens_out = Number(usage.output_tokens) || null;
    } else if (usage.completion_tokens != null && result.tokens_out === null) {
      result.tokens_out = Number(usage.completion_tokens) || null;
    }
  }

  return result;
}
