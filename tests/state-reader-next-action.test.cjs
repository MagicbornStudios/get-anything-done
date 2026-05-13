'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { readState } = require('../lib/state-reader.cjs');

function makeTempRoot({ stateXml, roadmapXml = '', tasks = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-state-next-action-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.xml'), stateXml, 'utf8');
  if (roadmapXml) {
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.xml'), roadmapXml, 'utf8');
  }
  if (tasks.length > 0) {
    const tasksDir = path.join(planningDir, 'tasks');
    fs.mkdirSync(tasksDir, { recursive: true });
    for (const task of tasks) {
      fs.writeFileSync(path.join(tasksDir, `${task.id}.json`), JSON.stringify({
        id: task.id,
        phase: task.phase,
        status: task.status,
        goal: task.goal,
        keywords: '',
        depends: [],
        commands: [],
        files: [],
        agent_id: '',
        agent_role: '',
        runtime: '',
        model_profile: '',
        resolved_model: '',
        skill: '',
        claimed: false,
        claimed_at: '',
        lease_expires_at: '',
        resolution: '',
        created_at: '2026-05-04T00:00:00.000Z',
        updated_at: '2026-05-04T00:00:00.000Z',
      }, null, 2), 'utf8');
    }
  }
  return { dir, root: { id: 'sample', path: '.', planningDir: '.planning' } };
}

describe('state-reader nextAction derivation', () => {
  test('falls back to legacy <next-action> when no computable source exists', () => {
    const { dir, root } = makeTempRoot({
      stateXml: [
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '  <next-action>Legacy fallback text.</next-action>',
        '</state>',
      ].join('\n'),
    });

    const state = readState(root, dir);
    assert.equal(state.nextAction, 'Legacy fallback text.');
  });

  test('prefers the latest state-log entry tagged with the active phase over stale legacy next-action', () => {
    const { dir, root } = makeTempRoot({
      stateXml: [
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '  <next-action>Stale legacy pointer.</next-action>',
        '  <state-log>',
        '    <entry agent="team-w1" at="2026-05-04T19:00:00.000Z" tags="109">Fresh derived action.</entry>',
        '    <entry agent="team-w1" at="2026-05-04T18:00:00.000Z" tags="109">Older derived action.</entry>',
        '  </state-log>',
        '</state>',
      ].join('\n'),
    });

    const state = readState(root, dir);
    assert.equal(state.nextAction, 'Fresh derived action.');
  });

  test('falls back to the lowest-numbered planned task in the active phase', () => {
    const { dir, root } = makeTempRoot({
      stateXml: [
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '</state>',
      ].join('\n'),
      tasks: [
        { id: '109-03', phase: '109', status: 'planned', goal: 'Third task.' },
        { id: '109-01', phase: '109', status: 'planned', goal: 'First task.' },
        { id: '108-09', phase: '108', status: 'planned', goal: 'Wrong phase.' },
      ],
    });

    const state = readState(root, dir);
    assert.equal(state.nextAction, 'Next: 109-01 — First task.');
  });

  test('falls back to the active phase goal when no state-log entry or planned task exists', () => {
    const { dir, root } = makeTempRoot({
      stateXml: [
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '</state>',
      ].join('\n'),
      roadmapXml: [
        '<roadmap>',
        '  <phase id="109">',
        '    <title>Phase 109</title>',
        '    <goal>Drop stale next-action writes.</goal>',
        '    <status>active</status>',
        '  </phase>',
        '</roadmap>',
      ].join('\n'),
    });

    const state = readState(root, dir);
    assert.equal(state.nextAction, 'Phase 109 goal: Drop stale next-action writes.');
  });
});
