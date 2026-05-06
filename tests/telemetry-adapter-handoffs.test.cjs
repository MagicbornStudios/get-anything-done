'use strict';
/**
 * Phase 145.5 task GLOBAL-T-145.5-03 verification — Adapter G (handoffs).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-handoffs.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { iterEnvelopes, _internal } = require('../lib/telemetry/adapters/handoffs.cjs');
const { validateEnvelope, deriveEnvelopeId } = require('../lib/telemetry/envelope.cjs');

function mkRootDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-'));
}

function writeHandoff(rootDir, bucket, id, frontmatter, body, { vendorRoot = false } = {}) {
  const sub = vendorRoot
    ? path.join('vendor', 'get-anything-done', '.planning', 'handoffs', bucket)
    : path.join('.planning', 'handoffs', bucket);
  const dir = path.join(rootDir, sub);
  fs.mkdirSync(dir, { recursive: true });
  const fmLines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    if (v === null) fmLines.push(`${k}: null`);
    else if (Array.isArray(v) || (typeof v === 'object' && v !== null)) fmLines.push(`${k}: ${JSON.stringify(v)}`);
    else fmLines.push(`${k}: ${v}`);
  }
  fmLines.push('---');
  fmLines.push('');
  fs.writeFileSync(path.join(dir, `${id}.md`), fmLines.join('\n') + body);
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

// ---------------------------------------------------------------------------
// parseFrontmatter unit
// ---------------------------------------------------------------------------

test('parseFrontmatter returns null for files with no `---` opener', () => {
  const out = _internal.parseFrontmatter('no frontmatter here\njust body');
  assert.equal(out, null);
});

test('parseFrontmatter handles flat key:value, null, and JSON arrays', () => {
  const txt = '---\nid: h-x\nphase: 80\nclaimed_by: null\nlist: [1,2]\n---\nbody text';
  const { frontmatter, body } = _internal.parseFrontmatter(txt);
  assert.equal(frontmatter.id, 'h-x');
  assert.equal(frontmatter.phase, '80');
  assert.equal(frontmatter.claimed_by, null);
  assert.deepEqual(frontmatter.list, [1, 2]);
  assert.equal(body, 'body text');
});

// ---------------------------------------------------------------------------
// normalizeRuntime
// ---------------------------------------------------------------------------

test('normalizeRuntime maps short alias to canonical, falls back to gad-cli', () => {
  assert.equal(_internal.normalizeRuntime('codex'), 'codex-cli');
  assert.equal(_internal.normalizeRuntime('codex-cli'), 'codex-cli');
  assert.equal(_internal.normalizeRuntime('gemini'), 'gemini-cli');
  assert.equal(_internal.normalizeRuntime('claude'), 'claude-code');
  assert.equal(_internal.normalizeRuntime(''), 'gad-cli');
  assert.equal(_internal.normalizeRuntime(null), 'gad-cli');
  assert.equal(_internal.normalizeRuntime('notarealruntime'), 'gad-cli');
});

// ---------------------------------------------------------------------------
// iterEnvelopes — main behavior with 3 fixture handoffs
// ---------------------------------------------------------------------------

test('3 fixtures (open + claimed + closed) → 3 prompts + 1 response, all valid', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'open', 'h-2026-05-05T00-00-00-global-80', {
    id: 'h-2026-05-05T00-00-00-global-80',
    projectid: 'global',
    phase: '80',
    task_id: '80-04',
    created_at: '2026-05-05T00:00:00.000Z',
    claimed_by: null,
    runtime_preference: 'codex',
  }, '# Open task body\nDo this thing.');

  writeHandoff(root, 'claimed', 'h-2026-05-05T01-00-00-global-81', {
    id: 'h-2026-05-05T01-00-00-global-81',
    projectid: 'global',
    phase: '81',
    task_id: '81-01',
    created_at: '2026-05-05T01:00:00.000Z',
    claimed_at: '2026-05-05T01:30:00.000Z',
    claimed_by: 'team-w1',
    runtime_preference: 'gemini-cli',
  }, '# Claimed task body\nIn progress.');

  writeHandoff(root, 'closed', 'h-2026-05-05T02-00-00-global-82', {
    id: 'h-2026-05-05T02-00-00-global-82',
    projectid: 'global',
    phase: '82',
    task_id: '82-09',
    created_at: '2026-05-05T02:00:00.000Z',
    claimed_at: '2026-05-05T02:10:00.000Z',
    completed_at: '2026-05-05T02:50:00.000Z',
    claimed_by: 'team-w3',
    runtime_preference: 'opencode',
  }, '# Closeout body\nLanded as commit abc123.');

  const envs = await collect(root);
  const prompts = envs.filter((e) => e.role === 'prompt');
  const responses = envs.filter((e) => e.role === 'response');

  assert.equal(prompts.length, 3, 'one prompt per handoff regardless of bucket');
  assert.equal(responses.length, 1, 'one response per closed handoff');
  for (const e of envs) assert.equal(validateEnvelope(e).ok, true);

  // Prompt content shape + bucket discriminator
  const buckets = prompts.map((p) => p.content.bucket).sort();
  assert.deepEqual(buckets, ['claimed', 'closed', 'open']);
  for (const p of prompts) assert.equal(p.content.kind, 'handoff_prompt');
  assert.equal(responses[0].content.kind, 'handoff_closeout');
  assert.equal(responses[0].content.bucket, 'closed');

  // task_id and handoff_id wired
  const closedPrompt = prompts.find((p) => p.handoff_id === 'h-2026-05-05T02-00-00-global-82');
  assert.equal(closedPrompt.task_id, '82-09');
  assert.equal(closedPrompt.runtime, 'opencode');

  // Runtime alias normalization
  const openPrompt = prompts.find((p) => p.handoff_id === 'h-2026-05-05T00-00-00-global-80');
  assert.equal(openPrompt.runtime, 'codex-cli');

  // content_type planning, schema_v 1
  for (const e of envs) {
    assert.equal(e.content_type, 'planning');
    assert.equal(e.schema_v, 1);
  }

  fs.rmSync(root, { recursive: true, force: true });
});

test('response.parent_id == prompt.id for the same closed handoff', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'closed', 'h-x', {
    id: 'h-x',
    projectid: 'global',
    phase: '99',
    task_id: '99-01',
    created_at: '2026-05-05T00:00:00.000Z',
    completed_at: '2026-05-05T01:00:00.000Z',
    claimed_by: 'team-w1',
    runtime_preference: 'codex-cli',
  }, '# Body');

  const envs = await collect(root);
  const p = envs.find((e) => e.role === 'prompt');
  const r = envs.find((e) => e.role === 'response');
  assert.ok(p && r);
  assert.equal(r.parent_id, p.id);
  // ids are deterministic — confirm derivation key
  assert.equal(p.id, deriveEnvelopeId('handoff|global|h-x|prompt'));
  assert.equal(r.id, deriveEnvelopeId('handoff|global|h-x|closeout'));
  // seq 1 for prompt, 2 for response
  assert.equal(p.seq, 1);
  assert.equal(r.seq, 2);
  fs.rmSync(root, { recursive: true, force: true });
});

test('idempotent — same inputs → same envelope ids', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'closed', 'h-idem', {
    id: 'h-idem',
    projectid: 'global',
    phase: '50',
    task_id: '50-01',
    created_at: '2026-05-05T00:00:00.000Z',
    completed_at: '2026-05-05T01:00:00.000Z',
    runtime_preference: 'codex',
  }, '# body');

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

test('sinceMs filters envelopes whose ts falls before cutoff', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'closed', 'h-old', {
    id: 'h-old',
    projectid: 'global',
    phase: '1',
    task_id: null,
    created_at: '2025-01-01T00:00:00.000Z',
    completed_at: '2025-01-01T01:00:00.000Z',
    runtime_preference: 'codex-cli',
  }, '# old');
  writeHandoff(root, 'open', 'h-new', {
    id: 'h-new',
    projectid: 'global',
    phase: '2',
    task_id: null,
    created_at: '2026-06-01T00:00:00.000Z',
    runtime_preference: 'codex-cli',
  }, '# new');

  const cutoff = new Date('2026-01-01T00:00:00.000Z').getTime();
  const envs = await collect(root, cutoff);
  // Only the new prompt envelope should pass; the old prompt + old response are filtered.
  assert.equal(envs.length, 1);
  assert.equal(envs[0].handoff_id, 'h-new');
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips files with no `---` frontmatter opener', async () => {
  const root = mkRootDir();
  const dir = path.join(root, '.planning', 'handoffs', 'open');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'h-bad.md'), 'no frontmatter just body\n');
  // also a valid one
  writeHandoff(root, 'open', 'h-good', {
    id: 'h-good',
    projectid: 'global',
    phase: '1',
    runtime_preference: 'codex-cli',
    created_at: '2026-05-05T00:00:00.000Z',
  }, '# good');
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].handoff_id, 'h-good');
  fs.rmSync(root, { recursive: true, force: true });
});

test('skips files where `id` frontmatter is missing', async () => {
  const root = mkRootDir();
  // missing id
  writeHandoff(root, 'open', 'h-noid', {
    projectid: 'global',
    phase: '1',
    runtime_preference: 'codex-cli',
    created_at: '2026-05-05T00:00:00.000Z',
  }, '# no id');
  // good
  writeHandoff(root, 'open', 'h-fine', {
    id: 'h-fine',
    projectid: 'global',
    phase: '1',
    runtime_preference: 'codex-cli',
    created_at: '2026-05-05T00:00:00.000Z',
  }, '# fine');
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].handoff_id, 'h-fine');
  fs.rmSync(root, { recursive: true, force: true });
});

test('walks BOTH .planning/handoffs and vendor/get-anything-done/.planning/handoffs', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'open', 'h-host', {
    id: 'h-host', projectid: 'global', phase: '1',
    runtime_preference: 'codex-cli', created_at: '2026-05-05T00:00:00.000Z',
  }, '# host');
  writeHandoff(root, 'open', 'h-vendor', {
    id: 'h-vendor', projectid: 'get-anything-done', phase: '1',
    runtime_preference: 'codex-cli', created_at: '2026-05-05T00:00:00.000Z',
  }, '# vendor', { vendorRoot: true });
  const envs = await collect(root);
  const ids = envs.map((e) => e.handoff_id).sort();
  assert.deepEqual(ids, ['h-host', 'h-vendor']);
  // project from frontmatter, not from where the file lives
  const vendorEnv = envs.find((e) => e.handoff_id === 'h-vendor');
  assert.equal(vendorEnv.project, 'get-anything-done');
  fs.rmSync(root, { recursive: true, force: true });
});

test('returns empty when rootDir has no handoffs at all', async () => {
  const root = mkRootDir();
  const envs = await collect(root);
  assert.deepEqual(envs, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('invalid runtime_preference falls back to gad-cli, envelope still valid', async () => {
  const root = mkRootDir();
  writeHandoff(root, 'open', 'h-badrt', {
    id: 'h-badrt', projectid: 'global', phase: '1',
    runtime_preference: 'fictional-runtime',
    created_at: '2026-05-05T00:00:00.000Z',
  }, '# x');
  const envs = await collect(root);
  assert.equal(envs.length, 1);
  assert.equal(envs[0].runtime, 'gad-cli');
  assert.equal(validateEnvelope(envs[0]).ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});
