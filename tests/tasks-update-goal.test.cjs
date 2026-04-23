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

function writeTaskFile(tmpDir, id, task) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const canonical = Object.assign({
    id,
    phase: id.split('-')[0] || '',
    status: 'planned',
    goal: '',
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
    created_at: '2026-04-22T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z',
  }, task);
  fs.writeFileSync(path.join(tasksDir, `${id}.json`), JSON.stringify(canonical, null, 2), 'utf8');
}

describe('gad tasks update', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-tasks-update-');
    writeConfig(tmpDir);
    writeTaskFile(tmpDir, '63-06', { phase: '63', status: 'planned', goal: 'Original goal text.' });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('rewrites an existing task goal (--goal)', () => {
    const result = runGadCli([
      'tasks', 'update', '63-06',
      '--projectid', 'sample',
      '--goal', 'Updated goal text.',
    ], tmpDir);

    assert.equal(result.success, true, `tasks update should succeed: ${result.error}`);
    assert.match(result.output, /Updated task 63-06/i);

    const json = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', '63-06.json'), 'utf8'));
    assert.equal(json.goal, 'Updated goal text.');
  });

  test('appends text with --append-goal', () => {
    const result = runGadCli([
      'tasks', 'update', '63-06',
      '--projectid', 'sample',
      '--append-goal', 'Extra context.',
    ], tmpDir);

    assert.equal(result.success, true, `tasks update should succeed: ${result.error}`);
    const json = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', '63-06.json'), 'utf8'));
    assert.equal(json.goal, 'Original goal text. Extra context.');
  });

  test('moves a task to a different phase (--phase)', () => {
    const result = runGadCli([
      'tasks', 'update', '63-06',
      '--projectid', 'sample',
      '--phase', '66',
    ], tmpDir);

    assert.equal(result.success, true, `tasks update should succeed: ${result.error}`);
    const json = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', '63-06.json'), 'utf8'));
    assert.equal(json.phase, '66');
  });

  test('updates type / status / depends in one call', () => {
    const result = runGadCli([
      'tasks', 'update', '63-06',
      '--projectid', 'sample',
      '--type', 'cleanup',
      '--status', 'in-progress',
      '--depends', '63-05,63-04',
    ], tmpDir);

    assert.equal(result.success, true, `tasks update should succeed: ${result.error}`);
    const json = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', '63-06.json'), 'utf8'));
    assert.equal(json.type, 'cleanup');
    assert.equal(json.status, 'in-progress');
    assert.deepEqual(json.depends, ['63-05', '63-04']);
  });

  test('fails when nothing is being updated', () => {
    const result = runGadCli([
      'tasks', 'update', '63-06',
      '--projectid', 'sample',
    ], tmpDir);
    assert.equal(result.success, false);
    assert.match(result.error, /Nothing to update/i);
  });

  test('fails when task id does not exist', () => {
    const result = runGadCli([
      'tasks', 'update', '99-99',
      '--projectid', 'sample',
      '--goal', 'x',
    ], tmpDir);
    assert.equal(result.success, false);
    assert.match(result.error, /not found/i);
  });
});
