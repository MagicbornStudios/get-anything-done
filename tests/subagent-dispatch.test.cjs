/**
 * subagent-dispatch.test.cjs — unit tests for lib/subagent-dispatch.cjs
 * (phase 59 task 59-07).
 *
 * Spec: decision gad-258 (subagent execution model), gad-262 (gad start),
 *       gad-266 G (scoped-spawn merge default — consumed, not tested here).
 * Todo: 2026-04-17-subagent-run-history.md (run-record schema).
 *
 * Tests use a tmp dir per invocation for real filesystem writes — the module
 * renames .tmp → final so we exercise the atomic-write path. Readers
 * (task-registry-reader, state-reader) are injected as lightweight stubs so
 * we don't have to scaffold full XML every test.
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const dispatchMod = require('../lib/subagent-dispatch.cjs');
const {
  createDispatcher,
  parsePlanningRoots,
  toLocalIsoDate,
  buildRunRecord,
  buildPromptBody,
} = dispatchMod;

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

/**
 * Create a temp directory scaffolded as a mini-monorepo: gad-config.toml at
 * root with a single planning root pointing at `projects/<id>/.planning/`.
 *
 * @param {{ projectId: string, dailySubagent: boolean, tomlExtras?: string }} opts
 * @returns {{ baseDir: string, projectDir: string, planningDir: string, cleanup: () => void }}
 */
function scaffoldMonorepo({ projectId, dailySubagent, tomlExtras = '' }) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-subagent-dispatch-'));
  const projectDir = path.join(baseDir, 'projects', projectId);
  const planningDir = path.join(projectDir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });

  const flagLine = dailySubagent ? 'dailySubagent = true\n' : '';
  const toml = [
    '# tmp gad-config.toml',
    '',
    '[[planning.roots]]',
    `id = "${projectId}"`,
    `path = "projects/${projectId}"`,
    'planningDir = ".planning"',
    'discover = false',
    flagLine,
    tomlExtras,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(baseDir, 'gad-config.toml'), toml, 'utf8');

  return {
    baseDir,
    projectDir,
    planningDir,
    cleanup: () => fs.rmSync(baseDir, { recursive: true, force: true }),
  };
}

/**
 * Return a readers object backed by arrays. One entry per test lets us pick
 * the first planned task deterministically.
 *
 * @param {{ currentPhase: string|null, nextAction?: string|null, tasks?: Array<{ id: string, goal: string, status: string, phase: string }> }} cfg
 */
function makeReaders(cfg) {
  const state = {
    currentPhase: cfg.currentPhase,
    nextAction: cfg.nextAction ?? null,
    status: 'active',
    milestone: 'v1',
  };
  const tasks = cfg.tasks ?? [];
  return {
    readState: () => state,
    readTasks: (_root, _baseDir, filter = {}) => {
      let out = tasks.slice();
      if (filter.phase) out = out.filter((t) => t.phase === filter.phase);
      if (filter.status) out = out.filter((t) => t.status === filter.status);
      return out;
    },
  };
}

/** Stub Date factory — fixes `now()` to a specific local-clock moment. */
function fixedNow(y, mo, d, h = 10, mi = 0, s = 0) {
  return () => new Date(y, mo - 1, d, h, mi, s).getTime();
}

const cleanups = [];
after(() => {
  for (const c of cleanups.splice(0)) {
    try { c(); } catch { /* ignore */ }
  }
});

// ---------------------------------------------------------------------------
// 1. happy path
// ---------------------------------------------------------------------------

