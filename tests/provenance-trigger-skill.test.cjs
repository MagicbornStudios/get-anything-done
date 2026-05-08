'use strict';
/**
 * Tests for trigger_skill propagation through the provenance joiner.
 *
 * Verifies that join.cjs picks up trigger_skill from trace events and:
 *   - emits a rich { id, kind, depth, started_ts } object when the trace event
 *     carries the full struct (post active-skill-stack wiring)
 *   - upcasts legacy plain-string trigger_skill to the minimal struct
 *   - omits the field entirely when trigger_skill is null/absent
 *
 * These tests run in-process with mocked payloads. No hook processes are
 * started; no actual file system provenance pipeline is run end-to-end.
 *
 * Run: node --test vendor/get-anything-done/tests/provenance-trigger-skill.test.cjs
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { buildProvenance } = require('../lib/provenance/join.cjs');

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function tmpPlanningDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'prov-trigger-skill-test-'));
  const planning = path.join(root, '.planning');
  fs.mkdirSync(planning, { recursive: true });
  return { root, planning };
}

const SESSION_ID = 'test-sess-trigger-skill';

const BASE_RUNTIME = {
  id: 'claude-code',
  source: 'hook-runtime',
  model: 'claude-sonnet-4-6',
  session_id: SESSION_ID,
};

const BASE_AGENT = {
  agent_id: null, agent_role: null,
  parent_agent_id: null, root_agent_id: null,
  depth: null, model_profile: null, resolved_model: null,
};

function makeTraceEvent(overrides) {
  return {
    ts: '2026-05-08T10:00:00.000Z',
    seq: 1,
    type: 'tool_use',
    runtime: { ...BASE_RUNTIME },
    agent: { ...BASE_AGENT },
    tool: 'Edit',
    inputs: {
      file_path: '/project/src/index.ts',
      old_string: 'foo',
      new_string: 'bar',
    },
    outputs: 'ok',
    outputs_truncated: false,
    duration_ms: null,
    success: true,
    trigger_skill: null,
    ...overrides,
  };
}

function writeTraceJsonl(planningDir, events) {
  const p = path.join(planningDir, '.trace-events.jsonl');
  fs.writeFileSync(p, events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  return p;
}

const FAKE_PROJECTS = [
  { projectId: 'test-proj', rootPath: '/project', planningDir: '.planning' },
];

// -------------------------------------------------------------------------
// Test: rich trigger_skill struct passes through unchanged
// -------------------------------------------------------------------------

test('buildProvenance propagates rich trigger_skill object', () => {
  const { root, planning } = tmpPlanningDir();

  const richSkill = {
    id: 'gad-evolution-evolve',
    kind: 'skill_tool',
    depth: 1,
    started_ts: '2026-05-08T09:59:00.000Z',
  };
  const events = [makeTraceEvent({ trigger_skill: richSkill })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  const result = buildProvenance({
    planningDir: planning,
    traceJsonlPath,
    projects: FAKE_PROJECTS,
    since: '2026-05-07',
    until: '2026-05-09',
  });

  assert.equal(result.events_kept, 1);

  const outDir = path.join(planning, '.provenance');
  const outFiles = fs.readdirSync(outDir).filter((f) => f.endsWith('.jsonl'));
  assert.equal(outFiles.length, 1);

  const lines = fs.readFileSync(path.join(outDir, outFiles[0]), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.equal(lines.length, 1);

  const evt = lines[0];
  assert.ok(evt.trigger_skill, 'trigger_skill should be present');
  assert.equal(evt.trigger_skill.id, 'gad-evolution-evolve');
  assert.equal(evt.trigger_skill.kind, 'skill_tool');
  assert.equal(evt.trigger_skill.depth, 1);
  assert.equal(evt.trigger_skill.started_ts, '2026-05-08T09:59:00.000Z');
});

// -------------------------------------------------------------------------
// Test: nested skill with depth=2
// -------------------------------------------------------------------------

test('buildProvenance preserves depth>1 for nested skills', () => {
  const { root, planning } = tmpPlanningDir();

  const nestedSkill = {
    id: 'frontend-design',
    kind: 'skill_tool',
    depth: 2,
    started_ts: '2026-05-08T10:01:00.000Z',
  };
  const events = [makeTraceEvent({ seq: 2, trigger_skill: nestedSkill })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  assert.equal(lines[0].trigger_skill.depth, 2);
  assert.equal(lines[0].trigger_skill.id, 'frontend-design');
});

// -------------------------------------------------------------------------
// Test: slash_command kind preserved
// -------------------------------------------------------------------------

test('buildProvenance preserves slash_command kind', () => {
  const { root, planning } = tmpPlanningDir();

  const slashSkill = {
    id: 'gad-do',
    kind: 'slash_command',
    depth: 1,
    started_ts: '2026-05-08T10:02:00.000Z',
  };
  const events = [makeTraceEvent({ seq: 3, trigger_skill: slashSkill })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  assert.equal(lines[0].trigger_skill.kind, 'slash_command');
  assert.equal(lines[0].trigger_skill.id, 'gad-do');
});

// -------------------------------------------------------------------------
// Test: legacy flat-string trigger_skill upcasted
// -------------------------------------------------------------------------

test('buildProvenance upcasts legacy plain-string trigger_skill to struct', () => {
  const { root, planning } = tmpPlanningDir();

  const events = [makeTraceEvent({ seq: 4, trigger_skill: 'gad-plan-phase' })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  const evt = lines[0];
  assert.ok(evt.trigger_skill, 'should have trigger_skill');
  assert.equal(evt.trigger_skill.id, 'gad-plan-phase');
  assert.equal(evt.trigger_skill.kind, 'skill_tool');
  assert.equal(evt.trigger_skill.depth, 1);
  // started_ts is null for legacy upcasted events
  assert.equal(evt.trigger_skill.started_ts, null);
});

// -------------------------------------------------------------------------
// Test: null trigger_skill → field omitted (not written as null)
// -------------------------------------------------------------------------

test('buildProvenance omits trigger_skill field when null', () => {
  const { root, planning } = tmpPlanningDir();

  const events = [makeTraceEvent({ seq: 5, trigger_skill: null })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  const evt = lines[0];
  assert.equal(Object.prototype.hasOwnProperty.call(evt, 'trigger_skill'), false,
    'trigger_skill key must not exist when no skill active (spec §2)');
});

// -------------------------------------------------------------------------
// Test: absent trigger_skill → field omitted
// -------------------------------------------------------------------------

test('buildProvenance omits trigger_skill field when absent in trace event', () => {
  const { root, planning } = tmpPlanningDir();

  const events = [makeTraceEvent({ seq: 6 })];
  delete events[0].trigger_skill; // ensure completely absent
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  const evt = lines[0];
  assert.equal(Object.prototype.hasOwnProperty.call(evt, 'trigger_skill'), false,
    'trigger_skill key must not exist when absent');
});

// -------------------------------------------------------------------------
// Test: whitespace/empty string trigger_skill → field omitted
// -------------------------------------------------------------------------

test('buildProvenance omits trigger_skill field for empty string', () => {
  const { root, planning } = tmpPlanningDir();

  const events = [makeTraceEvent({ seq: 7, trigger_skill: '' })];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  assert.equal(Object.prototype.hasOwnProperty.call(lines[0], 'trigger_skill'), false);
});

// -------------------------------------------------------------------------
// Test: multiple events in same provenance file — skill events isolated
// -------------------------------------------------------------------------

test('buildProvenance handles mixed skilled/unskilled events in same file', () => {
  const { root, planning } = tmpPlanningDir();

  const events = [
    makeTraceEvent({
      seq: 8,
      trigger_skill: { id: 'gad-audit-milestone', kind: 'skill_tool', depth: 1, started_ts: '2026-05-08T10:00:00.000Z' },
    }),
    makeTraceEvent({
      seq: 9,
      inputs: { file_path: '/project/src/other.ts', old_string: 'a', new_string: 'b' },
      trigger_skill: null,
    }),
  ];
  const traceJsonlPath = writeTraceJsonl(planning, events);

  buildProvenance({
    planningDir: planning, traceJsonlPath, projects: FAKE_PROJECTS,
    since: '2026-05-07', until: '2026-05-09',
  });

  const outDir = path.join(planning, '.provenance');
  const outFile = fs.readdirSync(outDir).find((f) => f.endsWith('.jsonl'));
  const lines = fs.readFileSync(path.join(outDir, outFile), 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));

  assert.equal(lines.length, 2);

  const skilled = lines.find((l) => l.seq === 8);
  const unskilled = lines.find((l) => l.seq === 9);

  assert.ok(skilled.trigger_skill, 'seq=8 should have trigger_skill');
  assert.equal(skilled.trigger_skill.id, 'gad-audit-milestone');
  assert.equal(Object.prototype.hasOwnProperty.call(unskilled, 'trigger_skill'), false);
});
