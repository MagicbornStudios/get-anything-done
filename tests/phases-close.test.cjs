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
  <phase id="42.1">
    <title>Blocked close</title>
    <goal>Has unfinished tasks.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="42.2">
    <title>Clean close</title>
    <goal>Everything is resolved.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
  <phase id="42.3">
    <title>Cancel me</title>
    <goal>This work is obsolete.</goal>
    <status>planned</status>
    <depends></depends>
  </phase>
</roadmap>
`, 'utf8');

  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>42.1</current-phase>
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

function readRoadmap(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), 'utf8');
}

function readState(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), 'utf8');
}

describe('gad phases close and cancel', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-close-');
    writeConfig(tmpDir);
    writePlanning(tmpDir);
    writeTask(tmpDir, { id: '42.1-01', phase: '42.1', status: 'done', goal: 'Done work.' });
    writeTask(tmpDir, { id: '42.1-02', phase: '42.1', status: 'planned', goal: 'Finish the remaining cleanup.' });
    writeTask(tmpDir, { id: '42.1-03', phase: '42.1', status: 'in-progress', goal: 'Uniform workflow frontmatter.' });
    writeTask(tmpDir, { id: '42.2-01', phase: '42.2', status: 'done', goal: 'Completed work.' });
    writeTask(tmpDir, { id: '42.2-02', phase: '42.2', status: 'cancelled', goal: 'Moot work.' });
  });

  afterEach(() => cleanup(tmpDir));

  test('refuses to close phases with planned or in-progress tasks', () => {
    const result = runGadCli(['phases', 'close', '42.1', '--projectid', 'sample'], tmpDir);
    assert.equal(result.success, false, 'close should fail with unfinished tasks');
    assert.match(result.error, /Cannot close phase 42\.1: 2 tasks still planned or in-progress/);
    assert.match(result.error, /42\.1-02: Finish the remaining cleanup/);
    assert.match(result.error, /42\.1-03: Uniform workflow frontmatter/);
    assert.match(result.error, /Close or cancel these tasks first/);
    assert.match(readRoadmap(tmpDir), /<phase id="42\.1">[\s\S]*?<status>planned<\/status>/);
  });

  test('closes phase when every task is done or cancelled and logs state', () => {
    const result = runGadCli(['phases', 'close', '42.2', '--projectid', 'sample'], tmpDir, {
      GAD_AGENT_NAME: 'codex-w1',
    });
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Closed phase 42\.2/);

    const roadmap = readRoadmap(tmpDir);
    assert.match(roadmap, /<phase id="42\.2">[\s\S]*?<status>done<\/status>/);
    assert.match(roadmap, /<phase id="42\.1">[\s\S]*?<status>planned<\/status>/);

    const state = readState(tmpDir);
    assert.match(state, /agent="codex-w1"/);
    assert.match(state, /Closed phase 42\.2 via gad phases close - 1 tasks done, 1 cancelled\./);
  });

  test('cancels phase, appends reason to goal, and keeps XML parseable', () => {
    const result = runGadCli([
      'phases',
      'cancel',
      '42.3',
      '--projectid',
      'sample',
      '--reason',
      'replaced by phase 42.4',
    ], tmpDir, { GAD_AGENT_NAME: 'codex-w1' });
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Cancelled phase 42\.3/);

    const roadmap = readRoadmap(tmpDir);
    assert.match(roadmap, /<phase id="42\.3">[\s\S]*?<status>cancelled<\/status>/);
    assert.match(roadmap, /<goal>This work is obsolete\. \[CANCELLED \d{4}-\d{2}-\d{2}: replaced by phase 42\.4\]<\/goal>/);

    const audit = runGadCli(['phases', 'audit', '--projectid', 'sample', '--json'], tmpDir);
    assert.equal(audit.success, true, audit.error);
    const byId = Object.fromEntries(JSON.parse(audit.output).map((row) => [row.id, row]));
    assert.equal(byId['42.3'].verdict, 'CANCELLED');
    assert.match(readState(tmpDir), /Cancelled phase 42\.3 via gad phases cancel - replaced by phase 42\.4/);
  });
});
