'use strict';

/**
 * Runtime fingerprinting via env vars. Precedence: explicit GAD_RUNTIME >
 * runtime-specific env > unknown. Each runtime must set at least one of
 * its fingerprint vars when it invokes `gad` — that's how liveness
 * inference works for runtimes beyond Claude Code.
 *
 * Known fingerprints:
 *   claude-code : CLAUDECODE=1, CLAUDE_CONFIG_DIR, CLAUDE_CODE_ENTRYPOINT
 *   codex       : CODEX_HOME, CODEX_SESSION_ID, CODEX_CLI
 *   cursor      : CURSOR_AGENT_ID, CURSOR_TRACE_ID, CURSOR_SESSION_ID,
 *                 CURSOR_SESSION, CURSOR_CONFIG_DIR
 *   gemini      : GEMINI_SESSION_ID, GEMINI_CONFIG_DIR
 *   opencode    : OPENCODE_SESSION_ID, OPENCODE_HOME
 *   copilot     : COPILOT_CONFIG_DIR
 *   antigravity : ANTIGRAVITY_CONFIG_DIR
 *   windsurf    : WINDSURF_CONFIG_DIR
 *   augment     : AUGMENT_CONFIG_DIR
 */
function detectRuntimeIdentity() {
  const model = process.env.GAD_MODEL || process.env.CLAUDE_MODEL || process.env.OPENAI_MODEL || null;
  if (process.env.GAD_RUNTIME) {
    return { id: process.env.GAD_RUNTIME, source: 'env', model };
  }
  // Claude Code first (most common, cheapest check)
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT || process.env.CLAUDE_CONFIG_DIR) {
    return { id: 'claude-code', source: 'env', model };
  }
  if (process.env.CURSOR_AGENT_ID || process.env.CURSOR_TRACE_ID || process.env.CURSOR_SESSION_ID || process.env.CURSOR_SESSION || process.env.CURSOR_CONFIG_DIR) {
    return { id: 'cursor', source: 'env', model };
  }
  if (process.env.CODEX_HOME || process.env.CODEX_SESSION_ID || process.env.CODEX_CLI) {
    return { id: 'codex', source: 'env', model };
  }
  if (process.env.GEMINI_SESSION_ID || process.env.GEMINI_CONFIG_DIR) {
    return { id: 'gemini', source: 'env', model };
  }
  if (process.env.OPENCODE_SESSION_ID || process.env.OPENCODE_HOME) {
    return { id: 'opencode', source: 'env', model };
  }
  if (process.env.COPILOT_CONFIG_DIR) {
    return { id: 'copilot', source: 'env', model };
  }
  if (process.env.ANTIGRAVITY_CONFIG_DIR) {
    return { id: 'antigravity', source: 'env', model };
  }
  if (process.env.WINDSURF_CONFIG_DIR) {
    return { id: 'windsurf', source: 'env', model };
  }
  if (process.env.AUGMENT_CONFIG_DIR) {
    return { id: 'augment', source: 'env', model };
  }
  return { id: 'unknown', source: 'unknown', model };
}

function detectRuntimeSessionId() {
  return process.env.GAD_RUNTIME_SESSION_ID
    || process.env.GAD_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || process.env.CLAUDE_CONVERSATION_ID
    || process.env.CODEX_SESSION_ID
    || process.env.CURSOR_SESSION_ID
    || process.env.CURSOR_TRACE_ID
    || process.env.CURSOR_AGENT_ID
    || process.env.GEMINI_SESSION_ID
    || process.env.OPENCODE_SESSION_ID
    || null;
}

module.exports = {
  detectRuntimeIdentity,
  detectRuntimeSessionId,
};
