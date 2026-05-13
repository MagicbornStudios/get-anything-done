'use strict';
/**
 * Phase 145 task GLOBAL-T-145-02 verification — Adapter C (worker-log).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-worker-log.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { iterEnvelopes, _internal } = require('../lib/telemetry/adapters/worker-log.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function mkRootDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wlog-'));
}

function writeWorker(rootDir, workerId, status, lines) {
  const dir = path.join(rootDir, '.planning', 'team', 'workers', workerId);
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'mailbox'), { recursive: true });
  if (status) {
    fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status));
  }
  const log = lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'log.jsonl'), log);
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

test('classifyKind maps the 6 known kinds correctly', () => {
  const { classifyKind } = _internal;
  assert.equal(classifyKind('subproc-stdin').role, 'prompt');
  assert.equal(classifyKind('subproc-stderr').role, 'reasoning');
  assert.equal(classifyKind('subproc-stdout').role, 'response');
  assert.equal(classifyKind('work-start').role, 'meta');
  assert.equal(classifyKind('rate-limit-detected-midstream').role, 'meta');
  assert.equal(classifyKind('claim-error').role, 'meta');
  assert.equal(classifyKind('work-skip-empty-body'), null);
  assert.equal(classifyKind('worker-start'), null);
  assert.equal(classifyKind('made-up-kind'), null);
});

test('extractModel pulls model line out of stderr banner', () => {
  const { extractModel } = _internal;
  const banner = 'workdir: C:\\foo\nmodel: gpt-5.4\nprovider: openai\n';
  assert.equal(extractModel(banner), 'gpt-5.4');
  assert.equal(extractModel('no banner here'), null);
  assert.equal(extractModel(null), null);
});

test('readStatusRuntime reads runtime from status.json, caches by worker', () => {
  const root = mkRootDir();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, []);
  const cache = new Map();
  assert.equal(_internal.readStatusRuntime(root, 'w1', cache), 'codex-cli');
  // Mutate file; cache should still return cached value
  fs.writeFileSync(
    path.join(root, '.planning', 'team', 'workers', 'w1', 'status.json'),
    JSON.stringify({ id: 'w1', runtime: 'gemini-cli' }),
  );
  assert.equal(_internal.readStatusRuntime(root, 'w1', cache), 'codex-cli');
  fs.rmSync(root, { recursive: true, force: true });
});

test('readStatusRuntime falls back to guess when status.json missing', () => {
  const root = mkRootDir();
  fs.mkdirSync(path.join(root, '.planning', 'team', 'workers', 'w2'), { recursive: true });
  const cache = new Map();
  assert.equal(_internal.readStatusRuntime(root, 'w2', cache), 'gemini-cli');
  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes yields valid envelopes for each interesting kind', async () => {
  const root = mkRootDir();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { ts: '2026-05-04T06:12:31.336Z', worker_id: 'w1', kind: 'worker-start', runtime: 'codex-cli' },
      { ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-test-1', prompt_file: 'out/100.prompt.md' },
      { ts: '2026-05-04T06:18:03.260Z', worker_id: 'w1', kind: 'subproc-stdin', data: 'hello prompt', prompt_file: 'out/100.prompt.md' },
      { ts: '2026-05-04T06:18:12.964Z', worker_id: 'w1', kind: 'subproc-stderr', data: 'OpenAI Codex v0.121.0\nmodel: gpt-5.4\nprovider: openai\n' },
      { ts: '2026-05-04T06:18:15.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'final answer' },
      { ts: '2026-05-04T06:18:16.000Z', worker_id: 'w1', kind: 'work-skip-empty-body' }, // ignored
      { ts: '2026-05-04T06:18:17.411Z', worker_id: 'w1', kind: 'rate-limit-detected-midstream', runtime_cmd: 'codex exec' },
    ],
  );

  const envs = await collect(root);
  // 1 work-start + 1 stdin + 1 stderr + 1 stdout + 1 rate-limit-detected = 5
  assert.equal(envs.length, 5, `got ${envs.length} envelopes`);

  for (const e of envs) {
    assert.equal(validateEnvelope(e).ok, true);
    assert.equal(e.runtime, 'codex-cli');
    assert.equal(e.agent_id, 'w1');
    assert.equal(e.project, 'global');
    assert.equal(e.handoff_id, 'h-test-1');
    assert.equal(e.schema_v, 1);
  }

  const byRole = (r) => envs.filter((x) => x.role === r);
  assert.equal(byRole('meta').length, 2);     // work-start + rate-limit
  assert.equal(byRole('prompt').length, 1);
  assert.equal(byRole('reasoning').length, 1);
  assert.equal(byRole('response').length, 1);

  // Model parsed from stderr banner — propagated to subsequent envelopes
  const stderr = byRole('reasoning')[0];
  assert.equal(stderr.model, 'gpt-5.4');
  // The stdout AFTER stderr should also carry the model.
  const stdout = byRole('response')[0];
  assert.equal(stdout.model, 'gpt-5.4');

  // Prompt content shape
  const p = byRole('prompt')[0];
  assert.equal(p.content.text, 'hello prompt');
  assert.equal(p.content.prompt_file, 'out/100.prompt.md');

  fs.rmSync(root, { recursive: true, force: true });
});

test('iterEnvelopes is idempotent — same input → same envelope ids', async () => {
  const root = mkRootDir();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-x' },
      { ts: '2026-05-04T06:18:03.260Z', worker_id: 'w1', kind: 'subproc-stdin', data: 'p' },
      { ts: '2026-05-04T06:18:15.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'r' },
    ],
  );

  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id);
    assert.equal(a[i].run_id, b[i].run_id);
    assert.equal(a[i].seq, b[i].seq);
    assert.equal(a[i].ts, b[i].ts);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('sinceMs filter drops earlier rows', async () => {
  const root = mkRootDir();
  writeWorker(
    root,
    'w1',
    { id: 'w1', runtime: 'codex-cli' },
    [
      { ts: '2026-05-04T06:00:00.000Z', worker_id: 'w1', kind: 'work-start', ref: 'h-old' },
      { ts: '2026-05-04T06:00:01.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'old' },
      { ts: '2026-05-05T00:00:00.000Z', worker_id: 'w1', kind: 'work-start', ref: 'h-new' },
      { ts: '2026-05-05T00:00:01.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'new' },
    ],
  );
  const cutoff = new Date('2026-05-04T12:00:00.000Z').getTime();
  const envs = await collect(root, cutoff);
  assert.equal(envs.length, 2);
  for (const e of envs) assert.ok(new Date(e.ts).getTime() >= cutoff);
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips unparseable jsonl lines without crashing', async () => {
  const root = mkRootDir();
  fs.mkdirSync(path.join(root, '.planning', 'team', 'workers', 'w1', 'out'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.planning', 'team', 'workers', 'w1', 'status.json'),
    JSON.stringify({ id: 'w1', runtime: 'codex-cli' }),
  );
  const lines = [
    JSON.stringify({ ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-1' }),
    'this is not json',
    JSON.stringify({ ts: '2026-05-04T06:18:15.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'ok' }),
  ];
  fs.writeFileSync(
    path.join(root, '.planning', 'team', 'workers', 'w1', 'log.jsonl'),
    lines.join('\n') + '\n',
  );
  const envs = await collect(root);
  // 1 work-start + 1 stdout = 2; bad line skipped
  assert.equal(envs.length, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('multiple workers — each gets own runtime + run_id namespacing', async () => {
  const root = mkRootDir();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-A' },
    { ts: '2026-05-04T06:18:00.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'a' },
  ]);
  writeWorker(root, 'w2', { id: 'w2', runtime: 'gemini-cli' }, [
    { ts: '2026-05-04T07:00:00.000Z', worker_id: 'w2', kind: 'work-start', ref: 'h-B' },
    { ts: '2026-05-04T07:00:01.000Z', worker_id: 'w2', kind: 'subproc-stdout', data: 'b' },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 4);
  const w1 = envs.filter((e) => e.agent_id === 'w1');
  const w2 = envs.filter((e) => e.agent_id === 'w2');
  assert.equal(w1.length, 2);
  assert.equal(w2.length, 2);
  assert.ok(w1[0].run_id.startsWith('cx-w1-'));
  assert.ok(w2[0].run_id.startsWith('gm-w2-'));
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns empty when rootDir has no workers', async () => {
  const root = mkRootDir();
  const envs = await collect(root);
  assert.deepEqual(envs, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('content_type defaults to planning when run has handoff_id and no path signal', async () => {
  const root = mkRootDir();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-test-1' },
    { ts: '2026-05-04T06:18:00.000Z', worker_id: 'w1', kind: 'subproc-stdin', data: 'do the planning task' },
    { ts: '2026-05-04T06:18:01.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'done' },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 3);
  for (const e of envs) {
    assert.equal(e.content_type, 'planning', `${e.role} should be planning under handoff`);
  }
  fs.rmSync(root, { recursive: true, force: true });
});

test('content_type field is populated and valid on every envelope', async () => {
  const root = mkRootDir();
  writeWorker(root, 'w1', { id: 'w1', runtime: 'codex-cli' }, [
    { ts: '2026-05-04T06:17:55.386Z', worker_id: 'w1', kind: 'work-start', ref: 'h-x' },
    { ts: '2026-05-04T06:18:00.000Z', worker_id: 'w1', kind: 'subproc-stdout', data: 'r' },
  ]);
  const envs = await collect(root);
  for (const e of envs) {
    assert.ok(['planning', 'code', 'site', 'eval', 'narrative', 'meta'].includes(e.content_type));
  }
  fs.rmSync(root, { recursive: true, force: true });
});
