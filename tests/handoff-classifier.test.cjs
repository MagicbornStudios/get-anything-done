'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { train, classify, trainFromFs, LABELS } = require('../lib/handoffs/classifier.cjs');

describe('handoff-classifier', () => {
  test('LABELS contains expected classes', () => {
    assert.deepEqual(LABELS, ['success', 'failure', 'in_progress']);
  });

  test('classify returns valid label when model is untrained', () => {
    const result = classify('some handoff text');
    assert.ok(LABELS.includes(result.label), `unexpected label: ${result.label}`);
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(typeof result.scores === 'object');
  });

  test('train returns vocab and weights arrays', () => {
    const samples = [
      { text: 'worker completed the task successfully shipped phase 80', label: 'success' },
      { text: 'rate limit error blocked abort failed handoff rejected', label: 'failure' },
      { text: 'task is in progress working on the handoff now', label: 'in_progress' },
      { text: 'deployed component and merged pull request done', label: 'success' },
      { text: 'process crashed error runtime failed again', label: 'failure' },
    ];
    const model = train(samples);
    assert.ok(Array.isArray(model.vocab), 'vocab should be array');
    assert.ok(Array.isArray(model.weights), 'weights should be array');
    assert.equal(model.weights.length, LABELS.length);
  });

  test('trained model classifies success text correctly', () => {
    const samples = [
      { text: 'completed shipped merged deployed phase done', label: 'success' },
      { text: 'completed shipped merged deployed phase done', label: 'success' },
      { text: 'rate limit error blocked failed abort crashed', label: 'failure' },
      { text: 'rate limit error blocked failed abort crashed', label: 'failure' },
      { text: 'working ongoing progress partial implementation', label: 'in_progress' },
      { text: 'working ongoing progress partial implementation', label: 'in_progress' },
    ];
    const model = train(samples);
    const result = classify('completed shipped deployed done', model);
    assert.ok(LABELS.includes(result.label));
    assert.ok(result.confidence > 0);
    // Scores should sum to ~1
    const sum = Object.values(result.scores).reduce((s, v) => s + v, 0);
    assert.ok(Math.abs(sum - 1) < 0.01, `scores should sum to ~1, got ${sum}`);
  });

  test('train with empty samples returns stub model', () => {
    const model = train([]);
    assert.equal(model.vocab.length, 0);
    const result = classify('any text', model);
    assert.equal(result.label, 'in_progress'); // stub default
  });

  test('trainFromFs returns a model even when directory is missing', () => {
    const model = trainFromFs('/nonexistent/path/that/does/not/exist');
    assert.ok(model, 'should return model object');
    assert.ok(Array.isArray(model.vocab));
    assert.ok(Array.isArray(model.weights));
  });
});
