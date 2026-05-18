'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  estimateTokens,
  checkBudget,
  truncateToBudget,
  budgetForModel,
  MODEL_BUDGETS,
} = require(path.join(__dirname, '../lib/token-budget/index.cjs'));

describe('estimateTokens', () => {
  test('empty string returns 0', () => {
    assert.strictEqual(estimateTokens(''), 0);
    assert.strictEqual(estimateTokens(null), 0);
    assert.strictEqual(estimateTokens(undefined), 0);
  });

  test('ASCII text returns positive count', () => {
    const n = estimateTokens('hello world');
    assert.ok(n > 0, `expected > 0 but got ${n}`);
  });

  test('multi-byte unicode text returns positive count', () => {
    const n = estimateTokens('こんにちは世界'); // Japanese "hello world"
    assert.ok(n > 0, `expected > 0 but got ${n}`);
  });

  test('longer text has more tokens than shorter', () => {
    const short = estimateTokens('hello');
    const long = estimateTokens('hello world, this is a longer string with many more tokens in it');
    assert.ok(long > short, `expected ${long} > ${short}`);
  });

  test('non-string value is serialised to JSON before counting', () => {
    const obj = { key: 'value', nested: { a: 1 } };
    const n = estimateTokens(obj);
    assert.ok(n > 0, `expected > 0 but got ${n}`);
  });
});

describe('checkBudget', () => {
  test('within budget returns withinBudget=true, overBy=0', () => {
    const result = checkBudget('hi', 1000);
    assert.strictEqual(result.withinBudget, true);
    assert.strictEqual(result.overBy, 0);
    assert.ok(result.tokens > 0);
    assert.strictEqual(result.budget, 1000);
  });

  test('over budget returns withinBudget=false and positive overBy', () => {
    const longText = 'word '.repeat(5000); // ~5000 tokens
    const result = checkBudget(longText, 10);
    assert.strictEqual(result.withinBudget, false);
    assert.ok(result.overBy > 0, `expected overBy > 0, got ${result.overBy}`);
  });

  test('exact-budget text is withinBudget', () => {
    const text = 'hello world';
    const exactTokens = estimateTokens(text);
    const result = checkBudget(text, exactTokens);
    assert.strictEqual(result.withinBudget, true);
    assert.strictEqual(result.overBy, 0);
  });

  test('accepts {system, user} object prompt', () => {
    const result = checkBudget({ system: 'You are an assistant.', user: 'What is 2+2?' }, 50000);
    assert.strictEqual(result.withinBudget, true);
    assert.ok(result.tokens > 0);
  });

  test('over-budget reports correct overBy amount', () => {
    const text = 'token '.repeat(1000); // roughly 1000 tokens
    const budget = 100;
    const result = checkBudget(text, budget);
    assert.strictEqual(result.overBy, result.tokens - budget);
  });
});

describe('truncateToBudget', () => {
  test('text within budget is returned unchanged', () => {
    const text = 'short text';
    const result = truncateToBudget(text, 10000);
    assert.strictEqual(result, text);
  });

  test('truncated text fits within budget', () => {
    const longText = 'word '.repeat(5000);
    const budget = 200;
    const result = truncateToBudget(longText, budget);
    const resultTokens = estimateTokens(result);
    // Allow 20% slack for the truncation marker tokens
    assert.ok(resultTokens <= budget * 1.2, `expected ${resultTokens} <= ${budget * 1.2}`);
  });

  test('truncated result contains truncation marker', () => {
    const longText = 'word '.repeat(5000);
    const result = truncateToBudget(longText, 50);
    assert.ok(result.includes('[truncated]'), 'expected truncation marker');
  });

  test('null/empty input returned as-is', () => {
    assert.strictEqual(truncateToBudget('', 100), '');
    assert.strictEqual(truncateToBudget(null, 100), null);
  });

  test('head is preserved (first chars appear in result)', () => {
    const longText = 'START ' + 'filler '.repeat(3000) + ' END';
    const result = truncateToBudget(longText, 100);
    assert.ok(result.startsWith('START'), 'expected head to be preserved');
  });
});

describe('budgetForModel', () => {
  test('known model returns correct budget', () => {
    assert.strictEqual(budgetForModel('claude-sonnet-4-6'), MODEL_BUDGETS['claude-sonnet-4-6']);
    assert.strictEqual(budgetForModel('claude-opus-4'), MODEL_BUDGETS['claude-opus-4']);
  });

  test('prefix match works for date-versioned models', () => {
    const result = budgetForModel('claude-sonnet-4-6-20250514');
    assert.strictEqual(result, MODEL_BUDGETS['claude-sonnet-4-6']);
  });

  test('unknown model returns default', () => {
    assert.strictEqual(budgetForModel('some-unknown-model-xyz'), MODEL_BUDGETS.default);
  });

  test('null/undefined returns default', () => {
    assert.strictEqual(budgetForModel(null), MODEL_BUDGETS.default);
    assert.strictEqual(budgetForModel(undefined), MODEL_BUDGETS.default);
  });
});
