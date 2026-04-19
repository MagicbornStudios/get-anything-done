'use strict';

/**
 * agent-detect.cjs — passively detect which runtime/agent is running the
 * current `gad` process.
 *
 * Read-only: inspects env vars only. No network, no side effects, no writes.
 * Used by `gad startup` and `gad handoffs claim-next` to auto-pick the
 * caller's runtime preference.
 *
 * Precedence:
 *   1. GAD_RUNTIME env var (explicit operator override)
 *   2. Runtime-specific env var fingerprints
 *   3. Returns null if unknown (caller should pass --runtime explicitly)
 *
 * Known runtimes:
 *   - claude-code   : CLAUDECODE=1 (set by Claude Code CLI)
 *   - codex         : CODEX_SESSION_ID or CODEX_HOME
 *   - cursor        : CURSOR_AGENT_ID, CURSOR_SESSION, or CURSOR_TRACE_ID
 *   - gemini        : GEMINI_SESSION_ID or GOOGLE_GENAI_API_KEY (weak — prefer session)
 *   - opencode      : OPENCODE_SESSION_ID
 *
 * Additional env fingerprints welcome. Keep the detector passive.
 */

const KNOWN_RUNTIMES = ['claude-code', 'codex', 'cursor', 'gemini', 'opencode'];

function detectRuntime(env = process.env) {
  const override = (env.GAD_RUNTIME || '').trim();
  if (override) {
    if (KNOWN_RUNTIMES.includes(override) || override === 'any') return override;
    // unknown override — respect it anyway so operator can plug in new runtimes
    return override;
  }

  if (env.CLAUDECODE === '1' || env.CLAUDE_CODE === '1') return 'claude-code';

  if (env.CODEX_SESSION_ID || env.CODEX_HOME || env.CODEX_CLI) return 'codex';

  if (env.CURSOR_AGENT_ID || env.CURSOR_SESSION || env.CURSOR_TRACE_ID) return 'cursor';

  if (env.GEMINI_SESSION_ID) return 'gemini';

  if (env.OPENCODE_SESSION_ID) return 'opencode';

  return null;
}

/**
 * Return true if the handoff's runtime_preference is compatible with the
 * current runtime. A handoff with `any`, empty, or matching preference is
 * compatible.
 */
function isHandoffCompatible(handoffRuntime, currentRuntime) {
  const pref = String(handoffRuntime || '').trim().toLowerCase();
  const curr = String(currentRuntime || '').trim().toLowerCase();
  if (!pref || pref === 'any') return true;
  if (!curr) return false;
  return pref === curr;
}

const PRIORITY_RANK = { critical: 4, high: 3, normal: 2, low: 1 };

function priorityRank(p) {
  return PRIORITY_RANK[String(p || 'normal').toLowerCase()] || 2;
}

/**
 * Sort handoffs for auto-pickup. Compatible handoffs first (descending
 * priority), then incompatible (ignored by claim-next but listed for
 * transparency).
 */
function sortHandoffsForPickup(handoffs, currentRuntime) {
  return [...handoffs].sort((a, b) => {
    const aCompat = isHandoffCompatible(a.frontmatter && a.frontmatter.runtime_preference, currentRuntime);
    const bCompat = isHandoffCompatible(b.frontmatter && b.frontmatter.runtime_preference, currentRuntime);
    if (aCompat && !bCompat) return -1;
    if (!aCompat && bCompat) return 1;
    const aP = priorityRank(a.frontmatter && a.frontmatter.priority);
    const bP = priorityRank(b.frontmatter && b.frontmatter.priority);
    if (aP !== bP) return bP - aP;
    // Tie-break: older handoff wins (FIFO at same priority)
    const aT = String((a.frontmatter && a.frontmatter.created_at) || a.id || '');
    const bT = String((b.frontmatter && b.frontmatter.created_at) || b.id || '');
    return aT.localeCompare(bT);
  });
}

module.exports = {
  KNOWN_RUNTIMES,
  detectRuntime,
  isHandoffCompatible,
  priorityRank,
  sortHandoffsForPickup,
};
