'use strict';
/**
 * Phase 145 task GLOBAL-T-145-02 verification — Adapter D (prompt-files).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-prompt-files.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { iterEnvelopes, _internal } = require('../lib/telemetry/adapters/prompt-files.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function mkRootDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pfile-'));
}

function writeWorker(rootDir, workerId, status, promptFiles) {
  const dir = path.join(rootDir, '.planning', 'team', 'workers', workerId);
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  if (status) {
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status));
  }
  for (const { name, content, mtimeMs } of promptFiles) {
    const p = path.join(dir, 'out', name);
    fs.writeFileSync(p, content);
    if (mtimeMs != null) {
      const ms = mtimeMs / 1000;
      fs.utimesSync(p, ms, ms);
    }
  }
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

test('listPromptFiles only matches numeric .prompt.md files, sorted by ts', () => {
  const root = mkRootDir();
  const dir = path.join(root, '.planning', 'team', 'workers', 'w1', 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '1777875475363.prompt.md'), 'b');
  fs.writeFileSync(path.join(dir, '1777875000000.prompt.md'), 'a');
  fs.writeFileSync(path.join(dir, 'README.md'), 'no');
  fs.writeFileSync(path.join(dir, 'not-numeric.prompt.md'), 'no');
  const files = _internal.listPromptFiles(dir);
  assert.equal(files.length, 2);
  assert.equal(files[0].name, '1777875000000.prompt.md');
  assert.equal(files[1].name, '1777875475363.prompt.md');
  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes yields one envelope per prompt file, all valid', async () => {
  const root = mkRootDir();
  const t1 = new Date('2026-05-04T06:00:00.000Z').getTime();
  const t2 = new Date('2026-05-04T07:00:00.000Z').getTime();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { name: '1777875000000.prompt.md', content: 'prompt one', mtimeMs: t1 },
      { name: '1777875475363.prompt.md', content: 'prompt two', mtimeMs: t2 },
    ],
  );

  const envs = await collect(root);
  assert.equal(envs.length, 2);
  for (const e of envs) {
    assert.equal(validateEnvelope(e).ok, true);
    assert.equal(e.role, 'prompt');
    assert.equal(e.runtime, 'codex-cli');
    assert.equal(e.agent_id, 'w1');
    assert.equal(e.project, 'global');
    assert.equal(e.handoff_id, null);
    assert.equal(e.task_id, null);
    assert.equal(e.schema_v, 1);
  }
  // Ordered by numeric ts prefix
  assert.equal(envs[0].seq, 1777875000000);
  assert.equal(envs[1].seq, 1777875475363);
  // content shape
  assert.equal(envs[0].content.text, 'prompt one');
  assert.equal(envs[0].content.source_file, '1777875000000.prompt.md');
  // ts is mtime as iso
  assert.equal(envs[0].ts, new Date(t1).toISOString());
  assert.equal(envs[1].ts, new Date(t2).toISOString());

  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes is idempotent — same input → same envelope ids', async () => {
  const root = mkRootDir();
  const t1 = new Date('2026-05-04T06:00:00.000Z').getTime();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { name: '1777875000000.prompt.md', content: 'p', mtimeMs: t1 },
    ],
  );
  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.equal(a[0].id, b[0].id);
  assert.equal(a[0].run_id, b[0].run_id);
  assert.equal(a[0].seq, b[0].seq);
  fs.rmSync(root, { recursive: true, force: true });
});

test('sinceMs drops files with older mtime', async () => {
  const root = mkRootDir();
  const tOld = new Date('2026-05-04T06:00:00.000Z').getTime();
  const tNew = new Date('2026-05-05T06:00:00.000Z').getTime();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { name: '1.prompt.md', content: 'old', mtimeMs: tOld },
      { name: '2.prompt.md', content: 'new', mtimeMs: tNew },
    ],
  );
  const cutoff = new Date('2026-05-04T12:00:00.000Z').getTime();
  const envs = await collect(root, cutoff);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.text, 'new');
  fs.rmSync(root, { recursive: true, force: true });
});

test('falls back to runtime guess when status.json missing', async () => {
  const root = mkRootDir();
  // No status.json — w2 should map to gemini-cli via guess table
  const dir = path.join(root, '.planning', 'team', 'workers', 'w2', 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '5.prompt.md'), 'hi');
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].runtime, 'gemini-cli');
  assert.ok(envs[0].run_id.startsWith('gm-w2-'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('multiple workers — each emits its own prompt envelopes', async () => {
  const root = mkRootDir();
  const t = new Date('2026-05-04T06:00:00.000Z').getTime();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { name: '1.prompt.md', content: 'a', mtimeMs: t },
  ]);
  writeWorker(root, 'w2', { id: 'w2', runtime: 'gemini-cli' }, [
    { name: '2.prompt.md', content: 'b', mtimeMs: t },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 2);
  const byAgent = {};
  for (const e of envs) byAgent[e.agent_id] = e;
  assert.equal(byAgent.w1.runtime, 'codex-cli');
  assert.equal(byAgent.w2.runtime, 'gemini-cli');
  // Different runtimes → different run_id prefixes
  assert.notEqual(byAgent.w1.run_id.slice(0, 2), byAgent.w2.run_id.slice(0, 2));
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns empty when rootDir has no workers', async () => {
  const root = mkRootDir();
  const envs = await collect(root);
  assert.deepEqual(envs, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('content_type defaults to planning for handoff prompt text', async () => {
  const root = mkRootDir();
  const t = new Date('2026-05-04T06:00:00.000Z').getTime();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { name: '1.prompt.md', content: 'do task GLOBAL-T-145-05 per handoff', mtimeMs: t },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content_type, 'planning');
  fs.rmSync(root, { recursive: true, force: true });
});

test('content_type field present and valid on every prompt envelope', async () => {
  const root = mkRootDir();
  const t = new Date('2026-05-04T06:00:00.000Z').getTime();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { name: '1.prompt.md', content: 'p', mtimeMs: t },
  ]);
  const envs = await collect(root);
  for (const e of envs) {
    assert.ok(['planning', 'code', 'site', 'eval', 'narrative', 'meta'].includes(e.content_type));
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('non-prompt files in out/ are ignored', async () => {
  const root = mkRootDir();
  const dir = path.join(root, '.planning', 'team', 'workers', 'w1', 'out');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'team', 'workers', 'w1', 'status.json'),
    JSON.stringify({ id: 'w1', runtime: 'codex-cli' }));
  fs.writeFileSync(path.join(dir, '1.prompt.md'), 'real');
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'ignore');
  fs.writeFileSync(path.join(dir, '1.response.md'), 'ignore');
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.text, 'real');
  fs.rmSync(root, { recursive: true, force: true });
});
