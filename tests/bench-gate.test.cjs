'use strict';
/**
 * tests/bench-gate.test.cjs — unit tests for lib/models/bench-gate.cjs
 *
 * Run: node --test tests/bench-gate.test.cjs
 */

const { describe, it, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const registry = require('../lib/models/registry.cjs');
const { shouldPromote, shouldPromoteAuto, DEFAULT_MIN_ELO_IMPROVEMENT } = require('../lib/models/bench-gate.cjs');

let tmpDir;

function makeRoot() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-test-bench-gate-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'models'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'models', 'registry.json'),
    JSON.stringify({ models: [] }, null, 2),
  );
  return tmpDir;
}

function cleanRoot() {
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function seed(id, patch) {
  return registry.upsertModel(tmpDir, id, patch);
}

function addBench(id, set, elo, tsOffsetMs = 0) {
  // recordBenchResult uses Date.now() — for deterministic ordering we touch
  // bench_results manually here.
  const m = registry.getModel(tmpDir, id);
  const bench_results = [...(m.bench_results || []), {
    set,
    elo,
    ts: new Date(Date.now() + tsOffsetMs).toISOString(),
  }];
  registry.upsertModel(tmpDir, id, { bench_results, last_bench_at: bench_results[bench_results.length - 1].ts });
}

describe('shouldPromote', () => {
  beforeEach(() => makeRoot());
  after(() => cleanRoot());

  // ---- candidate not found ------------------------------------------------

  it('fails when candidate not found', () => {
    const d = shouldPromote(tmpDir, 'missing', null);
    assert.equal(d.pass, false);
    assert.ok(d.reasons[0].includes('candidate not found'));
  });

  // ---- no incumbent (first promotion) -------------------------------------

  it('passes when no incumbent (first promotion)', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging' });
    const d = shouldPromote(tmpDir, 'kael-v1', null);
    assert.equal(d.pass, true);
    assert.ok(d.reasons.some((r) => r.includes('no-incumbent')));
  });

  it('passes when oldId given but model does not exist', () => {
    seed('kael-v1', { kind: 'llm', status: 'staging' });
    const d = shouldPromote(tmpDir, 'kael-v1', 'phantom-id');
    assert.equal(d.pass, true);
    assert.ok(d.reasons.some((r) => r.includes('active model not found')));
  });

  // ---- missing bench data --------------------------------------------------

  it('passes with no-bench-data when ELO missing on either side (default)', () => {
    seed('kael-v1', { kind: 'llm', status: 'active' });
    seed('kael-v2', { kind: 'llm', status: 'staging' });
    const d = shouldPromote(tmpDir, 'kael-v2', 'kael-v1');
    assert.equal(d.pass, true);
    assert.ok(d.reasons.some((r) => r.includes('no-bench-data')));
  });

  it('fails with no-bench-data when requireBench=true', () => {
    seed('kael-v1', { kind: 'llm', status: 'active' });
    seed('kael-v2', { kind: 'llm', status: 'staging' });
    const d = shouldPromote(tmpDir, 'kael-v2', 'kael-v1', { requireBench: true });
    assert.equal(d.pass, false);
    assert.ok(d.reasons.some((r) => r.includes('no-bench-data')));
  });

  // ---- ELO gate ------------------------------------------------------------

  it('passes ELO gate when delta >= min_improvement (explicit opt)', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('b', 'general', 1015);
    const d = shouldPromote(tmpDir, 'b', 'a', { minImprovement: 10 });
    assert.equal(d.pass, true);
    assert.equal(d.delta_elo, 15);
    assert.equal(d.candidate_elo, 1015);
    assert.equal(d.active_elo, 1000);
    assert.ok(d.reasons.some((r) => r.includes('elo_gate_passed')));
  });

  it('fails ELO gate when delta < min_improvement', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('b', 'general', 1005);
    const d = shouldPromote(tmpDir, 'b', 'a', { minImprovement: 10 });
    assert.equal(d.pass, false);
    assert.equal(d.delta_elo, 5);
    assert.ok(d.reasons.some((r) => r.includes('elo_gate_failed')));
  });

  it('fails ELO gate when candidate is worse than active', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1100);
    addBench('b', 'general', 1050);
    const d = shouldPromote(tmpDir, 'b', 'a', { minImprovement: 10 });
    assert.equal(d.pass, false);
    assert.equal(d.delta_elo, -50);
  });

  it('uses DEFAULT_MIN_ELO_IMPROVEMENT when no opt and no setting', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('b', 'general', 1000 + DEFAULT_MIN_ELO_IMPROVEMENT - 1);
    const d = shouldPromote(tmpDir, 'b', 'a');
    assert.equal(d.pass, false);
  });

  // ---- must-pass sets ------------------------------------------------------

  it('passes when must-pass sets all match or beat active', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('a', 'tool-use', 800);
    addBench('b', 'general', 1020);
    addBench('b', 'tool-use', 805);
    const d = shouldPromote(tmpDir, 'b', 'a', {
      minImprovement: 10,
      mustPassSets: ['tool-use'],
    });
    assert.equal(d.pass, true);
    assert.equal(d.regressions.length, 0);
    assert.ok(d.reasons.some((r) => r.includes('must_pass_passed')));
  });

  it('fails when must-pass set regresses below active', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('a', 'tool-use', 800);
    addBench('b', 'general', 1100);  // good overall
    addBench('b', 'tool-use', 750);  // regression
    const d = shouldPromote(tmpDir, 'b', 'a', {
      minImprovement: 10,
      mustPassSets: ['tool-use'],
    });
    assert.equal(d.pass, false);
    assert.equal(d.regressions.length, 1);
    assert.ok(d.regressions[0].includes('tool-use'));
    assert.ok(d.reasons.some((r) => r.includes('must_pass_regression')));
  });

  it('flags missing must-pass set as regression when only one side has data', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('a', 'must-set', 500);
    addBench('b', 'general', 1100);
    // b has no must-set bench
    const d = shouldPromote(tmpDir, 'b', 'a', {
      minImprovement: 10,
      mustPassSets: ['must-set'],
    });
    assert.equal(d.pass, false);
    assert.ok(d.regressions[0].includes('must-set'));
  });

  it('uses latest bench result per set when multiple exist', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000, 0);
    addBench('a', 'general', 1050, 1000); // older bench overwritten by newer
    addBench('b', 'general', 1100, 2000);
    const d = shouldPromote(tmpDir, 'b', 'a', { minImprovement: 10 });
    // active_elo should be 1050 (latest), so delta = 50
    assert.equal(d.delta_elo, 50);
    assert.equal(d.pass, true);
  });
});

