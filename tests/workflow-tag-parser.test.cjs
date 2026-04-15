/**
 * Workflow tag parser (v0) tests — decision gad-196.
 */

process.env.GAD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { parse, flatten, parseAndFlatten } = require('../lib/workflow-tag-parser.cjs');

describe('parse — basic tag recognition', () => {
  test('parses a workflow root', () => {
    const tree = parse('<workflow slug="foo"><objective>goal</objective></workflow>');
    assert.strictEqual(tree.children.length, 1);
    assert.strictEqual(tree.children[0].tag, 'workflow');
    assert.strictEqual(tree.children[0].attrs.slug, 'foo');
  });

  test('ignores unknown tags', () => {
    const tree = parse('<workflow><unknown>x</unknown><step id="1">y</step></workflow>');
    const wf = tree.children[0];
    // only `step` is recognized under workflow
    assert.strictEqual(wf.children.length, 1);
    assert.strictEqual(wf.children[0].tag, 'step');
  });

  test('parses attributes with quotes and bare tokens', () => {
    const tree = parse('<step id="1" name=simple tool="gad snapshot" skill=\'gad-snapshot\'>body</step>');
    const step = tree.children[0];
    assert.strictEqual(step.attrs.id, '1');
    assert.strictEqual(step.attrs.name, 'simple');
    assert.strictEqual(step.attrs.tool, 'gad snapshot');
    assert.strictEqual(step.attrs.skill, 'gad-snapshot');
  });

  test('ignores tags inside fenced code blocks', () => {
    const source = [
      '<workflow>',
      '```',
      '<step id="fake">should not parse</step>',
      '```',
      '<step id="real">real</step>',
      '</workflow>',
    ].join('\n');
    const tree = parse(source);
    const wf = tree.children[0];
    const steps = wf.children.filter((c) => c.tag === 'step');
    assert.strictEqual(steps.length, 1);
    assert.strictEqual(steps[0].attrs.id, 'real');
  });
});

describe('flatten — expected graph construction', () => {
  test('three sequential steps produce a linear graph', () => {
    const { steps, edges } = parseAndFlatten(
      '<workflow><process><step id="a"/><step id="b"/><step id="c"/></process></workflow>'
    );
    const stepIds = steps.filter((s) => s.kind === 'step').map((s) => s.id);
    assert.deepStrictEqual(stepIds, ['a', 'b', 'c']);
    assert.strictEqual(edges.length, 2);
    assert.deepStrictEqual(edges[0], { from: 'a', to: 'b', condition: null });
    assert.deepStrictEqual(edges[1], { from: 'b', to: 'c', condition: null });
  });

  test('branch with condition attaches to edge', () => {
    const { steps, edges } = parseAndFlatten(
      '<workflow><process><step id="a"/><branch if="x > 0"><step id="b"/></branch></process></workflow>'
    );
    const branchNode = steps.find((s) => s.kind === 'branch');
    assert.ok(branchNode, 'branch node exists');
    assert.strictEqual(branchNode.condition, 'x > 0');
    // edge a→branch exists
    assert.ok(edges.some((e) => e.from === 'a' && e.to === branchNode.id));
  });

  test('loop emits a loop node with for expression', () => {
    const { steps } = parseAndFlatten(
      '<workflow><process><loop for="candidate in candidates"><step id="draft"/></loop></process></workflow>'
    );
    const loopNode = steps.find((s) => s.kind === 'loop');
    assert.ok(loopNode);
    assert.strictEqual(loopNode.over, 'candidate in candidates');
  });

  test('parallel emits a parallel node', () => {
    const { steps } = parseAndFlatten(
      '<workflow><process><parallel><step id="x"/><step id="y"/></parallel></process></workflow>'
    );
    const parallelNode = steps.find((s) => s.kind === 'parallel');
    assert.ok(parallelNode);
  });

  test('step skill attribute is preserved', () => {
    const { steps } = parseAndFlatten(
      '<workflow><step id="1" skill="gad-plan-phase">plan it</step></workflow>'
    );
    const s = steps.find((x) => x.id === '1');
    assert.strictEqual(s.skill, 'gad-plan-phase');
  });

  test('anonymous branch gets auto-id', () => {
    const { steps } = parseAndFlatten(
      '<workflow><branch if="true"><step id="x"/></branch></workflow>'
    );
    const branchNode = steps.find((s) => s.kind === 'branch');
    assert.ok(/^branch-/.test(branchNode.id));
  });
});
