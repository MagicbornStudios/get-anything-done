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

test('populates content_type (defaults to meta for CLI traffic)', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-04-09.jsonl', [
    { ts: '2026-04-09T00:08:05.918Z', cmd: 'snapshot --projectid global', args: ['snapshot', '--projectid', 'global'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
    { ts: '2026-04-09T00:08:06.000Z', cmd: 'tasks add', args: ['tasks', 'add', '--projectid', 'global', '--phase', '145', 'sites/operator-portfolio/page.tsx'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 2);
  // Plain CLI call with no path-like arg → meta
  assert.equal(envs[0].content_type, 'meta');
  // Args contains a path-like sites/ token → site
  assert.equal(envs[1].content_type, 'site');
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

// Phase 145.5-05: glob extension picks up <date>-skill-loads.jsonl and
// <date>-routing.jsonl alongside the default <date>.jsonl. Verifies the
// new content.kind discriminator and that routing rows preserve every
// field verbatim (they're GOLD signal).

test('picks up <date>-skill-loads.jsonl with content.kind=skill_load', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-05-05-skill-loads.jsonl', [
    {
      ts: '2026-05-05T19:53:24.187Z',
      runtime: 'claude-code',
      worker: null,
      handoff_id: 'h-2026-05-05T15-02-57-global-107',
      slug: 'create-proto-skill',
      projectid: 'global',
      match_reason: 'name-match:create,proto,create; desc-match:proto,evolution,planning',
      source: 'claude-skill',
      score: 28,
    },
    {
      ts: '2026-05-05T19:53:24.190Z',
      runtime: 'claude-code',
      worker: 'w3',
      handoff_id: 'h-2026-05-05T15-02-57-global-107',
      slug: 'gad-evolution-evolve',
      projectid: 'magicborn',
      match_reason: 'name-match:evolution,evolve',
      source: 'claude-skill',
      score: 28,
    },
  ]);

  const envs = await collect(root);
  assert.equal(envs.length, 2);
  for (const env of envs) {
    assert.equal(validateEnvelope(env).ok, true);
    assert.equal(env.content.kind, 'skill_load');
    assert.equal(env.role, 'meta');
    assert.equal(env.runtime, 'gad-cli');
    assert.equal(env.content.source, 'claude-skill');
  }
  // projectid honoured per row
  assert.equal(envs[0].project, 'global');
  assert.equal(envs[1].project, 'magicborn');
  // worker carries through to content
  assert.equal(envs[1].content.worker, 'w3');
  assert.equal(envs[0].content.slug, 'create-proto-skill');
});

test('picks up <date>-routing.jsonl with content.kind=routing_decision (GOLD: every field preserved)', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-05-06-routing.jsonl', [
    {
      ts: '2026-05-06T16:15:36.650Z',
      task: 'h-2026-05-06T16-15-36-global-152',
      task_shape: 'planning',
      chosen_runtime: 'opencode',
      chosen_agent: 'team-w3',
      chosen_model: 'default',
      reason: ['handoff-claim', 'runtime_pref=opencode', 'priority=normal', 'ctx=bounded'],
      outcome: 'pending',
      cost_estimate: 0,
      latency_ms: -1,
      project_id: 'global',
      session_id: '',
    },
  ]);

  const envs = await collect(root);
  assert.equal(envs.length, 1);
  const env = envs[0];
  assert.equal(validateEnvelope(env).ok, true);
  assert.equal(env.content.kind, 'routing_decision');
  assert.equal(env.role, 'meta');
  assert.equal(env.runtime, 'gad-cli');
  // project_id → envelope.project
  assert.equal(env.project, 'global');
  // every routing field preserved verbatim on content
  assert.equal(env.content.task_shape, 'planning');
  assert.equal(env.content.chosen_runtime, 'opencode');
  assert.equal(env.content.chosen_agent, 'team-w3');
  assert.equal(env.content.chosen_model, 'default');
  assert.deepEqual(env.content.reason, ['handoff-claim', 'runtime_pref=opencode', 'priority=normal', 'ctx=bounded']);
  assert.equal(env.content.outcome, 'pending');
  assert.equal(env.content.cost_estimate, 0);
  assert.equal(env.content.latency_ms, -1);
  assert.equal(env.content.project_id, 'global');
});

test('all three file kinds coexist in one .gad-log/ dir', async () => {
  const root = tmpRoot();
  writeFixture(root, '2026-05-06.jsonl', [
    { ts: '2026-05-06T00:00:00.000Z', cmd: 'snapshot', args: ['snapshot'], duration_ms: 1, exit: 0, summary: '', pid: 1 },
  ]);
  writeFixture(root, '2026-05-06-skill-loads.jsonl', [
    { ts: '2026-05-06T00:00:01.000Z', runtime: 'claude-code', slug: 's', projectid: 'global', match_reason: '', source: 'x', score: 1 },
  ]);
  writeFixture(root, '2026-05-06-routing.jsonl', [
    { ts: '2026-05-06T00:00:02.000Z', task: 't', task_shape: 'p', chosen_runtime: 'codex-cli', chosen_agent: 'a', chosen_model: 'm', reason: [], outcome: 'pending', cost_estimate: 0, latency_ms: 0, project_id: 'global', session_id: '' },
  ]);

  const envs = await collect(root);
  assert.equal(envs.length, 3);
  const kinds = envs.map((e) => e.content.kind).sort();
  assert.deepEqual(kinds, ['gad_cli_call', 'routing_decision', 'skill_load']);
});
