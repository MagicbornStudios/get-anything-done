'use strict';
/**
 * Phase 145.5 task 145.5-04 verification — tasks-and-roadmap adapter (H).
 * Run: node --test vendor/get-anything-done/tests/telemetry-adapter-tasks-and-roadmap.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  iterEnvelopes,
  _internals,
} = require('../lib/telemetry/adapters/tasks-and-roadmap.cjs');
const { validateEnvelope } = require('../lib/telemetry/envelope.cjs');

function tmpRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-roadmap-adapter-'));
  fs.mkdirSync(path.join(dir, '.planning', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.planning', 'phases'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'vendor', 'get-anything-done', '.planning', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'vendor', 'get-anything-done', '.planning', 'phases'), { recursive: true });
  return dir;
}

function writeJson(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
}

async function collect(rootDir, sinceMs = 0) {
  const out = [];
  for await (const env of iterEnvelopes(rootDir, sinceMs)) out.push(env);
  return out;
}

test('emits role=prompt envelope per task JSON', async () => {
  const root = tmpRoot();
  writeJson(path.join(root, '.planning', 'tasks', '145-01.json'), {
    id: '145-01', phase: '145', status: 'done',
    goal: 'Define unified telemetry envelope schema module',
    runtime: 'claude-code', agent_id: 'claude-code-global',
    created_at: '2026-05-06T09:45:19.196Z',
    updated_at: '2026-05-06T09:45:41.045Z',
  });
  writeJson(path.join(root, '.planning', 'tasks', '145-02.json'), {
    id: '145-02', phase: '145', status: 'planned',
    goal: 'Adapter D: prompt-files',
    created_at: '2026-05-06T09:50:00.000Z',
  });
  // Write minimal ROADMAP.xml so the roadmap walk doesn't choke.
  fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.xml'),
    `<?xml version="1.0"?>\n<roadmap>\n  <phase id="145"><title>SLM training</title><goal>Build training corpus.</goal><status>active</status><depends></depends></phase>\n</roadmap>\n`);

  const envs = await collect(root);
  const promptEnvs = envs.filter((e) => e.role === 'prompt');
  assert.equal(promptEnvs.length, 2);
  for (const env of promptEnvs) {
    assert.equal(validateEnvelope(env).ok, true);
    assert.equal(env.content.kind, 'task_prompt');
    assert.equal(env.content_type, 'planning');
    assert.equal(env.project, 'global');
    assert.ok(env.task_id);
  }
  assert.equal(promptEnvs[0].runtime, 'claude-code');
  // Default runtime when task.runtime unset → gad-cli
  assert.equal(promptEnvs[1].runtime, 'gad-cli');
});

test('parses ROADMAP.xml and emits role=meta phase_definition per phase', async () => {
  const root = tmpRoot();
  fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.xml'),
    `<?xml version="1.0"?>\n<roadmap>\n` +
    `  <phase id="01"><title>Foundation</title><goal>Bootstrap phase.</goal><status>done</status><depends></depends></phase>\n` +
    `  <phase id="14"><title>Desktop</title><goal>VSCode-style shell &amp; planning.</goal><status>planned</status><depends>01</depends></phase>\n` +
    `</roadmap>\n`);

  const envs = await collect(root);
  const phaseEnvs = envs.filter((e) => e.content && e.content.kind === 'phase_definition');
  assert.equal(phaseEnvs.length, 2);
  for (const env of phaseEnvs) {
    assert.equal(env.role, 'meta');
    assert.equal(env.runtime, 'gad-cli');
    assert.equal(env.content_type, 'planning');
    assert.equal(validateEnvelope(env).ok, true);
  }
  const ph14 = phaseEnvs.find((e) => e.content.meta.id === '14');
  assert.equal(ph14.content.meta.title, 'Desktop');
  // entity-decoded
  assert.match(ph14.content.text, /&/);
  assert.deepEqual(ph14.content.meta.deps, ['01']);
});

test('emits role=meta phase_plan per phases/<n>-<slug>/PLAN.md, truncates at 8KB', async () => {
  const root = tmpRoot();
  fs.mkdirSync(path.join(root, '.planning', 'phases', '145.5-foo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'phases', '145.5-foo', 'PLAN.md'), '# Short plan\n\nThe goal is X.\n');
  // Big plan (>8KB) → must truncate.
  fs.mkdirSync(path.join(root, '.planning', 'phases', '146-bar'), { recursive: true });
  const big = '# Big plan\n' + 'X'.repeat(20000);
  fs.writeFileSync(path.join(root, '.planning', 'phases', '146-bar', 'PLAN.md'), big);

  const envs = await collect(root);
  const planEnvs = envs.filter((e) => e.content && e.content.kind === 'phase_plan');
  assert.ok(planEnvs.length >= 2);
  const small = planEnvs.find((e) => e.content.phase_id === '145.5');
  const large = planEnvs.find((e) => e.content.phase_id === '146');
  assert.ok(small, 'small plan envelope');
  assert.ok(large, 'large plan envelope');
  assert.equal(small.content.truncated, false);
  assert.equal(large.content.truncated, true);
  assert.ok(Buffer.byteLength(large.content.text, 'utf8') <= _internals.PLAN_TEXT_CAP_BYTES);
  assert.equal(validateEnvelope(small).ok, true);
  assert.equal(validateEnvelope(large).ok, true);
});

test('idempotent — same input yields same envelope ids', async () => {
  const root = tmpRoot();
  writeJson(path.join(root, '.planning', 'tasks', 'GLOBAL-T-145-01.json'), {
    id: 'GLOBAL-T-145-01', phase: '145', status: 'done', goal: 'g',
    runtime: 'claude-code', created_at: '2026-05-06T09:00:00.000Z',
  });
  fs.writeFileSync(path.join(root, '.planning', 'ROADMAP.xml'),
    `<roadmap><phase id="145"><goal>g</goal><status>done</status><depends></depends></phase></roadmap>`);
  fs.mkdirSync(path.join(root, '.planning', 'phases', '145-x'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'phases', '145-x', 'PLAN.md'), 'plan body');

  const a = await collect(root);
  const b = await collect(root);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    assert.equal(a[i].id, b[i].id, `envelope ${i} id stable`);
  }
});

test('derives project from canonical task ID prefix', async () => {
  assert.equal(_internals.deriveProjectFromTaskId('GLOBAL-T-145-01', 'fallback'), 'global');
  assert.equal(_internals.deriveProjectFromTaskId('SLM-LEARNING-T-12-03', 'fallback'), 'slm-learning');
  assert.equal(_internals.deriveProjectFromTaskId('GET-ANYTHING-DONE-T-1', 'fallback'), 'get-anything-done');
  // Bare id — uses fallback (root-derived project).
  assert.equal(_internals.deriveProjectFromTaskId('145-01', 'global'), 'global');
  // Lowercase legacy — `global-119-01`.
  assert.equal(_internals.deriveProjectFromTaskId('global-119-01', 'fallback'), 'global');
});

test('respects sinceMs cutoff', async () => {
  const root = tmpRoot();
  writeJson(path.join(root, '.planning', 'tasks', 'old.json'), {
    id: 'old-1', phase: '1', status: 'done', goal: 'old',
    created_at: '2026-04-01T00:00:00.000Z',
  });
  writeJson(path.join(root, '.planning', 'tasks', 'new.json'), {
    id: 'new-1', phase: '1', status: 'done', goal: 'new',
    created_at: '2026-05-06T00:00:00.000Z',
  });
  const cutoff = Date.parse('2026-05-01T00:00:00.000Z');
  const envs = await collect(root, cutoff);
  const taskIds = envs.filter((e) => e.role === 'prompt').map((e) => e.task_id);
  assert.ok(taskIds.includes('new-1'));
  assert.ok(!taskIds.includes('old-1'));
});

test('handles missing planning roots gracefully', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasks-roadmap-empty-'));
  // No .planning/ at all.
  const envs = await collect(dir);
  assert.equal(envs.length, 0);
});

test('walks BOTH host and submodule planning roots', async () => {
  const root = tmpRoot();
  writeJson(path.join(root, '.planning', 'tasks', '145-01.json'), {
    id: '145-01', phase: '145', status: 'done', goal: 'host task',
    created_at: '2026-05-06T09:00:00.000Z',
  });
  writeJson(path.join(root, 'vendor', 'get-anything-done', '.planning', 'tasks', '10-01.json'), {
    id: '10-01', phase: '10', status: 'done', goal: 'submodule task',
    created_at: '2026-04-23T00:48:00.480Z',
  });

  const envs = await collect(root);
  const promptEnvs = envs.filter((e) => e.role === 'prompt');
  assert.equal(promptEnvs.length, 2);
  const projects = new Set(promptEnvs.map((e) => e.project));
  assert.ok(projects.has('global'));
  assert.ok(projects.has('get-anything-done'));
});

test('parsePhases handles multi-phase ROADMAP.xml correctly', () => {
  const xml = `<roadmap>\n  <phase id="01"><title>A</title><goal>g1</goal><status>done</status><depends></depends></phase>\n  <phase id="02"><goal>g2 &amp; more</goal><status>planned</status><depends>01</depends></phase>\n</roadmap>`;
  const phases = _internals.parsePhases(xml);
  assert.equal(phases.length, 2);
  assert.equal(phases[0].id, '01');
  assert.equal(phases[0].title, 'A');
  assert.equal(phases[1].goal, 'g2 & more');
  assert.equal(phases[1].depends, '01');
});
