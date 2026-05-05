const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

function writeConfig(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), [
    '[planning]',
    '',
    '[[planning.roots]]',
    'id = "sample"',
    'path = "."',
    'planningDir = ".planning"',
    'discover = false',
    'enabled = true',
    '',
  ].join('\n'), 'utf8');
}

function writePlanning(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="60.1">
    <title>Sweep candidate</title>
    <goal>Every task done.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="60.2">
    <title>Sweep blocked by handoff</title>
    <goal>Tasks done but handoff still open.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="60.3">
    <title>Still active</title>
    <goal>Has planned task.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
</roadmap>
`, 'utf8');

  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>60.1</current-phase>
  <status>active</status>
  <next-action>Test fixture.</next-action>
  <state-log>
  </state-log>
</state>
`, 'utf8');
}

function writeTask(tmpDir, task) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${task.id}.json`), JSON.stringify(task, null, 2), 'utf8');
}

function writeOpenHandoff(tmpDir, id, projectid, phase) {
  const dir = path.join(tmpDir, '.planning', 'handoffs', 'open');
  fs.mkdirSync(dir, { recursive: true });
  const fm = [
    '---',
    `id: ${id}`,
    `projectid: ${projectid}`,
    `phase: ${phase}`,
    'task_id: null',
    'created_at: 2026-05-05T00:00:00.000Z',
    'created_by: test',
    'claimed_by: ',
    'claimed_at: ',
    'completed_at: null',
    'priority: normal',
    'estimated_context: bounded',
    'risk: safe',
    'time: standard',
    'surface: local',
    '---',
    `Phase ${phase} handoff body`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, `${id}.md`), fm, 'utf8');
}

function readRoadmap(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), 'utf8');
}

describe('gad phases sweep', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-sweep-');
    writeConfig(tmpDir);
    writePlanning(tmpDir);
    // 60.1: all tasks done -> closeable
    writeTask(tmpDir, { id: '60.1-01', phase: '60.1', status: 'done', goal: 'A.' });
    writeTask(tmpDir, { id: '60.1-02', phase: '60.1', status: 'cancelled', goal: 'B.' });
    // 60.2: all tasks done, but open handoff blocks
    writeTask(tmpDir, { id: '60.2-01', phase: '60.2', status: 'done', goal: 'C.' });
    writeOpenHandoff(tmpDir, 'h-2026-05-05T00-00-00-sample-60.2', 'sample', '60.2');
    // 60.3: planned task remains
    writeTask(tmpDir, { id: '60.3-01', phase: '60.3', status: 'done', goal: 'D.' });
    writeTask(tmpDir, { id: '60.3-02', phase: '60.3', status: 'planned', goal: 'E.' });
  });

  afterEach(() => cleanup(tmpDir));

  test('dry-run lists closeable phases and flags handoff-blocked phases without mutating', () => {
    const result = runGadCli(['phases', 'sweep', '--projectid', 'sample', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);
    const data = JSON.parse(result.output);
    assert.equal(data.mode, 'dry-run');
    const closeableIds = data.closeable.map((r) => r.id).sort();
    assert.deepEqual(closeableIds, ['60.1']);
    const blockedIds = data.blocked.map((r) => r.id).sort();
    assert.deepEqual(blockedIds, ['60.2']);
    assert.equal(data.closed.length, 0);
    // Roadmap unchanged
    assert.match(readRoadmap(tmpDir), /<phase id="60\.1">[\s\S]*?<status>planned<\/status>/);
  });

  test('--auto-close closes the phase and writes state log', () => {
    const result = runGadCli(['phases', 'sweep', '--projectid', 'sample', '--auto-close', '--json'], tmpDir, {
      GAD_AGENT_NAME: 'sweep-test',
    });
    assert.equal(result.success, true, result.error);
    const data = JSON.parse(result.output);
    assert.equal(data.mode, 'auto-close');
    assert.deepEqual(data.closed.map((r) => r.id).sort(), ['60.1']);
    assert.match(readRoadmap(tmpDir), /<phase id="60\.1">[\s\S]*?<status>done<\/status>/);
    // 60.2 still planned (blocked by handoff)
    assert.match(readRoadmap(tmpDir), /<phase id="60\.2">[\s\S]*?<status>planned<\/status>/);
    const state = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), 'utf8');
    assert.match(state, /Closed phase 60\.1 via gad phases sweep --auto-close/);
  });

  test('--phase scopes to a single phase id', () => {
    const result = runGadCli(['phases', 'sweep', '--projectid', 'sample', '--phase', '60.3', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);
    const data = JSON.parse(result.output);
    assert.deepEqual(data.closeable, []);
    assert.deepEqual(data.blocked, []);
  });
});
