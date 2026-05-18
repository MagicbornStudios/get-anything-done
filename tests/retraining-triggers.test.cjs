'use strict';
/**
 * tests/retraining-triggers.test.cjs — unit tests for lib/retraining/triggers.cjs
 *
 * Run: node --test tests/retraining-triggers.test.cjs
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Setup: temp project root with minimal structure
// ---------------------------------------------------------------------------

let tmpDir;

function makeRoot() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-test-triggers-'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'models'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, '.planning', 'datasets', 'dpo'), { recursive: true });
  // Write empty registry
  fs.writeFileSync(path.join(tmpDir, '.planning', 'models', 'registry.json'), JSON.stringify({ models: [] }, null, 2));
  return tmpDir;
}

function cleanRoot() {
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
}

function writeStateXml(root, level) {
  const content = `<state><level value="${level}"/></state>`;
  fs.writeFileSync(path.join(root, '.planning', 'STATE.xml'), content);
}

function writeDpoPairs(root, count) {
  const lines = Array.from({ length: count }, (_, i) => JSON.stringify({ idx: i })).join('\n');
  fs.writeFileSync(path.join(root, '.planning', 'datasets', 'dpo', 'pairs.jsonl'), lines);
}

const registry = require('../lib/models/registry.cjs');
const { checkTriggers } = require('../lib/retraining/triggers.cjs');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('retraining triggers', () => {
  beforeEach(() => makeRoot());
  after(() => cleanRoot());

  // ---- force flag ----------------------------------------------------------

  it('force flag always triggers regardless of kind', () => {
    registry.upsertModel(tmpDir, 'kael-v1', { kind: 'llm', level_at_train: 10, dataset_volume_at_train_mb: 0 });
    writeStateXml(tmpDir, 10); // no level delta
    const result = checkTriggers(tmpDir, 'kael-v1', { force: true });
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('force')));
  });

  // ---- model not found -----------------------------------------------------

  it('returns shouldTrain=false for unknown model id', () => {
    const result = checkTriggers(tmpDir, 'nonexistent-model');
    assert.equal(result.shouldTrain, false);
    assert.ok(result.reasons[0].includes('not found'));
  });

  // ---- LLM: level_delta ----------------------------------------------------

  it('LLM triggers on level_delta >= default (2)', () => {
    registry.upsertModel(tmpDir, 'llm-a', { kind: 'llm', level_at_train: 5, dataset_volume_at_train_mb: 0 });
    writeStateXml(tmpDir, 7); // delta = 2
    const result = checkTriggers(tmpDir, 'llm-a');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('level_delta')));
  });

  it('LLM does NOT trigger when level_delta < default', () => {
    registry.upsertModel(tmpDir, 'llm-b', { kind: 'llm', level_at_train: 5, dataset_volume_at_train_mb: 0 });
    writeStateXml(tmpDir, 6); // delta = 1 < 2
    const result = checkTriggers(tmpDir, 'llm-b');
    // May still trigger on dataset_delta if there's data; dataset is empty here
    const levelTrigger = result.reasons.some((r) => r.includes('level_delta'));
    assert.equal(levelTrigger, false);
  });

  it('LLM triggers on level_delta when never trained (level_at_train=null)', () => {
    registry.upsertModel(tmpDir, 'llm-never', { kind: 'llm', level_at_train: null, dataset_volume_at_train_mb: 0 });
    writeStateXml(tmpDir, 3);
    const result = checkTriggers(tmpDir, 'llm-never');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('level_delta') && r.includes('never')));
  });

  // ---- LLM: dataset_delta --------------------------------------------------

  it('LLM triggers on dataset_delta >= 500MB threshold', () => {
    // Write a large-ish file to simulate dataset growth (fake size via mocking is hard;
    // we lower threshold via model's dataset_volume_at_train_mb = 0 and write real bytes)
    // Write 1 byte file but model was trained at -600MB (simulate by setting negative train_mb)
    registry.upsertModel(tmpDir, 'llm-data', { kind: 'llm', level_at_train: 10, dataset_volume_at_train_mb: -600 });
    writeStateXml(tmpDir, 10); // no level delta
    // The dataset dir has minimal files; delta from -600 to ~0 = 600MB ≥ 500 → triggers
    const result = checkTriggers(tmpDir, 'llm-data');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('dataset_delta')));
  });

  // ---- mid: cron_weekly ----------------------------------------------------

  it('mid triggers when last_train_at is null (never trained)', () => {
    registry.upsertModel(tmpDir, 'reranker-v1', { kind: 'mid', last_train_at: null });
    const result = checkTriggers(tmpDir, 'reranker-v1');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('cron_weekly')));
  });

  it('mid triggers when last_train_at > 7 days ago', () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    registry.upsertModel(tmpDir, 'reranker-v2', { kind: 'mid', last_train_at: oldDate });
    const result = checkTriggers(tmpDir, 'reranker-v2');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('cron_weekly')));
  });

  it('mid does NOT trigger when last_train_at is recent (2 days ago)', () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    registry.upsertModel(tmpDir, 'reranker-v3', { kind: 'mid', last_train_at: recentDate });
    const result = checkTriggers(tmpDir, 'reranker-v3');
    // Should not trigger on cron_weekly
    const cronTrigger = result.reasons.some((r) => r.includes('cron_weekly'));
    assert.equal(cronTrigger, false);
  });

  // ---- mid: drift_flag -----------------------------------------------------

  it('mid triggers on drift_flag when curator log has drift signal', () => {
    const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    registry.upsertModel(tmpDir, 'reranker-drift', { kind: 'mid', last_train_at: recentDate });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'datasets-curator.log'), '2026-05-18 semantic drift detected in embedding space\n');
    const result = checkTriggers(tmpDir, 'reranker-drift');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('drift_flag')));
  });

  // ---- kNN / intent --------------------------------------------------------

  it('knn triggers when new DPO pairs >= 100 (default)', () => {
    registry.upsertModel(tmpDir, 'style-ranker-v1', { kind: 'knn', dpo_pairs_at_train: 50 });
    writeDpoPairs(tmpDir, 151); // 151 total, 101 new → triggers
    const result = checkTriggers(tmpDir, 'style-ranker-v1');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('dpo_accumulation')));
  });

  it('knn does NOT trigger when new DPO pairs < 100', () => {
    registry.upsertModel(tmpDir, 'style-ranker-v2', { kind: 'knn', dpo_pairs_at_train: 100 });
    writeDpoPairs(tmpDir, 150); // 150 total, 50 new < 100 → no trigger
    const result = checkTriggers(tmpDir, 'style-ranker-v2');
    assert.equal(result.shouldTrain, false);
  });

  it('intent kind uses same dpo_accumulation rule as knn', () => {
    registry.upsertModel(tmpDir, 'intent-v1', { kind: 'intent', dpo_pairs_at_train: 0 });
    writeDpoPairs(tmpDir, 120); // 120 new ≥ 100 → triggers
    const result = checkTriggers(tmpDir, 'intent-v1');
    assert.equal(result.shouldTrain, true);
    assert.ok(result.reasons.some((r) => r.includes('dpo_accumulation')));
  });

  it('intent does NOT trigger when never trained but 0 DPO pairs exist', () => {
    registry.upsertModel(tmpDir, 'intent-empty', { kind: 'intent', dpo_pairs_at_train: 0 });
    // no pairs written — count = 0, delta = 0 < 100
    const result = checkTriggers(tmpDir, 'intent-empty');
    assert.equal(result.shouldTrain, false);
  });
});