describe('subagent-dispatch: happy path', () => {
  test('one flagged project, no prior run today → prompt + record written', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-happy', dailySubagent: true });
    cleanups.push(scaf.cleanup);

    const readers = makeReaders({
      currentPhase: '01',
      nextAction: 'Do the thing.',
      tasks: [
        { id: '01-01', goal: 'Scaffold the package layout.', status: 'planned', phase: '01' },
      ],
    });
    const now = fixedNow(2026, 4, 17, 10, 30, 0);
    const disp = createDispatcher({ now, readers });

    const stdout = { buf: '', write(s) { this.buf += s; } };
    const stderr = { buf: '', write(s) { this.buf += s; } };
    const { outcomes, exitCode } = disp.dispatchAll({ baseDir: scaf.baseDir, stdout, stderr });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(outcomes.length, 1);
    const [o] = outcomes;
    assert.strictEqual(o.kind, 'dispatched');
    assert.strictEqual(o.projectId, 'proj-happy');
    assert.strictEqual(o.taskId, '01-01');
    assert.strictEqual(o.today, '2026-04-17');

    const runsDir = path.join(scaf.planningDir, 'subagent-runs', 'proj-happy');
    const names = fs.readdirSync(runsDir).sort();
    assert.deepStrictEqual(names, ['2026-04-17-01-01.json', '2026-04-17-01-01.prompt.md']);

    // Printed prompt path goes to stdout.
    assert.ok(stdout.buf.includes('2026-04-17-01-01.prompt.md'), 'stdout got prompt path');
    assert.ok(stderr.buf.includes('dispatched 01-01'), 'stderr logs dispatch');
  });
});

// ---------------------------------------------------------------------------
// 2. skip-already-ran
// ---------------------------------------------------------------------------

describe('subagent-dispatch: skip-already-ran', () => {
  test('pre-existing record for today → skip, exit 0, no new writes', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-skip', dailySubagent: true });
    cleanups.push(scaf.cleanup);

    const runsDir = path.join(scaf.planningDir, 'subagent-runs', 'proj-skip');
    fs.mkdirSync(runsDir, { recursive: true });
    fs.writeFileSync(
      path.join(runsDir, '2026-04-17-01-01.json'),
      JSON.stringify({ runId: 'x', projectId: 'proj-skip', status: 'done' }),
      'utf8',
    );

    const readers = makeReaders({
      currentPhase: '01',
      tasks: [{ id: '01-01', goal: 'g', status: 'planned', phase: '01' }],
    });
    const now = fixedNow(2026, 4, 17);
    const disp = createDispatcher({ now, readers });

    const stderr = { buf: '', write(s) { this.buf += s; } };
    const { outcomes, exitCode } = disp.dispatchAll({ baseDir: scaf.baseDir, stderr });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(outcomes[0].kind, 'skipped');
    assert.match(outcomes[0].reason, /already dispatched today/);
    // Only the pre-existing file, no prompt written.
    const names = fs.readdirSync(runsDir).sort();
    assert.deepStrictEqual(names, ['2026-04-17-01-01.json']);
  });
});

// ---------------------------------------------------------------------------
// 3. multiple projects
// ---------------------------------------------------------------------------

