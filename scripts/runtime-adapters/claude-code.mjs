/**
 * scripts/runtime-adapters/claude-code.mjs
 *
 * Response parser for the claude-code runtime (Anthropic claude CLI).
 *
 * Claude Code outputs a JSONL stream when invoked with --output-format json.
 * Each line is a JSON object; the final "result" message contains:
 *   - message.model          → model_id  (e.g. "claude-opus-4-7", "claude-sonnet-4-6")
 *   - message.usage.input_tokens  → tokens_in
 *   - message.usage.output_tokens → tokens_out
 *
 * Known model ids (non-exhaustive; match prefix):
 *   claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5
 *
 * On failure paths: classification still applies (see runtime-substrate-core.mjs),
 * this module only handles the success/stdout path.
 */

/**
 * Parse a raw stdout string from `claude --output-format json` into a
 * { model_id, tokens_in, tokens_out } telemetry payload.
 *
 * @param {string} stdout  - raw stdout captured from the claude CLI invocation
 * @returns {{ model_id: string|null, tokens_in: number|null, tokens_out: number|null }}
 */
export function parseResponse(stdout) {
  const result = {
    model_id: null,
    tokens_in: null,
    tokens_out: null,
  };

  if (typeof stdout !== 'string' || !stdout.trim()) return result;

  // Claude outputs JSONL — each line is a separate JSON object.
  // The "result" type message (or the last message with a model field) wins.
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || typeof entry !== 'object') continue;

    // Claude Code --output-format json JSONL stream:
    // type="result" carries message.model + message.usage
    if (entry.type === 'result' && entry.message) {
      const msg = entry.message;
      if (msg.model) result.model_id = String(msg.model);
      if (msg.usage && typeof msg.usage === 'object') {
        if (msg.usage.input_tokens != null) result.tokens_in = Number(msg.usage.input_tokens) || null;
        if (msg.usage.output_tokens != null) result.tokens_out = Number(msg.usage.output_tokens) || null;
      }
      // type=result is authoritative — stop after first match
      break;
    }

    // Fallback: some output modes emit a flat object with model + usage at top level
    if (entry.model && !result.model_id) {
      result.model_id = String(entry.model);
    }
    const usage = entry.usage || (entry.message && entry.message.usage) || null;
    if (usage && typeof usage === 'object') {
      if (usage.input_tokens != null && result.tokens_in === null) {
        result.tokens_in = Number(usage.input_tokens) || null;
      }
      if (usage.output_tokens != null && result.tokens_out === null) {
        result.tokens_out = Number(usage.output_tokens) || null;
      }
    }
  }

  return result;
}
