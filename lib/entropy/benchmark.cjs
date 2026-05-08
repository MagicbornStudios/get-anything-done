'use strict';
/**
 * lib/entropy/benchmark.cjs — Skill Entropy benchmark library.
 *
 * Phase 88, task 88-01.  Depends on v1 (compute.cjs) and v2 (v2.cjs).
 * Does NOT replace either; uses them as signal sources.
 *
 * Exports:
 *   runBenchmark({ projectRoot, since, runtime })
 *     Collects all measurable inputs (handoffs, retries, mailbox events,
 *     etc.) and passes them through the entropy formula.
 *     Returns: { inputs, H, D, H_total, generated_at }
 *
 *   crossGenerationCompare({ projectRoot, generations })
 *     generations = [{ id, since, until }]
 *     Returns: [{ id, since, until, H, D, H_total }] sorted ascending by H_total.
 *
 * Math (canonical from references/skill-entropy.md):
 *   H(S,t) = -sum p_i * log2(p_i)  — pressure-event type entropy
 *   D(S,t) = unique_decompositions / total_decompositions  — diversity
 *   H_total = alpha*H + beta*D      — combined entropy, alpha=0.7, beta=0.3
 *
 * Inputs fed to the formula (matched to benchmark suite in the reference doc):
 *   1. handoff-claim-time   — mean seconds from open→claim in window
 *   2. retry-count          — sum of unclaim_history lengths from handoffs
 *   3. tool-call-density    — tool-call events per session in window
 *   4. worker-mailbox-depth — open handoffs count at snapshot time
 *   5. runtime-rate-limit   — rate-limit-on-call events in window
 *   6. edit-conflict        — file-modified-since-read events in window
 *   7. discipline-rule-fail — failed discipline rule applications in window
 */

const fs = require('fs');
const path = require('path');
const { computePressure } = require('./compute.cjs');
const { computeEntropyV2 } = require('./v2.cjs');

// ── helpers ───────────────────────────────────────────────────────────────────

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Parse a `since` string into a Unix timestamp (ms).
 * Accepts: "7d", "14d", "30d", "YYYY-MM-DD", or an ISO string.
 */
function parseSinceMs(since) {
  if (!since) return null;
  const daysMatch = String(since).match(/^(\d+)d$/i);
  if (daysMatch) return Date.now() - Number(daysMatch[1]) * 86400_000;
  const ts = Date.parse(since);
  return Number.isFinite(ts) ? ts : null;
}

function parseUntilMs(until) {
  if (!until) return Date.now();
  const ts = Date.parse(until);
  return Number.isFinite(ts) ? ts : Date.now();
}

function readJsonlFile(filePath, limit = 20000) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

function tryReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function inWindow(tsStr, sinceMs, untilMs) {
  if (!tsStr) return false;
  const t = Date.parse(tsStr);
  if (!Number.isFinite(t)) return false;
  if (sinceMs && t < sinceMs) return false;
  if (untilMs && t > untilMs) return false;
  return true;
}

// ── signal collectors ─────────────────────────────────────────────────────────

/**
 * Collect rate-limit events from .planning/.gad-log/*.jsonl and worker logs.
 */
