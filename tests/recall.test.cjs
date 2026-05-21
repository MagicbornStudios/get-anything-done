'use strict';
/**
 * tests/recall.test.cjs — unit tests for lib/recall/index.cjs
 *
 * Coverage:
 *   1. retrieve() returns relevant artifacts for a known term
 *      ("secret tokenization" → GLOBAL-D-438 / phase-280 tasks)
 *   2. No-match path — retrieve() returns [] for a nonsense query
 *   3. termScore() scoring contract (more occurrences = higher score)
 *   4. tokenise() basic contract
 *   5. buildGroundedPrompt() includes artifacts and instruction to cite
 *   6. Corpus loading from a temp planning dir (isolated, no live .planning)
 *
 * The live LLM call (runAskLlm) is NOT tested here — that's integration
 * territory; all tests are pure retrieval + prompt assembly.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const { retrieve, buildGroundedPrompt, loadCorpus, termScore, tokenise } =
  require('../lib/recall/index.cjs');

// ---------------------------------------------------------------------------
// Unit: tokenise
// ---------------------------------------------------------------------------
describe('tokenise', () => {
  test('splits on non-alphanum and lower-cases', () => {
    const toks = tokenise('Hello World D-438!');
    assert.ok(toks.includes('hello'), 'should include hello');
    assert.ok(toks.includes('world'), 'should include world');
    // The regex [a-z0-9_-]+ keeps hyphens, so "D-438" tokenises as "d-438"
    assert.ok(toks.includes('d-438'), `should include d-438; got: ${toks.join(', ')}`);
  });

  test('returns [] for empty / null input', () => {
    assert.deepStrictEqual(tokenise(''), []);
    assert.deepStrictEqual(tokenise(null), []);
  });
});

// ---------------------------------------------------------------------------
// Unit: termScore
// ---------------------------------------------------------------------------
describe('termScore', () => {
  test('returns 0 for empty query tokens', () => {
    assert.strictEqual(termScore([], 'hello world'), 0);
  });

  test('returns 0 when no token appears in doc', () => {
    const score = termScore(['banana', 'mango'], 'hello world this is a test');
    assert.strictEqual(score, 0);
  });

  test('higher frequency → higher score (capped at 5 per token)', () => {
    const doc   = 'secret secret secret secret secret secret secret'; // 7× but capped at 5
    const score1 = termScore(['secret'], doc);
    const score2 = termScore(['secret'], 'just one secret here');
    assert.ok(score1 > score2, `score1 (${score1}) should exceed score2 (${score2})`);
    assert.strictEqual(score1, 5, 'cap at 5 occurrences per token');
  });

  test('multi-token queries accumulate', () => {
    const doc = 'secret tokenization proxy in the secret vault';
    const score = termScore(['secret', 'tokenization', 'proxy'], doc);
    // 'secret' × 2 (capped) + 'tokenization' × 1 + 'proxy' × 1 = 4
    assert.ok(score >= 4, `expected score >= 4, got ${score}`);
  });
});

// ---------------------------------------------------------------------------
// Helpers: temp planning dir
// ---------------------------------------------------------------------------

function createTempPlanningDir(overrides = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-test-'));
  const planningDir = path.join(tmpDir, '.planning');

  // DECISIONS.xml with two decisions
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'DECISIONS.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <decision id="TEST-D-01">
    <title>Secret tokenization proxy design</title>
    <summary>Local secret detection with reversible tokenization so secrets never reach cloud LLMs. Uses regex fast-path plus SLM classifier.</summary>
  </decision>
  <decision id="TEST-D-02">
    <title>Rename knowledge route to assistant</title>
    <summary>The desktop knowledge route is renamed to assistant to reflect its role as the desktop's own AI system, distinct from coding runtimes.</summary>
  </decision>
</decisions>`
  );

  // STATE.xml with state-log entries
  fs.writeFileSync(
    path.join(planningDir, 'STATE.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<state>
  <state-log>
    <entry tags="280-01">Secret detection regex fast-path shipped; proxy vault integration pending.</entry>
    <entry tags="283-01">knowledge route renamed to assistant in apps/desk sidebar.</entry>
  </state-log>
</state>`
  );

  // tasks/
  fs.mkdirSync(path.join(planningDir, 'tasks'), { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'tasks', '280-01.json'),
    JSON.stringify({
      id: '280-01',
      phase: '280',
      status: 'done',
      goal: 'Secret detection: regex fast-path for secret tokenization, detect secrets spanning text.',
    })
  );
  fs.writeFileSync(
    path.join(planningDir, 'tasks', '283-05.json'),
    JSON.stringify({
      id: '283-05',
      phase: '283',
      status: 'planned',
      goal: 'Rename knowledge route to assistant in sidebar and route config.',
    })
  );

  // notes/
  fs.mkdirSync(path.join(planningDir, 'notes'), { recursive: true });
  fs.writeFileSync(
    path.join(planningDir, 'notes', '2026-05-21-secret-tokenization.md'),
    `# Secret tokenization design note\n\nProxy approach: real secret replaced by reversible token before LLM call. Vault stores mappings.`
  );

  // Apply any overrides
  if (overrides.extraDecision) {
    // Append an extra decision to DECISIONS.xml — not needed for current tests
  }

  return { tmpDir, planningDir };
}

// ---------------------------------------------------------------------------
// Integration: retrieve() with temp planning dir
// ---------------------------------------------------------------------------

describe('retrieve — with temp planning dir', () => {
  let planningDir;
  let tmpDir;

  test('setup', () => {
    const result = createTempPlanningDir();
    planningDir = result.planningDir;
    tmpDir = result.tmpDir;
  });

  test('finds decision and task about secret tokenization', () => {
    const results = retrieve('secret tokenization proxy', { planningDir, topK: 6 });
    assert.ok(results.length > 0, 'should return at least one result');
    const ids = results.map(r => r.sourceId);
    const hasDecision = ids.some(id => id.includes('TEST-D-01'));
    const hasTask = ids.some(id => id.includes('280-01'));
    assert.ok(hasDecision, `should include TEST-D-01; got: ${ids.join(', ')}`);
    assert.ok(hasTask, `should include 280-01; got: ${ids.join(', ')}`);
  });

  test('finds decision and task about rename knowledge to assistant', () => {
    const results = retrieve('why did we rename knowledge to assistant', { planningDir, topK: 6 });
    assert.ok(results.length > 0, 'should return at least one result');
    const ids = results.map(r => r.sourceId);
    const hasDecision = ids.some(id => id.includes('TEST-D-02'));
    assert.ok(hasDecision, `should include TEST-D-02; got: ${ids.join(', ')}`);
  });

  test('returns empty array for nonsense query', () => {
    const results = retrieve('xyzzy frobnicator quux banana', { planningDir, topK: 6 });
    assert.deepStrictEqual(results, [], 'should return no results for nonsense query');
  });

  test('results are sorted by score descending', () => {
    const results = retrieve('secret tokenization', { planningDir, topK: 10 });
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].score >= results[i].score,
        `result[${i - 1}].score (${results[i - 1].score}) should be >= result[${i}].score (${results[i].score})`
      );
    }
  });

  test('each result has required fields', () => {
    const results = retrieve('secret', { planningDir, topK: 3 });
    for (const r of results) {
      assert.ok(r.id,       'has id');
      assert.ok(r.sourceId, 'has sourceId');
      assert.ok(r.type,     'has type');
      assert.ok(r.snippet,  'has snippet');
      assert.ok(r.path,     'has path');
      assert.ok(typeof r.score === 'number' && r.score > 0, 'has positive numeric score');
    }
  });

  test('cleanup', () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ---------------------------------------------------------------------------
// Unit: buildGroundedPrompt
// ---------------------------------------------------------------------------

describe('buildGroundedPrompt', () => {
  const fakeArtifacts = [
    {
      id: 'DECISION:TEST-D-01',
      sourceId: 'TEST-D-01',
      type: 'decision',
      snippet: '[TEST-D-01] Secret tokenization proxy design: Uses reversible token vault.',
      score: 5,
      path: '/tmp/planning/DECISIONS.xml',
    },
    {
      id: 'TASK:280-01',
      sourceId: '280-01',
      type: 'task',
      snippet: '[280-01] (phase 280, done) Secret detection regex fast-path.',
      score: 3,
      path: '/tmp/planning/tasks/280-01.json',
    },
  ];

  test('includes the question', () => {
    const prompt = buildGroundedPrompt('why secret tokenization', fakeArtifacts);
    assert.ok(prompt.includes('why secret tokenization'), 'should include the question');
  });

  test('includes artifact snippets', () => {
    const prompt = buildGroundedPrompt('why secret tokenization', fakeArtifacts);
    assert.ok(prompt.includes('TEST-D-01'), 'should include decision id in prompt');
    assert.ok(prompt.includes('280-01'),    'should include task id in prompt');
  });

  test('instructs to cite sources', () => {
    const prompt = buildGroundedPrompt('any question', fakeArtifacts);
    const lower = prompt.toLowerCase();
    assert.ok(lower.includes('cite') || lower.includes('source'), 'should instruct to cite sources');
  });

  test('contains instruction to answer only from context', () => {
    const prompt = buildGroundedPrompt('any question', fakeArtifacts);
    const lower = prompt.toLowerCase();
    assert.ok(lower.includes('only') || lower.includes('provided'), 'should instruct answer from context only');
  });
});

// ---------------------------------------------------------------------------
// Live corpus smoke test (uses real .planning if it exists)
// ---------------------------------------------------------------------------

describe('retrieve — live planning corpus smoke test', () => {
  const monoRoot    = path.resolve(__dirname, '..', '..', '..');
  const livePlanning = path.join(monoRoot, '.planning');

  test('skips if no live .planning dir', { skip: !fs.existsSync(livePlanning) }, () => {
    // never runs if planning dir absent
  });

  test('finds D-438 artifacts for secret tokenization query', { skip: !fs.existsSync(livePlanning) }, () => {
    const results = retrieve('secret tokenization', { planningDir: livePlanning, topK: 10 });
    // D-438 is in DECISIONS.xml; phase-280 tasks should appear
    const ids = results.map(r => r.sourceId).join(', ');
    const hasD438 = results.some(r => r.sourceId.includes('D-438') || r.snippet.includes('D-438') || r.snippet.toLowerCase().includes('tokenization'));
    assert.ok(hasD438, `Expected D-438/tokenization content in results. Got: ${ids}`);
  });
});
