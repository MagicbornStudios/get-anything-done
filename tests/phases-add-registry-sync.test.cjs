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

function writePlanningSkeleton(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01">
    <title>Phase 01</title>
    <goal>Bootstrap.</goal>
    <status>done</status>
    <depends></depends>
  </phase>
</roadmap>
`,
    'utf8',
  );
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="01">
    <task id="01-01" status="done">
      <goal>Bootstrap complete.</goal>
    </task>
  </phase>
</task-registry>
`,
    'utf8',
  );
}

describe('gad phases add syncs TASK-REGISTRY phase containers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-sync-');
    writeConfig(tmpDir);
    writePlanningSkeleton(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('adds a roadmap phase and mirrors an empty phase container into TASK-REGISTRY.xml', () => {
    const result = runGadCli([
      'phases',
      'add',
      '02',
      '--projectid',
      'sample',
      '--title',
      'Phase 02',
      '--goal',
      'Implement phase sync.',
    ], tmpDir);

    assert.equal(result.success, true, `phases add should succeed: ${result.error}`);
    assert.match(result.output, /Task registry phase sync: inserted/i);

    const roadmapXml = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), 'utf8');
    const tasksXml = fs.readFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), 'utf8');

    assert.match(roadmapXml, /<phase id="02">[\s\S]*?<title>Phase 02<\/title>/);
    assert.match(tasksXml, /<phase id="02">\s*<\/phase>/);
  });
});

