/**
 * skill-usage-stats.test.cjs — unit tests for lib/skill-usage-stats.cjs.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  extractTaskAttributions,
  buildUsageReport,
} = require('../lib/skill-usage-stats.cjs');

const BASE_XML = `<task-registry>
  <phase id="01">
    <task id="01-01" status="done" skill="execute-phase" type="code">
      <goal>ran execute-phase</goal>
    </task>
    <task id="01-02" status="done" skill="execute-phase,debug" type="code">
      <goal>execute + debug</goal>
    </task>
    <task id="01-03" status="planned" skill="unused-here" type="code">
      <goal>never ran</goal>
    </task>
    <task id="01-04" status="done" type="code">
      <goal>no skill attributed</goal>
    </task>
  </phase>
</task-registry>`;

describe('skill-usage-stats: extractTaskAttributions', () => {
  test('only done tasks with skill= are counted', () => {
    const attrs = extractTaskAttributions(BASE_XML, 'proj-a');
    assert.equal(attrs.length, 3);
    assert.deepEqual(attrs.map((a) => a.skill).sort(), ['debug', 'execute-phase', 'execute-phase']);
  });

  test('comma-separated skills split into separate rows', () => {
    const attrs = extractTaskAttributions(BASE_XML);
    const task0102 = attrs.filter((a) => a.taskId === '01-02');
    assert.equal(task0102.length, 2);
    assert.deepEqual(task0102.map((a) => a.skill).sort(), ['debug', 'execute-phase']);
  });

  test('projectId stamped on every attribution', () => {
    const attrs = extractTaskAttributions(BASE_XML, 'proj-a');
    assert.ok(attrs.every((a) => a.projectId === 'proj-a'));
  });
});

describe('skill-usage-stats: buildUsageReport', () => {
  test('aggregates by skill and surfaces unused', () => {
    const attrs = extractTaskAttributions(BASE_XML, 'proj-a');
    const report = buildUsageReport(attrs, ['execute-phase', 'debug', 'never-used-skill']);
    const execPhase = report.bySkill.find((e) => e.skill === 'execute-phase');
    assert.equal(execPhase.runs, 2);
    assert.deepEqual(execPhase.projects, ['proj-a']);
    assert.deepEqual(report.unused, ['never-used-skill']);
    assert.equal(report.totalRuns, 3);
  });

  test('topByRuns sorted correctly', () => {
    const attrs = [
      { skill: 'a', taskId: 't1' },
      { skill: 'a', taskId: 't2' },
      { skill: 'a', taskId: 't3' },
      { skill: 'b', taskId: 't4' },
    ];
    const report = buildUsageReport(attrs, ['a', 'b']);
    assert.equal(report.topByRuns[0].skill, 'a');
    assert.equal(report.topByRuns[0].runs, 3);
    assert.equal(report.topByRuns[1].skill, 'b');
  });

  test('attributedButMissing flags skills referenced in tasks but not present in catalog', () => {
    const attrs = [{ skill: 'ghost-skill', taskId: 't1' }];
    const report = buildUsageReport(attrs, ['real-skill']);
    assert.deepEqual(report.attributedButMissing, ['ghost-skill']);
  });
});
