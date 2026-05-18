'use strict';
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { extractEntitiesRegex, extractEntities, PATTERNS, GLINER_LABELS } = require('../lib/ner/extract.cjs');

describe('ner - regex fallback', () => {
  test('extracts TASK_ID from text', () => {
    const entities = extractEntitiesRegex('Working on GLOBAL-T-246-07 and 246-08 tasks today.');
    const taskIds = entities.filter((e) => e.type === 'TASK_ID').map((e) => e.value);
    assert.ok(taskIds.some((v) => v.includes('246-07')), `Expected 246-07 in ${JSON.stringify(taskIds)}`);
    assert.ok(taskIds.some((v) => v.includes('246-08')), `Expected 246-08 in ${JSON.stringify(taskIds)}`);
  });

  test('extracts DECISION_ID', () => {
    const entities = extractEntitiesRegex('See GLOBAL-D-293 and gad-195 for details.');
    const decIds = entities.filter((e) => e.type === 'DECISION_ID').map((e) => e.value);
    assert.ok(decIds.some((v) => v.includes('GLOBAL-D-293')), `Got ${JSON.stringify(decIds)}`);
    assert.ok(decIds.some((v) => v.includes('gad-195')), `Got ${JSON.stringify(decIds)}`);
  });

  test('extracts URL', () => {
    const entities = extractEntitiesRegex('Visit https://example.com/foo?bar=1 for info');
    const urls = entities.filter((e) => e.type === 'URL').map((e) => e.value);
    assert.ok(urls.length > 0, 'Expected at least one URL');
    assert.ok(urls[0].startsWith('https://'));
  });

  test('extracts RUNTIME', () => {
    const entities = extractEntitiesRegex('Dispatched to codex-cli and gemini workers.');
    const runtimes = entities.filter((e) => e.type === 'RUNTIME').map((e) => e.value);
    assert.ok(runtimes.includes('codex-cli'), `Got ${JSON.stringify(runtimes)}`);
    assert.ok(runtimes.includes('gemini'));
  });

  test('extracts FILE_PATH', () => {
    const entities = extractEntitiesRegex('Edit vendor/get-anything-done/lib/ml/ner/extract.cjs now.');
    const paths = entities.filter((e) => e.type === 'FILE_PATH').map((e) => e.value);
    assert.ok(paths.length > 0 && paths.some((v) => v.includes('extract.cjs')), `Got ${JSON.stringify(paths)}`);
  });

  test('extracts HANDOFF_ID', () => {
    const entities = extractEntitiesRegex('Handoff h-2026-04-23T23-30-00-global-05 closed.');
    const hids = entities.filter((e) => e.type === 'HANDOFF_ID').map((e) => e.value);
    assert.ok(hids.length > 0, 'Expected handoff ID');
    assert.ok(hids[0].startsWith('h-'));
  });

  test('returns sorted by start position', () => {
    const entities = extractEntitiesRegex('See GLOBAL-D-10 and https://foo.bar and 246-07.');
    for (let i = 1; i < entities.length; i++) {
      assert.ok(entities[i].start >= entities[i - 1].start, 'Should be sorted by start');
    }
  });

  test('no crash on empty string', () => {
    const entities = extractEntitiesRegex('');
    assert.ok(Array.isArray(entities));
    assert.equal(entities.length, 0);
  });

  test('PATTERNS covers all entity types', () => {
    const types = PATTERNS.map((p) => p.type);
    for (const t of ['TASK_ID', 'DECISION_ID', 'URL', 'FILE_PATH', 'RUNTIME', 'HANDOFF_ID']) {
      assert.ok(types.includes(t), `Missing pattern for ${t}`);
    }
  });

  test('GLINER_LABELS is an array of strings', () => {
    assert.ok(Array.isArray(GLINER_LABELS));
    assert.ok(GLINER_LABELS.length > 0);
    for (const l of GLINER_LABELS) assert.equal(typeof l, 'string');
  });
});

describe('ner - async extractEntities (regex-only mode)', () => {
  test('extractEntities with regexOnly=true matches regex variant', async () => {
    const text = 'Task GLOBAL-T-80-04 uses codex-cli; see GLOBAL-D-285.';
    const sync  = extractEntitiesRegex(text);
    const async_ = await extractEntities(text, { regexOnly: true });
    assert.deepEqual(sync, async_);
  });
});
