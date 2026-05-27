'use strict';

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildIndex,
  query,
  runCli,
  planningIndexPath,
} = require('../lib/context-pack/planning-index.cjs');

function makeTempPlanningCorpus() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'planning-index-test-'));
  const planningDir = path.join(root, '.planning');
  fs.mkdirSync(path.join(planningDir, 'handoffs', 'open'), { recursive: true });
  fs.mkdirSync(path.join(planningDir, 'notes'), { recursive: true });
  fs.mkdirSync(path.join(planningDir, 'tasks'), { recursive: true });

  fs.writeFileSync(
    path.join(planningDir, 'DECISIONS.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="TEST-D-99">
    <title>Pressure dispatch routing</title>
    <summary>Dispatch should prioritize pressure spikes and handoff urgency in the planning corpus index.</summary>
  </decision>
</decisions>`
  );

  fs.writeFileSync(
    path.join(planningDir, 'STATE.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <state-log>
    <entry tags="pressure dispatch">Pressure dispatch tick recorded with a handoff claim.</entry>
  </state-log>
</state>`
  );

  fs.writeFileSync(
    path.join(planningDir, 'tasks', '284-05.json'),
    JSON.stringify({
      id: '284-05',
      phase: '284',
      status: 'planned',
      goal: 'Build a low-latency planning-corpus RAG index for pressure dispatch recall.',
      commands: ['gad recall'],
      files: ['vendor/get-anything-done/lib/context-pack/planning-index.cjs'],
    }, null, 2)
  );

  fs.writeFileSync(
    path.join(planningDir, 'handoffs', 'open', 'h-2026-05-25T21-16-21-global-284-7b90.md'),
    `# Pressure dispatch handoff\n\nThe handoff keeps pressure dispatch artifacts available for recall and context packs.`
  );

  fs.writeFileSync(
    path.join(planningDir, 'notes', '2026-05-25-planning-index.md'),
    `# Planning index note\n\nThe planning corpus RAG index should surface pressure, dispatch, and handoff urgency.`
  );

  return { root, planningDir };
}

describe('planning-index', () => {
  let root;
  let planningDir;

  before(() => {
    const corpus = makeTempPlanningCorpus();
    root = corpus.root;
    planningDir = corpus.planningDir;
  });

  after(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  test('builds and queries the planning corpus', () => {
    const built = buildIndex(planningDir, { repoRoot: root });
    assert.ok(built.count >= 5, `expected at least 5 docs, got ${built.count}`);
    assert.ok(fs.existsSync(planningIndexPath(planningDir)), 'index file should be written');

    const results = query('pressure dispatch', {
      planningDir,
      repoRoot: root,
      topK: 5,
    });

    assert.ok(results.length >= 1, 'expected at least one result');
    assert.ok(results.some((result) => ['task', 'decision', 'state-log'].includes(result.type)));
    for (const result of results) {
      assert.ok(result.id, 'result has id');
      assert.ok(result.type, 'result has type');
      assert.ok(result.snippet, 'result has snippet');
    }
  });

  test('CLI smoke query returns ranked output', () => {
    const results = runCli(['--query', 'pressure dispatch', '--project-root', root, '--topK', '3', '--json']);
    assert.ok(Array.isArray(results), 'CLI should return array results');
    assert.ok(results.length >= 1, 'CLI should return at least one result');
  });
});
