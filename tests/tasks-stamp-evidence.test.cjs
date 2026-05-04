const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const taskFiles = require('../lib/task-files.cjs');

function makeRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-stamp-'));
  const planningDir = path.join(repoRoot, '.planning');
  fs.mkdirSync(path.join(planningDir, 'tasks'), { recursive: true });
  return { repoRoot, planningDir };
}

function writeTask(planningDir, overrides = {}) {
  return taskFiles.writeOne(planningDir, {
    id: '87-06',
    phase: '87',
    status: 'in-progress',
    goal: 'Ship stamp guardrail',
    files: ['src/guardrail.txt'],
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  });
}

function captureConsole(fn) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const logs = [];
  const warnings = [];
  console.log = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => warnings.push(args.join(' '));
  try {
    fn();
    return { logs, warnings };
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
}

function loadCommandWithExecStub(execStub) {
  const stampPath = require.resolve('../bin/commands/tasks/stamp.cjs');
  const originalExecSync = childProcess.execSync;
  childProcess.execSync = execStub;
  delete require.cache[stampPath];
  const { createTasksStampCommand } = require('../bin/commands/tasks/stamp.cjs');
  return {
    createTasksStampCommand,
    restore() {
      childProcess.execSync = originalExecSync;
      delete require.cache[stampPath];
    },
  };
}

function makeDeps(repoRoot, requireEvidenceOnStamp, errors) {
  return {
    resolveProjectRootById() {
      return {
        baseDir: repoRoot,
        root: { path: '.', planningDir: '.planning' },
        config: {
          tasks: { require_evidence_on_stamp: requireEvidenceOnStamp },
          planning: { require_evidence_on_stamp: requireEvidenceOnStamp },
        },
      };
    },
    outputError(message) {
      errors.push(String(message));
    },
    maybeRebuildGraph() {},
  };
}

function runStamp(command, args) {
  const originalExit = process.exit;
  process.exit = (code) => {
    throw new Error(`EXIT:${code}`);
  };
  try {
    return captureConsole(() => command.run({ args }));
  } finally {
    process.exit = originalExit;
  }
}

describe('gad tasks stamp evidence guardrail', () => {
  test('warn mode allows status=done without evidence but emits guidance', () => {
    const { repoRoot, planningDir } = makeRepo();
    writeTask(planningDir);
    const errors = [];
    const { createTasksStampCommand, restore } = loadCommandWithExecStub(() => {
      throw new Error('execSync should not run for missing evidence');
    });

    try {
      const command = createTasksStampCommand(makeDeps(repoRoot, false, errors));
      const result = runStamp(command, {
        id: '87-06',
        projectid: 'global',
        agent: 'team-w1',
        runtime: 'codex-cli',
        status: 'done',
        resolution: 'Finished work',
        role: '',
        'skill-id': '',
        'commit-sha': '',
        evidence: '',
        enforce: false,
      });

      assert.deepStrictEqual(errors, []);
      assert.match(result.warnings.join('\n'), /requires --commit-sha <sha> or --evidence/i);
      const updated = taskFiles.readOne(planningDir, '87-06');
      assert.strictEqual(updated.status, 'done');
    } finally {
      restore();
    }
  });

  test('enforce mode rejects done stamp without evidence', () => {
    const { repoRoot, planningDir } = makeRepo();
    writeTask(planningDir);
    const errors = [];
    const { createTasksStampCommand, restore } = loadCommandWithExecStub(() => {
      throw new Error('execSync should not run for missing evidence');
    });

    try {
      const command = createTasksStampCommand(makeDeps(repoRoot, true, errors));
      assert.throws(() => runStamp(command, {
        id: '87-06',
        projectid: 'global',
        agent: 'team-w1',
        runtime: 'codex-cli',
        status: 'done',
        resolution: 'Finished work',
        role: '',
        'skill-id': '',
        'commit-sha': '',
        evidence: '',
        enforce: false,
      }), /EXIT:1/);
      assert.match(errors.join('\n'), /requires --commit-sha <sha> or --evidence/i);
      const updated = taskFiles.readOne(planningDir, '87-06');
      assert.strictEqual(updated.status, 'in-progress');
    } finally {
      restore();
    }
  });

  test('commit evidence must touch task scope in enforce mode', () => {
    const { repoRoot, planningDir } = makeRepo();
    writeTask(planningDir);
    const errors = [];
    const { createTasksStampCommand, restore } = loadCommandWithExecStub((command, options) => {
      assert.strictEqual(options.cwd, repoRoot);
      if (command.includes('git rev-list --max-count=1 abc123')) return 'abc123\n';
      if (command.includes('git diff-tree --no-commit-id --name-only -r abc123')) return 'docs/elsewhere.txt\n';
      throw new Error(`Unexpected git command: ${command}`);
    });

    try {
      const command = createTasksStampCommand(makeDeps(repoRoot, true, errors));
      assert.throws(() => runStamp(command, {
        id: '87-06',
        projectid: 'global',
        agent: 'team-w1',
        runtime: 'codex-cli',
        status: 'done',
        resolution: 'Finished work',
        role: '',
        'skill-id': '',
        'commit-sha': 'abc123',
        evidence: '',
        enforce: false,
      }), /EXIT:1/);
      assert.match(errors.join('\n'), /does not touch any files in task scope/i);
    } finally {
      restore();
    }
  });

  test('evidence text passes when git history touches task scope after task creation', () => {
    const { repoRoot, planningDir } = makeRepo();
    writeTask(planningDir);
    const errors = [];
    const { createTasksStampCommand, restore } = loadCommandWithExecStub((command, options) => {
      assert.strictEqual(options.cwd, repoRoot);
      if (command.includes('git log --since=')) return 'def456\n';
      throw new Error(`Unexpected git command: ${command}`);
    });

    try {
      const command = createTasksStampCommand(makeDeps(repoRoot, true, errors));
      const result = runStamp(command, {
        id: '87-06',
        projectid: 'global',
        agent: 'team-w1',
        runtime: 'codex-cli',
        status: 'done',
        resolution: 'Finished work',
        role: '',
        'skill-id': '',
        'commit-sha': '',
        evidence: 'Implemented the guardrail and verified the git-backed scope evidence path.',
        enforce: false,
      });

      assert.deepStrictEqual(errors, []);
      assert.deepStrictEqual(result.warnings, []);
      const updated = taskFiles.readOne(planningDir, '87-06');
      assert.strictEqual(updated.status, 'done');
    } finally {
      restore();
    }
  });
});
