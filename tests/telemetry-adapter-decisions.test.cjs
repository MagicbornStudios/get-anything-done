'use strict';
/**
 * Phase 145.5 task GLOBAL-T-145.5-02 verification — Adapter F (decisions).
 *
 * Run: node --test tests/telemetry-adapter-decisions.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  iterEnvelopes,
  _internal,
} = require('../lib/telemetry/adapters/decisions.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function mkRootDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'decisions-adapter-'));
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
<decisions>
  <decision id="02-01">
    <title>Dual provider data plane</title>
    <summary>Move shared app data behind a provider contract.</summary>
    <impact>Books, Listen, and future shared services can target one backend-neutral contract.</impact>
    <references>
      <file path="apps/portfolio/PLAN.mdx" />
    </references>
  </decision>
  <decision id="03-02" at="2026-04-09T12:00:00Z" author="benja">
    <title>Storage policy</title>
    <summary>Heavy binaries go to storage as immutable artifacts.</summary>
    <body>The repo stops treating shipped binaries as commit cargo.</body>
    <supersedes id="02-01" />
    <tags>storage, policy</tags>
  </decision>
</decisions>
`;

const FIXTURE_VENDOR = `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="gad-92">
    <title>docs/ is GSD upstream</title>
    <summary>Archive docs/ as docs-gsd-upstream/.</summary>
    <impact>Quick rename. Site is self-contained.</impact>
  </decision>
</decisions>
`;

test('iterEnvelopes yields one envelope per <decision> across both sources', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/DECISIONS.xml', FIXTURE_GLOBAL);
  writeXml(root, 'vendor/get-anything-done/.planning/DECISIONS.xml', FIXTURE_VENDOR);

  const envs = await collect(root);
  assert.equal(envs.length, 3);
  for (const e of envs) {
    assert.equal(validateEnvelope(e).ok, true);
    assert.equal(e.role, 'reasoning');
    assert.equal(e.runtime, 'gad-cli');
    assert.equal(e.content_type, 'planning');
    assert.equal(e.content.kind, 'decision_rationale');
    assert.equal(e.schema_v, 1);
    assert.equal(e.task_id, null);
    assert.equal(e.handoff_id, null);
  }
  const byProject = {};
  for (const e of envs) {
    byProject[e.project] = (byProject[e.project] || 0) + 1;
  }
  assert.equal(byProject.global, 2);
  assert.equal(byProject['get-anything-done'], 1);

  fs.rmSync(root, { recursive: true, force: true });
});

test('content carries id/title/summary/body and falls back to <impact> when no <body>', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/DECISIONS.xml', FIXTURE_GLOBAL);
  const envs = await collect(root);
  const e0 = envs.find((e) => e.content.id === '02-01');
  const e1 = envs.find((e) => e.content.id === '03-02');
  assert.ok(e0);
  assert.ok(e1);

  assert.equal(e0.content.title, 'Dual provider data plane');
  assert.equal(e0.content.summary, 'Move shared app data behind a provider contract.');
  // No <body> → falls back to <impact>
  assert.match(e0.content.body, /backend-neutral contract/);

  // <body> present → used directly
  assert.equal(e1.content.body, 'The repo stops treating shipped binaries as commit cargo.');
  assert.equal(e1.content.author, 'benja');
  assert.equal(e1.content.at, '2026-04-09T12:00:00Z');
  assert.deepEqual(e1.content.supersedes, ['02-01']);
  assert.deepEqual(e1.content.tags, ['storage', 'policy']);

  fs.rmSync(root, { recursive: true, force: true });
});

test('ts uses <at> attribute when present, file mtime otherwise', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/DECISIONS.xml', FIXTURE_GLOBAL);
  const fixedMtime = Date.parse('2026-02-01T00:00:00.000Z') / 1000;
  fs.utimesSync(path.join(root, '.planning/DECISIONS.xml'), fixedMtime, fixedMtime);

  const envs = await collect(root);
  const e0 = envs.find((e) => e.content.id === '02-01');
  const e1 = envs.find((e) => e.content.id === '03-02');
  // No at -> mtime
  const tDelta = Math.abs(Date.parse(e0.ts) - fixedMtime * 1000);
  assert.ok(tDelta < 1500, `expected ts close to mtime, got delta ${tDelta}ms`);
  // at attribute -> exact parse
  assert.equal(e1.ts, '2026-04-09T12:00:00.000Z');

  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes is idempotent — re-run yields identical envelope ids', async () => {
  const root = mkRootDir();
  writeXml(root, '.planning/DECISIONS.xml', FIXTURE_GLOBAL);
  writeXml(root, 'vendor/get-anything-done/.planning/DECISIONS.xml', FIXTURE_VENDOR);
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

test('soft cap at 8KB triggers truncated flag on oversized body', async () => {
  const root = mkRootDir();
  const big = 'x'.repeat(9 * 1024);
  const xml = `<?xml version="1.0"?>
<decisions>
  <decision id="big-01" at="2026-04-09T12:00:00Z">
    <title>Big decision</title>
    <summary>summary</summary>
    <body>${big}</body>
  </decision>
  <decision id="small-01" at="2026-04-09T12:00:00Z">
    <title>Small</title>
    <summary>summary</summary>
    <body>tiny</body>
  </decision>
</decisions>
`;
  writeXml(root, '.planning/DECISIONS.xml', xml);
  const envs = await collect(root);
  const big01 = envs.find((e) => e.content.id === 'big-01');
  const small01 = envs.find((e) => e.content.id === 'small-01');
  assert.equal(big01.content.truncated, true);
  assert.ok(Buffer.byteLength(big01.content.body, 'utf8') <= _internal.BODY_CAP_BYTES);
  // small entry should NOT have truncated flag
  assert.equal(small01.content.truncated, undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sinceMs cutoff drops older entries', async () => {
  const root = mkRootDir();
  const xml = `<?xml version="1.0"?>
<decisions>
  <decision id="old-01" at="2026-01-01T00:00:00Z">
    <title>Old</title><summary>old</summary><body>old body</body>
  </decision>
  <decision id="new-01" at="2026-04-09T12:00:00Z">
    <title>New</title><summary>new</summary><body>new body</body>
  </decision>
</decisions>
`;
  writeXml(root, '.planning/DECISIONS.xml', xml);
  const cutoff = Date.parse('2026-03-01T00:00:00.000Z');
  const envs = await collect(root, cutoff);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.id, 'new-01');
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns empty when no source files exist', async () => {
  const root = mkRootDir();
  const envs = await collect(root);
  assert.deepEqual(envs, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips decision without id attribute', async () => {
  const root = mkRootDir();
  const xml = `<?xml version="1.0"?>
<decisions>
  <decision>
    <title>No id</title><summary>x</summary><body>y</body>
  </decision>
  <decision id="ok-1" at="2026-04-09T12:00:00Z">
    <title>Has id</title><summary>x</summary><body>y</body>
  </decision>
</decisions>
`;
  writeXml(root, '.planning/DECISIONS.xml', xml);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.id, 'ok-1');
  fs.rmSync(root, { recursive: true, force: true });
});

test('capBody internals: returns truncated=false for short input, true when oversized', () => {
  const { capBody, BODY_CAP_BYTES } = _internal;
  const small = capBody('hello');
  assert.equal(small.body, 'hello');
  assert.equal(small.truncated, false);

  const big = capBody('y'.repeat(BODY_CAP_BYTES + 100));
  assert.equal(big.truncated, true);
  assert.ok(Buffer.byteLength(big.body, 'utf8') <= BODY_CAP_BYTES);
});

test('decodes XML entities in body and summary', async () => {
  const root = mkRootDir();
  const xml = `<?xml version="1.0"?>
<decisions>
  <decision id="ent-01" at="2026-04-09T12:00:00Z">
    <title>Entities</title>
    <summary>a &amp; b</summary>
    <body>x &lt; y &amp; z</body>
  </decision>
</decisions>
`;
  writeXml(root, '.planning/DECISIONS.xml', xml);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.summary, 'a & b');
  assert.equal(envs[0].content.body, 'x < y & z');
  fs.rmSync(root, { recursive: true, force: true });
});
