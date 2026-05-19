'use strict';
/**
 * Tests for lib/runtimes/model-catalog.cjs (phase 252).
 *
 * Covers:
 *   1. listRuntimes() returns registered runtime ids
 *   2. getModelForKind(runtime, kind) returns primary model string
 *   3. getModelList(runtime, kind) returns full fallback list
 *   4. Invalid kind / runtime raise informative errors
 *   5. GAD_MODEL_CATALOG_PATH override is honored
 *   6. Smoke test: multi-agent-orchestration skill exists, has frontmatter
 *      that points at model-catalog, and skill loader (lib/skill-helpers.cjs)
 *      can discover + read it without throwing.
 *
 * Run with: node --test tests/model-catalog.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  getModelForKind,
  getModelList,
  listRuntimes,
  resolveCatalogPath,
} = require('../lib/runtimes/model-catalog.cjs');

const {
  listSkillDirs,
  readSkillFrontmatter,
} = require('../lib/skill-helpers.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-model-catalog-test-'));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function withCatalog(text, fn) {
  const tmp = makeTmpDir();
  const file = path.join(tmp, 'model-catalog.toml');
  fs.writeFileSync(file, text, 'utf8');
  const orig = process.env.GAD_MODEL_CATALOG_PATH;
  process.env.GAD_MODEL_CATALOG_PATH = file;
  try {
    return fn(file);
  } finally {
    if (orig === undefined) delete process.env.GAD_MODEL_CATALOG_PATH;
    else process.env.GAD_MODEL_CATALOG_PATH = orig;
    cleanup(tmp);
  }
}

// ---------------------------------------------------------------------------
// Test 1: listRuntimes (uses repo's real catalog)
// ---------------------------------------------------------------------------
test('listRuntimes: returns registered runtime ids from real catalog', () => {
  const runtimes = listRuntimes();
  assert.ok(Array.isArray(runtimes), 'listRuntimes returns array');
  assert.ok(runtimes.length > 0, 'real catalog has at least one runtime');
  // Real catalog (per phase 252) registers these four
  for (const expected of ['claude-code', 'codex-cli', 'gemini-cli', 'opencode']) {
    assert.ok(
      runtimes.includes(expected),
      `runtime "${expected}" should be registered, got: ${runtimes.join(', ')}`
    );
  }
});

test('listRuntimes: returns ids in catalog declaration order', () => {
  withCatalog(
    [
      '[runtimes.foo]',
      'cheap = "fc"',
      'mid = "fm"',
      'heavy = "fh"',
      '',
      '[runtimes.bar]',
      'cheap = "bc"',
      'mid = "bm"',
      'heavy = "bh"',
    ].join('\n'),
    () => {
      const runtimes = listRuntimes();
      assert.deepEqual(runtimes, ['foo', 'bar']);
    },
  );
});

// ---------------------------------------------------------------------------
// Test 2: getModelForKind returns primary string (real catalog)
// ---------------------------------------------------------------------------
test('getModelForKind: returns primary model for claude-code/mid', () => {
  const m = getModelForKind('claude-code', 'mid');
  assert.equal(typeof m, 'string');
  assert.ok(m.length > 0, 'should be non-empty');
  // claude-code mid is "claude-sonnet-4-6" per real catalog
  assert.equal(m, 'claude-sonnet-4-6');
});

test('getModelForKind: returns FIRST item of comma list (opencode/cheap)', () => {
  // opencode cheap = "qwen2.5:7b,gemma-2-9b,llama-3.1-8b"
  const m = getModelForKind('opencode', 'cheap');
  assert.equal(m, 'qwen2.5:7b', 'getModelForKind returns primary, not list');
  assert.equal(m.includes(','), false, 'should not contain commas');
});

test('getModelForKind: all three kinds resolve for every registered runtime', () => {
  for (const runtime of listRuntimes()) {
    for (const kind of ['cheap', 'mid', 'heavy']) {
      const m = getModelForKind(runtime, kind);
      assert.ok(
        typeof m === 'string' && m.length > 0,
        `${runtime}/${kind} should resolve to non-empty string, got ${JSON.stringify(m)}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Test 3: getModelList returns full fallback list
// ---------------------------------------------------------------------------
test('getModelList: returns full comma-separated list', () => {
  const list = getModelList('opencode', 'cheap');
  assert.ok(Array.isArray(list), 'returns array');
  assert.ok(list.length >= 2, 'opencode cheap has multiple fallbacks');
  assert.equal(list[0], 'qwen2.5:7b', 'first element is primary');
  for (const m of list) {
    assert.equal(typeof m, 'string');
    assert.ok(m.length > 0);
    assert.equal(m, m.trim(), 'entries are trimmed');
  }
});

test('getModelList: single-model tier returns 1-element array', () => {
  const list = getModelList('claude-code', 'mid');
  assert.equal(list.length, 1);
  assert.equal(list[0], 'claude-sonnet-4-6');
});

// ---------------------------------------------------------------------------
// Test 4: error paths
// ---------------------------------------------------------------------------
test('getModelForKind: invalid kind throws informative error', () => {
  assert.throws(
    () => getModelForKind('claude-code', 'super-heavy'),
    /Invalid kind/,
    'unknown kind should throw with Invalid kind message',
  );
  assert.throws(
    () => getModelForKind('claude-code', ''),
    /Invalid kind/,
  );
});

test('getModelForKind: unknown runtime throws with known list', () => {
  let err;
  try {
    getModelForKind('nonexistent-runtime', 'mid');
  } catch (e) {
    err = e;
  }
  assert.ok(err, 'should throw');
  assert.match(err.message, /Unknown runtime/);
  assert.match(err.message, /nonexistent-runtime/);
  // Error message must include the registered set so user can correct
  assert.match(err.message, /Registered:/);
});

test('getModelForKind: missing tier throws helpful error', () => {
  withCatalog(
    [
      '[runtimes.partial]',
      'cheap = "x"',
      // no mid, no heavy
    ].join('\n'),
    () => {
      assert.throws(
        () => getModelForKind('partial', 'mid'),
        /no "mid" tier defined/,
      );
    },
  );
});

test('getModelList: invalid kind throws', () => {
  assert.throws(() => getModelList('claude-code', 'bogus'), /Invalid kind/);
});

// ---------------------------------------------------------------------------
// Test 5: GAD_MODEL_CATALOG_PATH override
// ---------------------------------------------------------------------------
test('GAD_MODEL_CATALOG_PATH: override is honored', () => {
  withCatalog(
    [
      '[runtimes.test-only]',
      'cheap = "tc"',
      'mid = "tm"',
      'heavy = "th"',
    ].join('\n'),
    (file) => {
      assert.equal(resolveCatalogPath(), file);
      assert.deepEqual(listRuntimes(), ['test-only']);
      assert.equal(getModelForKind('test-only', 'mid'), 'tm');
    },
  );
});

test('comment + blank lines are ignored', () => {
  withCatalog(
    [
      '# this is a comment',
      '',
      '# another',
      '[runtimes.alpha]',
      '# inline-section comment',
      'cheap = "a-c"',
      'mid = "a-m"',
      'heavy = "a-h"',
    ].join('\n'),
    () => {
      assert.deepEqual(listRuntimes(), ['alpha']);
      assert.equal(getModelForKind('alpha', 'heavy'), 'a-h');
    },
  );
});

// ---------------------------------------------------------------------------
// Test 6: skill-loader smoke test
// ---------------------------------------------------------------------------
test('skill-loader smoke: multi-agent-orchestration skill is discoverable', () => {
  const skillsRoot = path.resolve(__dirname, '..', 'skills');
  const dirs = listSkillDirs(skillsRoot);
  assert.ok(dirs.length > 0, 'listSkillDirs returns at least one skill');

  const target = dirs.find((d) => d.id === 'multi-agent-orchestration');
  assert.ok(target, 'multi-agent-orchestration skill should be present in skills/');
  assert.ok(fs.existsSync(target.skillFile), 'SKILL.md should exist on disk');
});

test('skill-loader smoke: multi-agent-orchestration frontmatter is parseable', () => {
  const skillsRoot = path.resolve(__dirname, '..', 'skills');
  const target = listSkillDirs(skillsRoot).find(
    (d) => d.id === 'multi-agent-orchestration',
  );
  assert.ok(target, 'target skill must exist for this test');

  const fm = readSkillFrontmatter(target.skillFile);
  assert.equal(fm.name, 'multi-agent-orchestration', 'name field matches dir id');
  assert.ok(
    typeof fm.description === 'string' && fm.description.length > 0,
    'description must be non-empty',
  );
});

test('skill-loader smoke: listSkillDirs returns alphabetically sorted ids', () => {
  const skillsRoot = path.resolve(__dirname, '..', 'skills');
  const dirs = listSkillDirs(skillsRoot);
  const ids = dirs.map((d) => d.id);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted, 'listSkillDirs output should be alphabetical');
});

test('skill-loader smoke: missing root returns empty list (no throw)', () => {
  const result = listSkillDirs(
    path.join(os.tmpdir(), 'gad-skills-does-not-exist-xyz123'),
  );
  assert.deepEqual(result, [], 'non-existent root returns []');
});
