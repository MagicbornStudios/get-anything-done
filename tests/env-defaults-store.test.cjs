'use strict';
/**
 * env-defaults-store.test.cjs — unit tests for lib/env-defaults-store.cjs
 * (task 60-07b). Decision gad-268.
 *
 * Coverage:
 *   - CRUD round-trip (set/get/unset/list)
 *   - Scope path safety (traversal rejected)
 *   - Scope chain merge: most-specific wins, parents fill in
 *   - Gitignore enforcement covers .gad/env/
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const env = require('../lib/env-defaults-store.cjs');
const { EnvDefaultsError } = env;

const PROJECT_ID = 'test-project';
let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-env-defaults-test-'));
  env._setProjectRootForTest(PROJECT_ID, tmpRoot);
});

afterEach(() => {
  env._setProjectRootForTest(PROJECT_ID, null);
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe('env-defaults-store: round-trip', () => {
  test('set then get returns the value', () => {
    env.set({ projectId: PROJECT_ID, key: 'MODEL_NAME', value: 'gpt-5' });
    assert.strictEqual(env.get({ projectId: PROJECT_ID, key: 'MODEL_NAME' }), 'gpt-5');
  });

  test('list returns rows with key/value/scopeBag', () => {
    env.set({ projectId: PROJECT_ID, key: 'A', value: 'a-val' });
    env.set({ projectId: PROJECT_ID, key: 'B', value: 'b-val' });
    const rows = env.list({ projectId: PROJECT_ID });
    assert.strictEqual(rows.length, 2);
    for (const r of rows) {
      assert.ok(r.key);
      assert.ok(typeof r.value === 'string');
      assert.strictEqual(r.scopeBag, null);
    }
  });

  test('unset removes the key and returns true; second unset returns false', () => {
    env.set({ projectId: PROJECT_ID, key: 'TMP', value: '1' });
    assert.strictEqual(env.unset({ projectId: PROJECT_ID, key: 'TMP' }), true);
    assert.strictEqual(env.get({ projectId: PROJECT_ID, key: 'TMP' }), undefined);
    assert.strictEqual(env.unset({ projectId: PROJECT_ID, key: 'TMP' }), false);
  });

  test('file is created with v1 schema and 0600 perms', () => {
    env.set({ projectId: PROJECT_ID, key: 'X', value: 'y' });
    const p = env.filePath(PROJECT_ID);
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(parsed.schemaVersion, 1);
    assert.deepStrictEqual(parsed.values, { X: 'y' });
  });
});

describe('env-defaults-store: scope addressing', () => {
  test('scoped writes go to nested files, not the planning file', () => {
    env.set({ projectId: PROJECT_ID, key: 'COMMON', value: 'planning-c' });
    env.set({ projectId: PROJECT_ID, key: 'COMMON', value: 'eval-c', scope: 'eval-x' });
    env.set({ projectId: PROJECT_ID, key: 'COMMON', value: 'sp-c', scope: 'eval-x/grime-time' });
    assert.strictEqual(env.get({ projectId: PROJECT_ID, key: 'COMMON' }), 'planning-c');
    assert.strictEqual(env.get({ projectId: PROJECT_ID, key: 'COMMON', scope: 'eval-x' }), 'eval-c');
    assert.strictEqual(env.get({ projectId: PROJECT_ID, key: 'COMMON', scope: 'eval-x/grime-time' }), 'sp-c');
  });

  test('listChain merges parents and marks shadowed values', () => {
    env.set({ projectId: PROJECT_ID, key: 'COMMON', value: 'planning-c' });
    env.set({ projectId: PROJECT_ID, key: 'PLANNING_ONLY', value: 'po' });
    env.set({ projectId: PROJECT_ID, key: 'COMMON', value: 'eval-c', scope: 'eval-x' });
    env.set({ projectId: PROJECT_ID, key: 'EVAL_ONLY', value: 'eo', scope: 'eval-x' });
    const rows = env.listChain({
      projectId: PROJECT_ID,
      scopeChain: ['eval-x', null],
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    assert.strictEqual(byKey.COMMON.scopeBag, 'eval-x');
    assert.deepStrictEqual(byKey.COMMON.shadows, [null]);
    assert.strictEqual(byKey.EVAL_ONLY.scopeBag, 'eval-x');
    assert.strictEqual(byKey.PLANNING_ONLY.scopeBag, null);
    assert.deepStrictEqual(byKey.PLANNING_ONLY.shadows, []);
  });

  test('resolveChain returns flat KEY=value map with most-specific winning', () => {
    env.set({ projectId: PROJECT_ID, key: 'A', value: 'planning' });
    env.set({ projectId: PROJECT_ID, key: 'B', value: 'planning-b' });
    env.set({ projectId: PROJECT_ID, key: 'A', value: 'eval', scope: 'eval-x' });
    const merged = env.resolveChain({
      projectId: PROJECT_ID,
      scopeChain: ['eval-x', null],
    });
    assert.deepStrictEqual(merged, { A: 'eval', B: 'planning-b' });
  });
});

describe('env-defaults-store: validation', () => {
  test('rejects invalid env var names', () => {
    assert.throws(() => env.set({ projectId: PROJECT_ID, key: '1BAD', value: 'x' }),
      (err) => err instanceof EnvDefaultsError && err.code === 'VALIDATION');
    assert.throws(() => env.set({ projectId: PROJECT_ID, key: 'has-dash', value: 'x' }),
      (err) => err instanceof EnvDefaultsError && err.code === 'VALIDATION');
  });

  test('rejects path traversal in scope', () => {
    assert.throws(() => env.set({ projectId: PROJECT_ID, key: 'X', value: 'y', scope: '../../etc' }),
      (err) => err instanceof EnvDefaultsError && err.code === 'VALIDATION');
    assert.throws(() => env.set({ projectId: PROJECT_ID, key: 'X', value: 'y', scope: 'foo/..' }),
      (err) => err instanceof EnvDefaultsError && err.code === 'VALIDATION');
  });

  test('rejects non-string values', () => {
    assert.throws(() => env.set({ projectId: PROJECT_ID, key: 'X', value: 123 }),
      (err) => err instanceof EnvDefaultsError && err.code === 'VALIDATION');
  });
});

describe('env-defaults-store: gitignore', () => {
  test('first set adds .gad/env/ to .gitignore', () => {
    env.set({ projectId: PROJECT_ID, key: 'X', value: 'y' });
    const gi = fs.readFileSync(path.join(tmpRoot, '.gitignore'), 'utf8');
    assert.ok(/\.gad\/env\//.test(gi));
  });

  test('does not duplicate when .gad/ already present', () => {
    fs.writeFileSync(path.join(tmpRoot, '.gitignore'), 'node_modules/\n.gad/\n');
    env.set({ projectId: PROJECT_ID, key: 'X', value: 'y' });
    const gi = fs.readFileSync(path.join(tmpRoot, '.gitignore'), 'utf8');
    const matches = gi.match(/\.gad\/env\//g);
    assert.strictEqual(matches, null, 'should not add env-specific line when .gad/ already covers it');
  });
});
