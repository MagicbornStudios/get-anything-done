'use strict';
/**
 * Regression tests for lib/runtime-budget/index.cjs (phase 106-07).
 *
 * Covers the public surface:
 *   aggregateWorkerTokens — handoff records from worker log.jsonl
 *   histogram             — p50/p90/p99/mean from token distribution
 *   costPerHandoff        — bucket-by-(runtime,contextTier,timeTier)
 *   persistBudgetSnapshot — writes a valid JSONL line to .gad-log
 *   predictNextRateLimit  — ETA derivation from rate-limit events
 *
 * Uses node:test + node:assert/strict. No external deps. Fixtures are
 * synthesized in tmpdir() per-test (clean before each).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  aggregateWorkerTokens,
  histogram,
  costPerHandoff,
  persistBudgetSnapshot,
  predictNextRateLimit,
  _internal,
} = require('../lib/runtime-budget/index.cjs');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeWorkerLog(projectRoot, workerId, lines) {
  const dir = path.join(projectRoot, '.planning', 'team', 'workers', workerId);
  fs.mkdirSync(dir, { recursive: true });
  const content = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'log.jsonl'), content, 'utf8');
}

/**
 * Helper: synthesize a complete handoff log sequence for one worker.
 *   handoffId: ref tag, ts: ISO ts string, tokens: integer count, durationMs: number, rateLimited: bool
 * Emits: work-start, optional rate-limit, "tokens used" stderr pair, work-complete.
 */
function handoffLines({ handoffId, runtime, ts, tokens, durationMs, rateLimited }) {
  const lines = [
    { kind: 'work-start', ref: handoffId, runtime, ts },
  ];
  if (rateLimited) {
    lines.push({ kind: 'runtime-rate-limit-on-call', ref: handoffId, runtime, ts });
  }
  if (typeof tokens === 'number') {
    lines.push({ kind: 'subproc-stderr', data: 'tokens used' });
    lines.push({ kind: 'subproc-stderr', data: `\n${tokens.toLocaleString('en-US')}\n` });
  }
  lines.push({ kind: 'work-complete', ref: handoffId, ts, duration_ms: durationMs, rate_limited: !!rateLimited });
  return lines;
}

// ---------------------------------------------------------------------------
// 1. aggregateWorkerTokens — basic parse
// ---------------------------------------------------------------------------

test('aggregateWorkerTokens parses tokens, duration, and rate-limit flag from worker logs', () => {
  const root = mkProjectRoot('runtime-budget-agg-');
  try {
    const baseTs = '2026-05-17T10:00:00.000Z';
    const lines = [
      { kind: 'worker-start', runtime: 'codex-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-1', runtime: 'codex-cli', ts: baseTs, tokens: 50000, durationMs: 30000, rateLimited: false }),
      ...handoffLines({ handoffId: 'h-2', runtime: 'codex-cli', ts: '2026-05-17T10:30:00.000Z', tokens: 200000, durationMs: 120000, rateLimited: true }),
    ];
    writeWorkerLog(root, 'w1', lines);

    const recs = aggregateWorkerTokens({ projectRoot: root });
    assert.equal(recs.length, 2, 'two handoffs');
    assert.equal(recs[0].handoffId, 'h-1');
    assert.equal(recs[0].totalTokens, 50000);
    assert.equal(recs[0].rateLimited, false);
    assert.equal(recs[1].handoffId, 'h-2');
    assert.equal(recs[1].totalTokens, 200000);
    assert.equal(recs[1].rateLimited, true);
    assert.equal(recs[1].durationMs, 120000);
    assert.equal(recs[1].runtime, 'codex-cli');
  } finally {
    cleanup(root);
  }
});

test('aggregateWorkerTokens respects since= filter (ISO timestamp)', () => {
  const root = mkProjectRoot('runtime-budget-since-');
  try {
    const oldTs = '2026-05-10T00:00:00.000Z';
    const newTs = '2026-05-17T00:00:00.000Z';
    const lines = [
      { kind: 'worker-start', runtime: 'codex-cli', ts: oldTs },
      ...handoffLines({ handoffId: 'h-old', runtime: 'codex-cli', ts: oldTs, tokens: 10000, durationMs: 5000 }),
      ...handoffLines({ handoffId: 'h-new', runtime: 'codex-cli', ts: newTs, tokens: 80000, durationMs: 90000 }),
    ];
    writeWorkerLog(root, 'w1', lines);

    const recs = aggregateWorkerTokens({ projectRoot: root, since: '2026-05-15T00:00:00.000Z' });
    assert.equal(recs.length, 1);
    assert.equal(recs[0].handoffId, 'h-new');
  } finally {
    cleanup(root);
  }
});

