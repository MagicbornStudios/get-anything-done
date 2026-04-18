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
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), '<state><current-phase>55</current-phase></state>\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), '<roadmap><phase id="55"><title>Phase 55</title><status>active</status></phase></roadmap>\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'DECISIONS.xml'), '<decisions />\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<task-registry>',
    '  <phase id="55">',
    '    <task id="55-01" status="in-progress" type="framework" agent-id="codex-default-0001">',
    '      <goal>Reject sentinel skill attributions.</goal>',
    '    </task>',
    '    <task id="55-02" status="in-progress" type="framework" agent-id="codex-default-0001">',
    '      <goal>Allow explicit no-skill attribution.</goal>',
    '    </task>',
    '    <task id="55-03" status="in-progress" type="framework" agent-id="codex-default-0001">',
    '      <goal>Preserve real skill attribution.</goal>',
    '    </task>',
    '  </phase>',
    '</task-registry>',
    '',
  ].join('\n'), 'utf8');
}

describe('tasks release skill rejection', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-release-skill-');
    writeConfig(tmpDir);
    writePlanning(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('rejects sentinel skill values case-insensitively', () => {
    const result = runGadCli([
      'tasks',
      'release',
      '55-01',
      '--projectid',
      'sample',
      '--done',
      '--skill',
      'DEFAULT',
    ], tmpDir);

    assert.equal(result.success, false);
    assert.match(result.error, /placeholder, not a real skill/);
  });

  test('accepts --no-skill and writes an empty skill attribute', () => {
    const result = runGadCli([
      'tasks',
      'release',
      '55-02',
      '--projectid',
      'sample',
      '--done',
      '--no-skill',
    ], tmpDir);

    assert.equal(result.success, true, result.error);
    const xml = fs.readFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), 'utf8');
    assert.match(xml, /<task id="55-02" status="done" type="framework" agent-id="codex-default-0001" skill="">/);
  });

  test('preserves a real skill id', () => {
    const result = runGadCli([
      'tasks',
      'release',
      '55-03',
      '--projectid',
      'sample',
      '--done',
      '--skill',
      'execute-phase',
    ], tmpDir);

    assert.equal(result.success, true, result.error);
    const xml = fs.readFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), 'utf8');
    assert.match(xml, /skill="execute-phase"/);
  });
});
