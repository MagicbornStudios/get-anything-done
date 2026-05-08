'use strict';

/**
 * cross-project-handoffs.test.cjs
 *
 * Unit tests for GLOBAL-D-323 Phase A — cross-project handoff aggregation.
 * Uses synthetic planning roots in tmp dirs.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  RECIPIENT_ALIASES,
  resolveRecipient,
  scanCrossProjectHandoffs,
} = require('../lib/cross-project-handoffs.cjs');

const {
  buildCrossProjectHandoffsSection,
} = require('../lib/snapshot-cross-project-section.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-xph-'));
}

/**
 * Create a synthetic planning root with handoff files.
 * @param {string} rootDir  — absolute path for the root
 * @param {string} projectid
 * @param {Array<{id, bucket, frontmatter}>} handoffs
 */
function writeRoot(rootDir, projectid, handoffs) {
  fs.mkdirSync(path.join(rootDir, '.planning', 'handoffs', 'open'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, '.planning', 'handoffs', 'claimed'), { recursive: true });
  for (const h of handoffs) {
    const bucket = h.bucket || 'open';
    const fm = { id: h.id, projectid, ...h.frontmatter };
    const lines = ['---'];
    for (const [k, v] of Object.entries(fm)) {
      lines.push(`${k}: ${v}`);
    }
    lines.push('---');
    lines.push('');
    lines.push(`Body of ${h.id}`);
    const dir = path.join(rootDir, '.planning', 'handoffs', bucket);
    fs.writeFileSync(path.join(dir, `${h.id}.md`), lines.join('\n'));
  }
}

/**
 * Build a minimal gadConfig mock.
 */
function makeConfig(roots) {
  return { roots };
}

/**
 * Minimal render stub: returns CSV of row values.
 */
function render(rows, opts) {
  const headers = opts.headers || [];
  const lines = [headers.join('\t')];
  for (const row of rows) {
    lines.push(headers.map((h) => String(row[h] || '')).join('\t'));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tests: RECIPIENT_ALIASES and resolveRecipient
// ---------------------------------------------------------------------------

describe('RECIPIENT_ALIASES', () => {
  test('monorepo resolves to global', () => {
    assert.equal(resolveRecipient('monorepo'), 'global');
  });

  test('platform-team resolves to global', () => {
    assert.equal(resolveRecipient('platform-team'), 'global');
  });

  test('monorepo / platform team dispatcher (Marshal-tbd) resolves to global via substring', () => {
    assert.equal(resolveRecipient('monorepo / platform team dispatcher (Marshal-tbd)'), 'global');
  });

  test('framework resolves to get-anything-done', () => {
    assert.equal(resolveRecipient('framework'), 'get-anything-done');
  });

  test('framework-team resolves to get-anything-done', () => {
    assert.equal(resolveRecipient('framework-team'), 'get-anything-done');
  });

  test('null / empty returns null', () => {
    assert.equal(resolveRecipient(null), null);
    assert.equal(resolveRecipient(''), null);
    assert.equal(resolveRecipient(undefined), null);
  });

  test('unknown recipient returns null', () => {
    assert.equal(resolveRecipient('some-unknown-project'), null);
  });

  test('RECIPIENT_ALIASES exports the map object', () => {
    assert.ok(typeof RECIPIENT_ALIASES === 'object');
    assert.ok(RECIPIENT_ALIASES['monorepo'] === 'global');
  });
});

// ---------------------------------------------------------------------------
// Tests: scanCrossProjectHandoffs
// ---------------------------------------------------------------------------

describe('scanCrossProjectHandoffs', () => {
  test('returns empty when no roots provided', () => {
    const result = scanCrossProjectHandoffs({
      baseDir: os.tmpdir(),
      projectid: 'global',
      gadConfig: makeConfig([]),
    });
    assert.deepEqual(result, []);
  });

  test('returns empty when config has no roots key', () => {
    const result = scanCrossProjectHandoffs({
      baseDir: os.tmpdir(),
      projectid: 'global',
      gadConfig: {},
    });
    assert.deepEqual(result, []);
  });

  test('skips the current project own root', () => {
    const tmp = mkTmp();
    writeRoot(tmp, 'global', [
      { id: 'h-self', frontmatter: { recipient: 'monorepo', priority: 'high' } },
    ]);
    const result = scanCrossProjectHandoffs({
      baseDir: tmp,
      projectid: 'global',
      gadConfig: makeConfig([{ id: 'global', path: '.', planningDir: '.planning', enabled: true }]),
    });
    // Own root skipped
    assert.equal(result.length, 0);
  });

  test('picks up handoffs from a foreign root targeting global via recipient=monorepo', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      { id: 'h-cross-1', frontmatter: { recipient: 'monorepo', priority: 'high', runtime_preference: 'claude-code' } },
      { id: 'h-cross-2', frontmatter: { recipient: 'monorepo', priority: 'normal' } },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: true },
      { id: 'global', path: repoRoot, planningDir: '.planning', enabled: true },
    ]);

    const result = scanCrossProjectHandoffs({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
    });

    assert.equal(result.length, 2);
    assert.ok(result.every((r) => r.from_project === 'slm-learning'));
    const ids = result.map((r) => r.id);
    assert.ok(ids.includes('h-cross-1'));
    assert.ok(ids.includes('h-cross-2'));
  });

  test('does NOT include handoffs targeting a different project', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      { id: 'h-wrong', frontmatter: { recipient: 'some-other-project', priority: 'high' } },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: true },
    ]);

    const result = scanCrossProjectHandoffs({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
    });

    assert.equal(result.length, 0);
  });

  test('picks up claimed/ bucket handoffs too', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      { id: 'h-claimed', bucket: 'claimed', frontmatter: { recipient: 'monorepo', priority: 'high', claimed_by: 'claude-code' } },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: true },
    ]);

    const result = scanCrossProjectHandoffs({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].bucket, 'claimed');
  });

  test('skips disabled roots silently', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      { id: 'h-disabled', frontmatter: { recipient: 'monorepo', priority: 'high' } },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: false },
    ]);

    const result = scanCrossProjectHandoffs({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
    });

    assert.equal(result.length, 0);
  });

  test('skips unreadable root paths silently', () => {
    const result = scanCrossProjectHandoffs({
      baseDir: os.tmpdir(),
      projectid: 'global',
      gadConfig: makeConfig([
        { id: 'ghost', path: '/nonexistent/path/that/does/not/exist', planningDir: '.planning', enabled: true },
      ]),
    });
    assert.equal(result.length, 0);
  });

  test('matches to_agent field against projectid', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      { id: 'h-agent', frontmatter: { to_agent: 'global', priority: 'high' } },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: true },
    ]);

    const result = scanCrossProjectHandoffs({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'h-agent');
  });
});

