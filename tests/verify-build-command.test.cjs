const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

function writePlanningSkeleton(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>42.4</current-phase>
  <status>active</status>
  <next-action>Verify phase completion with build checks.</next-action>
</state>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="42.4">
    <title>Runtime substrate integration hardening</title>
    <goal>Harden the runtime substrate path and verification loops.</goal>
    <status>in-progress</status>
  </phase>
</roadmap>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="42.4">
  </phase>
</task-registry>
`,
    'utf8',
  );

  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'DECISIONS.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="gad-999">
    <title>Verification should be resilient to script naming</title>
    <summary>Allow non-generic build scripts in verify flow.</summary>
    <impact>Improves reliability for CLI-focused packages.</impact>
  </decision>
</decisions>
`,
    'utf8',
  );
}

function writeConfig(tmpDir, verifyToml = '') {
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
    verifyToml.trim(),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), body, 'utf8');
}

function writePackage(tmpDir, scripts) {
  fs.writeFileSync(
    path.join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'verify-fixture', version: '0.0.0', scripts }, null, 2),
    'utf8',
  );
}

describe('gad verify build command resolution', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-verify-build-');
    writePlanningSkeleton(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('auto fallback uses build:cli when build script is missing', () => {
    writeConfig(tmpDir);
    writePackage(tmpDir, {
      'build:cli': 'node -e "process.exit(0)"',
    });

    const result = runGadCli(['verify', '--projectid', 'sample', '--phase', '42.4'], tmpDir);
    assert.equal(result.success, true, `verify should pass, got: ${result.error}`);
    assert.match(result.output, /build:cli exited 0/i);
  });

  test('project verify.build_commands override takes precedence', () => {
    writeConfig(
      tmpDir,
      [
        '[verify.projects.sample]',
        'build_commands = ["npm run build:hooks"]',
      ].join('\n'),
    );
    writePackage(tmpDir, {
      'build:cli': 'node -e "process.exit(1)"',
      'build:hooks': 'node -e "process.exit(0)"',
    });

    const result = runGadCli(['verify', '--projectid', 'sample', '--phase', '42.4'], tmpDir);
    assert.equal(result.success, true, `verify should pass, got: ${result.error}`);
    assert.match(result.output, /build:hooks exited 0/i);
  });

  test('--build-cmd override beats config', () => {
    writeConfig(
      tmpDir,
      [
        '[verify.projects.sample]',
        'build_commands = ["npm run build:cli"]',
      ].join('\n'),
    );
    writePackage(tmpDir, {
      'build:cli': 'node -e "process.exit(1)"',
      'build:hooks': 'node -e "process.exit(0)"',
    });

    const result = runGadCli(
      ['verify', '--projectid', 'sample', '--phase', '42.4', '--build-cmd', 'npm run build:hooks'],
      tmpDir,
    );
    assert.equal(result.success, true, `verify should pass with --build-cmd override, got: ${result.error}`);
    assert.match(result.output, /build:hooks exited 0/i);
  });
});
