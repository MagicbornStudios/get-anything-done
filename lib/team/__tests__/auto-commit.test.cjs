'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const handoffs = require('../../handoffs.cjs');
const taskFiles = require('../../task-files.cjs');
const { runAutoCommitTick, readState } = require('../auto-commit.cjs');

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function initRepo(cwd) {
  fs.mkdirSync(cwd, { recursive: true });
  git(cwd, ['init']);
  git(cwd, ['config', 'user.name', 'Test User']);
  git(cwd, ['config', 'user.email', 'test@example.com']);
}

function writeFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

function commitAll(cwd, message) {
  git(cwd, ['add', '--all']);
  git(cwd, ['commit', '-m', message]);
}

function modify(baseDir, relPath, content) {
  writeFile(path.join(baseDir, relPath), content);
}

function createClosedHandoff(baseDir, { idSuffix, taskId, completedAt }) {
  const created = handoffs.createHandoff({
    baseDir,
    projectid: 'global',
    phase: '273',
    taskId,
    body: `handoff ${idSuffix}`,
    createdBy: 'test',
  });
  handoffs.claimHandoff({ baseDir, id: created.id, agent: 'team-w1', runtime: 'codex-cli' });
  handoffs.completeHandoff({ baseDir, id: created.id });
  if (completedAt) {
    const handoffPath = path.join(baseDir, '.planning', 'handoffs', 'closed', `${created.id}.md`);
    const raw = fs.readFileSync(handoffPath, 'utf8');
    const { frontmatter, body } = handoffs.parseFrontmatter(raw);
    frontmatter.completed_at = completedAt;
    fs.writeFileSync(handoffPath, handoffs.stringifyFrontmatter(frontmatter, body));
  }
  sleepSync(1100);
  return created.id;
}

function setupTask(baseDir, id, files) {
  const planningDir = path.join(baseDir, '.planning');
  taskFiles.writeOne(planningDir, {
    id,
    phase: '273',
    status: 'done',
    goal: `Task ${id}`,
    files,
  });
}

function revCount(cwd) {
  return Number(git(cwd, ['rev-list', '--count', 'HEAD']));
}