// ---------------------------------------------------------------------------
// Tests: buildCrossProjectHandoffsSection
// ---------------------------------------------------------------------------

describe('buildCrossProjectHandoffsSection', () => {
  test('returns null when no cross-project matches', () => {
    const result = buildCrossProjectHandoffsSection({
      baseDir: os.tmpdir(),
      projectid: 'global',
      gadConfig: makeConfig([]),
      render,
    });
    assert.equal(result, null);
  });

  test('returns section with correct title and cross_project_handoffs array', () => {
    const repoRoot = mkTmp();
    const foreignRoot = mkTmp();

    writeRoot(foreignRoot, 'slm-learning', [
      {
        id: 'h-2026-05-08T12-30-00-monorepo-thing',
        frontmatter: {
          recipient: 'monorepo',
          priority: 'high',
          estimated_context: 'bounded',
          runtime_preference: 'claude-code',
          created_at: new Date().toISOString(),
        },
      },
    ]);

    const config = makeConfig([
      { id: 'slm-learning', path: foreignRoot, planningDir: '.planning', enabled: true },
    ]);

    const result = buildCrossProjectHandoffsSection({
      baseDir: repoRoot,
      projectid: 'global',
      gadConfig: config,
      render,
    });

    assert.ok(result !== null, 'section should be returned');
    assert.match(result.title, /CROSS-PROJECT HANDOFFS/);
    assert.match(result.title, /1 filed/);
    assert.ok(Array.isArray(result.cross_project_handoffs));
    assert.equal(result.cross_project_handoffs.length, 1);
    assert.equal(result.cross_project_handoffs[0].from_project, 'slm-learning');
    assert.equal(result.cross_project_handoffs[0].id, 'h-2026-05-08T12-30-00-monorepo-thing');
    assert.match(result.content, /slm-learning/);
  });
});
