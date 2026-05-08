'use strict';
/**
 * lib/entropy/rubric.cjs — Skill Entropy eval rubric.
 *
 * Phase 88, task 88-01.
 *
 * Exports:
 *   RUBRIC_DIMENSIONS  — array of { name, weight, source, scorer }
 *   scoreRubric({ projectRoot, since }) — runs each scorer, returns
 *     [{ dimension, score, evidence, weight }]
 *
 * Rubric purpose:
 *   For a generation (a complete dev session ending in a closed milestone),
 *   score: total entropy, peak entropy, entropy decay rate, discipline
 *   weighted by entropy.
 *
 * Each RUBRIC_DIMENSION:
 *   name    — identifier (matches benchmark suite input names)
 *   weight  — contribution to composite rubric score (sums to 1.0)
 *   source  — where data comes from (human-readable)
 *   scorer  — function({ projectRoot, sinceMs, untilMs }) => { score, evidence }
 *             score is normalized 0-1 where 1.0 = best / cleanest execution
 */

const fs = require('fs');
const path = require('path');
const { runBenchmark, crossGenerationCompare } = require('./benchmark.cjs');

// ── scorer helpers ────────────────────────────────────────────────────────────

function tryReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function readJsonlFile(filePath, limit = 10000) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/).filter(Boolean).slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch {
    return [];
  }
}

function inWindow(tsStr, sinceMs, untilMs) {
  if (!tsStr) return false;
  const t = Date.parse(tsStr);
  if (!Number.isFinite(t)) return false;
  if (sinceMs && t < sinceMs) return false;
  if (untilMs && t > untilMs) return false;
  return true;
}

// ── scorers ───────────────────────────────────────────────────────────────────

/**
 * DIMENSION: total-entropy
 * Lower H_total is better. Score = 1 - H_total.
 */
function scoreTotalEntropy({ projectRoot, sinceMs, untilMs }) {
  const since = sinceMs
    ? new Date(sinceMs).toISOString().slice(0, 10)
    : '7d';
  try {
    const bench = runBenchmark({ projectRoot, since });
    const score = Math.max(0, 1 - bench.H_total);
    return {
      score: Math.round(score * 1000) / 1000,
      evidence: `H=${bench.H} D=${bench.D} H_total=${bench.H_total}`,
    };
  } catch (err) {
    return { score: 0, evidence: `error: ${err.message}` };
  }
}

/**
 * DIMENSION: peak-entropy
 * Looks at daily H snapshots and reports the peak. Lower peak = better.
 * When no daily breakdown is available, falls back to current benchmark value.
 * Score = 1 - peak_H_total.
 */
function scorePeakEntropy({ projectRoot, sinceMs, untilMs }) {
  // Without a time-series of daily benchmarks, we approximate peak as current.
  // A future phase can wire daily snapshots into .planning/.entropy-log/*.jsonl.
  const since = sinceMs
    ? new Date(sinceMs).toISOString().slice(0, 10)
    : '7d';
  try {
    const bench = runBenchmark({ projectRoot, since });
    const peak = bench.H_total; // approximation until daily logging is wired
    const score = Math.max(0, 1 - peak);
    return {
      score: Math.round(score * 1000) / 1000,
      evidence: `peak_H_total=${peak} (approximated from current snapshot; daily log wired in phase 107)`,
    };
  } catch (err) {
    return { score: 0, evidence: `error: ${err.message}` };
  }
}

/**
 * DIMENSION: entropy-decay-rate
 * Measures whether entropy trends downward across the session.
 * Requires at least 2 data points. Positive decay = entropy decreasing = better.
 * Score = clamp(decay_rate_normalized, 0, 1).
 *
 * Approximation: compare first-half vs second-half of the window.
 */
