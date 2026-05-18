'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const os   = require('node:os');
const path = require('node:path');
const fs   = require('node:fs');
const { linearRegression, computeVelocity, forecastPhases } = require('../lib/pressure/forecast.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-forecast-test-'));
  const tasksDir = path.join(tmp, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  return { tmp, tasksDir };
}

function writeTask(tasksDir, id, phase, status, createdAt, completedAt) {
  fs.writeFileSync(path.join(tasksDir, `${id}.json`), JSON.stringify({
    id, phase: String(phase), status,
    created_at: createdAt,
    completed_at: completedAt || null,
  }));
}

// ---------------------------------------------------------------------------
// linearRegression
// ---------------------------------------------------------------------------

describe('linearRegression', () => {
  test('perfect line y=2x+1', () => {
    const xs = [0, 1, 2, 3, 4];
    const ys = [1, 3, 5, 7, 9];
    const { slope, intercept, r2 } = linearRegression(xs, ys);
    assert.ok(Math.abs(slope - 2) < 0.001, `slope ${slope}`);
    assert.ok(Math.abs(intercept - 1) < 0.001, `intercept ${intercept}`);
    assert.ok(Math.abs(r2 - 1) < 0.001, `r2 ${r2}`);
  });

  test('single point returns slope=0', () => {
    const { slope } = linearRegression([1], [5]);
    assert.equal(slope, 0);
  });

  test('flat line has slope=0, r2=0', () => {
    const xs = [1, 2, 3, 4];
    const ys = [5, 5, 5, 5];
    const { slope, r2 } = linearRegression(xs, ys);
    assert.equal(slope, 0);
    assert.equal(r2, 0);
  });

  test('negative slope detected', () => {
    const xs = [0, 1, 2, 3];
    const ys = [10, 7, 4, 1];
    const { slope } = linearRegression(xs, ys);
    assert.ok(slope < 0, `slope should be negative: ${slope}`);
  });
});

// ---------------------------------------------------------------------------
// computeVelocity
// ---------------------------------------------------------------------------

describe('computeVelocity', () => {
  test('returns zero velocity with missing planning dir', () => {
    const result = computeVelocity({ repoRoot: '/nonexistent/path' });
    assert.ok(typeof result.velocityDays === 'number');
    assert.equal(result.velocityDays, 0);
    assert.ok(Array.isArray(result.phases));
  });

  test('derives velocity from synthetic task files', () => {
    const { tmp, tasksDir } = makeTmpDir();
    try {
      // Phase 100 — closed 5 days
      writeTask(tasksDir, '100-01', '100', 'done', '2026-01-01T00:00:00Z', '2026-01-06T00:00:00Z');
      // Phase 101 — closed 7 days
      writeTask(tasksDir, '101-01', '101', 'done', '2026-01-07T00:00:00Z', '2026-01-14T00:00:00Z');
      // Phase 102 — open
      writeTask(tasksDir, '102-01', '102', 'planned', '2026-01-15T00:00:00Z', null);

      const result = computeVelocity({ repoRoot: tmp });
      assert.ok(result.velocityDays > 0, `velocity should be positive: ${result.velocityDays}`);
      assert.ok(result.openPhases.length >= 1, 'Should have at least 1 open phase');
      assert.ok(result.closedPhases.length >= 2, 'Should have at least 2 closed phases');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// forecastPhases
// ---------------------------------------------------------------------------

describe('forecastPhases', () => {
  test('returns empty array when no planning dir', () => {
    const result = forecastPhases({ repoRoot: '/nonexistent' });
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  test('forecasts open phase with valid structure', () => {
    const { tmp, tasksDir } = makeTmpDir();
    try {
      // 3 closed phases for regression
      writeTask(tasksDir, '200-01', '200', 'done', '2026-02-01T00:00:00Z', '2026-02-08T00:00:00Z');
      writeTask(tasksDir, '201-01', '201', 'done', '2026-02-10T00:00:00Z', '2026-02-16T00:00:00Z');
      writeTask(tasksDir, '202-01', '202', 'done', '2026-02-18T00:00:00Z', '2026-02-25T00:00:00Z');
      // Open phase
      writeTask(tasksDir, '203-01', '203', 'planned', '2026-03-01T00:00:00Z', null);

      const forecasts = forecastPhases({ repoRoot: tmp });
      assert.ok(forecasts.length >= 1, `Expected at least 1 forecast, got ${forecasts.length}`);

      const fc = forecasts[0];
      assert.ok(typeof fc.phaseId === 'string', 'phaseId should be string');
      assert.ok(typeof fc.predictedCloseDate === 'string', 'predictedCloseDate should be string');
      assert.ok(typeof fc.daysFromNow === 'number');
      assert.ok(typeof fc.confidenceInterval === 'number');
      assert.ok(typeof fc.lower === 'string');
      assert.ok(typeof fc.upper === 'string');
      // Validate ISO date format YYYY-MM-DD
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(fc.predictedCloseDate), `Bad date: ${fc.predictedCloseDate}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
