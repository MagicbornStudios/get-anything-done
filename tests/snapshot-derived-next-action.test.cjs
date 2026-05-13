'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { readState } = require('../lib/state-reader.cjs');
const { compactStateXml } = require('../lib/snapshot-compact.cjs');

function makeTempRoot({ stateXml, roadmapXml, tasks = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-snapshot-derived-next-action-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.xml'), stateXml, 'utf8');
  fs.writeFileSync(path.join(planningDir, 'ROADMAP.xml'), roadmapXml, 'utf8');
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

function renderSnapshotStateSection(root, dir) {
  const state = readState(root, dir);
  const stateXml = fs.readFileSync(path.join(dir, '.planning', 'STATE.xml'), 'utf8');
  return compactStateXml(stateXml, state.nextAction);
}

const ROADMAP_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<roadmap>',
  '  <phase id="109">',
  '    <title>Phase 109</title>',
  '    <goal>Drop stale next-action writes.</goal>',
  '    <status>active</status>',
  '  </phase>',
  '</roadmap>',
  '',
].join('\n');

describe('snapshot STATE section uses derived next-action', () => {
  test('prefers fresh state-log content over stale <next-action>', () => {
    const { dir, root } = makeTempRoot({
      roadmapXml: ROADMAP_XML,
      stateXml: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '  <next-action>Stale legacy pointer.</next-action>',
        '  <state-log>',
        '    <entry agent="team-w1" at="2026-05-04T19:00:00.000Z" tags="109">Fresh state-log action.</entry>',
        '  </state-log>',
        '</state>',
        '',
      ].join('\n'),
    });

    const output = renderSnapshotStateSection(root, dir);
    assert.match(output, /next-action: Fresh state-log action\./);
    assert.doesNotMatch(output, /next-action: Stale legacy pointer\./);
  });

  test('uses the lowest planned task when STATE.xml has no next-action field', () => {
    const { dir, root } = makeTempRoot({
      roadmapXml: ROADMAP_XML,
      stateXml: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '</state>',
        '',
      ].join('\n'),
      tasks: [
        { id: '109-02', phase: '109', status: 'planned', goal: 'Second task.' },
        { id: '109-01', phase: '109', status: 'planned', goal: 'First task.' },
      ],
    });

    const output = renderSnapshotStateSection(root, dir);
    assert.match(output, /next-action: Next: 109-01 — First task\./);
  });

  test('uses the phase goal when there is no next-action field and no planned task', () => {
    const { dir, root } = makeTempRoot({
      roadmapXml: ROADMAP_XML,
      stateXml: [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<state>',
        '  <current-phase>109</current-phase>',
        '  <status>active</status>',
        '</state>',
        '',
      ].join('\n'),
    });

    const output = renderSnapshotStateSection(root, dir);
    assert.match(output, /next-action: Phase 109 goal: Drop stale next-action writes\./);
  });
});