function scoreEntropyDecayRate({ projectRoot, sinceMs, untilMs }) {
  if (!sinceMs) {
    return { score: 0.5, evidence: 'no sinceMs — cannot compute decay; neutral 0.5 assigned' };
  }
  const now = untilMs || Date.now();
  const mid = Math.floor((sinceMs + now) / 2);

  try {
    const firstHalfSince = new Date(sinceMs).toISOString().slice(0, 10);
    const secondHalfSince = new Date(mid).toISOString().slice(0, 10);

    const bench1 = runBenchmark({ projectRoot, since: firstHalfSince });
    const bench2 = runBenchmark({ projectRoot, since: secondHalfSince });

    const decay = bench1.H_total - bench2.H_total; // positive = entropy dropped
    // Normalize: decay of >=0.3 = score 1.0, decay <=-0.3 = score 0.0
    const score = Math.max(0, Math.min(1, (decay + 0.3) / 0.6));

    return {
      score: Math.round(score * 1000) / 1000,
      evidence: `first_half_H=${bench1.H_total} second_half_H=${bench2.H_total} decay=${Math.round(decay * 1000) / 1000}`,
    };
  } catch (err) {
    return { score: 0.5, evidence: `error: ${err.message}; neutral assigned` };
  }
}

/**
 * DIMENSION: discipline-weighted-by-entropy
 * When H_total is high, discipline failures matter more. When H_total is low,
 * discipline failures are less penalizing (the work is already clean).
 * Score = 1 - (discipline_fail_rate * H_total_weight)
 *
 * discipline_fail_rate: failed discipline events / total log events in window
 * H_total_weight: H_total (acts as amplifier)
 */
function scoreDisciplineWeightedByEntropy({ projectRoot, sinceMs, untilMs }) {
  const since = sinceMs
    ? new Date(sinceMs).toISOString().slice(0, 10)
    : '7d';
  try {
    const bench = runBenchmark({ projectRoot, since });
    const discFails = bench.inputs.disciplineFailEvents || 0;

    // Count total log events in window for denominator
    const logsDir = path.join(projectRoot, '.planning', '.gad-log');
    let totalEvents = 0;
    for (const fname of tryReadDir(logsDir).filter((f) => f.endsWith('.jsonl'))) {
      const events = readJsonlFile(path.join(logsDir, fname), 10000);
      for (const e of events) {
        if (e && inWindow(e.ts, sinceMs, untilMs)) totalEvents++;
      }
    }

    const failRate = totalEvents > 0 ? discFails / totalEvents : 0;
    const penalty = failRate * bench.H_total; // amplified when entropy is high
    const score = Math.max(0, 1 - penalty * 10); // scale: 10% penalty at 10% fail + H=1

    return {
      score: Math.round(score * 1000) / 1000,
      evidence: `disc_fails=${discFails} total_events=${totalEvents} fail_rate=${Math.round(failRate * 1000) / 1000} H_total=${bench.H_total}`,
    };
  } catch (err) {
    return { score: 0, evidence: `error: ${err.message}` };
  }
}

/**
 * DIMENSION: handoff-flow-efficiency
 * Ratio of successfully claimed+closed handoffs vs total. High retry = low score.
 * Score = 1 - (retry_count / max(claimed+open, 1))
 */
function scoreHandoffFlowEfficiency({ projectRoot, sinceMs, untilMs }) {
  const claimedDir = path.join(projectRoot, '.planning', 'handoffs', 'claimed');
  const closedDir = path.join(projectRoot, '.planning', 'handoffs', 'closed');
  const openDir = path.join(projectRoot, '.planning', 'handoffs', 'open');

  let totalHandoffs = 0;
  let totalRetries = 0;

  function countHandoffs(dir) {
    for (const fname of tryReadDir(dir).filter((f) => f.endsWith('.md'))) {
      try {
        const body = fs.readFileSync(path.join(dir, fname), 'utf8');
        const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) { totalHandoffs++; return; }
        const fm = fmMatch[1];

        const createdMatch = fm.match(/^created_at:\s*(.+)$/m);
        if (createdMatch && sinceMs) {
          if (Date.parse(createdMatch[1].trim()) < sinceMs) return;
        }

        totalHandoffs++;
        const unclaimMatch = fm.match(/^unclaim_history:\s*(.+)$/m);
        if (unclaimMatch) {
          try {
            const arr = JSON.parse(unclaimMatch[1]);
            if (Array.isArray(arr)) totalRetries += arr.length;
          } catch { /* ignore */ }
        }
      } catch { totalHandoffs++; }
    }
  }

  countHandoffs(claimedDir);
  countHandoffs(closedDir);
  countHandoffs(openDir);

  const retryRatio = totalHandoffs > 0 ? totalRetries / totalHandoffs : 0;
  const score = Math.max(0, 1 - retryRatio);

  return {
    score: Math.round(score * 1000) / 1000,
    evidence: `total_handoffs=${totalHandoffs} total_retries=${totalRetries} retry_ratio=${Math.round(retryRatio * 1000) / 1000}`,
  };
}

