'use strict';
/**
 * Quota-exhaustion cascade replay tests (phase 106-08).
 *
 * Simulates a multi-runtime failover scenario:
 *   1. claude-code worker hits rate limit
 *   2. Work cascades to codex-cli worker
 *   3. codex-cli also rate-limited
 *   4. Final fallback to gemini-cli worker which completes successfully
 *
 * Verifies that runtime-budget tracks the chain correctly:
 *   - predictNextRateLimit returns useful ETAs for the exhausted runtimes
 *   - persistBudgetSnapshot captures per-worker totals across the cascade
 *   - costPerHandoff buckets handoffs by runtime without losing cross-
 *     runtime context
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  aggregateWorkerTokens,
  predictNextRateLimit,
  persistBudgetSnapshot,
  costPerHandoff,
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
 * Build a complete handoff sequence for a worker.
 */
function buildHandoff({ handoffId, runtime, ts, tokens, durationMs, rateLimited }) {
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
// Cascade simulation
// ---------------------------------------------------------------------------

/**
 * Lay down a 3-worker cascade where the same logical task hops:
 *   w-claude (claude-code) → rate-limit
 *   w-codex (codex-cli)    → rate-limit
 *   w-gemini (gemini-cli)  → success
 *
 * Returns the projectRoot.
 */
function buildCascadeFixture() {
  const root = mkProjectRoot('runtime-budget-cascade-');
  const now = Date.now();
  const t0 = new Date(now - 120 * 60 * 1000).toISOString();  // 2h ago
  const t1 = new Date(now - 90 * 60 * 1000).toISOString();   // 90m ago
  const t2 = new Date(now - 60 * 60 * 1000).toISOString();   // 60m ago
  const t3 = new Date(now - 30 * 60 * 1000).toISOString();   // 30m ago

  // claude-code worker: 2 rate-limits earlier in window then 1 in this cascade
  writeWorkerLog(root, 'w-claude', [
    { kind: 'worker-start', runtime: 'claude-code', ts: t0 },
    ...buildHandoff({ handoffId: 'task-cascade-claude-prior-1', runtime: 'claude-code', ts: t0, tokens: 80000, durationMs: 45000, rateLimited: true }),
    ...buildHandoff({ handoffId: 'task-cascade-claude-prior-2', runtime: 'claude-code', ts: t1, tokens: 90000, durationMs: 60000, rateLimited: true }),
    ...buildHandoff({ handoffId: 'task-cascade-step-1', runtime: 'claude-code', ts: t2, tokens: 120000, durationMs: 75000, rateLimited: true }),
  ]);

  // codex-cli worker: caught the cascade, also rate-limited (twice prior, once now)
  writeWorkerLog(root, 'w-codex', [
    { kind: 'worker-start', runtime: 'codex-cli', ts: t0 },
    ...buildHandoff({ handoffId: 'task-cascade-codex-prior-1', runtime: 'codex-cli', ts: t0, tokens: 150000, durationMs: 90000, rateLimited: true }),
    ...buildHandoff({ handoffId: 'task-cascade-codex-prior-2', runtime: 'codex-cli', ts: t1, tokens: 180000, durationMs: 100000, rateLimited: true }),
    ...buildHandoff({ handoffId: 'task-cascade-step-2', runtime: 'codex-cli', ts: t3, tokens: 200000, durationMs: 120000, rateLimited: true }),
  ]);

  // gemini-cli worker: successful completion of the cascade
  writeWorkerLog(root, 'w-gemini', [
    { kind: 'worker-start', runtime: 'gemini-cli', ts: t0 },
    ...buildHandoff({ handoffId: 'task-cascade-step-3', runtime: 'gemini-cli', ts: t3, tokens: 75000, durationMs: 35000, rateLimited: false }),
  ]);

  return root;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('cascade: aggregateWorkerTokens captures all 7 handoffs across 3 runtimes', () => {
  const root = buildCascadeFixture();
  try {
    const recs = aggregateWorkerTokens({ projectRoot: root });
    assert.equal(recs.length, 7);

    const byRuntime = {};
    for (const r of recs) {
      byRuntime[r.runtime] = (byRuntime[r.runtime] || 0) + 1;
    }
    assert.equal(byRuntime['claude-code'], 3);
    assert.equal(byRuntime['codex-cli'], 3);
    assert.equal(byRuntime['gemini-cli'], 1);

    // The final cascade step succeeded (no rate limit) on gemini-cli
    const finalStep = recs.find((r) => r.handoffId === 'task-cascade-step-3');
    assert.ok(finalStep, 'final step recorded');
    assert.equal(finalStep.rateLimited, false);
    assert.equal(finalStep.totalTokens, 75000);
  } finally {
    cleanup(root);
  }
});

test('cascade: predictNextRateLimit reports ETA for each exhausted runtime', () => {
  const root = buildCascadeFixture();
  try {
    const claudePred = predictNextRateLimit({ workerId: 'w-claude', projectRoot: root });
    assert.notEqual(claudePred.etaSeconds, null, 'claude eta computed');
    assert.equal(claudePred.eventsInWindow, 3);
    assert.ok(claudePred.meanIntervalMs > 0, 'mean interval positive');

    const codexPred = predictNextRateLimit({ workerId: 'w-codex', projectRoot: root });
    assert.notEqual(codexPred.etaSeconds, null, 'codex eta computed');
    assert.equal(codexPred.eventsInWindow, 3);

    // gemini didn't rate-limit → null eta with reason
    const geminiPred = predictNextRateLimit({ workerId: 'w-gemini', projectRoot: root });
    assert.equal(geminiPred.etaSeconds, null);
    assert.match(geminiPred.reason, /no rate-limit history/i);
  } finally {
    cleanup(root);
  }
});

test('cascade: predictNextRateLimit with no workerId aggregates across all workers', () => {
  const root = buildCascadeFixture();
  try {
    const allPred = predictNextRateLimit({ projectRoot: root });
    // 6 rate-limit events across all workers (3 claude + 3 codex)
    assert.equal(allPred.eventsInWindow, 6);
    assert.notEqual(allPred.etaSeconds, null);
    assert.ok(allPred.meanIntervalMs > 0);
  } finally {
    cleanup(root);
  }
});

test('cascade: persistBudgetSnapshot captures per-worker totals + rate-limit counts', () => {
  const root = buildCascadeFixture();
  try {
    const result = persistBudgetSnapshot({ projectRoot: root });
    assert.equal(result.written, true);

    // Read back and validate shape
    const raw = fs.readFileSync(result.path, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    const snap = JSON.parse(lines[0]);

    assert.equal(snap.totalHandoffs, 7);
    assert.equal(snap.totalRateLimitEvents, 6);

    // Per-worker breakdown — find each worker in the snapshot
    const wClaude = snap.workers.find((w) => w.workerId === 'w-claude');
    const wCodex = snap.workers.find((w) => w.workerId === 'w-codex');
    const wGemini = snap.workers.find((w) => w.workerId === 'w-gemini');
    assert.ok(wClaude && wCodex && wGemini, 'all 3 workers present in snapshot');

    assert.equal(wClaude.runtime, 'claude-code');
    assert.equal(wClaude.totalHandoffs, 3);
    assert.equal(wClaude.rateLimitCount, 3);
    assert.equal(wClaude.totalTokens, 80000 + 90000 + 120000);

    assert.equal(wCodex.runtime, 'codex-cli');
    assert.equal(wCodex.rateLimitCount, 3);
    assert.equal(wCodex.totalTokens, 150000 + 180000 + 200000);

    assert.equal(wGemini.runtime, 'gemini-cli');
    assert.equal(wGemini.rateLimitCount, 0);
    assert.equal(wGemini.totalTokens, 75000);
  } finally {
    cleanup(root);
  }
});

test('cascade: costPerHandoff(byRuntime=true) preserves runtime separation through the chain', () => {
  const root = buildCascadeFixture();
  try {
    const rows = costPerHandoff({ projectRoot: root, byRuntime: true });
    const runtimesSeen = new Set(rows.map((r) => r.runtime));
    assert.ok(runtimesSeen.has('claude-code'));
    assert.ok(runtimesSeen.has('codex-cli'));
    assert.ok(runtimesSeen.has('gemini-cli'));

    // Tally token totals per runtime via the buckets
    const totals = {};
    for (const r of rows) {
      totals[r.runtime] = (totals[r.runtime] || 0) + r.totalTokens;
    }
    assert.equal(totals['claude-code'], 80000 + 90000 + 120000);
    assert.equal(totals['codex-cli'], 150000 + 180000 + 200000);
    assert.equal(totals['gemini-cli'], 75000);
  } finally {
    cleanup(root);
  }
});

test('cascade: subsequent persistBudgetSnapshot calls append to the same JSONL (audit trail)', () => {
  const root = buildCascadeFixture();
  try {
    persistBudgetSnapshot({ projectRoot: root });
    persistBudgetSnapshot({ projectRoot: root });
    const outPath = path.join(root, '.planning', '.gad-log', 'token-budgets.jsonl');
    const raw = fs.readFileSync(outPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    assert.equal(lines.length, 2, 'two append-only snapshots');
    // Each line is independently parseable
    for (const line of lines) {
      const obj = JSON.parse(line);
      assert.equal(obj.totalHandoffs, 7);
    }
  } finally {
    cleanup(root);
  }
});
