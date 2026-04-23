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

function writeTaskJson(tmpDir, id, patch = {}) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const canonical = Object.assign({
    id,
    phase: '55',
    status: 'in-progress',
    goal: '',
    type: 'framework',
    keywords: '',
    depends: [],
    commands: [],
    files: [],
    agent_id: 'codex-default-0001',
    agent_role: '',
    runtime: '',
    model_profile: '',
    resolved_model: '',
    skill: '',
    claimed: false,
    claimed_at: '',
    lease_expires_at: '',
    resolution: '',
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z',
  }, patch);
  fs.writeFileSync(path.join(tasksDir, `${id}.json`), JSON.stringify(canonical, null, 2), 'utf8');
}

function writePlanning(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), '<state><current-phase>55</current-phase></state>\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.xml'), '<roadmap><phase id="55"><title>Phase 55</title><status>active</status></phase></roadmap>\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'DECISIONS.xml'), '<decisions />\n', 'utf8');
  writeTaskJson(tmpDir, '55-01', { goal: 'Reject sentinel skill attributions.' });
  writeTaskJson(tmpDir, '55-02', { goal: 'Allow explicit no-skill attribution.' });
  writeTaskJson(tmpDir, '55-03', { goal: 'Preserve real skill attribution.' });
}

function readTaskJson(tmpDir, id) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', `${id}.json`), 'utf8'));
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
      'tasks', 'release', '55-01',
      '--projectid', 'sample',
      '--done',
      '--skill', 'DEFAULT',
    ], tmpDir);

    assert.equal(result.success, false);
    assert.match(result.error, /placeholder, not a real skill/);
  });

  test('accepts --no-skill and writes an empty skill attribute', () => {
    const result = runGadCli([
      'tasks', 'release', '55-02',
      '--projectid', 'sample',
      '--done',
      '--no-skill',
    ], tmpDir);

    assert.equal(result.success, true, result.error);
    const task = readTaskJson(tmpDir, '55-02');
    assert.equal(task.status, 'done');
    assert.equal(task.skill, '');
  });

  test('preserves a real skill id', () => {
    const result = runGadCli([
      'tasks', 'release', '55-03',
      '--projectid', 'sample',
      '--done',
      '--skill', 'execute-phase',
    ], tmpDir);

    assert.equal(result.success, true, result.error);
    const task = readTaskJson(tmpDir, '55-03');
    assert.equal(task.skill, 'execute-phase');
    assert.equal(task.status, 'done');
  });
});
