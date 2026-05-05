'use strict';
/**
 * handoffs-quality-gate.test.cjs
 *
 * Unit tests for the handoff intake quality gate (131-04):
 *   - create rejects missing task-id
 *   - create rejects unknown runtime-preference
 *   - create rejects missing ## Acceptance gate section
 *   - --quick bypass passes with WARN
 *   - lint subcommand scores known-good (A) and known-bad (lower grade) handoffs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const { createHandoffsCommand } = require('../bin/commands/handoffs.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal createHandoffsCommand instance.
 * outputError throws a QualityGateError so tests can assert without process.exit firing.
 */
class QualityGateError extends Error {
  constructor(msg) { super(msg); this.name = 'QualityGateError'; }
}

function makeCmd(baseDir) {
  return createHandoffsCommand({
    findRepoRoot() { return baseDir; },
    outputError(message) {
      throw new QualityGateError(message);
    },
    render() { return ''; },
    shouldUseJson() { return false; },
    detectRuntimeIdentity() { return { id: 'claude-code' }; },
    gadConfig: {
      load() { return { roots: [{ id: 'global', path: '.' }] }; },
    },
    resolveRoots(args, _baseDir, allRoots) {
      return allRoots.filter((r) => r.id === (args.projectid || 'global'));
    },
  });
}

/** Capture console.log + console.warn output during fn(). */
function captureStdout(fn) {
  const lines = [];
  const origLog = console.log;
  const origWarn = console.warn;
  console.log = (...a) => lines.push(a.join(' '));
  console.warn = (...a) => lines.push(a.join(' '));
  try { fn(); } finally {
    console.log = origLog;
    console.warn = origWarn;
  }
  return lines.join('\n');
}

/** Capture stderr.write output during fn(). */
function captureStderr(fn) {
  const lines = [];
  const origWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { lines.push(String(s)); return true; };
  try { fn(); } finally {
    process.stderr.write = origWrite;
  }
  return lines.join('');
}

