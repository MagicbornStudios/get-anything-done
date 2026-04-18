const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

function writeConfig(tmpDir) {
  const body = [
    '[planning]',
    '',
    '[[planning.roots]]',
    'id = "sample"',
    'path = "."',
    'planningDir = ".planning"',
    'discover = false',
    'enabled = true',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), body, 'utf8');
}

function writeTaskRegistry(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="63">
    <task id="63-06" status="planned">
      <goal>Original goal text.</goal>
    </task>
  </phase>
</task-registry>
`,
    'utf8',
  );
}

describe('gad tasks update --goal', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-tasks-update-');
    writeConfig(tmpDir);
    writeTaskRegistry(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('rewrites an existing task goal', () => {
    const result = runGadCli([
      'tasks',
      'update',
      '63-06',
      '--projectid',
      'sample',
      '--goal',
      'Updated goal text.',
    ], tmpDir);

    assert.equal(result.success, true, `tasks update should succeed: ${result.error}`);
    assert.match(result.output, /Updated task 63-06 goal/i);

    const xml = fs.readFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), 'utf8');
    assert.match(xml, /<task id="63-06"[\s\S]*?<goal>Updated goal text\.<\/goal>/);
    assert.doesNotMatch(xml, /<goal>Original goal text\.<\/goal>/);
  });

  test('fails with TASK_NOT_FOUND when task id does not exist', () => {
    const result = runGadCli([
      'tasks',
      'update',
      '99-99',
      '--projectid',
      'sample',
      '--goal',
      'x',
    ], tmpDir);
    assert.equal(result.success, false);
    assert.match(result.error, /TASK_NOT_FOUND/i);
  });
});