describe('shouldPromoteAuto', () => {
  beforeEach(() => makeRoot());
  after(() => cleanRoot());

  it('finds active model of same kind automatically', () => {
    seed('a', { kind: 'llm', status: 'active' });
    seed('b', { kind: 'llm', status: 'staging' });
    addBench('a', 'general', 1000);
    addBench('b', 'general', 1020);
    const d = shouldPromoteAuto(tmpDir, 'b', { minImprovement: 10 });
    assert.equal(d.pass, true);
    assert.equal(d.delta_elo, 20);
  });

  it('returns no-incumbent when no active model of same kind exists', () => {
    seed('b', { kind: 'llm', status: 'staging' });
    const d = shouldPromoteAuto(tmpDir, 'b');
    assert.equal(d.pass, true);
    assert.ok(d.reasons.some((r) => r.includes('no-incumbent')));
  });

  it('ignores active models of different kind', () => {
    seed('mid-a', { kind: 'mid', status: 'active' });
    seed('llm-b', { kind: 'llm', status: 'staging' });
    addBench('mid-a', 'general', 1000);
    addBench('llm-b', 'general', 50);
    const d = shouldPromoteAuto(tmpDir, 'llm-b');
    assert.equal(d.pass, true);
    assert.ok(d.reasons.some((r) => r.includes('no-incumbent')));
  });

  it('fails fast when candidate not found', () => {
    const d = shouldPromoteAuto(tmpDir, 'missing');
    assert.equal(d.pass, false);
  });
});
