'use strict';
/**
 * lib/runtime-budget/index.cjs
 *
 * Runtime budget prediction + token-cost dimension for gad.
 * CJS-native, built-ins only, no external deps.
 *
 * Exports:
 *   aggregateWorkerTokens({ projectRoot, since })
 *     → Array<{ workerId, runtime, session, handoffId, ts, totalTokens, rateLimited, durationMs }>
 *
 *   predictNextRateLimit({ workerId, projectRoot, history })
 *     → { etaSeconds, rateTokensPerHour, threshold, workerId }
 *       | { etaSeconds: null, reason: string }
 *
 *   costPerHandoff({ projectRoot, since, byRuntime })
 *     → Array<{ runtime, contextTier, timeTier, count, totalTokens, avgTokens }>
 *
 *   histogram({ projectRoot, taskShape, since })
 *     → { p50, p90, p99, mean, n }
 *
 *   persistBudgetSnapshot({ projectRoot })
 *     → { written: boolean, path: string }
 *
 * Token source: worker log `subproc-stderr` entries containing "tokens used"
 * followed by a numeric value, emitted by codex-cli at the end of each run.
 * These appear immediately before `work-complete` events.
 *
 * Rate-limit history comes from `runtime-rate-limit-on-call` events.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Read a JSONL file, return parsed lines. Never throws.
 */
function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Parse timestamp to epoch ms. Returns null on failure.
 */
function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Find all worker log.jsonl files under .planning/team/workers/.
 * Returns Array<{ workerId, filePath }>.
 */
function discoverWorkerLogs(projectRoot) {
  const workerRoot = path.join(projectRoot, '.planning', 'team', 'workers');
  const result = [];
  if (!fs.existsSync(workerRoot)) return result;
  let entries;
  try { entries = fs.readdirSync(workerRoot, { withFileTypes: true }); } catch { return result; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const logPath = path.join(workerRoot, entry.name, 'log.jsonl');
    if (fs.existsSync(logPath)) result.push({ workerId: entry.name, filePath: logPath });
  }
  return result;
}

/**
 * Parse a comma-formatted number like "200,492" into 200492.
 * Returns null if not parseable as a positive integer.
 */
function parseTokenCount(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/,/g, '').trim();
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Extract per-handoff token + rate-limit events from one worker log file.
 *
 * Strategy:
 *   - Track the active handoff from work-start events.
 *   - Accumulate subproc-stderr "tokens used\n<count>" patterns into tokenBuf.
 *   - On work-complete, attach accumulated token count to the handoff record.
 *   - On runtime-rate-limit-on-call, flag the current handoff as rate-limited.
 *
 * Returns Array<HandoffRecord>:
 *   { workerId, runtime, handoffId, ts, totalTokens, rateLimited, durationMs }
 */
function parseWorkerLogTokens(workerId, filePath) {
  const lines = readJsonl(filePath);
  const records = [];

  // runtime comes from worker-start or individual events
  let defaultRuntime = null;
  // Current in-flight handoff state
  let activeHandoffId = null;
  let activeRuntime = null;
  let activeStartTs = null;
  // Token accumulation: codex emits "tokens used" then "\n<count>\n" as two separate stderr entries
  let expectingTokenCount = false;
  let accumulatedTokens = 0;
  let hasTokens = false;
  let rateLimitedCurrent = false;

  function flushHandoff(completeTs, durationMs) {
    if (!activeHandoffId) return;
    records.push({
      workerId,
      runtime: activeRuntime || defaultRuntime,
      handoffId: activeHandoffId,
      ts: completeTs || activeStartTs,
      totalTokens: hasTokens ? accumulatedTokens : null,
      rateLimited: rateLimitedCurrent,
      durationMs: durationMs != null ? durationMs : null,
    });
    activeHandoffId = null;
    activeRuntime = null;
    activeStartTs = null;
    accumulatedTokens = 0;
    hasTokens = false;
    rateLimitedCurrent = false;
    expectingTokenCount = false;
  }

  for (const entry of lines) {
    if (!entry || !entry.kind) continue;

    switch (entry.kind) {
      case 'worker-start': {
        defaultRuntime = entry.runtime || null;
        break;
      }

      case 'work-start': {
        // Flush any in-progress handoff without completion data
        if (activeHandoffId) flushHandoff(entry.ts, null);
        activeHandoffId = entry.ref || null;
        activeRuntime = entry.runtime || (entry.runtime_cmd ? inferRuntime(entry.runtime_cmd) : null) || null;
        activeStartTs = entry.ts || null;
        accumulatedTokens = 0;
        hasTokens = false;
        rateLimitedCurrent = false;
        expectingTokenCount = false;
        break;
      }

      case 'subproc-stderr': {
        // Codex emits token count as:
        //   {"kind":"subproc-stderr","data":"tokens used"}
        //   {"kind":"subproc-stderr","data":"\n200,492\n"}
        // Or sometimes combined as:
        //   {"kind":"subproc-stderr","data":"tokens used\n200,492\n"}
        const data = entry.data || '';
        if (expectingTokenCount) {
          const count = parseTokenCount(data);
          if (count !== null) {
            accumulatedTokens += count;
            hasTokens = true;
          }
          expectingTokenCount = false;
          break;
        }
        // Check for combined "tokens used\n<n>" pattern
        const combinedMatch = data.match(/tokens used\s*\n\s*([\d,]+)/);
        if (combinedMatch) {
          const count = parseTokenCount(combinedMatch[1]);
          if (count !== null) {
            accumulatedTokens += count;
            hasTokens = true;
          }
          break;
        }
        // Just "tokens used" — next entry will have the count
        if (/tokens used\s*$/.test(data.trim())) {
          expectingTokenCount = true;
        }
        break;
      }

      case 'runtime-rate-limit-on-call': {
        rateLimitedCurrent = true;
        // If this references a different handoff than active, patch it after flush
        break;
      }

      case 'work-complete': {
        const durationMs = typeof entry.duration_ms === 'number' ? entry.duration_ms : null;
        // Carry rate_limited flag from the event itself if present
        if (entry.rate_limited === true) rateLimitedCurrent = true;
        flushHandoff(entry.ts, durationMs);
        break;
      }

      default:
        break;
    }
  }

  // Flush any dangling in-progress handoff
  if (activeHandoffId) flushHandoff(null, null);

  return records;
}