function collectRateLimitEvents(projectRoot, sinceMs, untilMs) {
  const logsDir = path.join(projectRoot, '.planning', '.gad-log');
  let count = 0;

  // Daily log files
  const logFiles = tryReadDir(logsDir).filter((f) => f.endsWith('.jsonl'));
  for (const fname of logFiles) {
    const events = readJsonlFile(path.join(logsDir, fname), 10000);
    for (const e of events) {
      if (
        e &&
        (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream') &&
        inWindow(e.ts, sinceMs, untilMs)
      ) count++;
    }
  }

  // Worker logs
  const workersDir = path.join(projectRoot, '.planning', 'team', 'workers');
  for (const wid of tryReadDir(workersDir)) {
    const logFile = path.join(workersDir, wid, 'log.jsonl');
    const events = readJsonlFile(logFile, 5000);
    for (const e of events) {
      if (
        e &&
        (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream') &&
        inWindow(e.ts, sinceMs, untilMs)
      ) count++;
    }
  }
  return count;
}

/**
 * Collect edit-conflict events (file-modified-since-read) from .gad-log.
 */
function collectEditConflictEvents(projectRoot, sinceMs, untilMs) {
  const logsDir = path.join(projectRoot, '.planning', '.gad-log');
  let count = 0;
  for (const fname of tryReadDir(logsDir).filter((f) => f.endsWith('.jsonl'))) {
    const events = readJsonlFile(path.join(logsDir, fname), 10000);
    for (const e of events) {
      if (
        e &&
        (e.kind === 'file-modified-since-read' || e.kind === 'edit-conflict') &&
        inWindow(e.ts, sinceMs, untilMs)
      ) count++;
    }
  }
  return count;
}

/**
 * Collect handoff signals: open count, claim times, retry sums.
 */
function collectHandoffSignals(projectRoot, sinceMs, untilMs) {
  const openDir = path.join(projectRoot, '.planning', 'handoffs', 'open');
  const claimedDir = path.join(projectRoot, '.planning', 'handoffs', 'claimed');

  let openCount = 0;
  let totalRetries = 0;
  const claimDelaysMs = [];

  // Open handoffs — these are the mailbox-depth signal
  for (const fname of tryReadDir(openDir).filter((f) => f.endsWith('.md'))) {
    try {
      const body = fs.readFileSync(path.join(openDir, fname), 'utf8');
      const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) { openCount++; continue; }
      const fm = fmMatch[1];

      // Check created_at in window
      const createdMatch = fm.match(/^created_at:\s*(.+)$/m);
      const createdAt = createdMatch ? createdMatch[1].trim() : null;
      if (createdAt && sinceMs && Date.parse(createdAt) < sinceMs) continue;

      openCount++;

      const unclaimMatch = fm.match(/^unclaim_history:\s*(.+)$/m);
      if (unclaimMatch) {
        try {
          const arr = JSON.parse(unclaimMatch[1]);
          if (Array.isArray(arr)) totalRetries += arr.length;
        } catch { /* ignore */ }
      }
    } catch { openCount++; }
  }

  // Claimed handoffs — compute claim time delta
  for (const fname of tryReadDir(claimedDir).filter((f) => f.endsWith('.md'))) {
    try {
      const body = fs.readFileSync(path.join(claimedDir, fname), 'utf8');
      const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const fm = fmMatch[1];

      const createdMatch = fm.match(/^created_at:\s*(.+)$/m);
      const claimedMatch = fm.match(/^claimed_at:\s*(.+)$/m);
      if (!createdMatch || !claimedMatch) continue;

      const created = Date.parse(createdMatch[1].trim());
      const claimed = Date.parse(claimedMatch[1].trim());
      if (!Number.isFinite(created) || !Number.isFinite(claimed)) continue;

      // Only include if created is in window
      if (sinceMs && created < sinceMs) continue;
      if (untilMs && created > untilMs) continue;

      claimDelaysMs.push(claimed - created);
    } catch { /* skip */ }
  }

  const meanClaimTimeSec = claimDelaysMs.length > 0
    ? claimDelaysMs.reduce((a, b) => a + b, 0) / claimDelaysMs.length / 1000
    : 0;

  return { openCount, totalRetries, meanClaimTimeSec, claimSamples: claimDelaysMs.length };
}

/**
 * Collect tool-call density from session telemetry files.
 */
function collectToolCallDensity(projectRoot, sinceMs, untilMs) {
  const sessionsDir = path.join(projectRoot, '.planning', 'sessions');
  let totalToolCalls = 0;
  let totalSessions = 0;

  for (const fname of tryReadDir(sessionsDir).filter((f) => f.endsWith('.telemetry.jsonl'))) {
    const events = readJsonlFile(path.join(sessionsDir, fname), 10000);
    // Count tool-call events in window
    let sessionToolCalls = 0;
    let sessionInWindow = false;
    for (const e of events) {
      if (!e) continue;
      if (inWindow(e.ts, sinceMs, untilMs)) {
        sessionInWindow = true;
        if (e.kind === 'tool-call') sessionToolCalls++;
      }
    }
    if (sessionInWindow) {
      totalToolCalls += sessionToolCalls;
      totalSessions++;
    }
  }

  return {
    totalToolCalls,
    totalSessions,
    density: totalSessions > 0 ? totalToolCalls / totalSessions : 0,
  };
}

/**
 * Collect discipline-rule-fail events from worker logs.
 */
function collectDisciplineFailEvents(projectRoot, sinceMs, untilMs) {
  const workersDir = path.join(projectRoot, '.planning', 'team', 'workers');
  let count = 0;
  for (const wid of tryReadDir(workersDir)) {
    const logFile = path.join(workersDir, wid, 'log.jsonl');
    const events = readJsonlFile(logFile, 5000);
    for (const e of events) {
      if (
        e &&
        (e.kind === 'discipline-rule-fail' || e.kind === 'discipline-violation') &&
        inWindow(e.ts, sinceMs, untilMs)
      ) count++;
    }
  }
  return count;
}

// ── entropy formula ───────────────────────────────────────────────────────────

const ALPHA = 0.7;
const BETA = 0.3;

/**
 * Compute Shannon entropy H from a map of { eventType: count }.
 * H(S,t) = -sum p_i * log2(p_i)
 * Returns normalized H in [0,1] range using max possible entropy (log2(n)).
 */
function computeH(typeCounts) {
  const total = Object.values(typeCounts).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const n = Object.keys(typeCounts).filter((k) => typeCounts[k] > 0).length;
  if (n <= 1) return 0;

  let rawH = 0;
  for (const count of Object.values(typeCounts)) {
    if (count <= 0) continue;
    const p = count / total;
    rawH -= p * Math.log2(p);
  }
  return rawH / Math.log2(n);
}

/**
 * Build a pressure-event type distribution from collected inputs.
 * Each measurable input becomes an event-type bucket.
 */
function buildEventTypeCounts(inputs) {
  return {
    'handoff-claim-time': Math.max(0, Math.round(inputs.meanClaimTimeSec)),
    'retry-count': Math.max(0, inputs.totalRetries),
    'tool-call-density': Math.max(0, Math.round(inputs.toolCallDensity)),
    'worker-mailbox-depth': Math.max(0, inputs.workerMailboxDepth),
    'runtime-rate-limit': Math.max(0, inputs.rateLimitEvents),
    'edit-conflict': Math.max(0, inputs.editConflictEvents),
    'discipline-rule-fail': Math.max(0, inputs.disciplineFailEvents),
  };
}

// ── runBenchmark ──────────────────────────────────────────────────────────────

/**
 * Run a full entropy benchmark for a project.
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot] — defaults to process.cwd()
 * @param {string}  [opts.since]       — "7d", "30d", or "YYYY-MM-DD"
 * @param {string}  [opts.runtime]     — runtime label for attribution (informational)
 * @param {string}  [opts.projectid]   — passed to v1/v2 pressure compute
 * @returns {{ inputs: object, H: number, D: number, H_total: number, generated_at: string }}
 */
function runBenchmark({ projectRoot, since, runtime, projectid } = {}) {
  const root = projectRoot || process.cwd();
  const pid = projectid || 'unknown';
  const sinceMs = parseSinceMs(since || '7d');
  const untilMs = Date.now();

  // Collect all measurable inputs
  const rlEvents = collectRateLimitEvents(root, sinceMs, untilMs);
  const ecEvents = collectEditConflictEvents(root, sinceMs, untilMs);
  const handoffs = collectHandoffSignals(root, sinceMs, untilMs);
  const toolCalls = collectToolCallDensity(root, sinceMs, untilMs);
  const discFails = collectDisciplineFailEvents(root, sinceMs, untilMs);

  const inputs = {
    since: since || '7d',
    runtime: runtime || null,
    meanClaimTimeSec: Math.round(handoffs.meanClaimTimeSec * 100) / 100,
    claimSamples: handoffs.claimSamples,
    totalRetries: handoffs.totalRetries,
    toolCallDensity: Math.round(toolCalls.density * 100) / 100,
    totalToolCalls: toolCalls.totalToolCalls,
    totalSessions: toolCalls.totalSessions,
    workerMailboxDepth: handoffs.openCount,
    rateLimitEvents: rlEvents,
    editConflictEvents: ecEvents,
    disciplineFailEvents: discFails,
  };

  // Compute H from event-type distribution
  const typeCounts = buildEventTypeCounts(inputs);
  const H = Math.round(computeH(typeCounts) * 1000) / 1000;

  // Compute D (decomposition diversity) via v2
  const v2Result = computeEntropyV2({ projectRoot: root, since, projectid: pid });
  const D = v2Result.v2.decomposition_diversity;

  // Combined entropy
  const H_total = Math.round(clamp(ALPHA * H + BETA * D, 0, 1) * 1000) / 1000;

  return {
    inputs,
    H,
    D,
    H_total,
    alpha: ALPHA,
    beta: BETA,
    type_counts: typeCounts,
    v1_score: v2Result.v1.score,
    generated_at: new Date().toISOString(),
  };
}

// ── crossGenerationCompare ────────────────────────────────────────────────────

/**
 * Compare entropy across multiple named generations (dev sessions / milestones).
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot]
 * @param {Array<{ id: string, since: string, until: string }>} opts.generations
 * @returns {Array<{ id, since, until, H, D, H_total }>} sorted ascending by H_total
 */
function crossGenerationCompare({ projectRoot, generations } = {}) {
  const root = projectRoot || process.cwd();
  if (!Array.isArray(generations) || generations.length === 0) return [];

  const rows = generations.map((gen) => {
    const sinceMs = parseSinceMs(gen.since);
    const untilMs = parseUntilMs(gen.until);

    // Collect signals constrained to this window
    const rlEvents = collectRateLimitEvents(root, sinceMs, untilMs);
    const ecEvents = collectEditConflictEvents(root, sinceMs, untilMs);
    const handoffs = collectHandoffSignals(root, sinceMs, untilMs);
    const toolCalls = collectToolCallDensity(root, sinceMs, untilMs);
    const discFails = collectDisciplineFailEvents(root, sinceMs, untilMs);

    const inputs = {
      meanClaimTimeSec: handoffs.meanClaimTimeSec,
      totalRetries: handoffs.totalRetries,
      toolCallDensity: toolCalls.density,
      workerMailboxDepth: handoffs.openCount,
      rateLimitEvents: rlEvents,
      editConflictEvents: ecEvents,
      disciplineFailEvents: discFails,
    };

    const typeCounts = buildEventTypeCounts(inputs);
    const H = Math.round(computeH(typeCounts) * 1000) / 1000;

    // For D, use v2 with since only (until not currently filtered in v2 — best effort)
    const v2Result = computeEntropyV2({ projectRoot: root, since: gen.since });
    const D = v2Result.v2.decomposition_diversity;
    const H_total = Math.round(clamp(ALPHA * H + BETA * D, 0, 1) * 1000) / 1000;

    return {
      id: gen.id,
      since: gen.since,
      until: gen.until || null,
      H,
      D,
      H_total,
    };
  });

  // Sort ascending by H_total — lowest entropy (cleanest execution) first
  return rows.sort((a, b) => a.H_total - b.H_total);
}

module.exports = {
  runBenchmark,
  crossGenerationCompare,
  // Exported for tests:
  computeH,
  buildEventTypeCounts,
  parseSinceMs,
  collectHandoffSignals,
  collectRateLimitEvents,
  collectEditConflictEvents,
  collectToolCallDensity,
  collectDisciplineFailEvents,
  ALPHA,
  BETA,
};
