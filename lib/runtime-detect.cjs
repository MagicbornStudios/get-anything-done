'use strict';

function detectRuntimeIdentity() {
  const model = process.env.GAD_MODEL || process.env.CLAUDE_MODEL || process.env.OPENAI_MODEL || null;
  if (process.env.GAD_RUNTIME) {
    return { id: process.env.GAD_RUNTIME, source: 'env', model };
  }
  if (process.env.CODEX_HOME) {
    return { id: 'codex', source: 'env', model };
  }
  if (process.env.CLAUDE_CONFIG_DIR || process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) {
    return { id: 'claude-code', source: 'env', model };
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
    || null;
}

module.exports = {
  detectRuntimeIdentity,
  detectRuntimeSessionId,
};
