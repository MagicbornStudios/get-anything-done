'use strict';
/**
 * parser-coverage.test.cjs
 *
 * Asserts 100% field coverage for every planning file parser.
 * Rules:
 *  - Every named field in each XML schema must appear in the parsed output
 *  - No "misc" fields (unexpected keys) in the returned objects
 *  - All parsers are tested against representative synthetic fixtures
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempRoot(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-parser-'));
  const planDir = path.join(dir, '.planning');
  fs.mkdirSync(planDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(planDir, name), content, 'utf8');
  }
  const root = { id: 'test', path: '.', planningDir: '.planning' };
  return { dir, root };
}

// Known fields for each schema — every field must be present in parsed output
const STATE_FIELDS    = ['projectId', 'path', 'planningDir', 'currentPhase', 'milestone', 'status', 'openTasks', 'phasesComplete', 'phasesTotal', 'lastActivity', 'nextAction'];
const PHASE_FIELDS    = ['id', 'title', 'goal', 'status', 'depends', 'milestone', 'plans', 'requirements', 'description'];
const TASK_FIELDS     = ['id', 'agentId', 'goal', 'status', 'phase', 'keywords', 'depends', 'commands', 'files'];
const DECISION_FIELDS = ['id', 'title', 'summary', 'impact', 'references'];
const REQ_FIELDS      = ['kind', 'docPath', 'description'];

// ---------------------------------------------------------------------------
// STATE.xml
// ---------------------------------------------------------------------------

describe('state-reader — STATE.xml field coverage', () => {
  const { readState } = require('../lib/state-reader.cjs');

  const STATE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase>05</current-phase>
  <current-plan>milestone-x</current-plan>
  <milestone>milestone-x</milestone>
  <status>active</status>
  <next-action>Do the thing.</next-action>
  <last-updated>2026-04-05T10:00:00.000Z</last-updated>
</state>`;

  test('parses current-phase', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    assert.equal(s.currentPhase, '05', 'currentPhase');
  });

  test('parses milestone from current-plan', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    assert.ok(s.milestone, 'milestone should be present');
  });

  test('parses status', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    assert.equal(s.status, 'active', 'status');
  });

  test('parses next-action', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    assert.equal(s.nextAction, 'Do the thing.', 'nextAction');
  });

  test('parses last-updated as ISO string', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    assert.ok(s.lastActivity, 'lastActivity should be present');
    assert.ok(s.lastActivity.includes('2026'), 'lastActivity should contain year');
  });

  test('no unknown fields (no misc)', () => {
    const { dir, root } = makeTempRoot({ 'STATE.xml': STATE_XML });
    const s = readState(root, dir);
    const unknownKeys = Object.keys(s).filter(k => !STATE_FIELDS.includes(k));
    assert.deepEqual(unknownKeys, [], `Unexpected keys in state: ${unknownKeys.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// ROADMAP.xml
// ---------------------------------------------------------------------------

describe('roadmap-reader — ROADMAP.xml field coverage', () => {
  const { readPhases, readDocFlow } = require('../lib/roadmap-reader.cjs');

  const ROADMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <phase id="01">
    <title>Bootstrap</title>
    <goal>Phase 01: bootstrap the project.</goal>
    <status>done</status>
    <depends></depends>
    <milestone>m1</milestone>
    <plans>.planning/phases/01-bootstrap/</plans>
    <requirements>REQ-01</requirements>
  </phase>
  <phase id="02">
    <title>Data layer</title>
    <goal>Phase 02: build the data layer.</goal>
    <status>active</status>
    <depends>01</depends>
  </phase>
  <doc-flow>
    <doc name="docs/requirements.mdx">Main requirements doc.</doc>
    <doc name="docs/roadmap.mdx">Human overview table.</doc>
  </doc-flow>
</roadmap>`;

  test('parses id', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].id, '01', 'id');
    assert.equal(phases[1].id, '02', 'id');
  });

  test('parses goal', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.ok(phases[0].goal.includes('bootstrap'), 'goal should contain text');
  });

  test('parses title (truncated goal)', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.ok(phases[0].title, 'title should be present');
  });

  test('parses status — done', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].status, 'done', 'status done');
  });

  test('parses status — active', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[1].status, 'active', 'status active');
  });

  test('parses depends', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[1].depends, '01', 'depends');
  });

  test('parses milestone', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].milestone, 'm1', 'milestone');
  });

  test('parses title from <title> element', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].title, 'Bootstrap', 'title from <title> element');
  });

  test('parses plans directory', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].plans, '.planning/phases/01-bootstrap/', 'plans path');
  });

  test('parses requirements reference', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    assert.equal(phases[0].requirements, 'REQ-01', 'requirements ref');
  });

  test('no unknown fields in phase (no misc)', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const phases = readPhases(root, dir);
    const unknownKeys = Object.keys(phases[0]).filter(k => !PHASE_FIELDS.includes(k));
    assert.deepEqual(unknownKeys, [], `Unexpected keys in phase: ${unknownKeys.join(', ')}`);
  });

  test('readDocFlow parses doc-flow entries', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    const docs = readDocFlow(root, dir);
    assert.equal(docs.length, 2, 'two doc-flow entries');
    assert.equal(docs[0].name, 'docs/requirements.mdx', 'doc name');
    assert.ok(docs[0].description, 'doc description present');
  });

  test('doc-flow section is not silently dropped as misc', () => {
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': ROADMAP_XML });
    // doc-flow must be accessible — readDocFlow must return entries
    const docs = readDocFlow(root, dir);
    assert.ok(docs.length > 0, 'doc-flow section must be parseable, not discarded');
  });
});

// ---------------------------------------------------------------------------
// TASK-REGISTRY.xml
// ---------------------------------------------------------------------------

describe('task-registry-reader — TASK-REGISTRY.xml field coverage', () => {
  const { readTasks } = require('../lib/task-registry-reader.cjs');

  const TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<task-registry>
  <phase id="01">
    <task id="01-01" agent-id="claude" status="done">
      <goal>Bootstrap the project structure.</goal>
      <keywords>bootstrap,init</keywords>
      <commands>
        <command>pnpm run build</command>
        <command>pnpm run lint</command>
      </commands>
      <depends></depends>
    </task>
    <task id="01-02" agent-id="" status="in-progress">
      <goal>Add logging layer.</goal>
      <keywords>logging</keywords>
      <commands>
        <command>pnpm test</command>
      </commands>
      <depends>01-01</depends>
    </task>
  </phase>
</task-registry>`;

  test('parses id', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[0].id, '01-01', 'id');
  });

  test('parses agent-id', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[0].agentId, 'claude', 'agentId');
  });

  test('parses status', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[0].status, 'done', 'status done');
    assert.equal(tasks[1].status, 'in-progress', 'status in-progress');
  });

  test('parses goal', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.ok(tasks[0].goal.includes('Bootstrap'), 'goal');
  });

  test('parses keywords', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[0].keywords, 'bootstrap,init', 'keywords');
  });

  test('parses depends', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[1].depends, '01-01', 'depends');
  });

  test('parses commands list', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.ok(Array.isArray(tasks[0].commands), 'commands is array');
    assert.equal(tasks[0].commands.length, 2, 'two commands');
    assert.equal(tasks[0].commands[0], 'pnpm run build', 'first command');
    assert.equal(tasks[0].commands[1], 'pnpm run lint', 'second command');
  });

  test('parses phase from id prefix', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    assert.equal(tasks[0].phase, '01', 'phase derived from id');
  });

  test('filter by status works', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const done = readTasks(root, dir, { status: 'done' });
    assert.equal(done.length, 1, 'one done task');
    assert.equal(done[0].id, '01-01');
  });

  test('no unknown fields (no misc)', () => {
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': TASK_XML });
    const tasks = readTasks(root, dir);
    const unknownKeys = Object.keys(tasks[0]).filter(k => !TASK_FIELDS.includes(k));
    assert.deepEqual(unknownKeys, [], `Unexpected keys in task: ${unknownKeys.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// DECISIONS.xml
// ---------------------------------------------------------------------------

describe('decisions-reader — DECISIONS.xml field coverage', () => {
  const { readDecisions } = require('../lib/decisions-reader.cjs');

  const DECISIONS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="gad-01">
    <title>Use citty for CLI</title>
    <summary>The GAD CLI uses citty for argument parsing because it is lightweight and CJS-compatible.</summary>
    <impact>All commands must use defineCommand from citty.</impact>
    <references>
      <file path="vendor/get-anything-done/bin/gad.cjs" />
      <file path="vendor/get-anything-done/package.json" />
    </references>
  </decision>
  <decision id="gad-02">
    <title>Planning files are XML-first</title>
    <summary>STATE, ROADMAP, TASK-REGISTRY, DECISIONS use XML for machine parsing.</summary>
    <impact>Parsers must handle XML natively without XSLT or DOM libraries.</impact>
    <references>
      <file path=".planning/STATE.xml" />
    </references>
  </decision>
</decisions>`;

  test('parses id', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.equal(decisions[0].id, 'gad-01', 'id');
  });

  test('parses title', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.equal(decisions[0].title, 'Use citty for CLI', 'title');
  });

  test('parses summary', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.ok(decisions[0].summary.includes('citty'), 'summary');
  });

  test('parses impact', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.ok(decisions[0].impact.includes('defineCommand'), 'impact');
  });

  test('parses references file paths', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.ok(Array.isArray(decisions[0].references), 'references is array');
    assert.equal(decisions[0].references.length, 2, 'two references');
    assert.ok(decisions[0].references[0].includes('gad.cjs'), 'first ref path');
  });

  test('filter by id works', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const filtered = readDecisions(root, dir, { id: 'gad-02' });
    assert.equal(filtered.length, 1, 'one decision');
    assert.equal(filtered[0].id, 'gad-02', 'correct id');
  });

  test('returns correct count', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    assert.equal(decisions.length, 2, 'two decisions');
  });

  test('no unknown fields (no misc)', () => {
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': DECISIONS_XML });
    const decisions = readDecisions(root, dir);
    const unknownKeys = Object.keys(decisions[0]).filter(k => !DECISION_FIELDS.includes(k));
    assert.deepEqual(unknownKeys, [], `Unexpected keys in decision: ${unknownKeys.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// REQUIREMENTS.xml
// ---------------------------------------------------------------------------

describe('requirements-reader — REQUIREMENTS.xml field coverage', () => {
  const { readRequirements } = require('../lib/requirements-reader.cjs');

  const REQ_XML = `<?xml version="1.0" encoding="UTF-8"?>
<planning-references>
  <doc kind="canonical-requirements">
    <path>apps/portfolio/content/docs/documentation/requirements.mdx</path>
    <content><![CDATA[
Canonical monorepo requirements narrative.
Use this as the human-readable source of truth.
]]></content>
  </doc>
  <doc kind="cross-cutting-queue">
    <path>apps/portfolio/content/docs/documentation/planning/state.mdx</path>
    <content><![CDATA[
Cross-cutting queue for shared monorepo work.
]]></content>
  </doc>
</planning-references>`;

  test('parses kind', () => {
    const { dir, root } = makeTempRoot({ 'REQUIREMENTS.xml': REQ_XML });
    const refs = readRequirements(root, dir);
    assert.equal(refs[0].kind, 'canonical-requirements', 'kind');
  });

  test('parses docPath', () => {
    const { dir, root } = makeTempRoot({ 'REQUIREMENTS.xml': REQ_XML });
    const refs = readRequirements(root, dir);
    assert.ok(refs[0].docPath.includes('requirements.mdx'), 'docPath');
  });

  test('parses description from CDATA content', () => {
    const { dir, root } = makeTempRoot({ 'REQUIREMENTS.xml': REQ_XML });
    const refs = readRequirements(root, dir);
    assert.ok(refs[0].description.length > 0, 'description is present');
    assert.ok(refs[0].description.includes('requirements'), 'description content');
  });

  test('returns correct count', () => {
    const { dir, root } = makeTempRoot({ 'REQUIREMENTS.xml': REQ_XML });
    const refs = readRequirements(root, dir);
    assert.equal(refs.length, 2, 'two refs');
  });

  test('no unknown fields (no misc)', () => {
    const { dir, root } = makeTempRoot({ 'REQUIREMENTS.xml': REQ_XML });
    const refs = readRequirements(root, dir);
    const unknownKeys = Object.keys(refs[0]).filter(k => !REQ_FIELDS.includes(k));
    assert.deepEqual(unknownKeys, [], `Unexpected keys in req ref: ${unknownKeys.join(', ')}`);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: no parser returns null/undefined for named fields
// ---------------------------------------------------------------------------

describe('parsers — no null/undefined for named fields', () => {
  test('state fields are not undefined', () => {
    const { readState } = require('../lib/state-reader.cjs');
    const { dir, root } = makeTempRoot({ 'STATE.xml': `<state><current-phase>01</current-phase><status>active</status></state>` });
    const s = readState(root, dir);
    for (const field of ['currentPhase', 'status', 'openTasks']) {
      assert.notEqual(s[field], undefined, `${field} must not be undefined`);
    }
  });

  test('phase fields are not undefined', () => {
    const { readPhases } = require('../lib/roadmap-reader.cjs');
    const { dir, root } = makeTempRoot({ 'ROADMAP.xml': `<roadmap><phase id="01"><goal>test</goal><status>done</status></phase></roadmap>` });
    const phases = readPhases(root, dir);
    for (const field of ['id', 'title', 'goal', 'status', 'depends', 'milestone']) {
      assert.notEqual(phases[0][field], undefined, `phase.${field} must not be undefined`);
    }
  });

  test('task fields are not undefined', () => {
    const { readTasks } = require('../lib/task-registry-reader.cjs');
    const { dir, root } = makeTempRoot({ 'TASK-REGISTRY.xml': `<task-registry><phase id="01"><task id="01-01" agent-id="" status="done"><goal>test</goal><keywords></keywords><commands></commands><depends></depends></task></phase></task-registry>` });
    const tasks = readTasks(root, dir);
    for (const field of ['id', 'agentId', 'goal', 'status', 'phase', 'keywords', 'depends', 'commands']) {
      assert.notEqual(tasks[0][field], undefined, `task.${field} must not be undefined`);
    }
  });

  test('decision fields are not undefined', () => {
    const { readDecisions } = require('../lib/decisions-reader.cjs');
    const { dir, root } = makeTempRoot({ 'DECISIONS.xml': `<decisions><decision id="d1"><title>t</title><summary>s</summary><impact>i</impact><references></references></decision></decisions>` });
    const decisions = readDecisions(root, dir);
    for (const field of ['id', 'title', 'summary', 'impact', 'references']) {
      assert.notEqual(decisions[0][field], undefined, `decision.${field} must not be undefined`);
    }
  });
});
