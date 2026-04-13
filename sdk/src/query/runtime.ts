import type { RuntimeIdentity } from './types.js';

export function detectRuntimeIdentity(): RuntimeIdentity {
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

export function normalizeRuntime(runtime: string | null | undefined): RuntimeIdentity {
  const value = String(runtime || '').trim().toLowerCase();
  if (!value) return detectRuntimeIdentity();
  if (value === 'claude' || value === 'claude-code') return { id: 'claude-code', source: 'query-arg', model: null };
  if (value === 'codex') return { id: 'codex', source: 'query-arg', model: null };
  if (value === 'cursor') return { id: 'cursor', source: 'query-arg', model: null };
  if (value === 'windsurf') return { id: 'windsurf', source: 'query-arg', model: null };
  if (value === 'gemini' || value === 'gemini-cli') return { id: 'gemini-cli', source: 'query-arg', model: null };
  if (value === 'human') return { id: 'human', source: 'query-arg', model: null };
  return { id: value, source: 'query-arg', model: null };
}

export function resolveSnapshotRuntime(runtime: string | null | undefined, options: { humanFallback?: boolean } = {}): RuntimeIdentity {
  const normalized = normalizeRuntime(runtime);
  if (runtime && normalized.id !== 'unknown') return normalized;
  const detected = detectRuntimeIdentity();
  if (detected.id !== 'unknown') return detected;
  if (options.humanFallback) return { id: 'human', source: 'snapshot-fallback', model: null };
  return detected;
}

export function detectRuntimeSessionId(): string | null {
  return process.env.GAD_RUNTIME_SESSION_ID
    || process.env.GAD_SESSION_ID
    || process.env.CLAUDE_SESSION_ID
    || process.env.CLAUDE_CONVERSATION_ID
    || process.env.CODEX_SESSION_ID
    || process.env.CURSOR_SESSION_ID
    || null;
}
