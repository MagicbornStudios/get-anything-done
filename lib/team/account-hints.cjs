'use strict';
/**
 * lib/team/account-hints.cjs — surface "this account needs upgrade or
 * a second account" hints by counting rate-limit events per (provider,
 * account-label) within a sliding window.
 *
 * Task: GLOBAL-T-87-05
 * Phase: 87 (multi-account / multi-runtime fallback).
 *
 * Data sources:
 *   - .planning/team/supervisor.log.jsonl — `kind=runtime-rate-limit-on-call`
 *     entries from worker-loop.cjs.
 *   - per-worker logs under .planning/team/workers/<id>/log.jsonl —
 *     `kind=runtime-failure-dispatch` entries with classification.class
 *     ∈ { quota_soft, quota_hard_cap }.
 *   - .planning/team/runtime-account-state.json — current `label` per runtime
 *     at the time the event fired (best-effort attribution).
 *
 * Threshold (default): 2 hits inside a 24h window for the same (provider,
 * label) → emit hint. Configurable via env GAD_ACCOUNT_HINTS_THRESHOLD /
 * GAD_ACCOUNT_HINTS_WINDOW_HOURS.
 */

const fs = require('fs');
const path = require('path');
const { workersRoot, supervisorLog, teamRoot, workerLog } = require('./paths.cjs');
const { loadRuntimeAccountState } = require('./accounts-registry.cjs');

const DEFAULT_THRESHOLD = 2;
const DEFAULT_WINDOW_HOURS = 24;

const RATE_LIMIT_LOG_KINDS = new Set([
  'runtime-rate-limit-on-call',
  'runtime-failure-dispatch',
]);

const RATE_LIMIT_CLASSES = new Set(['quota_soft', 'quota_hard_cap']);

const RUNTIME_TO_PROVIDER = Object.freeze({
  'codex-cli': 'codex',
  'gemini-cli': 'gemini',
  'claude-code': 'claude',
  opencode: 'opencode',
  'cursor-cli': 'cursor',
});

function tailJsonl(filePath, maxLines) {
  if (!fs.existsSync(filePath)) return [];
  // Cheap full-read; supervisor.log.jsonl is rotated at ~MB scale.
  // For multi-MB files the right answer is a backwards scan; keep it
  // simple until that's a real problem.
  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); } catch { return []; }
  const lines = text.split('\n').filter(Boolean);
  const start = typeof maxLines === 'number' && maxLines > 0
    ? Math.max(0, lines.length - maxLines)
    : 0;
  const out = [];
  for (let i = start; i < lines.length; i += 1) {
    try { out.push(JSON.parse(lines[i])); } catch { /* skip malformed line */ }
  }
  return out;
}

function listWorkerDirs(baseDir) {
  const dir = workersRoot(baseDir);
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch { return []; }
}

/**
 * Collect rate-limit events from supervisor + worker logs within the window.
 *
 * Returns array of { ts, provider, label, runtime, kind, source }.
 */
function collectRateLimitEvents(baseDir, { windowMs }) {
  const cutoff = Date.now() - windowMs;
  const events = [];
  const state = loadRuntimeAccountState(baseDir) || {};

  function activeLabelFor(runtime) {
    const entry = state[runtime];
    return (entry && entry.label) || null;
  }

  function pushIfRecent(entry, source) {
    if (!entry || !entry.ts) return;
    const t = Date.parse(entry.ts);
    if (!Number.isFinite(t) || t < cutoff) return;
    if (!RATE_LIMIT_LOG_KINDS.has(entry.kind)) return;
    // For runtime-failure-dispatch, only count quota classes.
    if (entry.kind === 'runtime-failure-dispatch') {
      const cls = entry.classification && entry.classification.class;
      if (!RATE_LIMIT_CLASSES.has(cls)) return;
    }
    const runtime = entry.runtime || null;
    const provider = runtime ? (RUNTIME_TO_PROVIDER[runtime] || null) : null;
    if (!provider) return;
    // Label attribution: prefer explicit; fall back to active account at time
    // of read (best-effort — runtime-account-state.json doesn't carry history).
    const label = entry.label || activeLabelFor(runtime) || 'unknown';
    events.push({
      ts: entry.ts,
      provider,
      label,
      runtime,
      kind: entry.kind,
      classification: entry.classification && entry.classification.class || null,
      source,
    });
  }

  // Supervisor log
  const supEntries = tailJsonl(supervisorLog(baseDir), 5000);
  for (const e of supEntries) pushIfRecent(e, 'supervisor');

  // Per-worker logs
  for (const id of listWorkerDirs(baseDir)) {
    const entries = tailJsonl(workerLog(baseDir, id), 5000);
    for (const e of entries) pushIfRecent(e, `worker:${id}`);
  }

  return events;
}

