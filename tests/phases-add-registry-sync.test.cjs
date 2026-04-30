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

function writeRoadmap(tmpDir) {
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
}

function writeLegacyRegistry(tmpDir) {
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

describe('gad phases add — primary path (no TASK-REGISTRY.xml)', () => {
  // Post-63-53: projects use per-task JSON; TASK-REGISTRY.xml is absent.
  // phases add must succeed without it.
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-noxmlreg-');
    writeConfig(tmpDir);
    writeRoadmap(tmpDir);
    // No TASK-REGISTRY.xml — this is the modern state.
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phases add succeeds with no TASK-REGISTRY.xml present', () => {
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

    assert.equal(result.success, true, `phases add should succeed without TASK-REGISTRY.xml: ${result.error}`);
    assert.match(result.output, /Added phase 02/i);

    const roadmapXml = fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), 'utf8');
    assert.match(roadmapXml, /<phase id="02">[\s\S]*?<title>Phase 02<\/title>/);
    // No TASK-REGISTRY.xml should be created
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml')), false);
  });
});

describe('gad phases add — legacy compat (TASK-REGISTRY.xml present)', () => {
  // Pre-migration projects still have TASK-REGISTRY.xml. phases add should
  // mirror the empty phase container into it for backward compatibility.
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-phases-sync-');
    writeConfig(tmpDir);
    writeRoadmap(tmpDir);
    writeLegacyRegistry(tmpDir);
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

