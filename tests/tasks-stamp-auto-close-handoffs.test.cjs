'use strict';
/**
 * tests/tasks-stamp-auto-close-handoffs.test.cjs
 *
 * Tests for GAD-T-63-56: auto-close linked handoffs on task stamp.
 *
 * Covers:
 *  1. stamp done → open handoff with matching task_id moved to closed/, body has ## Auto-closed
 *  2. stamp done → claimed handoff with matching task_id moved to closed/
 *  3. stamp done → no linked handoff → no error, no spurious files
 *  4. stamp done → handoff already in closed/ → idempotent, no error, no duplicate
 *  5. stamp done → handoff with different task_id → not touched
 *  6. stamp cancelled → also triggers auto-close
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { autoCloseLinkedHandoffs } = require('../bin/commands/tasks/stamp.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHandoffRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-autoclose-'));
  const handoffsBase = path.join(repoRoot, '.planning', 'handoffs');
  ['open', 'claimed', 'closed'].forEach((b) =>
    fs.mkdirSync(path.join(handoffsBase, b), { recursive: true }),
  );
  return { repoRoot, handoffsBase };
}

const HANDOFF_ID = 'h-2026-05-13T14-55-07-get-anything-done-63';
const TASK_ID = 'GAD-T-63-56';

function makeHandoffText(taskId, bucket, extra = '') {
  return `---
id: ${HANDOFF_ID}
projectid: get-anything-done
phase: 63
task_id: ${taskId}
created_at: 2026-05-13T14:55:07.030Z
claimed_by: null
claimed_at: null
completed_at: null
priority: normal
---
# Body

Some handoff body text.${extra}`;
}

function writeHandoff(handoffsBase, bucket, id, content) {
  fs.writeFileSync(path.join(handoffsBase, bucket, `${id}.md`), content, 'utf8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('autoCloseLinkedHandoffs', () => {
  test('moves open/ handoff with matching task_id to closed/', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    writeHandoff(handoffsBase, 'open', HANDOFF_ID, makeHandoffText(TASK_ID, 'open'));

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'done', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.closed, [HANDOFF_ID]);

    // File moved to closed/
    assert.ok(
      fs.existsSync(path.join(handoffsBase, 'closed', `${HANDOFF_ID}.md`)),
      'handoff should be in closed/',
    );
    assert.ok(
      !fs.existsSync(path.join(handoffsBase, 'open', `${HANDOFF_ID}.md`)),
      'handoff should NOT remain in open/',
    );

    // Body has ## Auto-closed section
    const closedText = fs.readFileSync(
      path.join(handoffsBase, 'closed', `${HANDOFF_ID}.md`),
      'utf8',
    );
    assert.match(closedText, /## Auto-closed/i);
    assert.match(closedText, /GAD-T-63-56/);
    assert.match(closedText, /done/);
    // completed_at injected
    assert.match(closedText, /completed_at:/);
  });

  test('moves claimed/ handoff with matching task_id to closed/', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    writeHandoff(handoffsBase, 'claimed', HANDOFF_ID, makeHandoffText(TASK_ID, 'claimed'));

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'done', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.closed, [HANDOFF_ID]);
    assert.ok(fs.existsSync(path.join(handoffsBase, 'closed', `${HANDOFF_ID}.md`)));
    assert.ok(!fs.existsSync(path.join(handoffsBase, 'claimed', `${HANDOFF_ID}.md`)));
  });

  test('no linked handoff → no error, no spurious files', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    // No handoff files at all.

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'done', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.closed, []);
    // closed/ dir should exist but be empty (only contains .md files check)
    const closedFiles = fs.readdirSync(path.join(handoffsBase, 'closed')).filter((f) => f.endsWith('.md'));
    assert.deepStrictEqual(closedFiles, []);
  });

  test('handoff already in closed/ → idempotent, no error', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    // Pre-write the handoff into closed/ only (not in open or claimed).
    writeHandoff(handoffsBase, 'closed', HANDOFF_ID, makeHandoffText(TASK_ID, 'closed'));

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'done', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    // Already closed, should not appear in `closed` list (skipped).
    assert.deepStrictEqual(result.closed, []);
    // File still exists
    assert.ok(fs.existsSync(path.join(handoffsBase, 'closed', `${HANDOFF_ID}.md`)));
  });

  test('handoff with different task_id is not touched', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    const OTHER_ID = 'h-2026-05-01T00-00-00-get-anything-done-99';
    writeHandoff(handoffsBase, 'open', OTHER_ID, makeHandoffText('GAD-T-99-99', 'open'));

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'done', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.closed, []);
    // The unrelated handoff stays in open/
    assert.ok(fs.existsSync(path.join(handoffsBase, 'open', `${OTHER_ID}.md`)));
  });

  test('stamp cancelled also triggers auto-close', () => {
    const { repoRoot, handoffsBase } = makeHandoffRepo();
    writeHandoff(handoffsBase, 'open', HANDOFF_ID, makeHandoffText(TASK_ID, 'open'));

    const result = autoCloseLinkedHandoffs(repoRoot, TASK_ID, 'cancelled', 'get-anything-done');

    assert.deepStrictEqual(result.errors, []);
    assert.deepStrictEqual(result.closed, [HANDOFF_ID]);
    const closedText = fs.readFileSync(
      path.join(handoffsBase, 'closed', `${HANDOFF_ID}.md`),
      'utf8',
    );
    assert.match(closedText, /cancelled/);
  });
});