test('aggregateWorkerTokens prefers work-complete token fields when runtimes report input/output counts', () => {
  const root = mkProjectRoot('runtime-budget-fields-');
  try {
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'claude-code', ts: '2026-05-17T10:00:00.000Z' },
      { kind: 'work-start', ref: 'h-fields', runtime: 'claude-code', ts: '2026-05-17T10:00:00.000Z' },
      {
        kind: 'work-complete',
        ref: 'h-fields',
        ts: '2026-05-17T10:01:00.000Z',
        duration_ms: 60000,
        rate_limited: false,
        tokens_input: 2048,
        tokens_output: 256,
        tokens_total: 2304,
      },
    ]);

    const recs = aggregateWorkerTokens({ projectRoot: root });
    assert.equal(recs.length, 1);
    assert.equal(recs[0].handoffId, 'h-fields');
    assert.equal(recs[0].inputTokens, 2048);
    assert.equal(recs[0].outputTokens, 256);
    assert.equal(recs[0].totalTokens, 2304);
  } finally {
    cleanup(root);
  }
});

test('aggregateWorkerTokens returns [] when no worker logs exist', () => {
  const root = mkProjectRoot('runtime-budget-empty-');
  try {
    const recs = aggregateWorkerTokens({ projectRoot: root });
    assert.deepStrictEqual(recs, []);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// 2. parseTokenCount internal helper — comma-formatted ints
// ---------------------------------------------------------------------------

test('parseTokenCount handles comma-formatted ints, trimmed strings, and rejects garbage', () => {
  const { parseTokenCount } = _internal;
  assert.equal(parseTokenCount('200,492'), 200492);
  assert.equal(parseTokenCount('  1,234,567  '), 1234567);
  assert.equal(parseTokenCount('42'), 42);
  assert.equal(parseTokenCount('0'), 0);
  assert.equal(parseTokenCount(''), null);
  assert.equal(parseTokenCount(null), null);
  assert.equal(parseTokenCount('not-a-number'), null);
});

// ---------------------------------------------------------------------------
// 3. histogram — p50/p90/p99/mean over known set
// ---------------------------------------------------------------------------

test('histogram returns p50/p90/p99/mean for a known-shape distribution', () => {
  const root = mkProjectRoot('runtime-budget-hist-');
  try {
    // 10 handoffs: tokens 10k,20k,30k,40k,50k,60k,70k,80k,90k,100k
    const lines = [{ kind: 'worker-start', runtime: 'codex-cli', ts: '2026-05-17T00:00:00.000Z' }];
    for (let i = 1; i <= 10; i++) {
      lines.push(...handoffLines({
        handoffId: `h-${i}`,
        runtime: 'codex-cli',
        ts: `2026-05-17T00:${String(i).padStart(2, '0')}:00.000Z`,
        tokens: i * 10000,
        durationMs: 30000,
      }));
    }
    writeWorkerLog(root, 'w1', lines);

    const hist = histogram({ projectRoot: root });
    assert.equal(hist.n, 10);
    assert.equal(hist.mean, 55000);  // arithmetic mean of 10k..100k = 55k
    // ceil(50/100 * 10) - 1 = idx 4 → values[4] = 50000
    assert.equal(hist.p50, 50000);
    // ceil(90/100 * 10) - 1 = idx 8 → values[8] = 90000
    assert.equal(hist.p90, 90000);
    // ceil(99/100 * 10) - 1 = idx 9 → values[9] = 100000
    assert.equal(hist.p99, 100000);
  } finally {
    cleanup(root);
  }
});

test('histogram returns zeroed shape when no records exist', () => {
  const root = mkProjectRoot('runtime-budget-hist-empty-');
  try {
    const hist = histogram({ projectRoot: root });
    assert.deepStrictEqual(hist, { p50: null, p90: null, p99: null, mean: null, n: 0 });
  } finally {
    cleanup(root);
  }
});

test('histogram filters by task-shape when shape matches a runtime id', () => {
  const root = mkProjectRoot('runtime-budget-hist-shape-');
  try {
    const baseTs = '2026-05-17T00:00:00.000Z';
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-cx-1', runtime: 'codex-cli', ts: baseTs, tokens: 50000, durationMs: 30000 }),
      ...handoffLines({ handoffId: 'h-cx-2', runtime: 'codex-cli', ts: baseTs, tokens: 70000, durationMs: 30000 }),
    ]);
    writeWorkerLog(root, 'w2', [
      { kind: 'worker-start', runtime: 'gemini-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-gm-1', runtime: 'gemini-cli', ts: baseTs, tokens: 999999, durationMs: 30000 }),
    ]);

    const codexOnly = histogram({ projectRoot: root, taskShape: 'codex-cli' });
    assert.equal(codexOnly.n, 2);
    assert.equal(codexOnly.mean, 60000);

    const allHist = histogram({ projectRoot: root });
    assert.equal(allHist.n, 3);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// 4. costPerHandoff — bucketing math
// ---------------------------------------------------------------------------

test('costPerHandoff groups by (runtime, contextTier, timeTier) and reports avgTokens', () => {
  const root = mkProjectRoot('runtime-budget-cph-');
  try {
    const baseTs = '2026-05-17T00:00:00.000Z';
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: baseTs },
      // 2 micro/quick handoffs (< 10K tokens, < 60s)
      ...handoffLines({ handoffId: 'h-m1', runtime: 'codex-cli', ts: baseTs, tokens: 5000, durationMs: 10000 }),
      ...handoffLines({ handoffId: 'h-m2', runtime: 'codex-cli', ts: baseTs, tokens: 7000, durationMs: 20000 }),
      // 1 large/long (>= 200K, >= 600s)
      ...handoffLines({ handoffId: 'h-L1', runtime: 'codex-cli', ts: baseTs, tokens: 300000, durationMs: 700000 }),
    ]);

    const rowsByRuntime = costPerHandoff({ projectRoot: root, byRuntime: true });
    assert.ok(rowsByRuntime.length >= 2);
    const microQuick = rowsByRuntime.find((r) => r.runtime === 'codex-cli' && r.contextTier === 'micro' && r.timeTier === 'quick');
    assert.ok(microQuick, 'micro/quick bucket present');
    assert.equal(microQuick.count, 2);
    assert.equal(microQuick.totalTokens, 12000);
    assert.equal(microQuick.avgTokens, 6000);

    const largeLong = rowsByRuntime.find((r) => r.runtime === 'codex-cli' && r.contextTier === 'large' && r.timeTier === 'long');
    assert.ok(largeLong, 'large/long bucket present');
    assert.equal(largeLong.count, 1);
    assert.equal(largeLong.totalTokens, 300000);
  } finally {
    cleanup(root);
  }
});

