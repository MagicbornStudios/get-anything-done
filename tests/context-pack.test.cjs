'use strict';
/**
 * tests/context-pack.test.cjs — unit tests for lib/context-pack/index.cjs
 *
 * Coverage:
 *   1. cid lookup returns the containing file (integration: searches real repo)
 *   2. task-id lookup reads files[] from .planning/tasks/
 *   3. graceful "not found" for both cid and task-id
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { buildContextPack } = require('../lib/context-pack/index.cjs');

// Repo root = two levels up from this test file (vendor/get-anything-done/tests/ -> monorepo root)
// The context-pack tests need a real repo to git-grep against.
// We use the actual monorepo so CID searches work.
const GAD_ROOT = path.resolve(__dirname, '..'); // vendor/get-anything-done
const MONO_ROOT = path.resolve(__dirname, '..', '..', '..'); // repo root

// ---------------------------------------------------------------------------
// Helper: create a minimal temp project with task + source files for isolated tests
// ---------------------------------------------------------------------------
function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-pack-test-'));

  // .planning/tasks/ dir
  fs.mkdirSync(path.join(tmpDir, '.planning', 'tasks'), { recursive: true });

  // A fake task JSON
  const task = {
    id: 'test-01',
    phase: 'test',
    status: 'planned',
    goal: 'Test task for context-pack unit tests.',
    depends: [],
    files: ['src/components/TestWidget.tsx'],
  };
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'tasks', 'test-01.json'),
    JSON.stringify(task, null, 2)
  );

  // A fake source file with a cid
  fs.mkdirSync(path.join(tmpDir, 'src', 'components'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'src', 'components', 'TestWidget.tsx'),
    [
      'import React from "react";',
      'import { invoke } from "@tauri-apps/api/core";',
      '',
      'export function TestWidget() {',
      '  return <div data-cid="test.widget.root">Hello</div>;',
      '}',
    ].join('\n')
  );

  return tmpDir;
}

// ---------------------------------------------------------------------------
// Tests: isolated (temp project, no git grep needed for task-id path)
// ---------------------------------------------------------------------------

describe('buildContextPack — task-id path', () => {
  let tmpDir;

  test('reads task files[] and emits file paths in output', () => {
    tmpDir = createTempProject();
    const pack = buildContextPack({
      taskId: 'test-01',
      repoRoot: tmpDir,
      planningDirs: [path.join(tmpDir, '.planning')],
    });

    assert.ok(
      pack.includes('test-01'),
      'pack should mention the task id'
    );
    assert.ok(
      pack.includes('Test task for context-pack unit tests'),
      'pack should include the task goal'
    );
    assert.ok(
      pack.includes('src/components/TestWidget.tsx'),
      'pack should list files[] from the task'
    );
  });

  test('graceful not-found when task-id does not exist', () => {
    if (!tmpDir) tmpDir = createTempProject();
    const pack = buildContextPack({
      taskId: 'nonexistent-99',
      repoRoot: tmpDir,
      planningDirs: [path.join(tmpDir, '.planning')],
    });

    assert.ok(
      pack.includes('not found') || pack.includes('nonexistent-99'),
      'pack should surface the not-found message or the id'
    );
    // Must not throw — graceful fallback
  });
});

describe('buildContextPack — CID path', () => {
  test('graceful not-found when cid does not exist in any source file', () => {
    // Use a temp dir — no git, no source, so grep returns nothing.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'context-pack-cid-test-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });

    const pack = buildContextPack({
      cid: 'no.such.cid.exists.anywhere.zzz',
      repoRoot: tmpDir,
    });

    assert.ok(
      pack.includes('no.such.cid.exists.anywhere.zzz'),
      'pack should echo back the cid even on not-found'
    );
    // Must not throw
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Integration test: CID lookup in the real monorepo
// (skipped when the monorepo root cannot be confirmed — e.g. CI with shallow clone)
// ---------------------------------------------------------------------------

describe('buildContextPack — CID integration (real repo)', () => {
  const TEAMS_CAPACITY_CID = 'desk.teams.machine-capacity';
  const CAPACITY_FILE = 'apps/desk/src/panels/teams-panel/MachineCapacity.tsx';

  test('finds the MachineCapacity component from its cid', () => {
    // Only run when the expected source file exists in the monorepo.
    const expectedFile = path.join(MONO_ROOT, CAPACITY_FILE);
    if (!fs.existsSync(expectedFile)) {
      // Skip gracefully — file may not be present in all environments
      console.log(`  [skip] ${CAPACITY_FILE} not found in monorepo — integration test skipped.`);
      return;
    }

    const pack = buildContextPack({
      cid: TEAMS_CAPACITY_CID,
      repoRoot: MONO_ROOT,
    });

    assert.ok(
      pack.includes(CAPACITY_FILE),
      `pack should reference ${CAPACITY_FILE}`
    );
    assert.ok(
      pack.includes('## Context pack for'),
      'pack should have the expected heading'
    );
  });
});

describe('buildContextPack — task-id integration (real monorepo)', () => {
  test('reads task 281-05 and emits files[] from the actual task JSON', () => {
    const taskFile = path.join(MONO_ROOT, '.planning', 'tasks', '281-05.json');
    if (!fs.existsSync(taskFile)) {
      console.log('  [skip] .planning/tasks/281-05.json not found — integration test skipped.');
      return;
    }

    const pack = buildContextPack({
      taskId: '281-05',
      repoRoot: MONO_ROOT,
      planningDirs: [path.join(MONO_ROOT, '.planning')],
    });

    assert.ok(
      pack.includes('281-05'),
      'pack should mention the task id'
    );
    assert.ok(
      pack.includes('## Context pack for'),
      'pack should have the expected heading'
    );
  });
});
