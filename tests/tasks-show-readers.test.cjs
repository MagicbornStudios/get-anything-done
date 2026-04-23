const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { createTempProject, cleanup } = require('./helpers.cjs');
const { createTasksShowCommand } = require('../bin/commands/tasks/show.cjs');
const { createErrorsCommand, createBlockersCommand } = require('../bin/commands/readers.cjs');

function writeMonorepoConfig(tmpDir) {
  const body = [
    '[planning]',
    '',
    '[[planning.roots]]',
    'id = "get-anything-done"',
    'path = "vendor/get-anything-done"',
    'planningDir = ".planning"',
    'discover = false',
    'enabled = true',
    '',
    '[[planning.roots]]',
    'id = "global"',
    'path = "."',
    'planningDir = ".planning"',
    'discover = false',
    'enabled = true',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), body, 'utf8');
}

function writeHostErrorFixtures(tmpDir) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ERRORS-AND-ATTEMPTS.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<errors-and-attempts>
  <entry id="sample-open-blocker" date="2026-04-21" phase="05" status="open" blocks="05-07">
    <summary>Spawn bug blocks task execution</summary>
    <context>Dispatcher starts but worker never transitions.</context>
    <failure>Installed gad.exe invoked gad.cjs as a subcommand.</failure>
    <rule>Use node for script launches under bundled gad.exe.</rule>
  </entry>
  <entry id="sample-resolved-error" date="2026-04-21" phase="05" status="resolved">
    <summary>Resolved regression</summary>
    <context>Regression was visible in startup output.</context>
    <failure>Reader rejected the current XML element shape.</failure>
    <rule>Support both attempt and entry records.</rule>
  </entry>
</errors-and-attempts>
`,
    'utf8',
  );
}

function writeVendorTaskFixture(tmpDir) {
  const vendorPlanning = path.join(tmpDir, 'vendor', 'get-anything-done', '.planning');
  fs.mkdirSync(path.join(vendorPlanning, 'tasks'), { recursive: true });
  fs.writeFileSync(
    path.join(vendorPlanning, 'tasks', '99-01.json'),
    JSON.stringify({
      id: '99-01',
      phase: '99',
      status: 'planned',
      goal: 'Read the full multi-line task goal from per-task JSON without truncation.',
      type: 'framework',
      commands: ['gad tasks show 99-01 --projectid get-anything-done'],
      files: ['bin/commands/tasks/show.cjs'],
      created_at: '2026-04-21T00:00:00.000Z',
      updated_at: '2026-04-21T00:00:00.000Z',
    }, null, 2),
    'utf8',
  );
}

function makeConfig() {
  return {
    roots: [
      { id: 'get-anything-done', path: 'vendor/get-anything-done', planningDir: '.planning' },
      { id: 'global', path: '.', planningDir: '.planning' },
    ],
  };
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

describe('gad tasks show and current errors/blockers readers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gad-tasks-show-');
    writeMonorepoConfig(tmpDir);
    writeHostErrorFixtures(tmpDir);
    writeVendorTaskFixture(tmpDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('tasks show reads per-task JSON from a nested project root', () => {
    const command = createTasksShowCommand({
      resolveSingleTaskRoot() {
        return {
          baseDir: tmpDir,
          root: { id: 'get-anything-done', path: 'vendor/get-anything-done', planningDir: '.planning' },
        };
      },
      readTasks() {
        return [];
      },
      outputError(message) {
        throw new Error(message);
      },
      shouldUseJson() {
        return false;
      },
    });

    const output = captureConsole(() => command.run({ args: { id: '99-01', projectid: 'get-anything-done', json: false } }));
    assert.match(output, /^id: 99-01/m);
    assert.match(output, /goal:\nRead the full multi-line task goal from per-task JSON without truncation\./m);
    assert.match(output, /commands:\n- gad tasks show 99-01 --projectid get-anything-done/m);
  });

  test('errors command reads host project ERRORS-AND-ATTEMPTS entry records via --projectid global', () => {
    const command = createErrorsCommand({
      findRepoRoot() {
        return tmpDir;
      },
      gadConfig: { load: makeConfig },
      resolveRoots(args, baseDir, allRoots) {
        return allRoots.filter((root) => root.id === args.projectid);
      },
      render() {
        throw new Error('table output should not be used in this test');
      },
      shouldUseJson() {
        return false;
      },
      readErrors: require('../lib/errors-reader.cjs').readErrors,
    });

    const output = captureConsole(() => command.run({ args: { projectid: 'global', all: false, status: '', phase: '', json: true } }));
    const rows = JSON.parse(output);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].project, 'global');
    assert.ok(rows.some((row) => row.id === 'sample-open-blocker' && row.status === 'open'));
    assert.ok(rows.some((row) => row.id === 'sample-resolved-error' && row.status === 'resolved'));
  });

  test('blockers command defaults to open blockers from host ERRORS-AND-ATTEMPTS entries', () => {
    const command = createBlockersCommand({
      findRepoRoot() {
        return tmpDir;
      },
      gadConfig: { load: makeConfig },
      resolveRoots(args, baseDir, allRoots) {
        return allRoots.filter((root) => root.id === args.projectid);
      },
      render() {
        throw new Error('table output should not be used in this test');
      },
      shouldUseJson() {
        return false;
      },
      readBlockers: require('../lib/blockers-reader.cjs').readBlockers,
    });

    const output = captureConsole(() => command.run({ args: { projectid: 'global', all: false, status: '', json: true } }));
    const rows = JSON.parse(output);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      project: 'global',
      id: 'sample-open-blocker',
      status: 'open',
      title: 'Spawn bug blocks task execution',
      summary: 'Installed gad.exe invoked gad.cjs as a subcommand.',
      taskRef: '05-07',
    });
  });
});
