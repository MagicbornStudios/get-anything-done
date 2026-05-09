'use strict';
/**
 * lib/anomalies/detector.cjs — rule-based anomaly detection for the GAD ecosystem.
 *
 * Closes the token-drain gap: 37M codex tokens burned over 6 days (2026-05-09
 * incident) while token-budgets.jsonl recorded the burn but no detection layer
 * fired. This module provides that layer.
 *
 * Exports:
 *   ANOMALY_RULES        — canonical rule set
 *   detectAnomalies()    — run all (or filtered) rules; return fired anomalies
 *   computeBaseline()    — derive median + stddev from historical spend data
 *   describeAnomaly()    — human-readable one-liner for an anomaly result
 */

const fs   = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Median of a numeric array. Returns 0 on empty. */
function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Population standard deviation. Returns 0 on empty or single-element. */
function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function readJsonlLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((l) => { try { return JSON.parse(l.trim()); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function readJsonSafe(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

/** Return mtime of a file in ms, or 0 if missing. */
function fileMtimeMs(filePath) {
  try { return fs.statSync(filePath).mtimeMs; } catch { return 0; }
}

/** Return file size in bytes, or 0 if missing. */
function fileSizeBytes(filePath) {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

// ---------------------------------------------------------------------------
// Compute Baseline
// ---------------------------------------------------------------------------

/**
 * Derive baseline statistics from token-budgets.jsonl over the last `days` days.
 *
 * Returns:
 *   { median, stddev, p95_threshold, samples, lookback_days }
 *
 * p95_threshold is used as the "normal" ceiling: exceed * 3 = spike.
 */
function computeBaseline({ baseDir, days = 14 } = {}) {
  const budgetsPath = path.join(baseDir, '.planning', '.gad-log', 'token-budgets.jsonl');
  const lines = readJsonlLines(budgetsPath);

  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  // Each line is a snapshot; derive per-day totals from totalTokens deltas
  // or use the raw totalTokens values as "spend-so-far" samples.
  // Since the file is a running aggregate we take daily max per calendar day.
  const dailyMax = {};
  for (const entry of lines) {
    if (!entry.ts || !entry.totalTokens) continue;
    const ts = new Date(entry.ts);
    if (ts.getTime() < cutoffMs) continue;
    const day = ts.toISOString().slice(0, 10);
    if (!dailyMax[day] || entry.totalTokens > dailyMax[day]) {
      dailyMax[day] = entry.totalTokens;
    }
  }

  // Convert to incremental daily spend (delta from previous day)
  const days_sorted = Object.keys(dailyMax).sort();
  const dailySpend = [];
  for (let i = 1; i < days_sorted.length; i++) {
    const delta = dailyMax[days_sorted[i]] - dailyMax[days_sorted[i - 1]];
    if (delta > 0) dailySpend.push(delta);
  }
  if (dailyMax[days_sorted[0]] && dailySpend.length === 0) {
    // Only one day recorded — use raw value as baseline seed
    dailySpend.push(dailyMax[days_sorted[0]]);
  }

  const med = median(dailySpend);
  const sd = stddev(dailySpend);
  const p95_threshold = med + 3 * sd; // 3-sigma upper bound

  return {
    median: med,
    stddev: sd,
    p95_threshold,
    samples: dailySpend,
    sample_count: dailySpend.length,
    lookback_days: days,
  };
}

// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------

/**
 * Read all worker log.jsonl files under .planning/team/workers/ and return
 * entries from the last `lookback_h` hours.
 */
function readWorkerLogEntries({ baseDir, lookback_h }) {
  const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
  if (!fs.existsSync(workersDir)) return [];
  const cutoffMs = Date.now() - lookback_h * 60 * 60 * 1000;
  const result = [];
  try {
    for (const w of fs.readdirSync(workersDir)) {
      const logPath = path.join(workersDir, w, 'log.jsonl');
      const entries = readJsonlLines(logPath).filter((e) => {
        if (!e.ts) return false;
        return new Date(e.ts).getTime() >= cutoffMs;
      });
      for (const e of entries) result.push({ ...e, _worker_id: w });
    }
  } catch {}
  return result;
}

/**
 * Check if a PID is alive. Cross-platform best-effort.
 */
function pidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// ANOMALY_RULES
// ---------------------------------------------------------------------------

const ANOMALY_RULES = [
  // ── 1. token_spend_daily_spike ────────────────────────────────────────────
  {
    id: 'token_spend_daily_spike',
    description: 'Daily premium-runtime token spend exceeded 3× the 14-day baseline (3-sigma rule). Indicates unexpected cost acceleration.',
    category: 'token_spend',
    severity: 'critical',
    async detect({ baseDir, projectid, lookback_h }) {
      const budgetsPath = path.join(baseDir, '.planning', '.gad-log', 'token-budgets.jsonl');
      const lines = readJsonlLines(budgetsPath);
      if (!lines.length) return { fired: false, evidence: { reason: 'no token-budgets.jsonl data' } };

      // Compute baseline over last 14 days
      const baseline = computeBaseline({ baseDir, days: 14 });

      // Get most recent two entries to compute incremental spend in the lookback window
      const cutoffMs = Date.now() - lookback_h * 60 * 60 * 1000;
      const recent = lines.filter((e) => e.ts && new Date(e.ts).getTime() >= cutoffMs);
      if (!recent.length) return { fired: false, evidence: { reason: 'no recent token-budget entries' } };

      // Spend = latest totalTokens - oldest within window
      const oldest = recent[0].totalTokens || 0;
      const newest = recent[recent.length - 1].totalTokens || 0;
      const observed_spend = newest - oldest;

      // Daily normalise: scale observed window to 24h
      const window_fraction = Math.min(lookback_h, 24) / 24;
      const daily_equivalent = window_fraction > 0 ? observed_spend / window_fraction : observed_spend;

      const threshold = baseline.p95_threshold * 3;
      const fired = threshold > 0 && daily_equivalent > threshold;

      return {
        fired,
        evidence: {
          observed_spend,
          daily_equivalent: Math.round(daily_equivalent),
          baseline_median: Math.round(baseline.median),
          baseline_stddev: Math.round(baseline.stddev),
          threshold: Math.round(threshold),
          window_h: lookback_h,
          sample_count: baseline.sample_count,
        },
      };
    },
  },

  // ── 2. rotation_storm ─────────────────────────────────────────────────────
  {
    id: 'rotation_storm',
    description: 'More than 100 runtime-account-rotated events in the last hour for a single runtime. Signals runaway rotation loops.',
    category: 'rate_limit',
    severity: 'critical',
    async detect({ baseDir, projectid, lookback_h }) {
      const entries = readWorkerLogEntries({ baseDir, lookback_h: 1 });
      const rotationEvents = entries.filter((e) =>
        e.kind === 'runtime-account-rotated' || e.kind === 'account-rotated'
      );

      // Group by runtime
      const byRuntime = {};
      for (const e of rotationEvents) {
        const rt = e.runtime || e.runtime_cmd || 'unknown';
        byRuntime[rt] = (byRuntime[rt] || 0) + 1;
      }

      const offenders = Object.entries(byRuntime).filter(([, count]) => count > 100);
      return {
        fired: offenders.length > 0,
        evidence: {
          offenders: offenders.map(([runtime, count]) => ({ runtime, count })),
          total_rotation_events: rotationEvents.length,
          window_h: 1,
        },
      };
    },
  },

  // ── 3. rate_limit_storm ───────────────────────────────────────────────────
  {
    id: 'rate_limit_storm',
    description: 'More than 50 rate-limit-detected-midstream events in the last hour for any runtime.',
    category: 'rate_limit',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const entries = readWorkerLogEntries({ baseDir, lookback_h: 1 });
      const rateLimitEvents = entries.filter((e) =>
        e.kind === 'rate-limit-detected-midstream' ||
        e.kind === 'runtime-rate-limit-on-call' ||
        e.rate_limited === true
      );

      const byRuntime = {};
      for (const e of rateLimitEvents) {
        const rt = e.runtime || e.runtime_cmd || 'unknown';
        byRuntime[rt] = (byRuntime[rt] || 0) + 1;
      }

      const offenders = Object.entries(byRuntime).filter(([, count]) => count > 50);
      return {
        fired: offenders.length > 0,
        evidence: {
          offenders: offenders.map(([runtime, count]) => ({ runtime, count })),
          total_rate_limit_events: rateLimitEvents.length,
          window_h: 1,
        },
      };
    },
  },

  // ── 4. stuck_claimed_handoff ──────────────────────────────────────────────
  {
    id: 'stuck_claimed_handoff',
    description: 'A handoff has been in claimed/ for more than 6 hours with no work-complete event. Possible worker death mid-task.',
    category: 'claim_lifecycle',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const claimedDir = path.join(baseDir, '.planning', 'handoffs', 'claimed');
      if (!fs.existsSync(claimedDir)) return { fired: false, evidence: { reason: 'no claimed/ directory' } };

      const STUCK_THRESHOLD_H = 6;
      const stuckMs = STUCK_THRESHOLD_H * 60 * 60 * 1000;
      const now = Date.now();
      const stuck = [];

      try {
        for (const fname of fs.readdirSync(claimedDir)) {
          const fpath = path.join(claimedDir, fname);
          if (!fs.statSync(fpath).isFile()) continue;
          const mtimeMs = fs.statSync(fpath).mtimeMs;
          const ageMs = now - mtimeMs;
          if (ageMs > stuckMs) {
            // Check worker logs for any work-complete event referencing this handoff id
            const handoffId = fname.replace(/\.md$/, '');
            const workerEntries = readWorkerLogEntries({ baseDir, lookback_h: STUCK_THRESHOLD_H });
            const hasCompletion = workerEntries.some((e) =>
              e.kind === 'work-complete' && e.ref && e.ref.includes(handoffId)
            );
            if (!hasCompletion) {
              stuck.push({ handoff_id: handoffId, age_h: Math.round(ageMs / 3600000 * 10) / 10 });
            }
          }
        }
      } catch {}

      return {
        fired: stuck.length > 0,
        evidence: { stuck_handoffs: stuck, threshold_h: STUCK_THRESHOLD_H },
      };
    },
  },

  // ── 5. claims_exceed_capacity ─────────────────────────────────────────────
  {
    id: 'claims_exceed_capacity',
    description: 'Number of claimed handoffs exceeds the count of live (non-stopped) workers. Work will pile up without resolution.',
    category: 'claim_lifecycle',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const claimedDir = path.join(baseDir, '.planning', 'handoffs', 'claimed');
      let claimedCount = 0;
      if (fs.existsSync(claimedDir)) {
        try {
          claimedCount = fs.readdirSync(claimedDir).filter((f) => f.endsWith('.md')).length;
        } catch {}
      }

      const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
      let liveWorkers = 0;
      if (fs.existsSync(workersDir)) {
        try {
          for (const w of fs.readdirSync(workersDir)) {
            const sp = path.join(workersDir, w, 'status.json');
            const status = readJsonSafe(sp);
            if (status && status.pid && pidAlive(status.pid) && status.state !== 'STOPPED') {
              liveWorkers++;
            }
          }
        } catch {}
      }

      const fired = claimedCount > 0 && claimedCount > liveWorkers;
      return {
        fired,
        evidence: { claimed_handoffs: claimedCount, live_workers: liveWorkers },
      };
    },
  },

  // ── 6. zombie_workers ─────────────────────────────────────────────────────
  {
    id: 'zombie_workers',
    description: 'Worker status.json says state=IDLE/WORKING/RUNNING but the declared PID is no longer alive in the OS process list.',
    category: 'process_lifecycle',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
      if (!fs.existsSync(workersDir)) return { fired: false, evidence: { reason: 'no workers dir' } };

      const ACTIVE_STATES = new Set(['IDLE', 'WORKING', 'RUNNING', 'STARTED']);
      const zombies = [];

      try {
        for (const w of fs.readdirSync(workersDir)) {
          const sp = path.join(workersDir, w, 'status.json');
          const status = readJsonSafe(sp);
          if (!status) continue;
          if (!ACTIVE_STATES.has(status.state)) continue;
          if (status.pid && !pidAlive(status.pid)) {
            zombies.push({ worker_id: w, pid: status.pid, state: status.state });
          }
        }
      } catch {}

      return {
        fired: zombies.length > 0,
        evidence: { zombies },
      };
    },
  },

  // ── 7. log_file_growth_spike ──────────────────────────────────────────────
  {
    id: 'log_file_growth_spike',
    description: 'A log file in .planning/.gad-log/ or a worker log.jsonl grew beyond 50 MB. Indicates runaway logging (w1 hit 88 MB on 2026-05-09).',
    category: 'file_growth',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const THRESHOLD_BYTES = 50 * 1024 * 1024; // 50 MB
      const large = [];

      // Check .planning/.gad-log/
      const gadLogDir = path.join(baseDir, '.planning', '.gad-log');
      if (fs.existsSync(gadLogDir)) {
        try {
          for (const f of fs.readdirSync(gadLogDir)) {
            const fp = path.join(gadLogDir, f);
            const size = fileSizeBytes(fp);
            if (size > THRESHOLD_BYTES) {
              large.push({ path: path.relative(baseDir, fp), size_mb: Math.round(size / 1024 / 1024 * 10) / 10 });
            }
          }
        } catch {}
      }

      // Check worker log.jsonl files
      const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
      if (fs.existsSync(workersDir)) {
        try {
          for (const w of fs.readdirSync(workersDir)) {
            const lp = path.join(workersDir, w, 'log.jsonl');
            const size = fileSizeBytes(lp);
            if (size > THRESHOLD_BYTES) {
              large.push({ path: path.relative(baseDir, lp), size_mb: Math.round(size / 1024 / 1024 * 10) / 10 });
            }
          }
        } catch {}
      }

      return {
        fired: large.length > 0,
        evidence: { large_files: large, threshold_mb: 50 },
      };
    },
  },

  // ── 8. unexpected_process_count ───────────────────────────────────────────
  {
    id: 'unexpected_process_count',
    description: 'The count of live workers with active PIDs significantly exceeds the worker registry count. May indicate zombie spawns (dozens of orphaned codex/gemini processes observed 2026-05-09).',
    category: 'process_lifecycle',
    severity: 'warn',
    async detect({ baseDir, projectid, lookback_h }) {
      const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
      if (!fs.existsSync(workersDir)) return { fired: false, evidence: { reason: 'no workers dir' } };

      let registeredWorkers = 0;
      let aliveCount = 0;

      try {
        const workerDirs = fs.readdirSync(workersDir).filter((w) => {
          try { return fs.statSync(path.join(workersDir, w)).isDirectory(); } catch { return false; }
        });
        registeredWorkers = workerDirs.length;
        for (const w of workerDirs) {
          const sp = path.join(workersDir, w, 'status.json');
          const status = readJsonSafe(sp);
          if (status && status.pid && pidAlive(status.pid)) aliveCount++;
        }
      } catch {}

      // Fire if alive workers is more than double registered count (and both >0)
      const MULTIPLIER = 2;
      const fired = registeredWorkers > 0 && aliveCount > registeredWorkers * MULTIPLIER;

      return {
        fired,
        evidence: {
          registered_workers: registeredWorkers,
          alive_count: aliveCount,
          multiplier_threshold: MULTIPLIER,
        },
      };
    },
  },
];

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