describe('subagent-dispatch: multiple daily projects', () => {
  test('two flagged projects both dispatch', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-subagent-dispatch-multi-'));
    cleanups.push(() => fs.rmSync(baseDir, { recursive: true, force: true }));

    // Two projects.
    for (const id of ['proj-a', 'proj-b']) {
      fs.mkdirSync(path.join(baseDir, 'projects', id, '.planning'), { recursive: true });
    }

    const toml = `
[[planning.roots]]
id = "proj-a"
path = "projects/proj-a"
planningDir = ".planning"
dailySubagent = true

[[planning.roots]]
id = "proj-b"
path = "projects/proj-b"
planningDir = ".planning"
dailySubagent = true
`;
    fs.writeFileSync(path.join(baseDir, 'gad-config.toml'), toml, 'utf8');

    // Both projects have a planned task each. The shared stub returns the same
    // tasks for each, but the id-0 match is what we're testing.
    const readers = {
      readState: () => ({ currentPhase: '01', nextAction: null }),
      readTasks: () => [{ id: '01-01', goal: 'goalgoal', status: 'planned', phase: '01' }],
    };
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    const { outcomes, exitCode } = disp.dispatchAll({ baseDir });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(outcomes.length, 2);
    for (const o of outcomes) assert.strictEqual(o.kind, 'dispatched');

    for (const id of ['proj-a', 'proj-b']) {
      const runsDir = path.join(baseDir, 'projects', id, '.planning', 'subagent-runs', id);
      const names = fs.readdirSync(runsDir).sort();
      assert.deepStrictEqual(names, ['2026-04-17-01-01.json', '2026-04-17-01-01.prompt.md']);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. no eligible projects
// ---------------------------------------------------------------------------

describe('subagent-dispatch: no eligible projects', () => {
  test('config has no dailySubagent flag → exit 0 with info message', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-unflagged', dailySubagent: false });
    cleanups.push(scaf.cleanup);

    const disp = createDispatcher({
      now: fixedNow(2026, 4, 17),
      readers: makeReaders({ currentPhase: '01' }),
    });
    const stderr = { buf: '', write(s) { this.buf += s; } };
    const { outcomes, exitCode } = disp.dispatchAll({ baseDir: scaf.baseDir, stderr });

    assert.strictEqual(exitCode, 0);
    assert.strictEqual(outcomes.length, 0);
    assert.match(stderr.buf, /no daily-subagent projects configured/);
  });
});

// ---------------------------------------------------------------------------
// 5. missing phase/task
// ---------------------------------------------------------------------------

describe('subagent-dispatch: nothing to do', () => {
  test('current phase has no planned tasks → skip without writing', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-empty', dailySubagent: true });
    cleanups.push(scaf.cleanup);

    const readers = makeReaders({
      currentPhase: '01',
      tasks: [
        { id: '01-01', goal: 'done already', status: 'done', phase: '01' },
        { id: '02-01', goal: 'not this phase', status: 'planned', phase: '02' },
      ],
    });
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    const { outcomes } = disp.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(outcomes[0].kind, 'skipped');
    assert.match(outcomes[0].reason, /no planned tasks/);
    const runsRoot = path.join(scaf.planningDir, 'subagent-runs');
    assert.strictEqual(fs.existsSync(runsRoot), false, 'no subagent-runs dir created');
  });

  test('no current-phase in STATE → skip without writing', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-nophase', dailySubagent: true });
    cleanups.push(scaf.cleanup);

    const readers = makeReaders({ currentPhase: null, tasks: [] });
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    const { outcomes } = disp.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(outcomes[0].kind, 'skipped');
    assert.match(outcomes[0].reason, /current-phase/);
  });
});

// ---------------------------------------------------------------------------
// 6. toml flag parsing
// ---------------------------------------------------------------------------

describe('subagent-dispatch: toml flag parsing', () => {
  test('dailySubagent = true → included; false / absent → excluded', () => {
    const toml = `
[[planning.roots]]
id = "proj-yes"
path = "a"
dailySubagent = true

[[planning.roots]]
id = "proj-explicit-no"
path = "b"
dailySubagent = false

[[planning.roots]]
id = "proj-implicit-no"
path = "c"
`;
    const rows = parsePlanningRoots(toml);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.strictEqual(byId['proj-yes'].dailySubagent, true);
    assert.strictEqual(byId['proj-explicit-no'].dailySubagent, false);
    assert.strictEqual(byId['proj-implicit-no'].dailySubagent, false);
  });
});

// ---------------------------------------------------------------------------
// 7. run-record schema
// ---------------------------------------------------------------------------

describe('subagent-dispatch: run-record schema', () => {
  test('stub has all required fields + dispatch-mode marker', () => {
    const rec = buildRunRecord({
      projectId: 'p',
      taskId: '01-01',
      startedAt: '2026-04-17T10:30:00-07:00',
      promptPath: 'relative/path.prompt.md',
    });
    for (const k of ['runId', 'projectId', 'taskId', 'startedAt', 'endedAt', 'status', 'promptPath', 'reportBody', 'teachingTipId', 'nextTaskId', 'dispatchMode']) {
      assert.ok(k in rec, `missing field: ${k}`);
    }
    assert.strictEqual(rec.status, 'pending-dispatch');
    assert.strictEqual(rec.endedAt, null);
    assert.strictEqual(rec.dispatchMode, 'prompt-emit-only');
    assert.match(rec.runId, /^[0-9a-f-]{36}$/, 'runId is a UUID');
  });

  test('dispatched record on disk matches stub shape', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-schema', dailySubagent: true });
    cleanups.push(scaf.cleanup);
    const readers = makeReaders({
      currentPhase: '01',
      tasks: [{ id: '01-01', goal: 'goal', status: 'planned', phase: '01' }],
    });
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    disp.dispatchAll({ baseDir: scaf.baseDir });
    const body = JSON.parse(fs.readFileSync(
      path.join(scaf.planningDir, 'subagent-runs', 'proj-schema', '2026-04-17-01-01.json'),
      'utf8',
    ));
    assert.strictEqual(body.status, 'pending-dispatch');
    assert.strictEqual(body.taskId, '01-01');
    assert.strictEqual(body.projectId, 'proj-schema');
    assert.match(body.promptPath, /subagent-runs\/proj-schema\/2026-04-17-01-01\.prompt\.md$/);
  });
});

