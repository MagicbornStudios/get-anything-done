const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { runGadCli } = require('./helpers.cjs');

describe('eval list vocabulary surface', () => {

  test('reports species and generations instead of flat runs', () => {
    const result = runGadCli(['eval', 'list']);

    assert.equal(result.success, true, result.error);
    assert.match(result.output, /GAD Projects \/ Species \/ Generations/);
    assert.match(result.output, /LATEST-GENERATION/);
    assert.match(result.output, /LATEST-STATUS/);
    assert.match(result.output, /species, \d+ total generations/);
    assert.match(result.output, /\/v\d+/);
    assert.doesNotMatch(result.output, /\[object Object\]/);
    assert.doesNotMatch(result.output, /total runs/);
  });
});