/**
 * Infer runtime id from a command string.
 */
function inferRuntime(text) {
  const t = String(text || '').toLowerCase();
  if (t.includes('codex')) return 'codex-cli';
  if (t.includes('opencode')) return 'opencode';
  if (t.includes('cursor')) return 'cursor';
  if (t.includes('claude')) return 'claude-code';
  if (t.includes('gemini')) return 'gemini-cli';
  return null;
}

/**
 * Default project root: walk up from this file or use cwd.
 */
function detectProjectRoot() {
  let dir = path.resolve(__dirname, '..', '..', '..');
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(dir, '.planning', 'team', 'workers'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * Percentile helper. arr must be sorted ascending.
 */
function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

// ---------------------------------------------------------------------------
// Context tier + time tier classifiers (for costPerHandoff histogram)
// ---------------------------------------------------------------------------

/**
 * Context tier from token count:
 *   micro  < 10K
 *   small  10K-50K
 *   medium 50K-200K
 *   large  >= 200K
 */
function contextTier(tokens) {
  if (tokens == null) return 'unknown';
  if (tokens < 10000) return 'micro';
  if (tokens < 50000) return 'small';
  if (tokens < 200000) return 'medium';
  return 'large';
}

/**
 * Time tier from duration ms:
 *   quick  < 60s
 *   medium 60s-600s
 *   long   >= 600s
 */
function timeTier(durationMs) {
  if (durationMs == null) return 'unknown';
  const s = durationMs / 1000;
  if (s < 60) return 'quick';
  if (s < 600) return 'medium';
  return 'long';
}

// ---------------------------------------------------------------------------
// Rate-limit detection: parse rate-limit timestamps from worker logs
// ---------------------------------------------------------------------------

/**
 * Load rate-limit events for a specific worker (or all workers if workerId is null).
 * Returns Array<{ workerId, runtime, ts, handoffId }> sorted by ts ascending.
 */
function loadRateLimitHistory(projectRoot, workerId) {
  const logs = workerId
    ? (() => {
      const p = path.join(projectRoot, '.planning', 'team', 'workers', workerId, 'log.jsonl');
      return fs.existsSync(p) ? [{ workerId, filePath: p }] : [];
    })()
    : discoverWorkerLogs(projectRoot);

  const events = [];
  for (const { workerId: wid, filePath } of logs) {
    const lines = readJsonl(filePath);
    for (const entry of lines) {
      if (entry.kind !== 'runtime-rate-limit-on-call') continue;
      events.push({
        workerId: wid,
        runtime: entry.runtime || null,
        ts: entry.ts || null,
        handoffId: entry.ref || null,
      });
    }
  }

  events.sort((a, b) => {
    const ta = toMs(a.ts) || 0;
    const tb = toMs(b.ts) || 0;
    return ta - tb;
  });

  return events;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * aggregateWorkerTokens({ projectRoot, since })
 *
 * Walks all worker log.jsonl files, aggregates token usage per handoff.
 * since: ISO timestamp string; only include records at or after this time.
 *
 * Returns Array<HandoffRecord>:
 *   { workerId, runtime, handoffId, ts, totalTokens, rateLimited, durationMs }
 */
function aggregateWorkerTokens({ projectRoot, since } = {}) {
  const root = projectRoot || detectProjectRoot();
  const sinceMs = since ? toMs(since) : null;
  const logs = discoverWorkerLogs(root);
  const all = [];

  for (const { workerId, filePath } of logs) {
    const records = parseWorkerLogTokens(workerId, filePath);
    for (const rec of records) {
      if (sinceMs != null) {
        const recMs = toMs(rec.ts);
        if (recMs == null || recMs < sinceMs) continue;
      }
      all.push(rec);
    }
  }

  all.sort((a, b) => (toMs(a.ts) || 0) - (toMs(b.ts) || 0));
  return all;
}

/**
 * predictNextRateLimit({ workerId, projectRoot, history })
 *
 * Uses rate-limit event timestamps in the last 24h to estimate rate (events/hour).
 * If fewer than 2 events, returns { etaSeconds: null, reason: "no rate-limit history" }.
 * Otherwise estimates when the next rate-limit will occur based on current token burn rate.
 *
 * history: optional pre-loaded array from loadRateLimitHistory (for testing / caching).
 *
 * Returns:
 *   { etaSeconds: number, rateTokensPerHour: number, threshold: number, workerId: string }
 *   | { etaSeconds: null, reason: string }
 */
function predictNextRateLimit({ workerId, projectRoot, history } = {}) {
  const root = projectRoot || detectProjectRoot();
  const wid = workerId || null;
  const events = history || loadRateLimitHistory(root, wid);

  if (!events.length) {
    return { etaSeconds: null, reason: 'no rate-limit history' };
  }

  // Filter to last 24h
  const nowMs = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  const recent = events.filter((e) => {
    const ms = toMs(e.ts);
    return ms != null && nowMs - ms <= windowMs;
  });

  if (recent.length < 2) {
    return {
      etaSeconds: null,
      reason: recent.length === 0
        ? 'no rate-limit events in last 24h'
        : 'only 1 rate-limit event in last 24h (need ≥2 for interval estimate)',
    };
  }

  // Compute inter-event intervals to derive expected event cadence
  const intervals = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = toMs(recent[i - 1].ts);
    const curr = toMs(recent[i].ts);
    if (prev != null && curr != null) intervals.push(curr - prev);
  }

  const meanIntervalMs = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  const lastEventMs = toMs(recent[recent.length - 1].ts) || nowMs;
  const elapsedSinceLastMs = nowMs - lastEventMs;
  const etaMs = Math.max(0, meanIntervalMs - elapsedSinceLastMs);
  const etaSeconds = Math.round(etaMs / 1000);

  // Token burn rate: aggregate tokens from recent handoff records
  const tokenRecords = aggregateWorkerTokens({
    projectRoot: root,
    since: new Date(nowMs - windowMs).toISOString(),
  }).filter((r) => !wid || r.workerId === wid);

  const totalTokens = tokenRecords.reduce((s, r) => s + (r.totalTokens || 0), 0);
  const windowHours = windowMs / (60 * 60 * 1000);
  const rateTokensPerHour = Math.round(totalTokens / windowHours);

  // Threshold: estimate tokens consumed per rate-limit cycle
  const tokensPerCycle = rateTokensPerHour > 0 ? Math.round(rateTokensPerHour * (meanIntervalMs / (60 * 60 * 1000))) : null;

  return {
    etaSeconds,
    rateTokensPerHour,
    threshold: tokensPerCycle,
    workerId: wid,
    lastRateLimitAt: recent[recent.length - 1].ts,
    eventsInWindow: recent.length,
    meanIntervalMs: Math.round(meanIntervalMs),
  };
}

/**
 * costPerHandoff({ projectRoot, since, byRuntime })
 *
 * Joins handoff token records with context-tier + time-tier bucketing.
 * Returns a histogram per (runtime, contextTier, timeTier) bucket.
 *
 * byRuntime: if true, group by runtime (default: false → group by contextTier × timeTier only).
 *
 * Returns Array<{ runtime, contextTier, timeTier, count, totalTokens, avgTokens }>
 */
function costPerHandoff({ projectRoot, since, byRuntime = false } = {}) {
  const records = aggregateWorkerTokens({ projectRoot, since });

  // Group into buckets
  const bucketMap = new Map();
  for (const rec of records) {
    const ct = contextTier(rec.totalTokens);
    const tt = timeTier(rec.durationMs);
    const rt = byRuntime ? (rec.runtime || 'unknown') : 'all';
    const key = `${rt}|${ct}|${tt}`;
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { runtime: rt, contextTier: ct, timeTier: tt, count: 0, totalTokens: 0 });
    }
    const b = bucketMap.get(key);
    b.count += 1;
    b.totalTokens += rec.totalTokens || 0;
  }

  return Array.from(bucketMap.values()).map((b) => ({
    ...b,
    avgTokens: b.count > 0 ? Math.round(b.totalTokens / b.count) : 0,
  })).sort((a, b) => {
    if (a.runtime < b.runtime) return -1;
    if (a.runtime > b.runtime) return 1;
    return b.totalTokens - a.totalTokens;
  });
}

