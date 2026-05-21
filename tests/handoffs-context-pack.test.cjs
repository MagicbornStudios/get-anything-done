'use strict';
/**
 * handoffs-context-pack.test.cjs — task 284-03
 *
 * Verifies:
 *   1. createHandoff with a real task_id appends a ## Context pack section.
 *   2. createHandoff with --no-context-pack (noContextPack=true) omits the pack.
 *   3. createHandoff with a bad/missing task_id still creates the handoff without throwing.
 *   4. Idempotency: if body already contains ## Context pack, no second copy is appended.
 *   5. CLI flag --no-context-pack is present in `gad handoffs create --help`.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
  createHandoff,
  parseFrontmatter,
  appendContextPack,
  CONTEXT_PACK_SENTINEL,
} = require('../lib/handoffs.cjs');

const { runGadCli, createTempDir, cleanup } = require('./helpers.cjs');

// ---------------------------------------------------------------------------
// Minimal fs fake (same pattern as handoffs.test.cjs)
// ---------------------------------------------------------------------------

function makeFsFake(files = {}) {
  const store = Object.assign({}, files);
  return {
    store,
    readdirSync(dir) {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      const names = [];
      for (const p of Object.keys(store)) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          if (!rest.includes(path.sep)) names.push(rest);
        }
      }
      if (names.length === 0 && !Object.keys(store).some((p) => p.startsWith(prefix))) {
        const err = Object.assign(new Error('ENOENT: ' + dir), { code: 'ENOENT' });
        throw err;
      }
      return names;
    },
    readFileSync(p) {
      if (!(p in store)) {
        const err = Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
        throw err;
      }
      return store[p];
    },
    writeFileSync(p, data) { store[p] = data; },
    renameSync(src, dest) {
      if (!(src in store)) throw Object.assign(new Error('ENOENT: ' + src), { code: 'ENOENT' });
      store[dest] = store[src];
      delete store[src];
    },
    mkdirSync() { /* no-op */ },
    existsSync(p) { return p in store; },
  };
}

// Standard body that passes the quality gate
const GOOD_BODY = [
  '## Why',
  '',
  'Auto-test handoff for context-pack wiring.',
  '',
  '## Acceptance gate',
  '',
  '- Context pack section present in body.',
].join('\n');

// ---------------------------------------------------------------------------
// Helper: create a real temp dir with a minimal task JSON file
// ---------------------------------------------------------------------------

function setupTempProject(taskId = '284-03') {
  const tmpDir = createTempDir('gad-cp-test-');
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const taskObj = {
    id: taskId,
    phase: '284',
    status: 'planned',
    goal: 'Test context-pack injection in createHandoff',
    files: [],
  };
  fs.writeFileSync(path.join(tasksDir, `${taskId}.json`), JSON.stringify(taskObj, null, 2));
  return tmpDir;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handoffs context-pack injection', () => {

  test('createHandoff with a real task_id appends ## Context pack section', () => {
    const tmpDir = setupTempProject('284-03');
    try {
      const result = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '284',
        taskId: '284-03',
        body: GOOD_BODY,
        createdBy: 'test',
        runtimePreference: 'codex-cli',
        // noContextPack defaults to false → pack should be injected
      });

      assert.ok(result.id, 'handoff id returned');
      assert.ok(fs.existsSync(result.filePath), 'handoff file written to disk');

      const text = fs.readFileSync(result.filePath, 'utf8');
      const { body } = parseFrontmatter(text);

      assert.ok(
        body.includes(CONTEXT_PACK_SENTINEL),
        `Expected body to contain "${CONTEXT_PACK_SENTINEL}"\n\nActual body:\n${body.slice(0, 600)}`,
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('createHandoff with noContextPack=true omits context pack', () => {
    const tmpDir = setupTempProject('284-03');
    try {
      const result = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '284',
        taskId: '284-03',
        body: GOOD_BODY,
        createdBy: 'test',
        runtimePreference: 'codex-cli',
        noContextPack: true,
      });

      const text = fs.readFileSync(result.filePath, 'utf8');
      const { body } = parseFrontmatter(text);

      assert.ok(
        !body.includes(CONTEXT_PACK_SENTINEL),
        `Expected body to NOT contain "${CONTEXT_PACK_SENTINEL}" when noContextPack=true`,
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('createHandoff with a missing/bad task_id still creates the handoff', () => {
    const tmpDir = setupTempProject('284-03');
    try {
      // Pass a task_id that does NOT exist on disk — context-pack should fail gracefully
      let result;
      assert.doesNotThrow(() => {
        result = createHandoff({
          baseDir: tmpDir,
          projectid: 'global',
          phase: '284',
          taskId: 'nonexistent-99-99',
          body: GOOD_BODY,
          createdBy: 'test',
          runtimePreference: 'codex-cli',
          // noContextPack defaults false — pack build will fail gracefully
        });
      }, 'createHandoff must not throw even when task is missing');

      assert.ok(result && result.id, 'handoff created with id despite bad task_id');
      assert.ok(fs.existsSync(result.filePath), 'handoff file written to disk');

      // Body may or may not have a context pack — what matters is no throw
      const text = fs.readFileSync(result.filePath, 'utf8');
      const { frontmatter } = parseFrontmatter(text);
      assert.strictEqual(frontmatter.task_id, 'nonexistent-99-99', 'task_id frontmatter preserved');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('appendContextPack is idempotent — does not double-append', () => {
    const tmpDir = setupTempProject('284-03');
    try {
      // First: create handoff (with pack)
      const result = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '284',
        taskId: '284-03',
        body: GOOD_BODY,
        createdBy: 'test',
        runtimePreference: 'codex-cli',
      });

      const text = fs.readFileSync(result.filePath, 'utf8');
      const { body: firstBody } = parseFrontmatter(text);

      // Simulate calling appendContextPack again on the already-enriched body
      const secondBody = appendContextPack(firstBody, { taskId: '284-03', repoRoot: tmpDir });

      const occurrences = (secondBody.split(CONTEXT_PACK_SENTINEL).length - 1);
      assert.strictEqual(occurrences, 1, `Expected exactly 1 "${CONTEXT_PACK_SENTINEL}" occurrence, got ${occurrences}`);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('CONTEXT_PACK_SENTINEL is "## Context pack"', () => {
    assert.strictEqual(CONTEXT_PACK_SENTINEL, '## Context pack');
  });

});

// ---------------------------------------------------------------------------
// CLI smoke test: --no-context-pack flag appears in --help
// ---------------------------------------------------------------------------

describe('CLI flag wiring', () => {

  test('gad handoffs create --help shows --no-context-pack', () => {
    const result = runGadCli(['handoffs', 'create', '--help']);
    // --help may exit non-zero in citty; check stdout regardless
    const output = result.output || result.error || '';
    assert.ok(
      output.includes('no-context-pack'),
      `Expected --help to mention "no-context-pack".\nOutput:\n${output.slice(0, 800)}`,
    );
  });

});
