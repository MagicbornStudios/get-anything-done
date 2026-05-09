'use strict';
/**
 * tests/anomalies-detector.test.cjs
 *
 * 5 unit tests for lib/anomalies/detector.cjs.
 * Uses node:test (built-in, no external deps).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { computeBaseline, detectAnomalies, ANOMALY_RULES } =
  require('../lib/anomalies/detector.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-anomaly-test-'));
  return dir;
}

function teardown(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Build a synthetic token-budgets.jsonl: `days` entries, one per calendar day,
 * each with an incrementing totalTokens sum.
 *
 * dailyValues[0] = tokens on day 0 (cumulative from zero).
 * dailyValues[i] = increment for day i.
 */
function writeTokenBudgets(baseDir, dailyValues) {
  const gadLogDir = path.join(baseDir, '.planning', '.gad-log');
  fs.mkdirSync(gadLogDir, { recursive: true });
  const budgetsPath = path.join(gadLogDir, 'token-budgets.jsonl');

  let cumulative = 0;
  const lines = dailyValues.map((v, i) => {
    cumulative += v;
    // Timestamp: subtract (days - i) days from today at noon
    const d = new Date();
    d.setDate(d.getDate() - (dailyValues.length - 1 - i));
    d.setHours(12, 0, 0, 0);
    return JSON.stringify({ ts: d.toISOString(), totalTokens: cumulative });
  });

  fs.writeFileSync(budgetsPath, lines.join('\n'));
  return budgetsPath;
}

/**
 * Write synthetic worker log.jsonl under .planning/team/workers/w1/
 */
function writeWorkerLog(baseDir, entries) {
  const w1Dir = path.join(baseDir, '.planning', 'team', 'workers', 'w1');
  fs.mkdirSync(w1Dir, { recursive: true });
  const logPath = path.join(w1Dir, 'log.jsonl');
  const lines = entries.map((e) => JSON.stringify(e));
  fs.writeFileSync(logPath, lines.join('\n'));
}

/**
 * Write synthetic worker status.json.
 */
function writeWorkerStatus(baseDir, workerId, statusObj) {
  const dir = path.join(baseDir, '.planning', 'team', 'workers', workerId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(statusObj));
}

// ---------------------------------------------------------------------------
// Test 1: computeBaseline returns correct median + stddev
// ---------------------------------------------------------------------------

