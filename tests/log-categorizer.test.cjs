'use strict';
/**
 * tests/log-categorizer.test.cjs — unit tests for lib/ml/log-categorizer
 *
 * Uses regexCategorize only (no model download required).
 * Run: node --test tests/log-categorizer.test.cjs
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  regexCategorize,
  CANDIDATE_LABELS,
  LABEL_MAP,
  CONF_THRESHOLD,
} = require(path.join(__dirname, '..', 'lib', 'ml', 'log-categorizer', 'index.cjs'));

// ─── regexCategorize tests ────────────────────────────────────────────────────

describe('regexCategorize', () => {
  it('classifies a non-zero exit as error', () => {
    const event = { cmd: 'tasks list', args: ['tasks', 'list'], exit: 1, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'error');
    assert.ok(r.confidence >= 0.9);
    assert.equal(r.method, 'regex');
  });

  it('classifies exit=0 --help call as noise', () => {
    const event = { cmd: 'tasks --help', args: ['tasks', '--help'], exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'noise');
    assert.equal(r.method, 'regex');
  });

  it('classifies tasks stamp as state', () => {
    const event = { cmd: 'tasks stamp GLOBAL-T-246-04', args: ['tasks', 'stamp'], exit: 0, summary: 'stamped' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'state');
    assert.equal(r.method, 'regex');
  });

  it('classifies runtime launch as dispatch', () => {
    const event = { cmd: 'runtime launch', args: ['runtime', 'launch', '--force-runtime', 'codex-cli'], exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'dispatch');
    assert.equal(r.method, 'regex');
  });

  it('classifies git commit as commit', () => {
    const event = { cmd: 'git commit -m "feat: add categorizer"', args: [], exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'commit');
    assert.equal(r.method, 'regex');
  });

  it('classifies trace edit event as tool-call', () => {
    const event = { kind: 'trace', type: 'edit', tool: 'Edit', exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'tool-call');
    assert.equal(r.method, 'regex');
  });

  it('classifies assistant role as agent-msg', () => {
    const event = { role: 'assistant', content: 'Here is the result', exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'agent-msg');
    assert.equal(r.method, 'regex');
  });

  it('defaults unknown event to cli', () => {
    const event = { cmd: 'snapshot', args: ['snapshot'], exit: 0, summary: 'snapshot complete' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'cli');
    assert.equal(r.method, 'regex');
  });

  it('classifies error in summary text', () => {
    const event = { cmd: 'phases list', args: [], exit: 0, summary: 'error: project not found' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'error');
    assert.equal(r.method, 'regex');
  });

  it('classifies state log addition as state', () => {
    const event = { cmd: 'state log "closed task"', args: ['state', 'log'], exit: 0, summary: '' };
    const r = regexCategorize(event);
    assert.equal(r.category, 'state');
    assert.equal(r.method, 'regex');
  });
});

// ─── Module shape tests ───────────────────────────────────────────────────────

describe('module exports', () => {
  it('exports CANDIDATE_LABELS array with 8 entries', () => {
    assert.ok(Array.isArray(CANDIDATE_LABELS));
    assert.equal(CANDIDATE_LABELS.length, 8);
  });

  it('LABEL_MAP covers all CANDIDATE_LABELS', () => {
    for (const label of CANDIDATE_LABELS) {
      assert.ok(LABEL_MAP[label], `Missing LABEL_MAP entry for: ${label}`);
    }
  });

  it('CONF_THRESHOLD is between 0.3 and 0.8', () => {
    assert.ok(CONF_THRESHOLD >= 0.3 && CONF_THRESHOLD <= 0.8);
  });

  it('categorize and categorizeBatch are async functions', async () => {
    const mod = require(path.join(__dirname, '..', 'lib', 'ml', 'log-categorizer', 'index.cjs'));
    assert.equal(typeof mod.categorize, 'function');
    assert.equal(typeof mod.categorizeBatch, 'function');
    // Call with model disabled to test fast-path (no network needed)
    const event = { cmd: 'snapshot', exit: 0, summary: '' };
    const r = await mod.categorize(event);
    assert.ok(r.category);
    assert.ok(r.method === 'regex' || r.method === 'bert');
  });
});
