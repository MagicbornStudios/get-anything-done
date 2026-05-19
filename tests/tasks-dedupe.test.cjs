'use strict';
/**
 * Tests for `gad tasks dedupe` + lib/tasks-dedupe.cjs.
 *
 * Surfaces:
 *   - lib pure functions (suffixOf, findDuplicateGroups, mergeGroup, applyDedupe)
 *   - CLI dry-run (default) reports duplicates without touching disk
 *   - CLI --apply merges legacy → canonical and deletes legacy files
 *   - --json output shape stable
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { runGadCli, createTempGitProject, cleanup } = require('./helpers.cjs');
const dedupeLib = require('../lib/tasks-dedupe.cjs');
const taskFiles = require('../lib/task-files.cjs');

function writeConfig(tmpDir) {
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), [
    '[planning]',
    '',
    '[[planning.roots]]',
    'id = "global"',
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
  fs.writeFileSync(
    path.join(tasksDir, `${taskFiles.sanitizeId(task.id)}.json`),
    JSON.stringify({
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
      created_at: '2026-05-01T00:00:00.000Z',
      updated_at: '2026-05-01T00:00:00.000Z',
      ...task,
    }, null, 2),
    'utf8'
  );
}

describe('lib/tasks-dedupe (pure)', () => {
  test('suffixOf strips canonical <NS>-T- prefix', () => {
    assert.equal(dedupeLib.suffixOf('GLOBAL-T-245-07'), '245-07');
    assert.equal(dedupeLib.suffixOf('GAD-T-44-13'), '44-13');
    assert.equal(dedupeLib.suffixOf('245-07'), '245-07'); // legacy unchanged
    assert.equal(dedupeLib.suffixOf(''), '');
  });

  test('isCanonical recognises namespaced ids', () => {
    assert.equal(dedupeLib.isCanonical('GLOBAL-T-245-07'), true);
    assert.equal(dedupeLib.isCanonical('245-07'), false);
    assert.equal(dedupeLib.isCanonical('global-t-245-07'), false); // case-sensitive
  });

  test('preferredStatus picks the best terminal/non-terminal value', () => {
    assert.equal(dedupeLib.preferredStatus('planned', 'done'), 'done');
    assert.equal(dedupeLib.preferredStatus('done', 'in-progress'), 'done');
    assert.equal(dedupeLib.preferredStatus('cancelled', 'planned'), 'planned');
    assert.equal(dedupeLib.preferredStatus('in-progress', 'planned'), 'in-progress');
  });

  test('unionFiles dedupes while preserving order', () => {
    assert.deepEqual(
      dedupeLib.unionFiles(['a', 'b'], ['b', 'c'], ['a', 'd']),
      ['a', 'b', 'c', 'd']
    );
  });
});

describe('lib/tasks-dedupe.findDuplicateGroups (disk)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gad-dedupe-find-');
    writeConfig(tmpDir);
  });

  afterEach(() => cleanup(tmpDir));

  test('finds groups by suffix; ignores singletons', () => {
    writeTask(tmpDir, { id: '245-07', phase: '245', status: 'planned', goal: 'legacy stub' });
    writeTask(tmpDir, { id: 'GLOBAL-T-245-07', phase: '245', status: 'done', goal: 'canonical', agent_id: 'wave-f3' });
    writeTask(tmpDir, { id: 'GLOBAL-T-245-08', phase: '245', status: 'done', goal: 'singleton (no dup)' });
    writeTask(tmpDir, { id: '300-01', phase: '300', status: 'planned', goal: 'singleton legacy' });

    const planningDir = path.join(tmpDir, '.planning');
    const groups = dedupeLib.findDuplicateGroups(planningDir);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].suffix, '245-07');
    assert.equal(groups[0].canonical.id, 'GLOBAL-T-245-07');
    assert.equal(groups[0].legacy.length, 1);
    assert.equal(groups[0].legacy[0].id, '245-07');
  });
});

describe('lib/tasks-dedupe.mergeGroup', () => {
  test('canonical done + legacy done → done; files unioned', () => {
    const group = {
      suffix: '245-07',
      canonical: taskFiles.normalizeTask({
        id: 'GLOBAL-T-245-07', phase: '245', status: 'done',
        goal: 'canonical goal', agent_id: 'wave-f3',
        files: ['a.cjs'],
      }),
      legacy: [taskFiles.normalizeTask({
        id: '245-07', phase: '245', status: 'done',
        goal: 'legacy goal', agent_id: 'claude-code',
        files: ['b.cjs', 'a.cjs'],
      })],
    };
    const merged = dedupeLib.mergeGroup(group);
    assert.equal(merged.id, 'GLOBAL-T-245-07');
    assert.equal(merged.status, 'done');
    assert.deepEqual(merged.files, ['a.cjs', 'b.cjs']);
    assert.equal(merged.agent_id, 'wave-f3'); // canonical preferred
    assert.equal(merged.goal, 'canonical goal');
  });

  test('canonical planned + legacy done → status promotes to done', () => {
    const group = {
      suffix: '245-07',
      canonical: taskFiles.normalizeTask({
        id: 'GLOBAL-T-245-07', phase: '245', status: 'planned',
        goal: 'canonical', files: [],
      }),
      legacy: [taskFiles.normalizeTask({
        id: '245-07', phase: '245', status: 'done',
        goal: 'legacy', agent_id: 'claude-code',
        files: ['real.cjs'],
      })],
    };
    const merged = dedupeLib.mergeGroup(group);
    assert.equal(merged.status, 'done');
    // canonical agent_id was empty, falls back to legacy
    assert.equal(merged.agent_id, 'claude-code');
    assert.deepEqual(merged.files, ['real.cjs']);
  });

  test('returns null when no canonical exists', () => {
    const group = {
      suffix: '999-01',
      canonical: null,
      legacy: [taskFiles.normalizeTask({ id: '999-01', phase: '999', status: 'planned', goal: 'orphan' })],
    };
    assert.equal(dedupeLib.mergeGroup(group), null);
  });
});

describe('gad tasks dedupe CLI', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject('gad-dedupe-cli-');
    writeConfig(tmpDir);

    writeTask(tmpDir, {
      id: '245-07',
      phase: '245',
      status: 'planned',
      goal: 'legacy entry never stamped',
    });
    writeTask(tmpDir, {
      id: 'GLOBAL-T-245-07',
      phase: '245',
      status: 'done',
      goal: 'canonical stamped done',
      agent_id: 'wave-f3',
      runtime: 'claude-code',
      files: ['vendor/get-anything-done/bin/commands/_ask-llm.cjs'],
    });
    writeTask(tmpDir, {
      id: '245-08',
      phase: '245',
      status: 'done',
      goal: 'legacy entry stamped first',
      agent_id: 'claude-code',
      files: ['legacy/file.cjs'],
    });
    writeTask(tmpDir, {
      id: 'GLOBAL-T-245-08',
      phase: '245',
      status: 'planned',
      goal: 'canonical newer wins identity',
      files: ['canonical/file.cjs'],
    });
    // Singleton — must not appear.
    writeTask(tmpDir, {
      id: 'GLOBAL-T-300-01',
      phase: '300',
      status: 'planned',
      goal: 'singleton',
    });
  });

  afterEach(() => cleanup(tmpDir));

  test('dry-run reports duplicates without touching disk', () => {
    const planningDir = path.join(tmpDir, '.planning');
    const before = fs.readdirSync(path.join(planningDir, 'tasks')).sort();

    const result = runGadCli(['tasks', 'dedupe', '--projectid', 'global'], tmpDir);
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Found 2 duplicate group/);
    assert.match(result.output, /suffix: 245-07/);
    assert.match(result.output, /suffix: 245-08/);
    assert.match(result.output, /canonical: GLOBAL-T-245-07/);
    assert.match(result.output, /legacy:\s+245-07/);
    assert.doesNotMatch(result.output, /singleton/);

    const after = fs.readdirSync(path.join(planningDir, 'tasks')).sort();
    assert.deepEqual(after, before, 'dry-run must not modify disk');
  });

  test('--json emits structured group report', () => {
    const result = runGadCli(['tasks', 'dedupe', '--projectid', 'global', '--json'], tmpDir);
    assert.equal(result.success, true, result.error);
    const parsed = JSON.parse(result.output);
    assert.equal(parsed.apply, false);
    assert.equal(parsed.groups.length, 2);
    const g0 = parsed.groups.find((g) => g.suffix === '245-07');
    assert.equal(g0.canonical, 'GLOBAL-T-245-07');
    assert.equal(g0.legacy[0].id, '245-07');
    assert.equal(g0.mergeable, true);
  });

  test('--apply merges legacy → canonical, deletes legacy files', () => {
    const planningDir = path.join(tmpDir, '.planning');
    const result = runGadCli(['tasks', 'dedupe', '--projectid', 'global', '--apply'], tmpDir);
    assert.equal(result.success, true, result.error);
    assert.match(result.output, /Applied dedupe across 2/);

    const remaining = fs.readdirSync(path.join(planningDir, 'tasks')).sort();
    assert.ok(!remaining.includes('245-07.json'), 'legacy 245-07.json must be deleted');
    assert.ok(!remaining.includes('245-08.json'), 'legacy 245-08.json must be deleted');
    assert.ok(remaining.includes('GLOBAL-T-245-07.json'), 'canonical 245-07 must remain');
    assert.ok(remaining.includes('GLOBAL-T-245-08.json'), 'canonical 245-08 must remain');
    assert.ok(remaining.includes('GLOBAL-T-300-01.json'), 'singleton untouched');

    // Merged 245-07: canonical already done; merged keeps done.
    const merged07 = taskFiles.readOne(planningDir, 'GLOBAL-T-245-07');
    assert.equal(merged07.status, 'done');
    assert.equal(merged07.agent_id, 'wave-f3');

    // Merged 245-08: canonical was planned, legacy was done — status promotes
    // to done, agent_id falls back to legacy (canonical was empty), files
    // unioned.
    const merged08 = taskFiles.readOne(planningDir, 'GLOBAL-T-245-08');
    assert.equal(merged08.status, 'done');
    assert.equal(merged08.agent_id, 'claude-code');
    assert.deepEqual(
      merged08.files.sort(),
      ['canonical/file.cjs', 'legacy/file.cjs'].sort()
    );
  });

  test('re-running --apply on a clean tree is a no-op', () => {
    runGadCli(['tasks', 'dedupe', '--projectid', 'global', '--apply'], tmpDir);
    const second = runGadCli(['tasks', 'dedupe', '--projectid', 'global'], tmpDir);
    assert.equal(second.success, true, second.error);
    assert.match(second.output, /No duplicate task entries found/);
  });
});
