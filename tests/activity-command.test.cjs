const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const { createActivityCommand } = require('../bin/commands/activity.cjs');

function writeJsonl(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
}

describe('gad activity command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gad-activity-');
    fs.writeFileSync(path.join(tmpDir, 'gad-config.toml'), [
      '[[planning.roots]]',
      'id = "global"',
      'path = "."',
      'planningDir = ".planning"',
      '',
    ].join('\n'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('activity merges worker, cli, and trace events with since filtering', async () => {
    writeJsonl(path.join(tmpDir, '.planning', 'team', 'workers', 'w1', 'log.jsonl'), [
      { ts: '2026-05-04T01:59:59.000Z', worker_id: 'w1', kind: 'worker-start', runtime_cmd: 'codex exec' },
      { ts: '2026-05-04T02:00:01.000Z', worker_id: 'w1', kind: 'work-start', ref: 'h-1' },
    ]);
    writeJsonl(path.join(tmpDir, '.planning', '.gad-log', '2026-05-04.jsonl'), [
      { ts: '2026-05-04T02:00:02.000Z', cmd: 'tasks stamp 05-08 --projectid global', runtime: { id: 'codex' } },
    ]);
    writeJsonl(path.join(tmpDir, '.planning', '.trace-events.jsonl'), [
      { ts: '2026-05-04T02:00:03.000Z', type: 'tool_use', tool: 'PowerShell', runtime: { id: 'cursor' }, inputs: { command: 'Get-ChildItem' } },
    ]);

    const lines = [];
    const originalLog = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      const command = createActivityCommand({
        findRepoRoot: () => tmpDir,
        gadConfig: { load: () => ({ roots: [{ id: 'global', path: '.', planningDir: '.planning' }] }) },
        resolveRoots: () => [{ id: 'global', path: '.', planningDir: '.planning' }],
        getLastActiveProjectid: () => null,
        outputError: (message) => { throw new Error(message); },
      });
      await command.run({ args: { projectid: 'global', since: '2026-05-04T02:00:00.000Z', once: true, limit: '100' } });
    } finally {
      console.log = originalLog;
    }

    const output = lines.join('\n');
    assert.match(output, /SOURCE/);
    assert.match(output, /worker/);
    assert.match(output, /cli/);
    assert.match(output, /trace/);
    assert.match(output, /h-1/);
    assert.match(output, /tasks stamp 05-08/);
    assert.match(output, /Get-ChildItem/);
    assert.doesNotMatch(output, /worker-start/);
  });
});
