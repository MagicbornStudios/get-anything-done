const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const NODE_EXEC_PATH = require.resolve('../lib/node-exec.cjs');
const TEAM_SPAWN_PATH = require.resolve('../lib/team/spawn.cjs');
const TEAM_DISPATCHER_CMD_PATH = require.resolve('../bin/commands/team/dispatcher.cjs');

const originalCwd = process.cwd();
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
    process.chdir(originalCwd);
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

  test('resolveDevSourceGadCli honors GAD_DEV_SOURCE_DIR', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-source-env-'));
    const sourceDir = path.join(tmpDir, 'source');
    const sourceCli = path.join(sourceDir, 'bin', 'gad.cjs');
    fs.mkdirSync(path.dirname(sourceCli), { recursive: true });
    fs.writeFileSync(sourceCli, '#!/usr/bin/env node\n');

    const { resolveDevSourceGadCli } = require('../lib/node-exec.cjs');
    assert.strictEqual(
      resolveDevSourceGadCli(tmpDir, { GAD_DEV_SOURCE_DIR: sourceDir }),
      sourceCli,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('resolveWorkerGadCli prefers monorepo source CLI over packaged gad executable', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-source-monorepo-'));
    const sourceCli = path.join(tmpDir, 'vendor', 'get-anything-done', 'bin', 'gad.cjs');
    const installedGad = 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe';
    fs.mkdirSync(path.dirname(sourceCli), { recursive: true });
    fs.writeFileSync(sourceCli, '#!/usr/bin/env node\n');

    const { resolveWorkerGadCli } = require('../lib/node-exec.cjs');
    assert.strictEqual(
      resolveWorkerGadCli(installedGad, { cwd: tmpDir, env: {} }),
      sourceCli,
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('resolveWorkerGadCli falls back to caller-provided binary outside dev source trees', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-source-fallback-'));
    const installedGad = 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe';
    process.chdir(tmpDir);

    const { resolveWorkerGadCli } = require('../lib/node-exec.cjs');
    assert.strictEqual(
      resolveWorkerGadCli(installedGad, { cwd: tmpDir, env: {} }),
      installedGad,
    );

    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('spawnWorker uses node plus monorepo source CLI under packaged runtime markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-worker-'));
    const spawnCalls = [];
    const sourceCli = path.join(tmpDir, 'vendor', 'get-anything-done', 'bin', 'gad.cjs');
    const installedGad = 'C:\\Users\\benja\\AppData\\Local\\Programs\\gad\\bin\\gad.exe';
    fs.mkdirSync(path.dirname(sourceCli), { recursive: true });
    fs.writeFileSync(sourceCli, '#!/usr/bin/env node\n');

    process.env.GAD_PACKAGED_EXECUTABLE = installedGad;
    setExecPath('C:\\bun\\bin\\bun.exe');

    childProcess.spawn = (command, args, options) => {
      spawnCalls.push({ command, args, options });
      return { pid: 12345, unref() {} };
    };

    const { spawnWorker } = require('../lib/team/spawn.cjs');
    const pid = spawnWorker(tmpDir, 'w1', installedGad);

    assert.strictEqual(pid, 12345);
    assert.strictEqual(spawnCalls.length, 1);
    assert.strictEqual(spawnCalls[0].command, 'node');
    assert.deepStrictEqual(spawnCalls[0].args, [sourceCli, 'team', 'work', '--worker-id', 'w1']);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dispatcher start uses node under packaged runtime markers', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-node-exec-dispatcher-'));
    const spawnCalls = [];
    const sourceCli = path.join(tmpDir, 'vendor', 'get-anything-done', 'bin', 'gad.cjs');

    fs.mkdirSync(path.join(tmpDir, '.planning', 'team'), { recursive: true });
    fs.mkdirSync(path.dirname(sourceCli), { recursive: true });
    fs.writeFileSync(sourceCli, '#!/usr/bin/env node\n');
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
    assert.strictEqual(spawnCalls[0].args[0], sourceCli);
    assert.deepStrictEqual(
      spawnCalls[0].args.slice(-3),
      ['team', 'dispatcher', 'run'],
    );

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