/**
 * Run all ANOMALY_RULES and return the array of fired anomalies.
 *
 * @param {object} opts
 * @param {string} opts.baseDir   — repo root (typically findRepoRoot())
 * @param {string} [opts.projectid]
 * @param {number} [opts.lookback_h=24]
 * @param {string} [opts.severity]   — filter to specific severity ('warn' | 'critical')
 * @returns {Promise<Array>}
 */
async function detectAnomalies({ baseDir, projectid = '', lookback_h = 24, severity = null } = {}) {
  const fired = [];
  const rules = severity
    ? ANOMALY_RULES.filter((r) => r.severity === severity)
    : ANOMALY_RULES;

  for (const rule of rules) {
    try {
      const result = await rule.detect({ baseDir, projectid, lookback_h });
      if (result.fired) {
        fired.push({
          rule_id: rule.id,
          category: rule.category,
          severity: rule.severity,
          description: rule.description,
          evidence: result.evidence || {},
          detected_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      // Rule failure should never crash the caller — log and continue
      fired.push({
        rule_id: rule.id,
        category: 'unknown',
        severity: 'info',
        description: `Rule ${rule.id} threw during detection: ${err.message}`,
        evidence: { error: err.message },
        detected_at: new Date().toISOString(),
      });
    }
  }

  return fired;
}

// ---------------------------------------------------------------------------
// describeAnomaly
// ---------------------------------------------------------------------------

const SEVERITY_PREFIX = { critical: 'CRITICAL', warn: 'WARN', info: 'INFO' };

/**
 * Return a human-readable one-liner for a fired anomaly.
 * @param {object} anomaly — element from detectAnomalies() result array
 * @returns {string}
 */
function describeAnomaly(anomaly) {
  const prefix = SEVERITY_PREFIX[anomaly.severity] || anomaly.severity.toUpperCase();
  const ev = anomaly.evidence || {};

  switch (anomaly.rule_id) {
    case 'token_spend_daily_spike':
      return `${prefix}: daily token spend ~${(ev.daily_equivalent || 0).toLocaleString()} tokens vs baseline ${(ev.threshold || 0).toLocaleString()} (3× 3-sigma). Window: ${ev.window_h}h.`;

    case 'rotation_storm': {
      const list = (ev.offenders || []).map((o) => `${o.runtime}:${o.count}`).join(', ');
      return `${prefix}: rotation storm — ${ev.total_rotation_events} events in 1h [${list || 'n/a'}].`;
    }

    case 'rate_limit_storm': {
      const list = (ev.offenders || []).map((o) => `${o.runtime}:${o.count}`).join(', ');
      return `${prefix}: rate-limit storm — ${ev.total_rate_limit_events} events in 1h [${list || 'n/a'}].`;
    }

    case 'stuck_claimed_handoff': {
      const ids = (ev.stuck_handoffs || []).map((h) => `${h.handoff_id}(${h.age_h}h)`).join(', ');
      return `${prefix}: ${(ev.stuck_handoffs || []).length} handoff(s) stuck in claimed/ >${ev.threshold_h}h: ${ids}.`;
    }

    case 'claims_exceed_capacity':
      return `${prefix}: ${ev.claimed_handoffs} claimed handoffs but only ${ev.live_workers} live workers — queue will block.`;

    case 'zombie_workers': {
      const ids = (ev.zombies || []).map((z) => `${z.worker_id}(pid ${z.pid}, state=${z.state})`).join(', ');
      return `${prefix}: ${(ev.zombies || []).length} zombie worker(s): ${ids}.`;
    }

    case 'log_file_growth_spike': {
      const files = (ev.large_files || []).map((f) => `${f.path}(${f.size_mb}MB)`).join(', ');
      return `${prefix}: ${(ev.large_files || []).length} log file(s) exceed ${ev.threshold_mb}MB: ${files}.`;
    }

    case 'unexpected_process_count':
      return `${prefix}: ${ev.alive_count} alive worker PIDs vs ${ev.registered_workers} registered (>${ev.multiplier_threshold}× expected).`;

    default:
      return `${prefix}: ${anomaly.description}`;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  ANOMALY_RULES,
  detectAnomalies,
  computeBaseline,
  describeAnomaly,
};