/**
 * Build hints by counting per (provider, label) and applying the threshold.
 *
 * @param {string} baseDir - .planning/ owner (typically a project's root).
 * @param {object} [opts]
 * @param {number} [opts.threshold] - default 2.
 * @param {number} [opts.windowHours] - default 24.
 * @param {function} [opts.scopePredicate] - (provider, label) => boolean. Skip
 *   accounts not in scope for the active project.
 * @returns {Array<{provider, label, runtime, count, first_ts, last_ts, window_hours, recommendation}>}
 */
function buildAccountHints(baseDir, opts = {}) {
  const threshold = Number.isFinite(opts.threshold) && opts.threshold > 0
    ? opts.threshold
    : Number(process.env.GAD_ACCOUNT_HINTS_THRESHOLD) || DEFAULT_THRESHOLD;
  const windowHours = Number.isFinite(opts.windowHours) && opts.windowHours > 0
    ? opts.windowHours
    : Number(process.env.GAD_ACCOUNT_HINTS_WINDOW_HOURS) || DEFAULT_WINDOW_HOURS;
  const windowMs = windowHours * 60 * 60 * 1000;
  const scopePredicate = typeof opts.scopePredicate === 'function' ? opts.scopePredicate : null;

  const events = collectRateLimitEvents(baseDir, { windowMs });
  const groups = new Map();
  for (const ev of events) {
    if (scopePredicate && !scopePredicate(ev.provider, ev.label)) continue;
    const key = `${ev.provider}::${ev.label}`;
    let g = groups.get(key);
    if (!g) {
      g = { provider: ev.provider, label: ev.label, runtime: ev.runtime, count: 0, first_ts: ev.ts, last_ts: ev.ts };
      groups.set(key, g);
    }
    g.count += 1;
    if (ev.ts < g.first_ts) g.first_ts = ev.ts;
    if (ev.ts > g.last_ts) g.last_ts = ev.ts;
  }

  const hints = [];
  for (const g of groups.values()) {
    if (g.count < threshold) continue;
    hints.push({
      ...g,
      window_hours: windowHours,
      recommendation: g.label === 'unknown'
        ? `Provider ${g.provider} hit rate-limit ${g.count}x in ${windowHours}h but account label is unknown — capture label attribution to fix the hint.`
        : `Account ${g.provider}:${g.label} hit rate-limit ${g.count}x in ${windowHours}h. Upgrade plan or add a second account via \`gad accounts add ${g.provider} --label <name>\`.`,
    });
  }
  // Sort: highest count first, then most recent.
  hints.sort((a, b) => (b.count - a.count) || (b.last_ts.localeCompare(a.last_ts)));
  return hints;
}

module.exports = {
  buildAccountHints,
  collectRateLimitEvents,
  DEFAULT_THRESHOLD,
  DEFAULT_WINDOW_HOURS,
  RATE_LIMIT_LOG_KINDS,
  RATE_LIMIT_CLASSES,
  RUNTIME_TO_PROVIDER,
};
