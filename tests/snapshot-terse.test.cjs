'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert');

const { createSnapshotCommand } = require('../bin/commands/snapshot.cjs');
const { handleTerseSnapshot } = require('../bin/commands/snapshot/terse.cjs');

function captureConsole(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n');
}

describe('snapshot --terse', () => {
  test('command exposes the terse flag', () => {
    const command = createSnapshotCommand({
      getCurrentSprintIndex() {
        return 1;
      },
      getSprintPhaseIds() {
        return ['57', '58'];
      },
    });

    assert.ok(command.args.terse, 'snapshot command should expose --terse');
    assert.match(command.args.terse.description, /Target <500 tokens/);
  });

  test('terse output stays under the target budget', () => {
    const output = captureConsole(() => handleTerseSnapshot({
      getCurrentSprintIndex() {
        return 12;
      },
      getSprintPhaseIds() {
        return ['57', '58', '59'];
      },
    }, {
      root: { id: 'global' },
      sprintSize: 3,
      currentPhase: '57',
      stateXml: [
        '<state>',
        '  <state-log>',
        '    <entry agent="team-w1" at="2026-05-04T17:20:00.000Z">Wrapped scoped skill preload wiring.</entry>',
        '    <entry agent="team-w1" at="2026-05-04T17:22:00.000Z">Added terse snapshot handler and prompt hint tests.</entry>',
        '    <entry agent="team-w1" at="2026-05-04T17:24:00.000Z">Verifying the handoff warning and token budget.</entry>',
        '    <entry agent="team-w1" at="2026-05-04T17:26:00.000Z">Final pass before commit.</entry>',
        '  </state-log>',
        '</state>',
      ].join('\n'),
      phases: [
        { id: '57', status: 'active', title: 'Per-handoff context budgets', goal: 'Ship terse snapshot, handoff warning, and scoped skill preload hints.' },
        { id: '58', status: 'planned', title: 'Follow-up', goal: 'Narrow further if token pressure remains high.' },
      ],
      allTasks: [
        { id: '57-01', phase: '57', status: 'done' },
        { id: '57-02', phase: '57', status: 'in-progress' },
        { id: '58-01', phase: '58', status: 'planned' },
        { id: '99-01', phase: '99', status: 'planned' },
      ],
    }, {}));

    assert.match(output, /Snapshot \(terse\): global - phases 57, 58, 59/);
    assert.match(output, /Last 3 state-log entries:/);
    const footer = output.split('\n').find((line) => line.startsWith('-- end terse snapshot'));
    assert.ok(footer, 'should include terse footer');
    const match = footer.match(/~(\d+) tokens/);
    assert.ok(match, 'footer should report approximate tokens');
    assert.ok(Number(match[1]) < 500, `expected <500 tokens, got ${match[1]}`);
  });
});