/**
 * histogram({ projectRoot, taskShape, since })
 *
 * Returns p50/p90/p99/mean/n of token-cost distribution.
 * taskShape: if provided, filters records by matching runtime or handoff shape.
 * (Worker logs don't carry task-shape metadata natively; we match by runtime prefix if taskShape
 *  corresponds to a known runtime id, otherwise return all.)
 *
 * Returns { p50, p90, p99, mean, n }
 */
function histogram({ projectRoot, taskShape, since } = {}) {
  let records = aggregateWorkerTokens({ projectRoot, since });

  // Filter by taskShape if provided (match against runtime or context tier label)
  if (taskShape) {
    const shape = String(taskShape).toLowerCase();
    // Match known runtime prefixes
    const runtimeMatch = ['codex-cli', 'gemini-cli', 'claude-code', 'opencode'].find((r) => r.startsWith(shape) || shape === r);
    if (runtimeMatch) {
      records = records.filter((r) => r.runtime === runtimeMatch);
    } else {
      // Match context tier label
      records = records.filter((r) => contextTier(r.totalTokens) === shape);
    }
  }

  const values = records
    .map((r) => r.totalTokens)
    .filter((v) => typeof v === 'number' && v >= 0)
    .sort((a, b) => a - b);

  if (!values.length) return { p50: null, p90: null, p99: null, mean: null, n: 0 };

  const mean = Math.round(values.reduce((s, v) => s + v, 0) / values.length);
  return {
    p50: percentile(values, 50),
    p90: percentile(values, 90),
    p99: percentile(values, 99),
    mean,
    n: values.length,
  };
}

