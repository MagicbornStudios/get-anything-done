#!/usr/bin/env node
/**
 * claude-session-end-hook.cjs — Claude Code Stop / SubagentStop spend logger.
 *
 * Registered as a Stop + SubagentStop hook by `gad install hooks`.
 * Reads the stop payload from stdin, extracts whatever token counts are
 * available, and appends a row to the daily ai-spend-ledger.
 *
 * Claude Code stop-hook stdin contract (as of 2026-05):
 *   {
 *     "hook_event_name": "Stop" | "SubagentStop",
 *     "session_id": "...",
 *     "transcript_path": "...",
 *     "cwd": "...",
 *     "stop_hook_active": false,
 *     // Token fields may be absent — we write placeholder nulls if so.
 *     "usage": { "prompt_tokens": N, "completion_tokens": N },  // optional
 *     "model": "claude-..."                                       // optional
 *   }
 *
 * Phase 188-03 (GLOBAL-T-188-03).
 */

'use strict';

const { appendRow } = require('../lib/spend-ledger.cjs');

async function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  let payload = null;
  try { payload = JSON.parse(raw); } catch { /* non-JSON stdin — skip */ }

  const cwd = (payload && payload.cwd) || process.cwd();
  const model = (payload && (payload.model || (payload.usage && payload.usage.model))) || null;
  const promptTokens = (payload && payload.usage && payload.usage.prompt_tokens != null)
    ? payload.usage.prompt_tokens : null;
  const completionTokens = (payload && payload.usage && payload.usage.completion_tokens != null)
    ? payload.usage.completion_tokens : null;

  appendRow({
    runtime: 'claude-code',
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    source: 'claude-stop-hook',
    cwd,
  });
}

main().catch(() => {
  // Never fail loud — must not block Claude Code's hook runtime.
  process.exit(0);
});
