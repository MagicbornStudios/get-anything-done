'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { IsolationForest, buildForest, avgPathLength } = require('../lib/anomalies/isoforest.cjs');

describe('isolation-forest', () => {
  test('avgPathLength returns 0 for n<=1', () => {
    assert.equal(avgPathLength(0), 0);
    assert.equal(avgPathLength(1), 0);
    assert.equal(avgPathLength(2), 1);
  });

  test('avgPathLength grows with n', () => {
    assert.ok(avgPathLength(10) > avgPathLength(5));
    assert.ok(avgPathLength(100) > avgPathLength(10));
  });

  test('fit does not throw with normal data', () => {
    const data = Array.from({ length: 50 }, () => [Math.random() * 100, Math.random() * 100]);
    const forest = new IsolationForest({ n_trees: 10, sample_size: 20 });
    assert.doesNotThrow(() => forest.fit(data));
    assert.equal(forest.trees.length, 10);
  });

  test('score returns value in (0,1]', () => {
    const data = Array.from({ length: 30 }, () => [Math.random() * 10, Math.random() * 10]);
    const forest = buildForest(data, { n_trees: 20, sample_size: 20 });
    const s = forest.score([5, 5]);
    assert.ok(s > 0 && s <= 1, `score ${s} should be in (0,1]`);
  });

  test('outlier scores higher than inlier on average', () => {
    // Cluster of inliers around 0, outlier at 1000
    const inliers = Array.from({ length: 50 }, () => [
      Math.random() * 2,
      Math.random() * 2,
    ]);
    const forest = buildForest(inliers, { n_trees: 50, sample_size: 32, threshold: 0.6 });

    const inlierScore  = forest.score([1, 1]);       // in-distribution
    const outlierScore = forest.score([1000, 1000]); // clear anomaly

    assert.ok(
      outlierScore > inlierScore,
      `Outlier score ${outlierScore} should exceed inlier score ${inlierScore}`
    );
  });

  test('predict returns array with anomaly flags', () => {
    const data = Array.from({ length: 20 }, () => [Math.random(), Math.random()]);
    const forest = buildForest(data, { n_trees: 20, sample_size: 16 });
    const results = forest.predict(data);
    assert.equal(results.length, data.length);
    for (const r of results) {
      assert.ok(typeof r.score === 'number');
      assert.ok(typeof r.anomaly === 'boolean');
    }
  });

  test('toJSON / fromJSON round-trip', () => {
    const data = Array.from({ length: 20 }, () => [Math.random() * 5, Math.random() * 5]);
    const forest = buildForest(data, { n_trees: 10, sample_size: 15 });
    const point = [2.5, 2.5];
    const scoreBefore = forest.score(point);

    const restored = IsolationForest.fromJSON(forest.toJSON());
    const scoreAfter = restored.score(point);

    assert.equal(scoreBefore, scoreAfter, 'Score should be identical after JSON round-trip');
  });

  test('detectWithIsolationForest import from detector.cjs', async () => {
    const { detectWithIsolationForest } = require('../lib/anomalies/detector.cjs');
    assert.ok(typeof detectWithIsolationForest === 'function');
    // Run against a path with no data — should not throw
    const result = await detectWithIsolationForest({ baseDir: '/nonexistent' });
    assert.ok(typeof result.fired === 'boolean');
    assert.ok(result.evidence);
  });
});
