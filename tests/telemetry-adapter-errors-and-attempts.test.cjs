'use strict';
/**
 * Phase 145.5 task GLOBAL-T-145.5-01 verification — Adapter E
 * (errors-and-attempts).
 *
 * Run: node --test tests/telemetry-adapter-errors-and-attempts.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  iterEnvelopes,
  _internal,
} = require('../lib/telemetry/adapters/errors-and-attempts.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function mkRootDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'errors-adapter-'));
}

function writeXml(rootDir, rel, body) {
  const full = path.join(rootDir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, 'utf8');
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

const FIXTURE_GLOBAL = `<?xml version="1.0" encoding="UTF-8"?>
<errors-and-attempts>
  <entry id="example-bug-2026-04-21" date="2026-04-21" phase="05" status="resolved">
    <summary>Example summary describing the failure mode</summary>
    <context>vendor/get-anything-done/site (date 2026-04-21)</context>
    <failure>What went wrong &amp; why</failure>
    <rule>Do X next time, not Y</rule>
    <reference>Fix commit: abc1234</reference>
    <reference>Task: GLOBAL-T-145-01</reference>
  </entry>
  <entry id="another-bug-2026-04-22" date="2026-04-22">
    <summary>Second entry</summary>
    <context>different surface</context>
    <failure>different failure</failure>
    <rule>different rule</rule>
    <reference>handoff h-2026-05-05T05-09-58-global-109</reference>
    <resolution>Resolved by GAD-T-63-18</resolution>
  </entry>
</errors-and-attempts>
`;

const FIXTURE_VENDOR = `<?xml version="1.0" encoding="UTF-8"?>
<errors-and-attempts>
  <entry id="vendor-only-2026-04-23" date="2026-04-23">
    <summary>Vendor-side entry</summary>
    <context>vendor surface</context>
    <failure>vendor failure</failure>
    <rule>vendor rule</rule>
    <reference>vendor ref</reference>
  </entry>
</errors-and-attempts>
`;

test('iterEnvelopes yields one envelope per <entry> across both sources', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_GLOBAL);
  writeXml(root, 'vendor/get-anything-done/.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_VENDOR);

  const envs = await collect(root);
  assert.equal(envs.length, 3);
  for (const e of envs) {
    assert.equal(validateEnvelope(e).ok, true);
    assert.equal(e.role, 'meta');
    assert.equal(e.runtime, 'gad-cli');
    assert.equal(e.content_type, 'meta');
    assert.equal(e.content.kind, 'error_lesson');
    assert.equal(e.schema_v, 1);
    assert.equal(e.model, null);
  }
  // Project tagging differs by source
  const byProject = {};
  for (const e of envs) {
    byProject[e.project] = (byProject[e.project] || 0) + 1;
  }
  assert.equal(byProject.global, 2);
  assert.equal(byProject['get-anything-done'], 1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('content carries id/summary/context/failure/rule/reference fields and decoded entities', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_GLOBAL);
  const envs = await collect(root);
  const e0 = envs.find((e) => e.content.id === 'example-bug-2026-04-21');
  assert.ok(e0);
  assert.equal(e0.content.summary, 'Example summary describing the failure mode');
  assert.equal(e0.content.failure, 'What went wrong & why'); // entity decoded
  assert.equal(e0.content.rule, 'Do X next time, not Y');
  assert.deepEqual(e0.content.reference, [
    'Fix commit: abc1234',
    'Task: GLOBAL-T-145-01',
  ]);
  assert.equal(e0.content.phase, '05');
  assert.equal(e0.content.status, 'resolved');
  assert.equal(e0.content.date, '2026-04-21');
  // ts is from date attr at midnight UTC
  assert.equal(e0.ts, '2026-04-21T00:00:00.000Z');
  fs.rmSync(root, { recursive: true, force: true });
});

test('parseRefIds extracts task_id and handoff_id from references', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_GLOBAL);
  const envs = await collect(root);
  const e0 = envs.find((e) => e.content.id === 'example-bug-2026-04-21');
  const e1 = envs.find((e) => e.content.id === 'another-bug-2026-04-22');
  assert.equal(e0.task_id, 'GLOBAL-T-145-01');
  assert.equal(e1.handoff_id, 'h-2026-05-05T05-09-58-global-109');
  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes is idempotent — re-run yields identical envelope ids', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_GLOBAL);
  writeXml(root, 'vendor/get-anything-done/.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_VENDOR);
  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id);
    assert.equal(a[i].run_id, b[i].run_id);
    assert.equal(a[i].seq, b[i].seq);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('sinceMs cutoff drops older entries', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', FIXTURE_GLOBAL);
  const cutoff = Date.parse('2026-04-22T00:00:00.000Z');
  const envs = await collect(root, cutoff);
  // example-bug-2026-04-21 is before cutoff; another-bug-2026-04-22 is at cutoff
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.id, 'another-bug-2026-04-22');
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns empty when no source files exist', async () => {
  const root = mkRootDir();
  const envs = await collect(root);
  assert.deepEqual(envs, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('falls back to file mtime when entry has no date', async () => {
  const root = mkRootDir();
  const undated = `<?xml version="1.0"?>
<errors-and-attempts>
  <entry id="undated-1">
    <summary>No date attribute</summary>
    <context>no date here</context>
    <failure>x</failure>
    <rule>y</rule>
  </entry>
</errors-and-attempts>
`;
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', undated);
  // set mtime to a known value
  const mt = Date.parse('2026-03-15T12:00:00.000Z') / 1000;
  fs.utimesSync(path.join(root, '.planning/ERRORS-AND-ATTEMPTS.xml'), mt, mt);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  // ts within 1s of mtime
  const tDelta = Math.abs(Date.parse(envs[0].ts) - mt * 1000);
  assert.ok(tDelta < 1500, `expected ts close to mtime, got delta ${tDelta}ms`);
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips entry without id attribute', async () => {
  const root = mkRootDir();
  const bad = `<?xml version="1.0"?>
<errors-and-attempts>
  <entry date="2026-04-21">
    <summary>No id</summary><failure>x</failure><rule>y</rule><context>c</context>
  </entry>
  <entry id="ok-1" date="2026-04-21">
    <summary>has id</summary><failure>x</failure><rule>y</rule><context>c</context>
  </entry>
</errors-and-attempts>
`;
  writeXml(root, '.planning/ERRORS-AND-ATTEMPTS.xml', bad);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.id, 'ok-1');
  fs.rmSync(root, { recursive: true, force: true });
});

test('decodeEntities handles &amp; &lt; &gt; &quot; &apos; numeric refs', () => {
  const { decodeEntities } = _internal;
  assert.equal(decodeEntities('a &amp; b'), 'a & b');
  assert.equal(decodeEntities('&lt;tag&gt;'), '<tag>');
  assert.equal(decodeEntities('&quot;x&quot;'), '"x"');
  assert.equal(decodeEntities('it&apos;s'), "it's");
  assert.equal(decodeEntities('A&#65;'), 'AA');
  assert.equal(decodeEntities('A&#x41;'), 'AA');
});

test('parseRefIds returns nulls when no ids found', () => {
  const { parseRefIds } = _internal;
  assert.deepEqual(parseRefIds(['just text', 'no ids here']), {
    task_id: null,
    handoff_id: null,
  });
});