test('costPerHandoff with byRuntime=false collapses runtime to "all"', () => {
  const root = mkProjectRoot('runtime-budget-cph-all-');
  try {
    const baseTs = '2026-05-17T00:00:00.000Z';
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-1', runtime: 'codex-cli', ts: baseTs, tokens: 30000, durationMs: 90000 }),
    ]);
    writeWorkerLog(root, 'w2', [
      { kind: 'worker-start', runtime: 'gemini-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-2', runtime: 'gemini-cli', ts: baseTs, tokens: 40000, durationMs: 120000 }),
    ]);

    const rows = costPerHandoff({ projectRoot: root });  // byRuntime defaults false
    // Both handoffs are small/medium — should land in same bucket regardless of runtime
    const allRuntimes = rows.filter((r) => r.runtime === 'all');
    assert.ok(allRuntimes.length >= 1, 'rows are bucketed under runtime=all');
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    assert.equal(totalCount, 2);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// 5. persistBudgetSnapshot — writes a parseable JSONL line
// ---------------------------------------------------------------------------

test('persistBudgetSnapshot appends a parseable JSONL line to .planning/.gad-log/token-budgets.jsonl', () => {
  const root = mkProjectRoot('runtime-budget-persist-');
  try {
    const baseTs = '2026-05-17T00:00:00.000Z';
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: baseTs },
      ...handoffLines({ handoffId: 'h-1', runtime: 'codex-cli', ts: baseTs, tokens: 100000, durationMs: 60000 }),
    ]);

    const result = persistBudgetSnapshot({ projectRoot: root });
    assert.equal(result.written, true, 'snapshot persisted');
    assert.match(result.path, /token-budgets\.jsonl$/);
    assert.ok(fs.existsSync(result.path), 'output file created');

    // Validate JSONL content
    const raw = fs.readFileSync(result.path, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'one snapshot line written');
    const parsed = JSON.parse(lines[0]);
    assert.ok(typeof parsed.ts === 'string');
    assert.equal(parsed.totalHandoffs, 1);
    assert.equal(parsed.totalTokens, 100000);
    assert.ok(Array.isArray(parsed.workers));
    assert.equal(parsed.workers[0].workerId, 'w1');
    assert.equal(parsed.workers[0].totalTokens, 100000);
    assert.ok(parsed.histAll);
    assert.ok(parsed.costByRuntime);

    // Second call appends, doesn't overwrite
    persistBudgetSnapshot({ projectRoot: root });
    const raw2 = fs.readFileSync(result.path, 'utf8');
    assert.equal(raw2.split('\n').filter(Boolean).length, 2);
  } finally {
    cleanup(root);
  }
});

