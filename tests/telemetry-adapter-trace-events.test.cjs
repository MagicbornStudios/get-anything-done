'use strict';
/**
 * Phase 145 task GLOBAL-T-145-02 verification — trace-events adapter (S2).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-trace-events.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { iterEnvelopes } = require('../lib/telemetry/adapters/trace-events.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-events-adapter-'));
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  return dir;
}

function writeFixture(rootDir, lines) {
  const fpath = path.join(rootDir, '.planning', '.trace-events.jsonl');
  fs.writeFileSync(fpath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return fpath;
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

const baseRuntime = {
  id: 'claude-code',
  source: 'hook-runtime',
  model: 'claude-opus-4-7',
  session_id: '0de6ac21-bc04-4a1c-882a-782b890c9e42',
};
const baseAgent = {
  agent_id: 'ac85f4c55d7233a53',
  agent_role: null,
  parent_agent_id: null,
  root_agent_id: 'ac85f4c55d7233a53',
  depth: null,
  model_profile: null,
  resolved_model: null,
};

function toolUseRow(seq) {
  return {
    ts: '2026-05-05T19:50:00.065Z',
    seq,
    type: 'tool_use',
    runtime: baseRuntime,
    agent: baseAgent,
    tool: 'Edit',
    inputs: { file_path: '/tmp/foo', old_string: 'a', new_string: 'b' },
    outputs: '{"filePath":"/tmp/foo"}',
    outputs_truncated: false,
    duration_ms: 12,
    success: true,
    trigger_skill: null,
    scope: 'gad-framework',
  };
}

test('tool_use emits paired tool_call + tool_result', async () => {
  const root = tmpRoot();
  writeFixture(root, [toolUseRow(100)]);
  const envs = await collect(root);
  assert.equal(envs.length, 2);
  const [call, result] = envs;
  assert.equal(call.role, 'tool_call');
  assert.equal(result.role, 'tool_result');
  assert.equal(result.parent_id, call.id);
  assert.equal(call.parent_id, null);
  assert.equal(call.runtime, 'claude-code');
  assert.equal(call.model, 'claude-opus-4-7');
  assert.equal(call.agent_id, 'ac85f4c55d7233a53');
  assert.equal(call.content.tool, 'Edit');
  assert.deepEqual(call.content.inputs.file_path, '/tmp/foo');
  assert.equal(result.content.success, true);
  assert.equal(result.content.duration_ms, 12);
  assert.equal(result.content.outputs_truncated, false);
  assert.equal(call.content.scope, 'gad-framework');
  for (const env of envs) assert.equal(validateEnvelope(env).ok, true);
});

test('assistant_response emits one role=response envelope', async () => {
  const root = tmpRoot();
  writeFixture(root, [
    {
      ts: '2026-05-05T19:50:01.000Z',
      seq: 200,
      type: 'assistant_response',
      runtime: baseRuntime,
      agent: baseAgent,
      content: { text: 'Hello, here is my answer.', transcript_path: '/tmp/x.jsonl' },
    },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].role, 'response');
  assert.equal(envs[0].content.text, 'Hello, here is my answer.');
  assert.equal(envs[0].content.transcript_path, '/tmp/x.jsonl');
  assert.equal(validateEnvelope(envs[0]).ok, true);
});

test('assistant_reasoning emits one role=reasoning envelope', async () => {
  const root = tmpRoot();
  writeFixture(root, [
    {
      ts: '2026-05-05T19:50:01.000Z',
      seq: 201,
      type: 'assistant_reasoning',
      runtime: baseRuntime,
      agent: baseAgent,
      content: { text: 'Let me think about this...' },
    },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].role, 'reasoning');
  assert.equal(envs[0].content.text, 'Let me think about this...');
  assert.equal(validateEnvelope(envs[0]).ok, true);
});

test('skips out-of-scope event types (skill_invocation, file_mutation, subagent_spawn)', async () => {
  const root = tmpRoot();
  writeFixture(root, [
    { ts: '2026-05-05T19:50:01.000Z', seq: 300, type: 'skill_invocation', runtime: baseRuntime, agent: baseAgent, skill_id: 'foo' },
    { ts: '2026-05-05T19:50:02.000Z', seq: 301, type: 'file_mutation', runtime: baseRuntime, agent: baseAgent, path: '/tmp/x', op: 'edit', size_delta: 10 },
    { ts: '2026-05-05T19:50:03.000Z', seq: 302, type: 'subagent_spawn', runtime: baseRuntime, agent: baseAgent, agent_id: 'sub-1' },
  ]);
  const envs = await collect(root);
  assert.equal(envs.length, 0);
});

test('rejects rows with invalid runtime', async () => {
  const root = tmpRoot();
  writeFixture(root, [
    { ts: '2026-05-05T19:50:00.000Z', seq: 400, type: 'tool_use', runtime: { id: 'bogus', source: 'x', model: null, session_id: 's' }, agent: baseAgent, tool: 'Read', inputs: {}, outputs: null, outputs_truncated: false, duration_ms: 1, success: true },
  ]);
  const origWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const envs = await collect(root);
    assert.equal(envs.length, 0);
    assert.match(captured, /runtime not in valid set/);
  } finally {
    process.stderr.write = origWrite;
  }
});

test('skips rows older than sinceMs', async () => {
  const root = tmpRoot();
  const old = toolUseRow(500);
  old.ts = '2026-05-05T00:00:00.000Z';
  const fresh = toolUseRow(501);
  fresh.ts = '2026-05-05T20:00:00.000Z';
  writeFixture(root, [old, fresh]);
  const cutoff = Date.parse('2026-05-05T10:00:00.000Z');
  const envs = await collect(root, cutoff);
  assert.equal(envs.length, 2); // only the fresh row -> call + result
  for (const env of envs) {
    assert.equal(env.ts, '2026-05-05T20:00:00.000Z');
  }
});

test('idempotent: same input -> same envelope ids', async () => {
  const root = tmpRoot();
  writeFixture(root, [
    toolUseRow(600),
    {
      ts: '2026-05-05T19:50:01.000Z',
      seq: 601,
      type: 'assistant_response',
      runtime: baseRuntime,
      agent: baseAgent,
      content: { text: 'idempotent text' },
    },
  ]);
  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id);
    assert.equal(a[i].run_id, b[i].run_id);
    assert.equal(a[i].role, b[i].role);
    assert.deepEqual(a[i].content, b[i].content);
  }
});

test('handles missing trace-events file gracefully', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-events-empty-'));
  const envs = await collect(dir);
  assert.equal(envs.length, 0);
});

test('handles fractional seq (sub-events) without colliding', async () => {
  const root = tmpRoot();
  const a = toolUseRow(700);
  const b = toolUseRow(700.2);
  writeFixture(root, [a, b]);
  const envs = await collect(root);
  // Each tool_use yields call + result (4 total), all distinct ids.
  assert.equal(envs.length, 4);
  const ids = new Set(envs.map((e) => e.id));
  assert.equal(ids.size, 4);
});

test('populates content_type from tool_call file_path', async () => {
  const root = tmpRoot();
  // Edit on a .planning .md -> planning
  const a = {
    ...toolUseRow(900),
    inputs: { file_path: '.planning/STATE.xml', old_string: 'a', new_string: 'b' },
  };
  // Edit on a .ts file -> code
  const b = {
    ...toolUseRow(901),
    inputs: { file_path: 'lib/foo.ts', old_string: 'a', new_string: 'b' },
  };
  // Edit on a sites/ tsx -> site
  const c = {
    ...toolUseRow(902),
    inputs: { file_path: 'sites/operator-portfolio/app/page.tsx', old_string: 'a', new_string: 'b' },
  };
  writeFixture(root, [a, b, c]);
  const envs = await collect(root);
  assert.equal(envs.length, 6); // 3 tool_use -> 6 envelopes
  // Both call + result envelopes from the same row should match
  assert.equal(envs[0].content_type, 'planning');
  assert.equal(envs[1].content_type, 'planning');
  assert.equal(envs[2].content_type, 'code');
  assert.equal(envs[4].content_type, 'site');
});

test('content_type is one of the 6 valid types for every emitted envelope', async () => {
  const root = tmpRoot();
  writeFixture(root, [toolUseRow(1000)]);
  const envs = await collect(root);
  for (const env of envs) {
    assert.ok(['planning', 'code', 'site', 'eval', 'narrative', 'meta'].includes(env.content_type));
  }
});

test('skips unparseable lines, logs to stderr, continues', async () => {
  const root = tmpRoot();
  const fpath = path.join(root, '.planning', '.trace-events.jsonl');
  fs.writeFileSync(fpath, [
    JSON.stringify(toolUseRow(800)),
    'not valid json',
    JSON.stringify(toolUseRow(801)),
  ].join('\n') + '\n');

  const origWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (chunk) => { captured += String(chunk); return true; };
  try {
    const envs = await collect(root);
    assert.equal(envs.length, 4); // 2 tool_use rows -> 4 envelopes
    assert.match(captured, /unparseable/);
  } finally {
    process.stderr.write = origWrite;
  }
});
