const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempProject, cleanup } = require('./helpers.cjs');

const repoRoot = path.resolve(__dirname, '..');
const traceHook = path.join(repoRoot, 'bin', 'gad-trace-hook.cjs');

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
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), [
    '<state>',
    '  <current-phase>63</current-phase>',
    '  <next-action>Verify startup stays read-only in release worktrees.</next-action>',
    '</state>',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), [
    '<roadmap>',
    '  <phase id="63"><title>Phase 63</title><status>active</status><goal>Agent hygiene.</goal></phase>',
    '</roadmap>',
    '',
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'DECISIONS.xml'), '<decisions />\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'TASK-REGISTRY.xml'), [
    '<task-registry>',
    '  <phase id="63">',
    '    <task id="63-01" status="planned" type="cli"><goal>Keep startup clean.</goal></task>',
    '  </phase>',
    '</task-registry>',
    '',
  ].join('\n'), 'utf8');
}

function capturePlanningFiles(tmpDir) {
  const planningDir = path.join(tmpDir, '.planning');
  const out = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const rel = path.relative(planningDir, full).replace(/\\/g, '/');
      out[rel] = fs.readFileSync(full, 'utf8');
    }
  }
  walk(planningDir);
  return out;
}

function runTraceHook(tmpDir, payload, env = {}) {
  execFileSync(process.execPath, [traceHook], {
    cwd: tmpDir,
    input: JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      cwd: tmpDir,
      tool_input: { command: 'node bin/gad.cjs startup --projectid sample' },
      tool_response: { stdout: 'ok' },
      ...payload,
    }),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
}

describe('startup/snapshot no-side-effects mode', () => {
  let tmpDir;
  let userSettingsPath;

  beforeEach(() => {
    tmpDir = createTempProject('gad-startup-no-side-effects-');
    userSettingsPath = path.join(tmpDir, 'gad-user.json');
    writeConfig(tmpDir);
    writePlanning(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('startup --no-side-effects leaves .planning untouched', () => {
    const before = capturePlanningFiles(tmpDir);
    const result = runGadCli([
      'startup',
      '--projectid',
      'sample',
      '--no-side-effects',
    ], tmpDir, { GAD_USER_SETTINGS: userSettingsPath });

    assert.equal(result.success, true, result.error);
    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(userSettingsPath), false);
    assert.match(result.output, /Side effects suppressed:/);
  });

  test('GAD_NO_SIDE_EFFECTS=1 suppresses startup writes', () => {
    const before = capturePlanningFiles(tmpDir);
    const result = runGadCli([
      'startup',
      '--projectid',
      'sample',
    ], tmpDir, {
      GAD_NO_SIDE_EFFECTS: '1',
      GAD_USER_SETTINGS: userSettingsPath,
    });

    assert.equal(result.success, true, result.error);
    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(userSettingsPath), false);
  });

  test('GAD_RELEASE_BUILD=1 suppresses startup writes', () => {
    const before = capturePlanningFiles(tmpDir);
    const result = runGadCli([
      'startup',
      '--projectid',
      'sample',
    ], tmpDir, {
      GAD_RELEASE_BUILD: '1',
      GAD_USER_SETTINGS: userSettingsPath,
    });

    assert.equal(result.success, true, result.error);
    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(userSettingsPath), false);
  });

  test('marker file .gad-release-build suppresses startup writes', () => {
    fs.writeFileSync(path.join(tmpDir, '.gad-release-build'), 'release\n', 'utf8');
    const before = capturePlanningFiles(tmpDir);
    const result = runGadCli([
      'startup',
      '--projectid',
      'sample',
    ], tmpDir, { GAD_USER_SETTINGS: userSettingsPath });

    assert.equal(result.success, true, result.error);
    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(userSettingsPath), false);
  });

  test('snapshot --no-side-effects skips session and graph writes', () => {
    const before = capturePlanningFiles(tmpDir);
    const result = runGadCli([
      'snapshot',
      '--projectid',
      'sample',
      '--no-side-effects',
    ], tmpDir, { GAD_USER_SETTINGS: userSettingsPath });

    assert.equal(result.success, true, result.error);
    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', 'graph.json')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', 'sessions')), false);
  });

  test('trace hook skips release-mode planning writes', () => {
    const before = capturePlanningFiles(tmpDir);
    runTraceHook(tmpDir, {}, { GAD_NO_SIDE_EFFECTS: '1' });
    runTraceHook(tmpDir, {}, { GAD_RELEASE_BUILD: '1' });
    runTraceHook(tmpDir, {
      tool_input: { command: 'node bin/gad.cjs startup --projectid sample --no-side-effects' },
    });
    fs.writeFileSync(path.join(tmpDir, '.gad-release-build'), 'release\n', 'utf8');
    runTraceHook(tmpDir, {});

    const after = capturePlanningFiles(tmpDir);
    assert.deepEqual(after, before);
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', '.trace-events.jsonl')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', '.trace-seq')), false);
    assert.equal(fs.existsSync(path.join(tmpDir, '.planning', '.trace-last-skill')), false);
  });
});