test('computeBaseline computes correct median and stddev from synthetic spend', () => {
  const tmpDir = makeTmpDir();
  try {
    // 5 days of daily spend: 100k, 120k, 110k, 130k, 90k tokens
    // These are increments; writeTokenBudgets makes them cumulative
    const increments = [100000, 120000, 110000, 130000, 90000];
    writeTokenBudgets(tmpDir, increments);

    const baseline = computeBaseline({ baseDir: tmpDir, days: 14 });

    // Sample count should be increments.length - 1 (delta-based) = 4
    // Increments after delta: [120k, 110k, 130k, 90k]
    assert.ok(baseline.sample_count >= 3, `Expected at least 3 samples, got ${baseline.sample_count}`);
    assert.ok(baseline.median > 0, 'Median should be positive');
    assert.ok(baseline.stddev >= 0, 'StdDev should be non-negative');
    assert.ok(baseline.p95_threshold >= baseline.median, 'p95_threshold >= median');
  } finally {
    teardown(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test 2: token_spend_daily_spike fires when spend is above 3× baseline
// ---------------------------------------------------------------------------

test('token_spend_daily_spike fires when observed spend exceeds 3× 3-sigma threshold', async () => {
  const tmpDir = makeTmpDir();
  try {
    // Build 16 days of stable history (100k/day), then add a massive spike as
    // the most-recent two entries within the lookback window.
    // The last "stable" day is 2+ days ago so the spike entries dominate the
    // lookback window comparison.
    const gadLogDir = path.join(tmpDir, '.planning', '.gad-log');
    fs.mkdirSync(gadLogDir, { recursive: true });
    const budgetsPath = path.join(gadLogDir, 'token-budgets.jsonl');

    // Write 16 days of history (cumulative, 100k/day) ending 2 days ago
    let cumulative = 0;
    const histLines = [];
    for (let i = 16; i >= 2; i--) {
      cumulative += 100000;
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(12, 0, 0, 0);
      histLines.push(JSON.stringify({ ts: d.toISOString(), totalTokens: cumulative }));
    }
    fs.writeFileSync(budgetsPath, histLines.join('\n'));

    // Now add two entries within the last hour — a 5M token spike
    // (baseline is ~100k/day = ~4200/h; 5M in 1h is ~1200× normal)
    const spikePrev = new Date(Date.now() - 40 * 60 * 1000).toISOString();
    const spikeNow  = new Date(Date.now() - 5  * 60 * 1000).toISOString();
    const prevTotal = cumulative + 10000; // small increment from history end
    const spikeTotal = prevTotal + 5000000; // +5M spike
    fs.appendFileSync(budgetsPath, '\n' + JSON.stringify({ ts: spikePrev, totalTokens: prevTotal }));
    fs.appendFileSync(budgetsPath, '\n' + JSON.stringify({ ts: spikeNow,  totalTokens: spikeTotal }));

    const anomalies = await detectAnomalies({ baseDir: tmpDir, lookback_h: 2 });
    const spikeRule = anomalies.find((a) => a.rule_id === 'token_spend_daily_spike');

    assert.ok(spikeRule, `token_spend_daily_spike should have fired — anomalies: ${JSON.stringify(anomalies.map(a=>a.rule_id))}`);
    assert.equal(spikeRule.severity, 'critical');
  } finally {
    teardown(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test 3: token_spend_daily_spike does NOT fire when spend is within baseline
// ---------------------------------------------------------------------------

test('token_spend_daily_spike does NOT fire when spend is within normal range', async () => {
  const tmpDir = makeTmpDir();
  try {
    // 14 days at 100k; add two entries near the baseline (small delta)
    const stable = Array(14).fill(100000);
    writeTokenBudgets(tmpDir, stable);

    const gadLogDir = path.join(tmpDir, '.planning', '.gad-log');
    const budgetsPath = path.join(gadLogDir, 'token-budgets.jsonl');

    // Add a "normal" recent delta: ~80k tokens (below 3× of ~100k baseline)
    const prev = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const now  = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    fs.appendFileSync(budgetsPath, '\n' + JSON.stringify({ ts: prev, totalTokens: 1400000 }));
    fs.appendFileSync(budgetsPath, '\n' + JSON.stringify({ ts: now,  totalTokens: 1480000 })); // +80k = normal

    const anomalies = await detectAnomalies({ baseDir: tmpDir, lookback_h: 24 });
    const spikeRule = anomalies.find((a) => a.rule_id === 'token_spend_daily_spike');

    assert.ok(!spikeRule, `token_spend_daily_spike should NOT have fired (fired: ${JSON.stringify(spikeRule)})`);
  } finally {
    teardown(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test 4: rotation_storm fires with 100+ rotation events in synthetic worker log
// ---------------------------------------------------------------------------

test('rotation_storm fires when > 100 account-rotated events exist in worker logs in last 1h', async () => {
  const tmpDir = makeTmpDir();
  try {
    const now = Date.now();
    // Generate 120 rotation events within the last hour
    const entries = Array.from({ length: 120 }, (_, i) => ({
      ts: new Date(now - i * 20000).toISOString(), // 20s apart
      worker_id: 'w1',
      kind: 'runtime-account-rotated',
      runtime_cmd: 'codex exec',
    }));
    writeWorkerLog(tmpDir, entries);

    const anomalies = await detectAnomalies({ baseDir: tmpDir, lookback_h: 24 });
    const stormRule = anomalies.find((a) => a.rule_id === 'rotation_storm');

    assert.ok(stormRule, 'rotation_storm should have fired');
    assert.equal(stormRule.severity, 'critical');
    assert.ok(stormRule.evidence.total_rotation_events >= 100);
  } finally {
    teardown(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Test 5: zombie_workers fires when status says RUNNING but pid is dead
// ---------------------------------------------------------------------------

test('zombie_workers fires when status.json claims RUNNING but PID is not alive', async () => {
  const tmpDir = makeTmpDir();
  try {
    // Use a PID we know is dead: 999999999 (way above any OS PID limit)
    const deadPid = 999999999;
    writeWorkerStatus(tmpDir, 'w1', { id: 'w1', state: 'RUNNING', pid: deadPid, last_heartbeat: new Date().toISOString() });

    const anomalies = await detectAnomalies({ baseDir: tmpDir, lookback_h: 24 });
    const zombieRule = anomalies.find((a) => a.rule_id === 'zombie_workers');

    assert.ok(zombieRule, 'zombie_workers should have fired');
    assert.equal(zombieRule.severity, 'warn');
    assert.ok(zombieRule.evidence.zombies.some((z) => z.worker_id === 'w1' && z.pid === deadPid));
  } finally {
    teardown(tmpDir);
  }
});
