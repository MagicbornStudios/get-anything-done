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
  <phase id="10">
    <title>Cancelled dependency</title>
    <goal>Cancelled upstream.</goal>
    <status>cancelled</status>
    <depends></depends>
  </phase>
  <phase id="11">
    <title>Ready close</title>
    <goal>All work closed.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="12">
    <title>Superseded child</title>
    <goal>Depends on cancelled work.</goal>
    <status>planned</status>
    <depends>10</depends>
  </phase>
  <phase id="13">
    <title>Empty planned</title>
    <goal>No tasks yet.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="14">
    <title>Stale tasks</title>
    <goal>Has stale task.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
</roadmap>
`, 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <state-log>
  </state-log>
</state>
`, 'utf8');
}

function writeTask(tmpDir, task) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${task.id}.json`), JSON.stringify({
    type: '',
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
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z',
    ...task,
  }, null, 2), 'utf8');
}

function readRoadmap(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), 'utf8');
}

function readTask(tmpDir, id) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', `${id}.json`), 'utf8'));
}

describe('gad backlog sweep', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-backlog-sweep-');
    writeConfig(tmpDir);
    writePlanning(tmpDir);
    writeTask(tmpDir, { id: '11-01', phase: '11', status: 'done', goal: 'Done.' });
    writeTask(tmpDir, { id: '11-02', phase: '11', status: 'cancelled', goal: 'Cancelled.' });
    writeTask(tmpDir, {
      id: '14-01',
      phase: '14',
      status: 'in-progress',
      goal: 'Stale task.',
      updated_at: '2026-03-01T00:00:00.000Z',
    });
  });

  afterEach(() => cleanup(tmpDir));

  test('JSON report groups phase and task recommendations', () => {
    const result = runGadCli(['backlog', 'sweep', '--projectid', 'sample', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);
    const report = JSON.parse(result.output);

    assert.deepEqual(report.ready_to_close_phases.map((row) => row.id), ['11']);
    assert.deepEqual(report.superseded_phases.map((row) => row.id), ['12']);
    assert.deepEqual(report.empty_phases.map((row) => row.id), ['12', '13']);
    assert.deepEqual(report.stale_tasks.map((row) => row.id), ['14-01']);
    assert.ok(report.stale_tasks[0].flags.includes('STALE-INPROGRESS'));
    assert.ok(report.stale_tasks[0].flags.includes('ORPHAN'));
    assert.ok(report.stale_tasks[0].flags.includes('NO-CHANGES'));
  });

  test('markdown report is human-readable', () => {
    const result = runGadCli(['backlog', 'sweep', '--projectid', 'sample'], tmpDir);
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /# Backlog Sweep: sample/);
    assert.match(result.output, /## READY-TO-CLOSE phases/);
    assert.match(result.output, /gad phases close 11 --projectid sample/);
    assert.match(result.output, /## STALE TASKS/);
    assert.match(result.output, /14-01/);
  });

  test('--apply --yes closes, cancels, and stamps stale task reviews', () => {
    const result = runGadCli(['backlog', 'sweep', '--projectid', 'sample', '--apply', '--yes'], tmpDir, {
      GAD_AGENT_NAME: 'team-w1',
    });
    assert.equal(result.success, true, result.error);

    const roadmap = readRoadmap(tmpDir);
    assert.match(roadmap, /<phase id="11">[\s\S]*?<status>done<\/status>/);
    assert.match(roadmap, /<phase id="12">[\s\S]*?<status>cancelled<\/status>/);
    assert.match(roadmap, /dependency cascade/);

    const staleTask = readTask(tmpDir, '14-01');
    assert.match(staleTask.resolution, /Backlog sweep review requested/);
    assert.match(staleTask.resolution, /STALE-INPROGRESS/);
  });
});
