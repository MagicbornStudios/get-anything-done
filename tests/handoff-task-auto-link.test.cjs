'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createHandoffsCommand } = require('../bin/commands/handoffs.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

function writeFile(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
}

function setupProject() {
  const tmpDir = createTempDir('gad-handoff-task-link-');
  writeFile(path.join(tmpDir, '.planning', 'STATE.xml'), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<state>',
    '  <project-id>sample</project-id>',
    '  <current-phase>42</current-phase>',
    '  <status>active</status>',
    '</state>',
    '',
  ].join('\n'));
  fs.mkdirSync(path.join(tmpDir, '.planning', 'tasks'), { recursive: true });
  return tmpDir;
}

function makeCommand(tmpDir, runtime = 'codex-cli') {
  return createHandoffsCommand({
    findRepoRoot() {
      return tmpDir;
    },
    outputError(message) {
      throw new Error(message);
    },
    render() {
      throw new Error('render should not be used in these tests');
    },
    shouldUseJson() {
      return false;
    },
    detectRuntimeIdentity() {
      return { id: runtime };
    },
    gadConfig: {
      load() {
        return { roots: [{ id: 'sample', path: '.', planningDir: '.planning' }] };
      },
    },
    resolveRoots(args, _baseDir, allRoots) {
      return allRoots.filter((root) => !args.projectid || root.id === args.projectid);
    },
  });
}

function captureConsole(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = originalLog;
  }
  return logs.join('\n');
}

function writeTask(tmpDir, id, patch = {}) {
  const now = '2026-05-04T03:42:52.000Z';
  const task = {
    id,
    phase: patch.phase || id.split('-')[0],
    status: 'planned',
    goal: 'Test task.',
    type: 'framework',
    keywords: '',
    depends: [],
    commands: [],
    files: [],
    agent_id: '',
    agent_role: '',
    runtime: '',
    model_profile: '',
    resolved_model: '',
    skill: '',
    claimed_by: '',
    claimed: false,
    claimed_at: '',
    lease_expires_at: '',
    completed_at: '',
    resolution: '',
    created_at: now,
    updated_at: now,
    ...patch,
  };
  writeFile(path.join(tmpDir, '.planning', 'tasks', `${id}.json`), JSON.stringify(task, null, 2));
}

function readTask(tmpDir, id) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'tasks', `${id}.json`), 'utf8'));
}

function readState(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.xml'), 'utf8');
}

function parseCreatedId(output, label = 'Created') {
  const match = output.match(new RegExp(`${label}:\\s+(h-[^\\r\\n]+)`));
  assert.ok(match, `Expected ${label} id in output.\n${output}`);
  return match[1];
}

function addSkillToHandoff(tmpDir, bucket, handoffId, skillId) {
  const handoffPath = path.join(tmpDir, '.planning', 'handoffs', bucket, `${handoffId}.md`);
  const text = fs.readFileSync(handoffPath, 'utf8');
  const updated = text.replace(/\ncompleted_at: null\n/, `\ncompleted_at: null\nskill: ${skillId}\n`);
  fs.writeFileSync(handoffPath, updated, 'utf8');
}