/**
 * persistBudgetSnapshot({ projectRoot })
 *
 * Appends the current aggregated budget snapshot to
 * .planning/.gad-log/token-budgets.jsonl for time-series analysis.
 *
 * Returns { written: boolean, path: string }
 */
function persistBudgetSnapshot({ projectRoot } = {}) {
  const root = projectRoot || detectProjectRoot();
  const outPath = path.join(root, '.planning', '.gad-log', 'token-budgets.jsonl');

  const allRecords = aggregateWorkerTokens({ projectRoot: root });
  const rateEvents = loadRateLimitHistory(root, null);

  // Per-worker summary
  const byWorker = new Map();
  for (const rec of allRecords) {
    if (!byWorker.has(rec.workerId)) {
      byWorker.set(rec.workerId, { workerId: rec.workerId, runtime: rec.runtime, totalHandoffs: 0, totalTokens: 0, rateLimitCount: 0 });
    }
    const w = byWorker.get(rec.workerId);
    w.totalHandoffs += 1;
    w.totalTokens += rec.totalTokens || 0;
    if (rec.rateLimited) w.rateLimitCount += 1;
  }

  for (const ev of rateEvents) {
    if (byWorker.has(ev.workerId)) {
      // Already counted via work-complete flags; this is a belt-and-suspenders count
      // We store raw event count separately to not double-count
    }
  }

  const snap = {
    ts: new Date().toISOString(),
    totalHandoffs: allRecords.length,
    totalTokens: allRecords.reduce((s, r) => s + (r.totalTokens || 0), 0),
    totalRateLimitEvents: rateEvents.length,
    workers: Array.from(byWorker.values()),
    histAll: histogram({ projectRoot: root }),
    costByRuntime: costPerHandoff({ projectRoot: root, byRuntime: true }),
  };

  let written = false;
  try {
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(outPath, JSON.stringify(snap) + '\n', 'utf8');
    written = true;
  } catch {
    written = false;
  }

  return { written, path: outPath, snapshot: snap };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  aggregateWorkerTokens,
  predictNextRateLimit,
  costPerHandoff,
  histogram,
  persistBudgetSnapshot,
  // Internal helpers exposed for testing
  _internal: {
    parseWorkerLogTokens,
    parseTokenCount,
    contextTier,
    timeTier,
    loadRateLimitHistory,
    discoverWorkerLogs,
    percentile,
  },
};
