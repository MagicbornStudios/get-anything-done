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

function normalizeRuntimeId(runtime) {
  return String(runtime || '').trim().toLowerCase();
}

function toHandoffFrontmatter(handoffLike) {
  if (!handoffLike || typeof handoffLike !== 'object' || Array.isArray(handoffLike)) {
    return { runtime_preference: handoffLike };
  }
  return handoffLike;
}

function getRuntimeFallbacks(frontmatter, opts) {
  const local = frontmatter.runtime_fallbacks;
  if (Array.isArray(local)) return local.map(normalizeRuntimeId).filter(Boolean);
  const pref = normalizeRuntimeId(frontmatter.runtime_preference);
  const globalChains = opts && opts.globalFallbacks;
  if (!pref || !globalChains || typeof globalChains !== 'object') return [];
  const chain = globalChains[pref];
  return Array.isArray(chain) ? chain.map(normalizeRuntimeId).filter(Boolean) : [];
}

/**
 * Return true if the handoff can be attempted by the current runtime.
 * `runtime_preference` is a hint only; only `runtime_required: true`
 * turns it into a hard gate.
 */
function isHandoffCompatible(handoffLike, currentRuntime) {
  const frontmatter = toHandoffFrontmatter(handoffLike);
  const pref = normalizeRuntimeId(frontmatter.runtime_preference);
  const curr = normalizeRuntimeId(currentRuntime);
  if (frontmatter.runtime_required === true || frontmatter.runtime_required === 'true') {
    if (!pref || pref === 'any') return true;
    return !!curr && pref === curr;
  }
  return true;
}

function runtimeAffinityRank(handoffLike, currentRuntime, opts) {
  const frontmatter = toHandoffFrontmatter(handoffLike);
  const pref = normalizeRuntimeId(frontmatter.runtime_preference);
  const curr = normalizeRuntimeId(currentRuntime);
  if (!curr) return !pref || pref === 'any' ? 10 : 100;
  if (!pref || pref === 'any') return 10;
  if (pref === curr) return 0;
  const fallbackIdx = getRuntimeFallbacks(frontmatter, opts).indexOf(curr);
  if (fallbackIdx !== -1) return 1 + fallbackIdx;
  return 100;
}

const PRIORITY_RANK = { critical: 4, high: 3, normal: 2, low: 1 };

function priorityRank(p) {
  return PRIORITY_RANK[String(p || 'normal').toLowerCase()] || 2;
}

/**
 * Sort handoffs for auto-pickup.
 * Priority stays primary; runtime preference only acts as a sort hint.
 */
function sortHandoffsForPickup(handoffs, currentRuntime, opts) {
  return [...handoffs].sort((a, b) => {
    const aCompat = isHandoffCompatible(a.frontmatter, currentRuntime);
    const bCompat = isHandoffCompatible(b.frontmatter, currentRuntime);
    if (aCompat && !bCompat) return -1;
    if (!aCompat && bCompat) return 1;
    const aP = priorityRank(a.frontmatter && a.frontmatter.priority);
    const bP = priorityRank(b.frontmatter && b.frontmatter.priority);
    if (aP !== bP) return bP - aP;
    const aAffinity = runtimeAffinityRank(a.frontmatter, currentRuntime, opts);
    const bAffinity = runtimeAffinityRank(b.frontmatter, currentRuntime, opts);
    if (aAffinity !== bAffinity) return aAffinity - bAffinity;
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
  runtimeAffinityRank,
  priorityRank,
  sortHandoffsForPickup,
};
