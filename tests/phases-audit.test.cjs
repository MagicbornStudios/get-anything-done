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

function writeRoadmap(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01">
    <title>Ready phase</title>
    <goal>Ready to close.</goal>
    <status>planned</status>
  </phase>
  <phase id="02">
    <title>Stale phase</title>
    <goal>No useful work remains.</goal>
    <status>planned</status>
  </phase>
  <phase id="03">
    <title>Active phase</title>
    <goal>Still has work.</goal>
    <status>planned</status>
  </phase>
  <phase id="04">
    <title>Done phase</title>
    <goal>Already complete.</goal>
    <status>done</status>
  </phase>
  <phase id="05">
    <title>Cancelled phase</title>
    <goal>Already cancelled.</goal>
    <status>cancelled</status>
  </phase>
</roadmap>
`, 'utf8');
}

function writeTask(tmpDir, task) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${task.id}.json`), JSON.stringify(task, null, 2), 'utf8');
}

describe('gad phases audit', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-audit-');
    writeConfig(tmpDir);
    writeRoadmap(tmpDir);
    writeTask(tmpDir, { id: '01-01', phase: '01', status: 'done', goal: 'Finished.' });
    writeTask(tmpDir, { id: '02-01', phase: '02', status: 'cancelled', goal: 'Moot.' });
    writeTask(tmpDir, { id: '03-01', phase: '03', status: 'planned', goal: 'Open task.' });
    writeTask(tmpDir, { id: '03-02', phase: '03', status: 'in-progress', goal: 'Running task.' });
    writeTask(tmpDir, { id: '04-01', phase: '04', status: 'done', goal: 'Done task.' });
    writeTask(tmpDir, { id: '05-01', phase: '05', status: 'cancelled', goal: 'Cancelled task.' });
  });

  afterEach(() => cleanup(tmpDir));

  test('reports all verdicts as JSON', () => {
    const result = runGadCli(['phases', 'audit', '--projectid', 'sample', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);

    const rows = JSON.parse(result.output);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));

    assert.equal(byId['01'].verdict, 'READY-TO-CLOSE');
    assert.equal(byId['01'].tasks, '1/1/0/0');
    assert.equal(byId['02'].verdict, 'STALE');
    assert.equal(byId['03'].verdict, 'ACTIVE');
    assert.equal(byId['03'].in_progress, 1);
    assert.equal(byId['04'].verdict, 'DONE');
    assert.equal(byId['05'].verdict, 'CANCELLED');
  });

  test('renders a pretty table by default', () => {
    const result = runGadCli(['phases', 'audit', '--projectid', 'sample'], tmpDir);
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Phase Audit \(5\)/);
    assert.match(result.output, /READY-TO-CLOSE/);
    assert.match(result.output, /Tasks column: total\/done\/planned\/cancelled/);
  });
});
