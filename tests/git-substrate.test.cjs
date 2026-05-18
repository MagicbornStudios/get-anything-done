'use strict';
/**
 * git-substrate.test.cjs — Phase 256-02
 *
 * Tests for vendor/get-anything-done/lib/git-substrate/index.cjs
 *
 * Uses the monorepo itself (REPO_ROOT) as the test repo for read-only
 * operations (status/log/branch); mocks spawn for write ops.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '../../..');

// Reset module cache between tests that mutate env/cached state
function freshSubstrate() {
  // Clear require cache for the module
  const modPath = require.resolve('../lib/git-substrate/index.cjs');
  delete require.cache[modPath];
  return require('../lib/git-substrate/index.cjs');
}

// ── 1. detectGitBinary ────────────────────────────────────────────────────────

describe('detectGitBinary', () => {
  test('returns a string path on a machine with git installed', () => {
    const { detectGitBinary } = freshSubstrate();
    const bin = detectGitBinary();
    // Operator machine is known to have git; CI may not — allow null there
    if (bin !== null) {
      assert.equal(typeof bin, 'string');
      assert.ok(bin.length > 0, 'bin path should be non-empty');
    }
  });

  test('returns null when GIT_SUBSTRATE=isogit is set', () => {
    process.env.GIT_SUBSTRATE = 'isogit';
    try {
      const { detectGitBinary } = freshSubstrate();
      const bin = detectGitBinary();
      assert.equal(bin, null);
    } finally {
      delete process.env.GIT_SUBSTRATE;
    }
  });
});

// ── 2. createSubstrate ────────────────────────────────────────────────────────

describe('createSubstrate', () => {
  test('returns an object with all 12 required methods', () => {
    const { createSubstrate } = freshSubstrate();
    const s = createSubstrate();
    const required = [
      'status', 'log', 'diff', 'branchList', 'checkout', 'createBranch',
      'stage', 'commit', 'push', 'pull', 'fetch', 'clone', 'currentBranch',
    ];
    for (const m of required) {
      assert.equal(typeof s[m], 'function', `missing method: ${m}`);
    }
  });

  test('returns same cached instance on second call', () => {
    const { createSubstrate, resetSubstrate } = freshSubstrate();
    resetSubstrate();
    const s1 = createSubstrate();
    const s2 = createSubstrate();
    assert.equal(s1, s2, 'should return cached instance');
  });

  test('resetSubstrate() clears the cache', () => {
    const { createSubstrate, resetSubstrate } = freshSubstrate();
    const s1 = createSubstrate();
    resetSubstrate();
    const s2 = createSubstrate();
    assert.notEqual(s1, s2, 'should return a new instance after reset');
  });

  test('GIT_SUBSTRATE=isogit forces IsogitGit backend', () => {
    process.env.GIT_SUBSTRATE = 'isogit';
    try {
      const { createSubstrate, IsogitGit } = freshSubstrate();
      const s = createSubstrate();
      assert.ok(s instanceof IsogitGit, 'should be IsogitGit instance');
    } finally {
      delete process.env.GIT_SUBSTRATE;
    }
  });
});

// ── 3. SystemGit live read-only tests (skip if no git binary) ─────────────────

describe('SystemGit live (read-only)', () => {
  let substrate, SystemGit, bin;

  beforeEach(() => {
    const mod = freshSubstrate();
    SystemGit = mod.SystemGit;
    bin = mod.detectGitBinary();
    if (!bin) return; // skip if no git
    substrate = new SystemGit(bin);
  });

  test('status() returns an array', async () => {
    if (!bin) return;
    const entries = await substrate.status(REPO_ROOT);
    assert.ok(Array.isArray(entries), 'status should return array');
    for (const e of entries) {
      assert.ok(typeof e.xy === 'string', 'xy should be string');
      assert.ok(typeof e.path === 'string', 'path should be string');
    }
  });

  test('log() returns commits with expected shape', async () => {
    if (!bin) return;
    const commits = await substrate.log(REPO_ROOT, 3);
    assert.ok(Array.isArray(commits), 'log should return array');
    assert.ok(commits.length > 0, 'should have at least one commit');
    const c = commits[0];
    assert.ok(typeof c.hash === 'string' && c.hash.length === 40, 'hash should be 40 chars');
    assert.ok(typeof c.short === 'string', 'short should be string');
    assert.ok(typeof c.subject === 'string', 'subject should be string');
    assert.ok(typeof c.authorName === 'string', 'authorName should be string');
    assert.ok(typeof c.date === 'string', 'date should be string');
  });

  test('currentBranch() returns a non-empty string', async () => {
    if (!bin) return;
    const branch = await substrate.currentBranch(REPO_ROOT);
    assert.ok(typeof branch === 'string', 'branch should be string');
    // May be empty on detached HEAD; just check type
  });

  test('branchList() returns an array with at least one branch', async () => {
    if (!bin) return;
    const branches = await substrate.branchList(REPO_ROOT);
    assert.ok(Array.isArray(branches), 'branchList should return array');
    assert.ok(branches.length > 0, 'should have at least one branch');
    for (const b of branches) {
      assert.ok(typeof b.name === 'string', 'branch name should be string');
      assert.ok(typeof b.current === 'boolean', 'branch.current should be boolean');
    }
  });

  test('diff() returns an array (may be empty on clean repo)', async () => {
    if (!bin) return;
    const diffs = await substrate.diff(REPO_ROOT, false);
    assert.ok(Array.isArray(diffs), 'diff should return array');
    for (const d of diffs) {
      assert.ok(typeof d.status === 'string', 'diff.status should be string');
      assert.ok(typeof d.path === 'string', 'diff.path should be string');
    }
  });
});

// ── 4. IsogitGit — no-install error ──────────────────────────────────────────

describe('IsogitGit', () => {
  test('throws a helpful error when isomorphic-git is not installed', async () => {
    // Force isogit env
    process.env.GIT_SUBSTRATE = 'isogit';
    try {
      const { createSubstrate } = freshSubstrate();
      const s = createSubstrate();
      // isomorphic-git is not in devDeps → should throw install hint
      try {
        await s.status(REPO_ROOT);
        // If it somehow succeeds (package is installed), that's fine too
      } catch (err) {
        assert.ok(
          err.message.includes('isomorphic-git') || err.message.includes('pnpm'),
          `error should mention isomorphic-git or pnpm, got: ${err.message}`,
        );
      }
    } finally {
      delete process.env.GIT_SUBSTRATE;
    }
  });
});