// ---------------------------------------------------------------------------
// 8. prompt template contents
// ---------------------------------------------------------------------------

describe('subagent-dispatch: prompt template', () => {
  test('contains task id, goal text, report-format contract, teaching-tip instruction', () => {
    const body = buildPromptBody({
      projectId: 'llm-from-scratch',
      taskId: '01-02',
      taskGoal: 'Write scripts/fetch_corpus.py to pull ~10MB TinyStories subset.',
      phaseId: '01',
      nextAction: 'Next is data.',
      today: '2026-04-17',
    });
    assert.match(body, /Daily subagent/);
    assert.match(body, /llm-from-scratch/);
    assert.match(body, /01-02/);
    assert.match(body, /fetch_corpus\.py/);
    assert.match(body, /Report format contract/);
    assert.match(body, /STATUS: done \| blocked \| partial/);
    assert.match(body, /TEACHING TIP/);
    assert.match(body, /gad snapshot --projectid llm-from-scratch/);
    assert.match(body, /gad-258/);
  });
});

// ---------------------------------------------------------------------------
// 9. concurrent re-run same day
// ---------------------------------------------------------------------------

describe('subagent-dispatch: concurrent re-run same day', () => {
  test('second invocation skips all projects that ran on first', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-rerun', dailySubagent: true });
    cleanups.push(scaf.cleanup);
    const readers = makeReaders({
      currentPhase: '01',
      tasks: [{ id: '01-01', goal: 'g', status: 'planned', phase: '01' }],
    });
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17, 9), readers });

    const r1 = disp.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(r1.outcomes[0].kind, 'dispatched');

    // Second invocation, same day, slightly later.
    const disp2 = createDispatcher({ now: fixedNow(2026, 4, 17, 15), readers });
    const r2 = disp2.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(r2.outcomes[0].kind, 'skipped');
    assert.strictEqual(r2.exitCode, 0);
  });
});

// ---------------------------------------------------------------------------
// 10. date handling at boundary
// ---------------------------------------------------------------------------

