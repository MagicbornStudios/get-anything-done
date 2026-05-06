'use strict';
/**
 * Phase 145 task GLOBAL-T-145-02 verification — gad-log adapter (S1).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-gad-log.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { iterEnvelopes } = require('../lib/telemetry/adapters/gad-log.cjs');
const { validateEnvelope, VALID_ROLES, VALID_RUNTIMES } = require('../lib/telemetry/envelope.cjs');

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-log-adapter-'));
  fs.mkdirSync(path.join(dir, '.planning', '.gad-log'), { recursive: true });
  return dir;
}

function writeFixture(rootDir, fname, lines) {
  const fpath = path.join(rootDir, '.planning', '.gad-log', fname);
  fs.writeFileSync(fpath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return fpath;
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

test('emits one envelope per gad CLI invocation line', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:08:05.918Z', cmd: 'snapshot --projectid global', args: ['snapshot', '--projectid', 'global'], duration_ms: 153, exit: 0, summary: '', pid: 30972 },
    { ts: '2026-04-09T00:08:06.146Z', type: 'tool_call', tool: 'Bash', session_id: 'fa8293de-c4d7-47f6-94a5-35f99607c936', input_summary: 'node bin/gad.cjs snapshot --projectid get-anything-done', output_length: 0, gad_command: 'snapshot --projectid get-anything-done' },
    { ts: '2026-04-09T00:08:42.000Z', type: 'tool_call', tool: 'Read', session_id: 'fa8293de-c4d7-47f6-94a5-35f99607c936', input_summary: 'C:\\path\\to\\file', output_length: 0 },
  ]);

  const envs = await collect(root);
  assert.equal(envs.length, 3);
  for (const env of envs) {
    assert.equal(validateEnvelope(env).ok, true);
    assert.equal(env.runtime, 'gad-cli');
    assert.equal(env.role, 'meta');
    assert.ok(VALID_ROLES.has(env.role));
    assert.ok(VALID_RUNTIMES.has(env.runtime));
  }
});

test('derives project from --projectid arg', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:08:05.918Z', cmd: 'snapshot --projectid global', args: ['snapshot', '--projectid', 'global'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:08:06.000Z', cmd: 'snapshot --projectid get-anything-done', args: ['snapshot', '--projectid', 'get-anything-done'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:08:07.000Z', cmd: 'foo', args: ['foo'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:08:08.000Z', type: 'tool_call', tool: 'Bash', session_id: 's1', input_summary: 'gad snapshot --projectid magicborn', output_length: 0 },
  ]);
  const envs = await collect(root);
  assert.equal(envs[0].project, 'global');
  assert.equal(envs[1].project, 'get-anything-done');
  assert.equal(envs[2].project, 'global'); // default
  assert.equal(envs[3].project, 'magicborn');
});

test('preserves source fields in content', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:08:05.918Z', cmd: 'snapshot', args: ['snapshot'], duration_ms: 153, exit: 0, summary: 'ok', pid: 30972 },
  ]);
  const [env] = await collect(root);
  assert.equal(env.content.cmd, 'snapshot');
  assert.deepEqual(env.content.args, ['snapshot']);
  assert.equal(env.content.duration_ms, 153);
  assert.equal(env.content.exit, 0);
  assert.equal(env.content.summary, 'ok');
  assert.equal(env.content.pid, 30972);
});

test('skips rows older than sinceMs', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:00:00.000Z', cmd: 'old', args: ['old'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T05:00:00.000Z', cmd: 'new', args: ['new'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
  ]);
  const cutoff = Date.parse('2026-04-09T01:00:00.000Z');
  const envs = await collect(root, cutoff);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].content.cmd, 'new');
});

test('idempotent: same input -> same envelope ids', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:00:00.000Z', cmd: 'a', args: ['a'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:01:00.000Z', cmd: 'b', args: ['b'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:02:00.000Z', cmd: 'c', args: ['c'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
  ]);
  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id);
    assert.equal(a[i].run_id, b[i].run_id);
    assert.deepEqual(a[i].content, b[i].content);
  }
});

test('handles missing .gad-log dir gracefully', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-log-empty-'));
  // no .planning/.gad-log
  const envs = await collect(dir);
  assert.equal(envs.length, 0);
});

test('skips unparseable lines, logs to stderr, continues', async () => {
  const root = tmpRoot();
  const fpath = path.join(root, '.planning', '.gad-log', '2026-04-09.jsonl');
  fs.writeFileSync(fpath, [
    JSON.stringify({ ts: '2026-04-09T00:00:00.000Z', cmd: 'a', args: ['a'], duration_ms: 1, exit: 0, summary: '', pid: 1 }),
    'not valid json',
    JSON.stringify({ ts: '2026-04-09T00:01:00.000Z', cmd: 'b', args: ['b'], duration_ms: 1, exit: 0, summary: '', pid: 1 }),
  ].join('\n') + '\n');

  const origWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const envs = await collect(root);
    assert.equal(envs.length, 2);
    assert.match(captured, /unparseable/);
  } finally {
    process.stderr.write = origWrite;
  }
});

test('seq is per-file line number', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:00:00.000Z', cmd: 'a', args: ['a'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:01:00.000Z', cmd: 'b', args: ['b'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
  ]);
  const envs = await collect(root);
  assert.equal(envs[0].seq, 1);
  assert.equal(envs[1].seq, 2);
});