describe('handoff-task auto-link lifecycle', () => {
  test('create with valid task-id marks the linked task in-progress and logs state', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir);
    try {
      writeTask(tmpDir, '42-01');
      captureConsole(() => command.subCommands.create.run({
        args: {
          projectid: 'sample',
          phase: '42',
          'task-id': '42-01',
          priority: 'normal',
          context: 'mechanical',
          body: 'Body',
          'runtime-preference': '',
          'runtime-fallbacks': '',
          'runtime-required': false,
          'force-share': false,
        },
      }));

      const task = readTask(tmpDir, '42-01');
      assert.equal(task.status, 'in-progress');
      assert.match(readState(tmpDir), /Task 42-01 handed off via h-/);
      assert.match(readState(tmpDir), /handoff-create/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('create with non-existent task-id fails with a helpful error', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir);
    try {
      assert.throws(
        () => command.subCommands.create.run({
          args: {
            projectid: 'sample',
            phase: '42',
            'task-id': '42-99',
            priority: 'normal',
            context: 'mechanical',
            body: 'Body',
            'runtime-preference': '',
            'runtime-fallbacks': '',
            'runtime-required': false,
            'force-share': false,
          },
        }),
        /Task 42-99 not found\. Add via gad tasks add or omit --task-id\./,
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  test('claim populates linked task agent_id, runtime, claimed_by, and claimed_at', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir, 'codex-cli');
    try {
      writeTask(tmpDir, '42-02');
      const createdOutput = captureConsole(() => command.subCommands.create.run({
        args: {
          projectid: 'sample',
          phase: '42',
          'task-id': '42-02',
          priority: 'normal',
          context: 'mechanical',
          body: 'Body',
          'runtime-preference': '',
          'runtime-fallbacks': '',
          'runtime-required': false,
          'force-share': false,
        },
      }));
      const handoffId = parseCreatedId(createdOutput);

      captureConsole(() => command.subCommands.claim.run({
        args: {
          id: handoffId,
          agent: 'team-w1',
          runtime: 'codex-cli',
        },
      }));

      const task = readTask(tmpDir, '42-02');
      assert.equal(task.agent_id, 'team-w1');
      assert.equal(task.runtime, 'codex-cli');
      assert.equal(task.claimed_by, 'team-w1');
      assert.equal(task.claimed, true);
      assert.ok(task.claimed_at);
      assert.match(readState(tmpDir), /Task 42-02 claimed by team-w1 via/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('complete marks linked task done with attribution', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir, 'codex-cli');
    try {
      writeTask(tmpDir, '42-03');
      const createdOutput = captureConsole(() => command.subCommands.create.run({
        args: {
          projectid: 'sample',
          phase: '42',
          'task-id': '42-03',
          priority: 'normal',
          context: 'mechanical',
          body: 'Body',
          'runtime-preference': '',
          'runtime-fallbacks': '',
          'runtime-required': false,
          'force-share': false,
        },
      }));
      const handoffId = parseCreatedId(createdOutput);
      captureConsole(() => command.subCommands.claim.run({
        args: {
          id: handoffId,
          agent: 'team-w1',
          runtime: 'codex-cli',
        },
      }));
      addSkillToHandoff(tmpDir, 'claimed', handoffId, 'gad:test-skill');

      captureConsole(() => command.subCommands.complete.run({ args: { id: handoffId } }));

      const task = readTask(tmpDir, '42-03');
      assert.equal(task.status, 'done');
      assert.equal(task.agent_id, 'team-w1');
      assert.equal(task.runtime, 'codex-cli');
      assert.equal(task.skill, 'gad:test-skill');
      assert.ok(task.completed_at);
      assert.match(readState(tmpDir), /Task 42-03 done via/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('unclaim reverts the linked task to planned and clears claim metadata', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir, 'codex-cli');
    try {
      writeTask(tmpDir, '42-04');
      const createdOutput = captureConsole(() => command.subCommands.create.run({
        args: {
          projectid: 'sample',
          phase: '42',
          'task-id': '42-04',
          priority: 'normal',
          context: 'mechanical',
          body: 'Body',
          'runtime-preference': '',
          'runtime-fallbacks': '',
          'runtime-required': false,
          'force-share': false,
        },
      }));
      const handoffId = parseCreatedId(createdOutput);
      captureConsole(() => command.subCommands.claim.run({
        args: {
          id: handoffId,
          agent: 'team-w1',
          runtime: 'codex-cli',
        },
      }));

      captureConsole(() => command.subCommands.unclaim.run({
        args: {
          id: handoffId,
          reason: 'rate-limit',
          by: 'team-w1',
        },
      }));

      const task = readTask(tmpDir, '42-04');
      assert.equal(task.status, 'planned');
      assert.equal(task.agent_id, '');
      assert.equal(task.runtime, '');
      assert.equal(task.claimed_by, '');
      assert.equal(task.claimed, false);
      assert.equal(task.claimed_at, '');
      assert.match(readState(tmpDir), /Task 42-04 returned to planned via/);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('create and complete help text mention the auto-link behavior', () => {
    const tmpDir = setupProject();
    const command = makeCommand(tmpDir);
    try {
      assert.match(command.subCommands.create.meta.description, /linked task is validated, marked in-progress/i);
      assert.match(command.subCommands.complete.meta.description, /linked tasks are auto-stamped done/i);
    } finally {
      cleanup(tmpDir);
    }
  });
});
