'use strict';
/**
 * Tests for `gad feedback record`.
 * Covers: new row append + idempotent replace.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const { createFeedbackCommand } = require('../bin/commands/feedback.cjs');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJsonlRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l));
}

function makeDeps(tmpDir) {
  return {
    findRepoRoot: () => tmpDir,
    gadConfig: { load: () => ({ roots: [{ id: 'global', path: '.', planningDir: '.planning' }] }) },
    resolveRoots: () => [{ id: 'global', path: '.', planningDir: '.planning' }],
    outputError: (msg) => { throw new Error(msg); },
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('gad feedback record', () => {
  let tmpDir;
  let pairsDir;

  beforeEach(() => {
    tmpDir = createTempDir('gad-feedback-test-');
    pairsDir = path.join(tmpDir, '.planning', 'datasets', 'preference-pairs');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('records a new turn — JSONL row appears with correct fields', async () => {
    const deps = makeDeps(tmpDir);
    const cmd = createFeedbackCommand(deps);
    const recordCmd = cmd.subCommands.record;

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(' '));
    try {
      await recordCmd.run({
        args: {
          'turn-id': 'test-turn-001',
          question: 'Which output format looks better?',
          'picked-label': 'compact table',
          'picked-index': '0',
          'rejected-labels': 'verbose list,raw JSON',
          reason: 'easier to scan',
          'fragment-content': 'col1 | col2 ...',
          projectid: 'global',
        },
      });
    } finally {
      console.log = origLog;
    }

    // File should exist
    const dateFile = path.join(pairsDir, `${todayIso()}.jsonl`);
    assert.ok(fs.existsSync(dateFile), `Expected JSONL file at ${dateFile}`);

    const rows = readJsonlRows(dateFile);
    assert.strictEqual(rows.length, 1, 'Expected exactly 1 row');

    const row = rows[0];
    assert.strictEqual(row.turn_id, 'test-turn-001');
    assert.strictEqual(row.question, 'Which output format looks better?');
    assert.strictEqual(row.picked.label, 'compact table');
    assert.strictEqual(row.picked.index, 0);
    assert.ok(Array.isArray(row.rejected), 'rejected must be array');
    assert.strictEqual(row.rejected.length, 2);
    assert.strictEqual(row.rejected[0].label, 'verbose list');
    assert.strictEqual(row.rejected[1].label, 'raw JSON');
    assert.strictEqual(row.reason, 'easier to scan');
    assert.strictEqual(row.fragment_content, 'col1 | col2 ...');
    assert.strictEqual(row.projectid, 'global');
    assert.ok(row.ts, 'ts must be set');
    assert.ok(typeof row.runtime === 'string', 'runtime must be string');
  });

  test('idempotent replace — same turn_id twice = 1 row, latest content', async () => {
    const deps = makeDeps(tmpDir);
    const cmd = createFeedbackCommand(deps);
    const recordCmd = cmd.subCommands.record;

    const origLog = console.log;
    console.log = () => {};
    try {
      // First write
      await recordCmd.run({
        args: {
          'turn-id': 'dup-turn-999',
          question: 'Original question?',
          'picked-label': 'first choice',
          'picked-index': '0',
          'rejected-labels': '',
          reason: 'first reason',
          'fragment-content': '',
          projectid: 'global',
        },
      });

      // Second write with same turn_id — different picked-label
      await recordCmd.run({
        args: {
          'turn-id': 'dup-turn-999',
          question: 'Updated question?',
          'picked-label': 'second choice',
          'picked-index': '1',
          'rejected-labels': 'first choice',
          reason: 'changed my mind',
          'fragment-content': '',
          projectid: 'global',
        },
      });
    } finally {
      console.log = origLog;
    }

    const dateFile = path.join(pairsDir, `${todayIso()}.jsonl`);
    const rows = readJsonlRows(dateFile);

    assert.strictEqual(rows.length, 1, 'Expected exactly 1 row after idempotent replace');
    const row = rows[0];
    assert.strictEqual(row.turn_id, 'dup-turn-999');
    // Should have latest content
    assert.strictEqual(row.picked.label, 'second choice');
    assert.strictEqual(row.picked.index, 1);
    assert.strictEqual(row.reason, 'changed my mind');
    assert.strictEqual(row.rejected.length, 1);
    assert.strictEqual(row.rejected[0].label, 'first choice');
  });
});
