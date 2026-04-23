const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { runGadCli, createTempGitProject, cleanup } = require('./helpers.cjs');

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

function writeTask(tmpDir, task) {
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, `${task.id}.json`), JSON.stringify({
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
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-22T00:00:00.000Z',
    ...task,
  }, null, 2), 'utf8');
}

describe('gad tasks audit', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gad-tasks-audit-');
    writeConfig(tmpDir);
    writeTask(tmpDir, {
      id: '42-01',
      phase: '42',
      status: 'planned',
      goal: 'Implemented and validated the migration path.',
    });
    writeTask(tmpDir, {
      id: '42-02',
      phase: '42',
      status: 'planned',
      goal: 'Acceptance criteria: migration is validated by tests.',
    });
    writeTask(tmpDir, {
      id: '42-03',
      phase: '42',
      status: 'in-progress',
      goal: 'Old in-progress work.',
      updated_at: '2026-03-01T00:00:00.000Z',
    });
    writeTask(tmpDir, {
      id: '42-04',
      phase: '42',
      status: 'in-progress',
      goal: 'Recently touched work.',
      updated_at: '2026-04-22T00:00:00.000Z',
      agent_id: 'team-w1',
      runtime: 'codex-cli',
      skill: 'default',
    });
    execSync('git add -A', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git commit -m "progress on 42-04"', { cwd: tmpDir, stdio: 'pipe' });
  });

  afterEach(() => cleanup(tmpDir));

  test('JSON audit emits every stale heuristic flag', () => {
    const result = runGadCli(['tasks', 'audit', '--projectid', 'sample', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);
    const rows = Object.fromEntries(JSON.parse(result.output).map((row) => [row.id, row]));

    assert.deepEqual(rows['42-01'].flags, ['GOAL-READS-DONE']);
    assert.deepEqual(rows['42-02'].flags, ['GOAL-READS-DONE']);
    assert.ok(rows['42-03'].flags.includes('STALE-INPROGRESS'));
    assert.ok(rows['42-03'].flags.includes('ORPHAN'));
    assert.ok(rows['42-03'].flags.includes('NO-CHANGES'));
    assert.equal(rows['42-03'].age_days >= 14, true);
    assert.equal(rows['42-04'], undefined, 'unflagged rows are hidden by default');
  });

  test('pretty audit shows only flagged rows unless --all is passed', () => {
    const flagged = runGadCli(['tasks', 'audit', '--projectid', 'sample'], tmpDir);
    assert.equal(flagged.success, true, flagged.error);
    assert.match(flagged.output, /42-01/);
    assert.match(flagged.output, /42-03/);
    assert.doesNotMatch(flagged.output, /42-04/);

    const all = runGadCli(['tasks', 'audit', '--projectid', 'sample', '--all'], tmpDir);
    assert.equal(all.success, true, all.error);
    assert.match(all.output, /42-04/);
  });
});