/**
 * DIMENSION: decomposition-diversity
 * Higher diversity means richer skill expression. Score = D directly.
 */
function scoreDecompositionDiversity({ projectRoot, sinceMs }) {
  const since = sinceMs
    ? new Date(sinceMs).toISOString().slice(0, 10)
    : '7d';
  try {
    const bench = runBenchmark({ projectRoot, since });
    return {
      score: bench.D,
      evidence: `D=${bench.D} unique_seqs=${bench.inputs.totalSessions}`,
    };
  } catch (err) {
    return { score: 0, evidence: `error: ${err.message}` };
  }
}

// ── RUBRIC_DIMENSIONS ─────────────────────────────────────────────────────────

/**
 * The canonical rubric dimensions for a generation evaluation.
 * Weights sum to 1.0.
 */
const RUBRIC_DIMENSIONS = [
  {
    name: 'total-entropy',
    weight: 0.30,
    source: 'benchmark.cjs runBenchmark — H_total from pressure-event distribution + diversity',
    scorer: scoreTotalEntropy,
  },
  {
    name: 'peak-entropy',
    weight: 0.15,
    source: 'benchmark.cjs runBenchmark — peak H_total within window (approx until daily log phase)',
    scorer: scorePeakEntropy,
  },
  {
    name: 'entropy-decay-rate',
    weight: 0.20,
    source: 'benchmark.cjs — first-half vs second-half H_total comparison',
    scorer: scoreEntropyDecayRate,
  },
  {
    name: 'discipline-weighted-by-entropy',
    weight: 0.20,
    source: '.planning/.gad-log discipline-rule-fail events × H_total amplifier',
    scorer: scoreDisciplineWeightedByEntropy,
  },
  {
    name: 'handoff-flow-efficiency',
    weight: 0.10,
    source: '.planning/handoffs/{open,claimed,closed} unclaim_history counts',
    scorer: scoreHandoffFlowEfficiency,
  },
  {
    name: 'decomposition-diversity',
    weight: 0.05,
    source: 'v2.cjs computeEntropyV2 — unique_sequences / total_sequences from telemetry',
    scorer: scoreDecompositionDiversity,
  },
];

// Verify weights sum to 1.0 (tolerance for floating-point)
const weightSum = RUBRIC_DIMENSIONS.reduce((acc, d) => acc + d.weight, 0);
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(`RUBRIC_DIMENSIONS weights sum to ${weightSum}, expected 1.0`);
}

// ── scoreRubric ───────────────────────────────────────────────────────────────

/**
 * Run all rubric dimensions and return scored results.
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot] — defaults to process.cwd()
 * @param {string}  [opts.since]       — "7d", "30d", or "YYYY-MM-DD"
 * @returns {Array<{ dimension, score, evidence, weight }>}
 */
function scoreRubric({ projectRoot, since } = {}) {
  const root = projectRoot || process.cwd();
  const sinceMs = since
    ? (() => {
        const daysMatch = String(since).match(/^(\d+)d$/i);
        if (daysMatch) return Date.now() - Number(daysMatch[1]) * 86400_000;
        const ts = Date.parse(since);
        return Number.isFinite(ts) ? ts : null;
      })()
    : null;
  const untilMs = Date.now();

  return RUBRIC_DIMENSIONS.map((dim) => {
    let result;
    try {
      result = dim.scorer({ projectRoot: root, sinceMs, untilMs });
    } catch (err) {
      result = { score: 0, evidence: `scorer threw: ${err.message}` };
    }
    return {
      dimension: dim.name,
      weight: dim.weight,
      score: result.score,
      evidence: result.evidence,
    };
  });
}

module.exports = {
  RUBRIC_DIMENSIONS,
  scoreRubric,
};
