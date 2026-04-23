const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const NODE_EXEC_PATH = require.resolve('../lib/node-exec.cjs');
const TEAM_SPAWN_PATH = require.resolve('../lib/team/spawn.cjs');
const TEAM_DISPATCHER_CMD_PATH = require.resolve('../bin/commands/team/dispatcher.cjs');

const originalExecPath = process.execPath;
const originalEnv = { ...process.env };
const originalSpawn = childProcess.spawn;

function setExecPath(value) {
  Object.defineProperty(process, 'execPath', {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

function resetModuleCache() {
  delete require.cache[NODE_EXEC_PATH];
  delete require.cache[TEAM_SPAWN_PATH];
  delete require.cache[TEAM_DISPATCHER_CMD_PATH];
}

describe('node-exec packaged runtime detection', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    setExecPath(originalExecPath);
    resetModuleCache();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setExecPath(originalExecPath);
    childProcess.spawn = originalSpawn;
    resetModuleCache();
  });

  test('pickNodeExecutableFor returns node for packaged env markers even when execPath is not gad.exe', () => {
    const { pickNodeExecutableFor } = require('../lib/node-exec.cjs');

    assert.strictEqual(
      pickNodeExecutableFor('C:\\bun\\bin\\bun.exe', { GAD_PACKAGED_EXECUTABLE: 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe' }),
      'node',
    );
    assert.strictEqual(
      pickNodeExecutableFor('C:\\bun\\bin\\bun.exe', { GAD_PACKAGED_ROOT: 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad' }),
      'node',
    );
  });

  test('pickNodeExecutableFor preserves non-packaged execPath', () => {
    const { pickNodeExecutableFor } = require('../lib/node-exec.cjs');
    assert.strictEqual(
      pickNodeExecutableFor('C:\\Program Files\\nodejs\\node.exe', {}),
      'C:\\Program Files\\nodejs\\node.exe',
    );
  });

  test('spawnWorker uses node under packaged runtime markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-worker-'));
    const spawnCalls = [];

    process.env.GAD_PACKAGED_EXECUTABLE = 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe';
    setExecPath('C:\\bun\\bin\\bun.exe');

    childProcess.spawn = (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return { pid: 12345, unref() {} };
    };

    const { spawnWorker } = require('../lib/team/spawn.cjs');
    const gadBinary = 'C:\\Users\\benja\\Documents\\custom_portfolio\\vendor\\get-anything-done\\bin\\gad.cjs';
    const pid = spawnWorker(tmpDir, 'w1', gadBinary);

    assert.strictEqual(pid, 12345);
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, 'node');
    assert.deepStrictEqual(spawnCalls[0].args, [gadBinary, 'team', 'work', '--worker-id', 'w1']);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dispatcher start uses node under packaged runtime markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-dispatcher-'));
    const spawnCalls = [];

    fs.mkdirSync(path.join(tmpDir, '.planning', 'team'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'team', 'config.json'),
      JSON.stringify({ workers: 1, runtime: 'codex-cli', workers_spec: [{ id: 'w1', role: 'executor', runtime: 'codex-cli' }] }, null, 2),
    );

    process.env.GAD_PACKAGED_EXECUTABLE = 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe';
    setExecPath('C:\\bun\\bin\\bun.exe');

    childProcess.spawn = (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return { pid: 54321, unref() {} };
    };

    const { createDispatcherCommand } = require('../bin/commands/team/dispatcher.cjs');
    const cmd = createDispatcherCommand({
      findRepoRoot: () => tmpDir,
      gadConfig: { load: () => ({ roots: [{ id: 'global', path: '.' }] }) },
      resolveRoots: () => [{ id: 'global', path: '.' }],
      getLastActiveProjectid: () => null,
      outputError: (msg) => { throw new Error(msg); },
    });

    cmd.subCommands.start.run({ args: { projectid: 'global' } });

    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, 'node');
    assert.deepStrictEqual(
      spawnCalls[0].args.slice(-3),
      ['team', 'dispatcher', 'run'],
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
