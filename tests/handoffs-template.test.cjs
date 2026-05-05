'use strict';
/**
 * handoffs-template.test.cjs
 *
 * Unit tests for 131-06: handoff-template.md + gad handoffs new command.
 *   - template file loads and contains expected sections
 *   - template placeholders substitute correctly
 *   - new command creates a file in open/ with substituted content
 *   - new command rejects missing required args
 *   - new command with --body uses provided text instead of template skeleton
 *   - generated file passes lint at grade A or B
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { createHandoffsCommand } = require('../bin/commands/handoffs.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'handoff-template.md');

class CmdError extends Error {
  constructor(msg) { super(msg); this.name = 'CmdError'; }
}

function makeCmd(baseDir) {
  return createHandoffsCommand({
    findRepoRoot() { return baseDir; },
    outputError(message) {
      throw new CmdError(message);
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

/** Capture console.log output during fn(). */
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

/** Seed a task JSON file so has-task-id check passes. */
function seedTask(baseDir, taskId) {
  const tasksDir = path.join(baseDir, '.planning', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(
    path.join(tasksDir, `${taskId}.json`),
    JSON.stringify({ id: taskId, status: 'planned', goal: 'test task', phase: taskId.split('-')[0] })
  );
}

/** Find the file written by 'new' in open/ under baseDir. */
function findOpenHandoff(baseDir, phaseId) {
  const openDir = path.join(baseDir, '.planning', 'handoffs', 'open');
  if (!fs.existsSync(openDir)) return null;
  const files = fs.readdirSync(openDir).filter((f) => f.includes(`-${phaseId}.md`));
  return files.length > 0 ? path.join(openDir, files[0]) : null;
}

// ---------------------------------------------------------------------------
// Template file — structure tests
// ---------------------------------------------------------------------------

describe('handoff-template.md — structure', () => {
  test('template file exists', () => {
    assert.ok(fs.existsSync(TEMPLATE_PATH), `Template not found at ${TEMPLATE_PATH}`);
  });

  test('template has YAML frontmatter with required slots', () => {
    const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    assert.match(raw, /^---\r?\n/, 'should start with frontmatter');
    assert.match(raw, /task_id:/, 'should have task_id slot');
    assert.match(raw, /runtime_preference:/, 'should have runtime_preference slot');
    assert.match(raw, /priority:/, 'should have priority slot');
  });

  test('template body has required section headers', () => {
    const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    assert.match(raw, /^##\s+Linked task/m, 'should have ## Linked task');
    assert.match(raw, /^##\s+Acceptance gate/im, 'should have ## Acceptance gate');
    assert.match(raw, /^##\s+Read first/im, 'should have ## Read first');
    assert.match(raw, /^##\s+Why/im, 'should have ## Why');
  });

  test('template contains {{task_id}}, {{runtime_preference}}, {{priority}} placeholders', () => {
    const raw = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    assert.match(raw, /\{\{task_id\}\}/, 'should have {{task_id}} placeholder');
    assert.match(raw, /\{\{runtime_preference\}\}/, 'should have {{runtime_preference}} placeholder');
    assert.match(raw, /\{\{priority\}\}/, 'should have {{priority}} placeholder');
  });
});

// ---------------------------------------------------------------------------
// handoffs new — file creation
// ---------------------------------------------------------------------------

describe('handoffs new — file creation', () => {
  test('creates handoff in open/ with substituted placeholders', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      seedTask(tmpDir, '131-06');
      const cmd = makeCmd(tmpDir);
      const output = captureStdout(() => {
        cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': 'codex-cli',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        });
      });
      assert.match(output, /Created:/, 'should print Created line');
      assert.match(output, /Path:/, 'should print Path line');

      // File must exist in open/
      const handoffFile = findOpenHandoff(tmpDir, '999');
      assert.ok(handoffFile !== null, 'handoff file should exist in open/');

      const content = fs.readFileSync(handoffFile, 'utf8');
      // Placeholders substituted
      assert.match(content, /task_id: 131-06/, 'task_id in frontmatter');
      assert.match(content, /runtime_preference: codex-cli/, 'runtime_preference in frontmatter');
      assert.match(content, /priority: normal/, 'priority in frontmatter');
      // Body sections present
      assert.match(content, /## Acceptance gate/i, 'should have ## Acceptance gate');
      assert.match(content, /## Why/i, 'should have ## Why');
      // No unresolved placeholders in body
      assert.doesNotMatch(content.replace(/^---[\s\S]*?---\n/m, ''), /\{\{/, 'body should have no unresolved {{}} placeholders');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('--body flag replaces skeleton with provided text', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      seedTask(tmpDir, '131-06');
      const cmd = makeCmd(tmpDir);
      const customBody = `# My custom handoff\n\n## Acceptance gate\n1. Done when X\n`;
      const output = captureStdout(() => {
        cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': 'gemini-cli',
            priority: 'high',
            body: customBody,
          },
          rawArgs: [],
        });
      });
      assert.match(output, /Created:/);

      const handoffFile = findOpenHandoff(tmpDir, '999');
      assert.ok(handoffFile !== null, 'handoff file should exist in open/');
      const content = fs.readFileSync(handoffFile, 'utf8');
      assert.match(content, /My custom handoff/, 'should contain custom body text');
      assert.match(content, /Done when X/, 'should contain custom acceptance criteria');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('generated file passes lint at grade A (with seeded task) or B', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      seedTask(tmpDir, '131-06');
      const cmd = makeCmd(tmpDir);

      captureStdout(() => {
        cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': 'claude-code',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        });
      });

      // Lint the generated file
      const lintOutput = captureStdout(() => {
        cmd.subCommands.lint.run({ args: { projectid: 'global', json: false }, rawArgs: [] });
      });

      // Should show grade A or B (not C, D, E, F)
      const handoffLine = lintOutput.split('\n').find((l) => l.includes('-global-999')) || '';
      assert.ok(handoffLine, 'lint output should contain the global-999 handoff line');
      assert.match(handoffLine, /\b[AB]\b/, `grade should be A or B, got: ${handoffLine}`);
    } finally {
      cleanup(tmpDir);
    }
  });
});

// ---------------------------------------------------------------------------
// handoffs new — argument validation
// ---------------------------------------------------------------------------

describe('handoffs new — argument validation', () => {
  test('rejects missing --task-id', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '',
            'runtime-preference': 'codex-cli',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        }),
        (e) => e instanceof CmdError && /--task-id/.test(e.message),
        'should throw CmdError mentioning --task-id'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects missing --runtime-preference', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': '',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        }),
        (e) => e instanceof CmdError && /--runtime-preference/.test(e.message),
        'should throw CmdError mentioning --runtime-preference'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects invalid --runtime-preference value', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': 'cursor',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        }),
        (e) => e instanceof CmdError && /not allowed/.test(e.message),
        'should throw CmdError mentioning not allowed'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects missing --projectid', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.new.run({
          args: {
            projectid: '',
            phase: '999',
            'task-id': '131-06',
            'runtime-preference': 'codex-cli',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        }),
        (e) => e instanceof CmdError,
        'should throw CmdError for missing projectid'
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('rejects missing --phase', () => {
    const tmpDir = createTempDir('gad-ht-test-');
    try {
      const cmd = makeCmd(tmpDir);
      assert.throws(
        () => cmd.subCommands.new.run({
          args: {
            projectid: 'global',
            phase: '',
            'task-id': '131-06',
            'runtime-preference': 'codex-cli',
            priority: 'normal',
            body: '',
          },
          rawArgs: [],
        }),
        (e) => e instanceof CmdError || e.message,
        'should throw for missing phase'
      );
    } finally {
      cleanup(tmpDir);
    }
  });
});