/** Create a temp dir with a task JSON file seeded. */
function makeTempWithTask(taskId) {
  const tmpDir = createTempDir('gad-hq-test-');
  const tasksDir = path.join(tmpDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  const taskFile = path.join(tasksDir, `${taskId}.json`);
  fs.writeFileSync(taskFile, JSON.stringify({ id: taskId, status: 'planned', goal: 'test task', phase: taskId.split('-')[0] }));
  return tmpDir;
}

const GOOD_BODY = `# My handoff

Do the thing.

## Acceptance gate
1. Verify X
2. Verify Y
`;

const BASE_CREATE_ARGS = {
  projectid: 'global',
  phase: '999',
  priority: 'normal',
  context: 'prescribed',
  risk: 'safe',
  time: 'standard',
  surface: 'local',
  'runtime-fallbacks': '',
  'runtime-required': false,
  quick: false,
};

// ---------------------------------------------------------------------------
// create — quality gate rejection tests
// ---------------------------------------------------------------------------

describe('handoffs create — quality gate', () => {
  test('rejects when --task-id is missing', () => {
    const tmpDir = createTempDir('gad-hq-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.create.run({
          args: { ...BASE_CREATE_ARGS, 'task-id': '', body: GOOD_BODY, 'runtime-preference': 'claude-code' },
          rawArgs: [],
        }),
        (e) => e instanceof QualityGateError && /task-id/i.test(e.message) && /required/i.test(e.message),
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects when task-id file does not exist in .planning/tasks/', () => {
    const tmpDir = createTempDir('gad-hq-test-');
    try {
      fs.mkdirSync(path.join(tmpDir, '.planning', 'tasks'), { recursive: true });
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.create.run({
          args: { ...BASE_CREATE_ARGS, 'task-id': '999-01', body: GOOD_BODY, 'runtime-preference': 'claude-code' },
          rawArgs: [],
        }),
        (e) => e instanceof QualityGateError && /999-01/.test(e.message) && /not found/i.test(e.message),
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects when --runtime-preference is missing', () => {
    const tmpDir = makeTempWithTask('999-02');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.create.run({
          args: { ...BASE_CREATE_ARGS, 'task-id': '999-02', body: GOOD_BODY, 'runtime-preference': '' },
          rawArgs: [],
        }),
        (e) => e instanceof QualityGateError && /runtime-preference/i.test(e.message) && /required/i.test(e.message),
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects when --runtime-preference is "any" (not allowed)', () => {
    const tmpDir = makeTempWithTask('999-03');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.create.run({
          args: { ...BASE_CREATE_ARGS, 'task-id': '999-03', body: GOOD_BODY, 'runtime-preference': 'any' },
          rawArgs: [],
        }),
        (e) => e instanceof QualityGateError && /not allowed/i.test(e.message) && /any/.test(e.message),
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects when body has no ## Acceptance gate section', () => {
    const tmpDir = makeTempWithTask('999-04');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.create.run({
          args: { ...BASE_CREATE_ARGS, 'task-id': '999-04', body: 'Just some notes without an acceptance section.', 'runtime-preference': 'claude-code' },
          rawArgs: [],
        }),
        (e) => e instanceof QualityGateError && /acceptance/i.test(e.message),
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('accepts ## Acceptance criteria (case-insensitive) as valid', () => {
    const tmpDir = makeTempWithTask('999-05');
    try {
      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.create.run({
          args: {
            ...BASE_CREATE_ARGS,
            'task-id': '999-05',
            body: '## Acceptance Criteria\n1. Does the thing\n',
            'runtime-preference': 'codex-cli',
          },
          rawArgs: [],
        });
      });
      assert.match(output, /Created:/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('--quick bypass passes even with all-invalid inputs; WARN appears on stderr', () => {
    const tmpDir = createTempDir('gad-hq-test-');
    try {
      const cmd = makeCmd(tmpDir);
      let stdout = '';
      let stderr = '';
      // capture both streams
      const origLog = console.log;
      const origWarn = console.warn;
      const origStderrWrite = process.stderr.write.bind(process.stderr);
      console.log = (...a) => { stdout += a.join(' ') + '\n'; };
      console.warn = (...a) => { stdout += a.join(' ') + '\n'; };
      process.stderr.write = (s) => { stderr += String(s); return true; };
      try {
        cmd.subCommands.create.run({
          args: {
            ...BASE_CREATE_ARGS,
            'task-id': '',                // invalid
            body: 'no acceptance',        // invalid
            'runtime-preference': '',     // invalid
            quick: true,                  // bypass
          },
          rawArgs: [],
        });
      } finally {
        console.log = origLog;
        console.warn = origWarn;
        process.stderr.write = origStderrWrite;
      }
      // Should succeed (no throw)
      assert.match(stdout, /Created:/);
      // WARN must appear on stderr
      assert.match(stderr, /WARN.*--quick bypass/i);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('happy path: valid handoff creates successfully', () => {
    const tmpDir = makeTempWithTask('999-06');
    try {
      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.create.run({
          args: {
            ...BASE_CREATE_ARGS,
            'task-id': '999-06',
            body: GOOD_BODY,
            'runtime-preference': 'codex-cli',
          },
          rawArgs: [],
        });
      });
      assert.match(output, /Created:/);
      assert.match(output, /Path:/);
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------
// lint — scoring tests
// ---------------------------------------------------------------------------

describe('handoffs lint — scoring', () => {
  function makeHandoffFile(dir, bucket, id, frontmatter, body) {
    const bucketDir = path.join(dir, '.planning', 'handoffs', bucket);
    fs.mkdirSync(bucketDir, { recursive: true });
    const lines = ['---'];
    for (const [k, v] of Object.entries(frontmatter)) {
      lines.push(`${k}: ${v === null ? 'null' : v}`);
    }
    lines.push('---', '', body);
    fs.writeFileSync(path.join(bucketDir, `${id}.md`), lines.join('\n'));
  }

  test('known-good handoff scores A (5/5)', () => {
    const tmpDir = createTempDir('gad-hq-lint-');
    try {
      const tasksDir = path.join(tmpDir, '.planning', 'tasks');
      fs.mkdirSync(tasksDir, { recursive: true });
      fs.writeFileSync(path.join(tasksDir, '80-01.json'), JSON.stringify({ id: '80-01', status: 'planned', goal: 'test' }));

      makeHandoffFile(tmpDir, 'open', 'h-good-handoff', {
        id: 'h-good-handoff',
        projectid: 'global',
        phase: '80',
        task_id: '80-01',
        priority: 'high',
        estimated_context: 'bounded',
        runtime_preference: 'claude-code',
        claimed_by: null,
        claimed_at: null,
        completed_at: null,
      }, GOOD_BODY);

      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.lint.run({ args: { projectid: 'global', json: false }, rawArgs: [] });
      });

      assert.match(output, /h-good-handoff/);
      assert.match(output, /\bA\b/);
      assert.match(output, /A=1/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('handoff missing task-id, runtime, acceptance scores lower than A', () => {
    const tmpDir = createTempDir('gad-hq-lint-');
    try {
      makeHandoffFile(tmpDir, 'open', 'h-bad-handoff', {
        id: 'h-bad-handoff',
        projectid: 'global',
        phase: '80',
        task_id: null,
        priority: 'normal',
        estimated_context: 'bounded',
        runtime_preference: 'any',
        claimed_by: null,
        claimed_at: null,
        completed_at: null,
      }, '# Bad handoff\n\nNo acceptance section here.\n');

      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.lint.run({ args: { projectid: 'global', json: false }, rawArgs: [] });
      });

      assert.match(output, /h-bad-handoff/);
      // Grade must not be A
      const handoffLine = output.split('\n').find((l) => l.includes('h-bad-handoff')) || '';
      assert.doesNotMatch(handoffLine, /\bA\b/);
      // Missing checks must be listed
      assert.match(output, /has-task-id|has-runtime-preference|has-acceptance-section/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('lint --json emits JSON array with grade and score fields', () => {
    const tmpDir = createTempDir('gad-hq-lint-');
    try {
      const tasksDir = path.join(tmpDir, '.planning', 'tasks');
      fs.mkdirSync(tasksDir, { recursive: true });
      fs.writeFileSync(path.join(tasksDir, '81-01.json'), JSON.stringify({ id: '81-01', status: 'planned', goal: 'test' }));

      makeHandoffFile(tmpDir, 'open', 'h-json-test', {
        id: 'h-json-test',
        projectid: 'global',
        phase: '81',
        task_id: '81-01',
        priority: 'normal',
        estimated_context: 'prescribed',
        runtime_preference: 'gemini-cli',
        claimed_by: null,
        claimed_at: null,
        completed_at: null,
      }, GOOD_BODY);

      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.lint.run({ args: { projectid: 'global', json: true }, rawArgs: [] });
      });

      const parsed = JSON.parse(output);
      assert.ok(Array.isArray(parsed), 'output should be JSON array');
      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].id, 'h-json-test');
      assert.ok(typeof parsed[0].grade === 'string');
      assert.ok(typeof parsed[0].score === 'number');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('lint shows "No handoffs found" when directory is empty', () => {
    const tmpDir = createTempDir('gad-hq-lint-');
    try {
      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.lint.run({ args: { projectid: 'global', json: false }, rawArgs: [] });
      });
      assert.match(output, /No handoffs found/i);
    } finally {
      cleanup(tmpDir);
    }
  });
});