describe('subagent-dispatch: local-date skip-already-ran', () => {
  test('uses local date, not UTC — late-night run followed by next-morning run dispatches twice', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-boundary', dailySubagent: true });
    cleanups.push(scaf.cleanup);
    const readers = makeReaders({
      currentPhase: '01',
      tasks: [{ id: '01-01', goal: 'g', status: 'planned', phase: '01' }],
    });

    // Run 1: April 17th, 23:30 local.
    const disp1 = createDispatcher({ now: fixedNow(2026, 4, 17, 23, 30), readers });
    const r1 = disp1.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(r1.outcomes[0].kind, 'dispatched');
    assert.strictEqual(r1.outcomes[0].today, '2026-04-17');

    // Run 2: April 18th, 00:30 local — different local day, must dispatch again.
    const disp2 = createDispatcher({ now: fixedNow(2026, 4, 18, 0, 30), readers });
    const r2 = disp2.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(r2.outcomes[0].kind, 'dispatched');
    assert.strictEqual(r2.outcomes[0].today, '2026-04-18');

    const runsDir = path.join(scaf.planningDir, 'subagent-runs', 'proj-boundary');
    const names = fs.readdirSync(runsDir).sort();
    assert.deepStrictEqual(names, [
      '2026-04-17-01-01.json',
      '2026-04-17-01-01.prompt.md',
      '2026-04-18-01-01.json',
      '2026-04-18-01-01.prompt.md',
    ]);
  });

  test('toLocalIsoDate formats YYYY-MM-DD with local-clock padding', () => {
    // Pick a day/month below 10 so padding is exercised.
    const s = toLocalIsoDate(new Date(2026, 0, 3, 12, 0, 0));  // Jan 3 2026
    assert.strictEqual(s, '2026-01-03');
  });
});

// ---------------------------------------------------------------------------
// 11. corrupt prior run-record is still a skip signal
// ---------------------------------------------------------------------------

describe('subagent-dispatch: corrupt prior record', () => {
  test('unparseable <today>-*.json still counts as handled-today (fail-safe)', () => {
    const scaf = scaffoldMonorepo({ projectId: 'proj-corrupt', dailySubagent: true });
    cleanups.push(scaf.cleanup);
    const runsDir = path.join(scaf.planningDir, 'subagent-runs', 'proj-corrupt');
    fs.mkdirSync(runsDir, { recursive: true });
    // Truncated / corrupt JSON — readdirSync filename alone is the signal.
    fs.writeFileSync(
      path.join(runsDir, '2026-04-17-01-01.json'),
      '{ this is not valid json',
      'utf8',
    );

    const readers = makeReaders({
      currentPhase: '01',
      tasks: [{ id: '01-01', goal: 'g', status: 'planned', phase: '01' }],
    });
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    const { outcomes } = disp.dispatchAll({ baseDir: scaf.baseDir });
    assert.strictEqual(outcomes[0].kind, 'skipped');
    assert.match(outcomes[0].reason, /already dispatched today/);
    // Still only the corrupt file — we did not overwrite it.
    const names = fs.readdirSync(runsDir).sort();
    assert.deepStrictEqual(names, ['2026-04-17-01-01.json']);
  });
});

// ---------------------------------------------------------------------------
// 12. projectid scope filter
// ---------------------------------------------------------------------------

describe('subagent-dispatch: projectid scope', () => {
  test('--projectid scopes dispatch to a single project even when others are flagged', () => {
    const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-subagent-dispatch-scope-'));
    cleanups.push(() => fs.rmSync(baseDir, { recursive: true, force: true }));

    for (const id of ['proj-scope-a', 'proj-scope-b']) {
      fs.mkdirSync(path.join(baseDir, 'projects', id, '.planning'), { recursive: true });
    }
    fs.writeFileSync(path.join(baseDir, 'gad-config.toml'), `
[[planning.roots]]
id = "proj-scope-a"
path = "projects/proj-scope-a"
planningDir = ".planning"
dailySubagent = true

[[planning.roots]]
id = "proj-scope-b"
path = "projects/proj-scope-b"
planningDir = ".planning"
dailySubagent = true
`, 'utf8');

    const readers = {
      readState: () => ({ currentPhase: '01', nextAction: null }),
      readTasks: () => [{ id: '01-01', goal: 'g', status: 'planned', phase: '01' }],
    };
    const disp = createDispatcher({ now: fixedNow(2026, 4, 17), readers });
    const { outcomes } = disp.dispatchAll({ baseDir, projectId: 'proj-scope-a' });
    assert.strictEqual(outcomes.length, 1);
    assert.strictEqual(outcomes[0].projectId, 'proj-scope-a');
    assert.strictEqual(fs.existsSync(
      path.join(baseDir, 'projects', 'proj-scope-b', '.planning', 'subagent-runs'),
    ), false);
  });
});
