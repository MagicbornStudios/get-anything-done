'use strict';
/**
 * tests/predicates.test.cjs
 *
 * Unit tests for lib/predicates/index.cjs
 * Uses node:test (built-in, no external deps).
 * Covers all predicates: ok/not-ok branches, edge cases, confidence scoring.
 *
 * Run: node --test tests/predicates.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  hasEnoughFreeRam,
  hasEnoughDisk,
  supportsLocalModel,
  shouldEscalateToFrontier,
  isHighRiskFileChange,
  isStaleTask,
  requiresApproval,
  registerPredicate,
  getPredicate,
  listPredicates,
  evaluate,
  evaluateMultiple
} = require('../lib/predicates/index.cjs');

// ---------------------------------------------------------------------------
// hasEnoughFreeRam Tests
// ---------------------------------------------------------------------------

test('hasEnoughFreeRam: sufficient RAM', (t) => {
  const result = hasEnoughFreeRam.evaluate({ freeRamGb: 8, requiredGb: 4 });
  assert.equal(result.ok, true);
  assert.match(result.reason, /8\.0 GB free >= 4 GB required/);
  assert.equal(result.confidence, 1.0);
});

test('hasEnoughFreeRam: insufficient RAM', (t) => {
  const result = hasEnoughFreeRam.evaluate({ freeRamGb: 2, requiredGb: 4 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /2\.0 GB free < 4 GB required/);
  assert.match(result.reason, /shortfall: 2\.0 GB/);
  assert.equal(result.confidence, 1.0);
});

test('hasEnoughFreeRam: exact threshold', (t) => {
  const result = hasEnoughFreeRam.evaluate({ freeRamGb: 4, requiredGb: 4 });
  assert.equal(result.ok, true);
  assert.equal(result.confidence, 1.0);
});

test('hasEnoughFreeRam: zero free RAM', (t) => {
  const result = hasEnoughFreeRam.evaluate({ freeRamGb: 0, requiredGb: 2 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /shortfall: 2\.0 GB/);
});

// ---------------------------------------------------------------------------
// hasEnoughDisk Tests
// ---------------------------------------------------------------------------

test('hasEnoughDisk: sufficient disk', (t) => {
  const result = hasEnoughDisk.evaluate({ freeDiskGb: 50, requiredGb: 10 });
  assert.equal(result.ok, true);
  assert.match(result.reason, /50\.0 GB free >= 10 GB required/);
  assert.equal(result.confidence, 1.0);
});

test('hasEnoughDisk: insufficient disk', (t) => {
  const result = hasEnoughDisk.evaluate({ freeDiskGb: 5, requiredGb: 10 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /5\.0 GB free < 10 GB required/);
  assert.match(result.reason, /shortfall: 5\.0 GB/);
  assert.equal(result.confidence, 1.0);
});

test('hasEnoughDisk: exact threshold', (t) => {
  const result = hasEnoughDisk.evaluate({ freeDiskGb: 10, requiredGb: 10 });
  assert.equal(result.ok, true);
});

test('hasEnoughDisk: very low disk', (t) => {
  const result = hasEnoughDisk.evaluate({ freeDiskGb: 0.1, requiredGb: 5 });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// supportsLocalModel Tests
// ---------------------------------------------------------------------------

test('supportsLocalModel: qwen-0.5b sufficient resources', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 2,
    freeDiskGb: 1,
    modelId: 'qwen-0.5b'
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /qwen-0\.5b/);
  assert.equal(result.confidence, 1.0);
});

test('supportsLocalModel: qwen-0.5b insufficient RAM', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 1,
    freeDiskGb: 1,
    modelId: 'qwen-0.5b'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /RAM: 1\.0 < 1\.5/);
});

test('supportsLocalModel: qwen-1.5b sufficient resources', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 4,
    freeDiskGb: 2,
    modelId: 'qwen-1.5b'
  });
  assert.equal(result.ok, true);
});

test('supportsLocalModel: qwen-1.5b insufficient disk', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 4,
    freeDiskGb: 1,
    modelId: 'qwen-1.5b'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /disk: 1\.0 < 1\.5/);
});

test('supportsLocalModel: qwen-3b both constraints', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 2,
    freeDiskGb: 1,
    modelId: 'qwen-3b'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /RAM.*disk/);
});

test('supportsLocalModel: unknown model', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 10,
    freeDiskGb: 10,
    modelId: 'unknown-model-99'
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unknown model/);
  assert.equal(result.confidence, 1.0);
});

test('supportsLocalModel: qwen-7b tight resources', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 7,
    freeDiskGb: 5,
    modelId: 'qwen-7b'
  });
  assert.equal(result.ok, true);
});

test('supportsLocalModel: qwen-7b insufficient RAM', (t) => {
  const result = supportsLocalModel.evaluate({
    freeRamGb: 6,
    freeDiskGb: 5,
    modelId: 'qwen-7b'
  });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// shouldEscalateToFrontier Tests
// ---------------------------------------------------------------------------

test('shouldEscalateToFrontier: refactor task', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'refactor',
    complexity: 3
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /refactor.*requires frontier/);
  assert.equal(result.confidence, 0.95);
});

test('shouldEscalateToFrontier: architecture task', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'architecture',
    complexity: 2
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /architecture.*requires frontier/);
});

test('shouldEscalateToFrontier: high complexity bugfix', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'bugfix',
    complexity: 8
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /Complexity 8\/10 exceeds/);
  assert.equal(result.confidence, 0.85);
});

test('shouldEscalateToFrontier: high complexity threshold boundary', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'bugfix',
    complexity: 7
  });
  assert.equal(result.ok, true);
});

test('shouldEscalateToFrontier: low complexity summary', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'summary',
    complexity: 2
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /suitable for Tier 0–4/);
  assert.equal(result.confidence, 0.80);
});

test('shouldEscalateToFrontier: medium complexity feature', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'feature',
    complexity: 5
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /feature.*complexity 5\/10/);
});

test('shouldEscalateToFrontier: trivial task', (t) => {
  const result = shouldEscalateToFrontier.evaluate({
    taskKind: 'bugfix',
    complexity: 0
  });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// isHighRiskFileChange Tests
// ---------------------------------------------------------------------------

test('isHighRiskFileChange: lib.rs file', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['apps/desk/src-tauri/src/lib.rs']
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /High-risk files detected/);
  assert.match(result.reason, /lib\.rs/);
  assert.equal(result.confidence, 0.98);
});

test('isHighRiskFileChange: Cargo.toml', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['apps/desk/Cargo.toml']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: Cargo.lock', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['Cargo.lock']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: pnpm-lock.yaml', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['pnpm-lock.yaml']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: .env file', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['.env']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: secrets file', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['lib/secrets-vault.cjs']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: clerk auth module', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['apps/platform/src/lib/clerk-flag.ts']
  });
  assert.equal(result.ok, true);
});

test('isHighRiskFileChange: safe files only', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['src/components/button.tsx', 'src/utils/helper.ts']
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /No high-risk files/);
  assert.equal(result.confidence, 0.95);
});

test('isHighRiskFileChange: mix of safe and risky', (t) => {
  const result = isHighRiskFileChange.evaluate({
    files: ['src/components/button.tsx', 'apps/desk/src-tauri/src/lib.rs']
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /lib\.rs/);
});

test('isHighRiskFileChange: empty file list', (t) => {
  const result = isHighRiskFileChange.evaluate({ files: [] });
  assert.equal(result.ok, false);
  assert.match(result.reason, /No files in change set/);
});

test('isHighRiskFileChange: not an array', (t) => {
  const result = isHighRiskFileChange.evaluate({ files: null });
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// isStaleTask Tests
// ---------------------------------------------------------------------------

test('isStaleTask: task stale by 14 days', (t) => {
  const now = new Date();
  const updated = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const result = isStaleTask.evaluate({
    updatedAt: updated.toISOString(),
    nowMs: now.getTime(),
    staleDays: 14
  });
  assert.equal(result.ok, true);
  assert.match(result.reason, /14\.0 days old/);
  assert.equal(result.confidence, 1.0);
});

test('isStaleTask: task fresh', (t) => {
  const now = new Date();
  const updated = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const result = isStaleTask.evaluate({
    updatedAt: updated.toISOString(),
    nowMs: now.getTime(),
    staleDays: 14
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /1\.0 days old/);
});

test('isStaleTask: task boundary (exactly staleDays)', (t) => {
  const now = new Date();
  const updated = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = isStaleTask.evaluate({
    updatedAt: updated.toISOString(),
    nowMs: now.getTime(),
    staleDays: 7
  });
  assert.equal(result.ok, true);
});

test('isStaleTask: task just before boundary', (t) => {
  const now = new Date();
  const updated = new Date(now.getTime() - 6.99 * 24 * 60 * 60 * 1000);
  const result = isStaleTask.evaluate({
    updatedAt: updated.toISOString(),
    nowMs: now.getTime(),
    staleDays: 7
  });
  assert.equal(result.ok, false);
});

test('isStaleTask: invalid timestamp', (t) => {
  const result = isStaleTask.evaluate({
    updatedAt: 'not-a-date',
    nowMs: Date.now(),
    staleDays: 7
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /Invalid updatedAt timestamp/);
});

test('isStaleTask: custom staleDays threshold', (t) => {
  const now = new Date();
  const updated = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const result = isStaleTask.evaluate({
    updatedAt: updated.toISOString(),
    nowMs: now.getTime(),
    staleDays: 30
  });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// requiresApproval Tests
// ---------------------------------------------------------------------------

test('requiresApproval: delete-task', (t) => {
  const result = requiresApproval.evaluate({ action: 'delete-task' });
  assert.equal(result.ok, true);
  assert.match(result.reason, /delete-task.*destructive/);
  assert.equal(result.confidence, 0.98);
});

test('requiresApproval: reset-hard', (t) => {
  const result = requiresApproval.evaluate({ action: 'reset-hard' });
  assert.equal(result.ok, true);
});

test('requiresApproval: force-push', (t) => {
  const result = requiresApproval.evaluate({ action: 'force-push' });
  assert.equal(result.ok, true);
});

test('requiresApproval: deploy-prod', (t) => {
  const result = requiresApproval.evaluate({ action: 'deploy-prod' });
  assert.equal(result.ok, true);
});

test('requiresApproval: revoke-token', (t) => {
  const result = requiresApproval.evaluate({ action: 'revoke-token' });
  assert.equal(result.ok, true);
});

test('requiresApproval: safe action (commit)', (t) => {
  const result = requiresApproval.evaluate({ action: 'commit' });
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not require approval/);
  assert.equal(result.confidence, 0.90);
});

test('requiresApproval: safe action (push)', (t) => {
  const result = requiresApproval.evaluate({ action: 'push' });
  assert.equal(result.ok, false);
});

test('requiresApproval: cancel-worker', (t) => {
  const result = requiresApproval.evaluate({ action: 'cancel-worker' });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Registry API Tests
// ---------------------------------------------------------------------------

test('getPredicate: retrieve registered predicate', (t) => {
  const pred = getPredicate('hasEnoughFreeRam');
  assert.ok(pred);
  assert.equal(pred.id, 'hasEnoughFreeRam');
});

test('getPredicate: non-existent predicate', (t) => {
  const pred = getPredicate('nonexistent-predicate');
  assert.equal(pred, undefined);
});

test('listPredicates: returns all registered predicates', (t) => {
  const preds = listPredicates();
  assert.ok(Array.isArray(preds));
  assert.ok(preds.length >= 7, `Expected at least 7 predicates, got ${preds.length}`);
  const ids = preds.map(p => p.id);
  assert.ok(ids.includes('hasEnoughFreeRam'));
  assert.ok(ids.includes('hasEnoughDisk'));
  assert.ok(ids.includes('supportsLocalModel'));
  assert.ok(ids.includes('shouldEscalateToFrontier'));
  assert.ok(ids.includes('isHighRiskFileChange'));
  assert.ok(ids.includes('isStaleTask'));
  assert.ok(ids.includes('requiresApproval'));
});

test('evaluate: run predicate by id', (t) => {
  const result = evaluate('hasEnoughFreeRam', { freeRamGb: 8, requiredGb: 4 });
  assert.equal(result.ok, true);
});

test('evaluate: throw on missing predicate', (t) => {
  assert.throws(
    () => evaluate('nonexistent', {}),
    /Predicate not found/
  );
});

test('evaluateMultiple: runs all predicates', (t) => {
  const results = evaluateMultiple(
    ['hasEnoughFreeRam', 'hasEnoughDisk'],
    { freeRamGb: 8, requiredGb: 4, freeDiskGb: 50, freeDiskGb: 10 }
  );
  assert.equal(results.length, 2);
  assert.equal(results[0].predicateId, 'hasEnoughFreeRam');
  assert.equal(results[1].predicateId, 'hasEnoughDisk');
});

test('evaluateMultiple: short-circuits on failure', (t) => {
  const results = evaluateMultiple(
    ['hasEnoughFreeRam', 'hasEnoughDisk'],
    { freeRamGb: 2, requiredGb: 4, freeDiskGb: 50, requiredGb: 10 }
  );
  // Should only have 1 result (short-circuited after first failure)
  assert.equal(results.length, 1);
  assert.equal(results[0].result.ok, false);
});

test('registerPredicate: add custom predicate', (t) => {
  const customPred = {
    id: 'test-custom-predicate',
    description: 'A test predicate',
    evaluate: () => ({ ok: true, reason: 'test', confidence: 0.5 })
  };
  registerPredicate(customPred);
  const retrieved = getPredicate('test-custom-predicate');
  assert.ok(retrieved);
  assert.equal(retrieved.id, 'test-custom-predicate');
});

test('registerPredicate: reject duplicate id', (t) => {
  const dup = {
    id: 'hasEnoughFreeRam',
    description: 'Duplicate',
    evaluate: () => ({})
  };
  assert.throws(
    () => registerPredicate(dup),
    /already registered/
  );
});

test('registerPredicate: reject invalid shape', (t) => {
  assert.throws(
    () => registerPredicate({ id: 'bad' }),
    /Invalid predicate shape/
  );
});

// ---------------------------------------------------------------------------
// Integration Tests
// ---------------------------------------------------------------------------

test('Integration: machine profile check (Tiny)', (t) => {
  // Tiny machine: 2.3 GB free RAM, 9 GB free disk
  const machineProfile = { freeRamGb: 2.3, freeDiskGb: 9 };

  // Can run Qwen 0.5B? (needs 1.5 GB RAM, 0.8 GB disk)
  const res1 = supportsLocalModel.evaluate({
    ...machineProfile,
    modelId: 'qwen-0.5b'
  });
  assert.equal(res1.ok, true); // 2.3 GB >= 1.5 GB required

  // Can run rules-based predicates (Tier 0)?
  const res2 = hasEnoughFreeRam.evaluate({
    freeRamGb: machineProfile.freeRamGb,
    requiredGb: 0.1
  });
  assert.equal(res2.ok, true); // Yes
});

test('Integration: task evaluation pipeline', (t) => {
  const task = {
    kind: 'refactor',
    complexity: 3,
    files: ['src/components/button.tsx'],
    updatedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z'
  };

  // Should this task be escalated?
  const escalateRes = shouldEscalateToFrontier.evaluate({
    taskKind: task.kind,
    complexity: task.complexity
  });
  assert.equal(escalateRes.ok, true);

  // Are there high-risk files?
  const riskRes = isHighRiskFileChange.evaluate({ files: task.files });
  assert.equal(riskRes.ok, false); // Safe file

  // Is the task stale? (assuming today)
  const staleRes = isStaleTask.evaluate({
    updatedAt: task.updatedAt,
    nowMs: Date.now(),
    staleDays: 7
  });
  assert.equal(staleRes.ok, true); // Old task
});