// ---------------------------------------------------------------------------
// 6. predictNextRateLimit — ETA from event cadence
// ---------------------------------------------------------------------------

test('predictNextRateLimit returns null+reason when no rate-limit history exists', () => {
  const root = mkProjectRoot('runtime-budget-predict-empty-');
  try {
    const result = predictNextRateLimit({ workerId: 'w1', projectRoot: root });
    assert.equal(result.etaSeconds, null);
    assert.match(result.reason, /no rate-limit history/i);
  } finally {
    cleanup(root);
  }
});

test('predictNextRateLimit returns null+reason when only 1 event in 24h window', () => {
  const root = mkProjectRoot('runtime-budget-predict-one-');
  try {
    const recentTs = new Date(Date.now() - 60 * 60 * 1000).toISOString();  // 1h ago
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: recentTs },
      { kind: 'runtime-rate-limit-on-call', ref: 'h-1', runtime: 'codex-cli', ts: recentTs },
    ]);
    const result = predictNextRateLimit({ workerId: 'w1', projectRoot: root });
    assert.equal(result.etaSeconds, null);
    assert.match(result.reason, /need.*2/i);
  } finally {
    cleanup(root);
  }
});

test('predictNextRateLimit derives ETA from mean interval of recent rate-limit events', () => {
  const root = mkProjectRoot('runtime-budget-predict-eta-');
  try {
    // Two rate-limit events 1h apart, last one 30 minutes ago → next ETA should
    // be roughly meanInterval(3600s) - elapsedSinceLast(1800s) = ~1800s.
    // Use raw events directly so we don't double-emit via handoffLines.
    const event1Ts = new Date(Date.now() - 90 * 60 * 1000).toISOString();  // 90m ago
    const event2Ts = new Date(Date.now() - 30 * 60 * 1000).toISOString();  // 30m ago
    writeWorkerLog(root, 'w1', [
      { kind: 'worker-start', runtime: 'codex-cli', ts: event1Ts },
      { kind: 'runtime-rate-limit-on-call', ref: 'h-1', runtime: 'codex-cli', ts: event1Ts },
      { kind: 'runtime-rate-limit-on-call', ref: 'h-2', runtime: 'codex-cli', ts: event2Ts },
    ]);

    const result = predictNextRateLimit({ workerId: 'w1', projectRoot: root });
    assert.notEqual(result.etaSeconds, null, 'eta computed');
    assert.equal(typeof result.etaSeconds, 'number');
    // mean interval ~3600s, elapsed since last ~1800s → eta ~1800s ± slack
    assert.ok(result.etaSeconds >= 1500 && result.etaSeconds <= 2100,
      `ETA ${result.etaSeconds}s should be ~1800s ± 300`);
    assert.ok(result.rateTokensPerHour >= 0);
    assert.equal(result.eventsInWindow, 2);
  } finally {
    cleanup(root);
  }
});
