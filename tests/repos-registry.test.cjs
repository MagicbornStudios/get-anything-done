'use strict';
/**
 * repos-registry.test.cjs — Phase 256-03
 *
 * Tests for bin/commands/repos.cjs
 * Uses a temp directory for .planning/repos.toml to avoid polluting the real repo.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const REPOS_MOD = path.resolve(__dirname, '../bin/commands/repos.cjs');

// ── Helpers ───────────────────────────────────────────────────────────────────

let tmpDir;
let tomlPath;

function makeEnv() {
  // Stub deps for createReposCommand
  function findRepoRoot() {
    return tmpDir;
  }
  function outputError(msg) {
    process.stderr.write(msg + '\n');
  }
  return { findRepoRoot, outputError };
}

async function runSubcommand(name, args) {
  // Clear require cache so each test gets a fresh module
  delete require.cache[REPOS_MOD];
  const { createReposCommand } = require(REPOS_MOD);
  const cmd = createReposCommand(makeEnv());
  const sub = cmd.subCommands[name];
  if (!sub) throw new Error(`No subcommand: ${name}`);
  // Simulate citty run({ args })
  await sub.run({ args });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-repos-test-'));
  tomlPath = path.join(tmpDir, '.planning', 'repos.toml');
  // Ensure .planning dir exists
  fs.mkdirSync(path.dirname(tomlPath), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  delete require.cache[REPOS_MOD];
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('gad repos add', () => {
  test('creates repos.toml with a new entry', async () => {
    await runSubcommand('add', {
      name: 'test-repo',
      path: tmpDir,
      'default-branch': 'main',
    });
    assert.ok(fs.existsSync(tomlPath), 'repos.toml should be created');
    const src = fs.readFileSync(tomlPath, 'utf8');
    assert.ok(src.includes('[[repos]]'), 'should have [[repos]] section');
    assert.ok(src.includes('name = "test-repo"'), 'should contain name');
  });

  test('rejects duplicate name', async () => {
    await runSubcommand('add', { name: 'dupe', path: tmpDir, 'default-branch': 'main' });
    // Second add should exit(1) — capture via thrown error (process.exit mocked by node:test)
    let threw = false;
    const origExit = process.exit;
    process.exit = (code) => { threw = true; throw new Error(`exit(${code})`); };
    try {
      await runSubcommand('add', { name: 'dupe', path: tmpDir, 'default-branch': 'main' });
    } catch {
      // expected
    } finally {
      process.exit = origExit;
    }
    assert.ok(threw, 'should have called process.exit for duplicate');
  });
});

describe('gad repos list', () => {
  test('outputs JSON array when --json flag set', async () => {
    await runSubcommand('add', { name: 'r1', path: tmpDir, 'default-branch': 'main' });
    await runSubcommand('add', { name: 'r2', path: path.join(tmpDir, 'sub'), 'default-branch': 'dev' });

    let captured = '';
    const orig = console.log;
    console.log = (s) => { captured += s; };
    try {
      await runSubcommand('list', { json: true });
    } finally {
      console.log = orig;
    }
    const parsed = JSON.parse(captured);
    assert.ok(Array.isArray(parsed), 'should return array');
    assert.equal(parsed.length, 2, 'should have 2 entries');
    assert.ok(parsed.find(r => r.name === 'r1'), 'should contain r1');
    assert.ok(parsed.find(r => r.name === 'r2'), 'should contain r2');
  });

  test('prints empty message when no repos', async () => {
    let captured = '';
    const orig = console.log;
    console.log = (s) => { captured += s; };
    try {
      await runSubcommand('list', { json: false });
    } finally {
      console.log = orig;
    }
    assert.ok(captured.includes('No repos'), 'should mention no repos');
  });
});

describe('gad repos show', () => {
  test('prints repo fields', async () => {
    await runSubcommand('add', {
      name: 'show-test',
      path: tmpDir,
      remote: 'https://github.com/owner/repo',
      'default-branch': 'main',
    });

    let captured = '';
    const orig = console.log;
    console.log = (...args) => { captured += args.join(' ') + '\n'; };
    try {
      await runSubcommand('show', { name: 'show-test' });
    } finally {
      console.log = orig;
    }
    assert.ok(captured.includes('show-test'), 'should show repo name');
    assert.ok(captured.includes(tmpDir), 'should show repo path');
  });
});

describe('gad repos remove', () => {
  test('removes the entry from repos.toml', async () => {
    await runSubcommand('add', { name: 'to-remove', path: tmpDir, 'default-branch': 'main' });
    await runSubcommand('add', { name: 'keeper', path: tmpDir, 'default-branch': 'main' });

    await runSubcommand('remove', { name: 'to-remove' });

    const src = fs.readFileSync(tomlPath, 'utf8');
    assert.ok(!src.includes('"to-remove"'), 'to-remove should be gone');
    assert.ok(src.includes('"keeper"'), 'keeper should remain');
  });

  test('exits with error on unknown name', async () => {
    let threw = false;
    const origExit = process.exit;
    process.exit = () => { threw = true; throw new Error('exit'); };
    try {
      await runSubcommand('remove', { name: 'nonexistent' });
    } catch {
      // expected
    } finally {
      process.exit = origExit;
    }
    assert.ok(threw, 'should exit on unknown name');
  });
});
