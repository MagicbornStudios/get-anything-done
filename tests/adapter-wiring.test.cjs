'use strict';
/**
 * tests/adapter-wiring.test.cjs
 *
 * Verifies that the model_id + token extraction is wired end-to-end:
 *   (a) buildTelemetryPayload from runtime-substrate-core resolves correctly
 *       for a mocked claude-code stdout containing a real response envelope.
 *   (b) parseWorkerRecords (via telemetry.cjs collectTelemetryRecords) reads
 *       model_id from a work-complete log entry — i.e. a synthetic .gad-log
 *       work-complete entry with model_id populated reaches gad telemetry models.
 *   (c) worker-loop work-complete log shape includes model_id/tokens fields.
 *
 * No live CLIs. No daemon. No gad system start. (GAD-T-35-17)
 *
 * Run: node --test tests/adapter-wiring.test.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');

const SUBSTRATE_PATH = path.resolve(__dirname, '..', 'scripts', 'runtime-substrate-core.mjs');

// Synthetic claude-code stdout fixtures (--output-format json JSONL).
const CLAUDE_CODE_RESULT_STDOUT = [
  JSON.stringify({ type: 'system', subtype: 'init', session_id: 'abc123' }),
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    message: {
      id: 'msg_abc',
      model: 'claude-opus-4-7',
      content: [{ type: 'text', text: 'hello' }],
      usage: { input_tokens: 2048, output_tokens: 256 },
    },
    cost_usd: 0.01,
  }),
].join('\n');

const CODEX_RESULT_STDOUT = JSON.stringify({
  choices: [{ message: { content: 'ok' } }],
  model: 'gpt-5.4',
  usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
});

const EMPTY_STDOUT = '';

// ── A: buildTelemetryPayload from runtime-substrate-core ─────────────────────

describe('buildTelemetryPayload (substrate core)', () => {
  let substrate;

  test('loads substrate module', async () => {
    assert.ok(fs.existsSync(SUBSTRATE_PATH), `substrate not found at ${SUBSTRATE_PATH}`);
    substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    assert.ok(typeof substrate.buildTelemetryPayload === 'function', 'buildTelemetryPayload must be exported');
  });

  test('claude-code: extracts model_id + tokens from type=result JSONL stdout', async () => {
    if (!substrate) substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const payload = await substrate.buildTelemetryPayload('claude-code', CLAUDE_CODE_RESULT_STDOUT);
    assert.equal(payload.model_id, 'claude-opus-4-7');
    assert.equal(payload.tokens_in, 2048);
    assert.equal(payload.tokens_out, 256);
  });

  test('claude-code: empty stdout returns null fields', async () => {
    if (!substrate) substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const payload = await substrate.buildTelemetryPayload('claude-code', EMPTY_STDOUT);
    assert.equal(payload.model_id, null);
    assert.equal(payload.tokens_in, null);
    assert.equal(payload.tokens_out, null);
  });

  test('unknown runtimeId returns null fields gracefully', async () => {
    if (!substrate) substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const payload = await substrate.buildTelemetryPayload('mystery-runtime', CLAUDE_CODE_RESULT_STDOUT);
    assert.equal(payload.model_id, null);
    assert.equal(payload.tokens_in, null);
    assert.equal(payload.tokens_out, null);
  });

  test('null runtimeId returns null fields gracefully', async () => {
    if (!substrate) substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const payload = await substrate.buildTelemetryPayload(null, CLAUDE_CODE_RESULT_STDOUT);
    assert.equal(payload.model_id, null);
  });
});

// ── B: Synthetic gad-log work-complete entry → telemetry models rollup ────────
// We write a .gad-log JSONL file containing a work-complete entry with model_id,
// then run parseWorkerRecords to confirm the model field is populated.

describe('parseWorkerRecords reads model_id from work-complete entries', () => {
  // Load the parseWorkerRecords function via the collectTelemetryRecords export.
  // telemetry.cjs exports collectTelemetryRecords from its createTelemetryCommand factory.
  // We can access parseWorkerRecords via the module-level export at the bottom of telemetry.cjs.
  const TELEMETRY_PATH = path.resolve(__dirname, '..', 'bin', 'commands', 'telemetry.cjs');

  function mkPlanningDir() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-telemetry-wiring-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(path.join(planningDir, '.gad-log'), { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'team', 'workers', 'w1'), { recursive: true });
    return { tmpDir, planningDir };
  }

  test('work-complete entry with model_id propagates to telemetry record model field', () => {
    assert.ok(fs.existsSync(TELEMETRY_PATH), `telemetry.cjs not found at ${TELEMETRY_PATH}`);
    const { _private } = require(TELEMETRY_PATH);
    const collectTelemetryRecords = _private && _private.collectTelemetryRecords;
    assert.ok(typeof collectTelemetryRecords === 'function', 'collectTelemetryRecords must be in _private export');

    const { tmpDir, planningDir } = mkPlanningDir();
    try {
      // Write a worker log with a work-complete entry that has model_id populated
      // (as worker-loop will do after this PR).
      const workerLogDir = path.join(planningDir, 'team', 'workers', 'w1');
      fs.writeFileSync(
        path.join(workerLogDir, 'status.json'),
        JSON.stringify({ id: 'w1', runtime: 'claude-code' }),
      );
      const logLines = [
        { ts: '2026-05-08T10:00:00.000Z', worker_id: 'w1', kind: 'worker-start', runtime: 'claude-code' },
        { ts: '2026-05-08T10:01:00.000Z', worker_id: 'w1', kind: 'work-start', ref: 'h-test-35-17' },
        {
          ts: '2026-05-08T10:05:00.000Z',
          worker_id: 'w1',
          kind: 'work-complete',
          ref: 'h-test-35-17',
          exit_code: 0,
          rate_limited: false,
          duration_ms: 240000,
          stdout_bytes: 512,
          stderr_bytes: 64,
          model_id: 'claude-opus-4-7',
          tokens_in: 2048,
          tokens_out: 256,
        },
      ];
      fs.writeFileSync(
        path.join(workerLogDir, 'log.jsonl'),
        logLines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      );

      const records = collectTelemetryRecords(tmpDir);
      const workerRecords = records.filter((r) => r.source_stream === 'worker-log');

      // Should have a work-complete record (worker-start is skipped, work-start is not in the filter set)
      const completionRecord = workerRecords.find((r) => r.model === 'claude-opus-4-7');
      assert.ok(
        completionRecord,
        `Expected a record with model='claude-opus-4-7' but got: ${JSON.stringify(workerRecords.map((r) => r.model))}`,
      );
      assert.equal(completionRecord.model, 'claude-opus-4-7');
      assert.equal(completionRecord.runtime, 'claude-code');
      assert.equal(completionRecord.success, true);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });

  test('work-complete entry WITHOUT model_id stays null (backward compat)', () => {
    const { _private } = require(TELEMETRY_PATH);
    const collectTelemetryRecords = _private && _private.collectTelemetryRecords;

    const { tmpDir, planningDir } = mkPlanningDir();
    try {
      const workerLogDir = path.join(planningDir, 'team', 'workers', 'w1');
      fs.writeFileSync(
        path.join(workerLogDir, 'status.json'),
        JSON.stringify({ id: 'w1', runtime: 'codex-cli' }),
      );
      const logLines = [
        { ts: '2026-05-08T10:00:00.000Z', worker_id: 'w1', kind: 'worker-start', runtime: 'codex-cli' },
        {
          ts: '2026-05-08T10:05:00.000Z',
          worker_id: 'w1',
          kind: 'work-complete',
          ref: 'h-old-format',
          exit_code: 0,
          rate_limited: false,
          duration_ms: 60000,
          stdout_bytes: 128,
          stderr_bytes: 0,
          // No model_id field — legacy format
        },
      ];
      fs.writeFileSync(
        path.join(workerLogDir, 'log.jsonl'),
        logLines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      );

      const records = collectTelemetryRecords(tmpDir);
      const workerRecords = records.filter((r) => r.source_stream === 'worker-log');
      // Legacy records should have model=null (not crash)
      const legacyRecord = workerRecords.find((r) => r.handoff_id === 'h-old-format' || r.tool === 'handoff');
      assert.ok(legacyRecord, 'should have at least one worker-log record');
      assert.equal(legacyRecord.model, null);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  });
});

// ── C: worker-loop work-complete log shape ────────────────────────────────────
// Verify that the extractTelemetry helper in worker-loop returns the expected
// shape — tested by directly calling the substrate buildTelemetryPayload since
// extractTelemetry is a closure inside the module.

describe('worker-loop extractTelemetry helper (via substrate)', () => {
  test('produces { model_id, tokens_in, tokens_out } shape for claude-code', async () => {
    const substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const result = await substrate.buildTelemetryPayload('claude-code', CLAUDE_CODE_RESULT_STDOUT);
    // Verify the exact fields that worker-loop will spread into work-complete log
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'model_id'), 'must have model_id');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'tokens_in'), 'must have tokens_in');
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'tokens_out'), 'must have tokens_out');
    assert.equal(result.model_id, 'claude-opus-4-7');
    assert.equal(typeof result.tokens_in, 'number');
    assert.equal(typeof result.tokens_out, 'number');
  });

  test('returns all-null fields when runtimeId is unknown — no crash', async () => {
    const substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const result = await substrate.buildTelemetryPayload('not-a-real-runtime', 'anything');
    assert.strictEqual(result.model_id, null);
    assert.strictEqual(result.tokens_in, null);
    assert.strictEqual(result.tokens_out, null);
  });

  test('correct shape even when stdout is not valid JSON', async () => {
    const substrate = await import(pathToFileURL(SUBSTRATE_PATH).href);
    const result = await substrate.buildTelemetryPayload('claude-code', 'not json at all');
    assert.strictEqual(result.model_id, null);
    assert.strictEqual(result.tokens_in, null);
    assert.strictEqual(result.tokens_out, null);
  });
});