function changedPathsInHead(cwd) {
  return git(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
    .split(/\r?\n/)
    .filter(Boolean)
    .sort();
}

function statusPaths(cwd) {
  const out = git(cwd, ['status', '--short']);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

test('count-trigger creates task-scoped commits with explicit pathspecs and nested repo routing', () => {
  const tmpDir = makeTmpDir('gad-auto-commit-count-');
  try {
    initRepo(tmpDir);
    initRepo(path.join(tmpDir, 'vendor', 'get-anything-done'));

    // Commit the nested sub-repo FIRST so it has a HEAD; otherwise the root's
    // `git add --all` chokes on an embedded repo with no commit checked out.
    modify(tmpDir, 'vendor/get-anything-done/lib/included-sub.txt', 'sub v1\n');
    modify(tmpDir, 'vendor/get-anything-done/lib/unrelated-sub.txt', 'sub unrelated v1\n');
    commitAll(path.join(tmpDir, 'vendor', 'get-anything-done'), 'init sub');

    // Keep the nested repo out of the root index (it is a separate repo here,
    // not a tracked gitlink) so the root's `git add --all` does not embed it.
    writeFile(path.join(tmpDir, '.git', 'info', 'exclude'), 'vendor/get-anything-done/\n');

    modify(tmpDir, 'app/included-root.txt', 'root v1\n');
    modify(tmpDir, 'app/unrelated-root.txt', 'root unrelated v1\n');
    commitAll(tmpDir, 'init root');

    writeFile(path.join(tmpDir, '.planning', 'team', 'config.json'), JSON.stringify({
      auto_commit: {
        enabled: true,
        max_completed_handoffs: 2,
        max_age_minutes: 60,
      },
    }, null, 2));

    setupTask(tmpDir, '273-13a', ['app/included-root.txt']);
    setupTask(tmpDir, '273-13b', ['vendor/get-anything-done/lib/included-sub.txt']);

    createClosedHandoff(tmpDir, { idSuffix: 'a', taskId: '273-13a' });
    createClosedHandoff(tmpDir, { idSuffix: 'b', taskId: '273-13b' });

    modify(tmpDir, 'app/included-root.txt', 'root v2\n');
    modify(tmpDir, 'app/unrelated-root.txt', 'root unrelated v2\n');
    modify(tmpDir, 'vendor/get-anything-done/lib/included-sub.txt', 'sub v2\n');
    modify(tmpDir, 'vendor/get-anything-done/lib/unrelated-sub.txt', 'sub unrelated v2\n');

    const rootBefore = revCount(tmpDir);
    const subBefore = revCount(path.join(tmpDir, 'vendor', 'get-anything-done'));

    const result = runAutoCommitTick(tmpDir);

    assert.equal(result.triggered, true);
    assert.equal(result.reason, 'count-threshold');
    assert.equal(result.committed, 2);
    assert.equal(revCount(tmpDir), rootBefore + 1);
    assert.equal(revCount(path.join(tmpDir, 'vendor', 'get-anything-done')), subBefore + 1);
    assert.deepEqual(changedPathsInHead(tmpDir), ['app/included-root.txt']);
    assert.deepEqual(changedPathsInHead(path.join(tmpDir, 'vendor', 'get-anything-done')), ['lib/included-sub.txt']);
    assert.ok(statusPaths(tmpDir).some((line) => line.includes('app/unrelated-root.txt')), 'unrelated root file must remain dirty');
    assert.ok(statusPaths(path.join(tmpDir, 'vendor', 'get-anything-done')).some((line) => line.includes('lib/unrelated-sub.txt')), 'unrelated sub file must remain dirty');

    const state = readState(tmpDir);
    assert.equal(state.handoffs[result.outcomes[0].handoff_id].status, 'committed');
    assert.equal(state.handoffs[result.outcomes[1].handoff_id].status, 'committed');
  } finally {
    cleanup(tmpDir);
  }
});

test('time-trigger commits a single old completed handoff', () => {
  const tmpDir = makeTmpDir('gad-auto-commit-time-');
  try {
    initRepo(tmpDir);
    modify(tmpDir, 'app/time-trigger.txt', 'v1\n');
    commitAll(tmpDir, 'init root');

    writeFile(path.join(tmpDir, '.planning', 'team', 'config.json'), JSON.stringify({
      auto_commit: {
        enabled: true,
        max_completed_handoffs: 5,
        max_age_minutes: 15,
      },
    }, null, 2));

    setupTask(tmpDir, '273-13c', ['app/time-trigger.txt']);
    const oldTs = new Date(Date.now() - (16 * 60 * 1000)).toISOString();
    createClosedHandoff(tmpDir, { idSuffix: 'c', taskId: '273-13c', completedAt: oldTs });
    modify(tmpDir, 'app/time-trigger.txt', 'v2\n');

    const before = revCount(tmpDir);
    const result = runAutoCommitTick(tmpDir);

    assert.equal(result.triggered, true);
    assert.equal(result.reason, 'time-threshold');
    assert.equal(result.committed, 1);
    assert.equal(revCount(tmpDir), before + 1);
    assert.deepEqual(changedPathsInHead(tmpDir), ['app/time-trigger.txt']);
  } finally {
    cleanup(tmpDir);
  }
});

test('idempotent when there are no completed handoffs', () => {
  const tmpDir = makeTmpDir('gad-auto-commit-idle-');
  try {
    initRepo(tmpDir);
    writeFile(path.join(tmpDir, '.planning', 'team', 'config.json'), JSON.stringify({
      auto_commit: {
        enabled: true,
        max_completed_handoffs: 1,
        max_age_minutes: 1,
      },
    }, null, 2));

    const result = runAutoCommitTick(tmpDir);
    assert.equal(result.triggered, false);
    assert.equal(result.reason, 'no-pending-handoffs');
    assert.equal(result.processed, 0);
  } finally {
    cleanup(tmpDir);
  }
});
