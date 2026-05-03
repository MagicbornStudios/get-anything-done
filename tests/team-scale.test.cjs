'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');

const SCALE_CMD_PATH = require.resolve('../bin/commands/team/scale.cjs');
const SPAWN_PATH = require.resolve('../lib/team/spawn.cjs');

const originalSpawnWorker = require('../lib/team/spawn.cjs').spawnWorker;

function resetModules() {
  delete require.cache[SCALE_CMD_PATH];
}

function makeDeps(tmpDir) {
  return {
    findRepoRoot: () => tmpDir,
    gadConfig: { load: () => ({ roots: [{ id: 'global', path: '.' }] }) },
    resolveRoots: () => [{ id: 'global', path: '.' }],
    getLastActiveProjectid: () => null,
    outputError: (message) => {
      throw new Error(message);
    },
  };
}

function teamConfig(workersSpec, runtime = 'claude-code') {
  return {
    workers: workersSpec.length,
    roles: workersSpec.map((spec) => spec.role || 'executor'),
    workers_spec: workersSpec,
    runtime,
    runtime_cmd: null,
    autopause_threshold: 20,
    tick_ms: 2000,
    created_at: '2026-05-02T00:00:00.000Z',
    supervisor_pid: 1,
  };
}

function writeTeamConfig(tmpDir, cfg) {
  const file = path.join(tmpDir, '.planning', 'team', 'config.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
}

function writeWorkerState(tmpDir, id, state = 'IDLE') {
  const dir = path.join(tmpDir, '.planning', 'team', 'workers', id);
  fs.mkdirSync(path.join(dir, 'mailbox'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({
    id,
    role: 'executor',
    lane: null,
    runtime: 'claude-code',
    runtime_cmd: 'claude -p',
    pid: null,
    started_at: null,
    last_heartbeat: null,
    current_ref: null,
    state,
  }, null, 2));
}

function readConfig(tmpDir) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'team', 'config.json'), 'utf8'));
}

function captureConsole(fn) {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = originalLog;
    })
    .then(() => logs.join('\n'));
}

describe('team scale command', () => {
  let tmpDir;
  let spawnCalls;

  beforeEach(() => {
    tmpDir = createTempDir('gad-team-scale-');
    spawnCalls = [];
    require(SPAWN_PATH).spawnWorker = (baseDir, id, gadBinary) => {
      spawnCalls.push({ baseDir, id, gadBinary });
      return 2000 + spawnCalls.length;
    };
    resetModules();
  });

  afterEach(() => {
    require(SPAWN_PATH).spawnWorker = originalSpawnWorker;
    resetModules();
    cleanup(tmpDir);
  });

  test('scale up by 2 rewrites config from 3 to 5 workers', async () => {
    writeTeamConfig(tmpDir, teamConfig([
      { id: 'w1', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w2', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w3', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
    ]));
    const { createScaleCommand } = require('../bin/commands/team/scale.cjs');
    const command = createScaleCommand(makeDeps(tmpDir));

    const output = await captureConsole(() => command.run({ args: { projectid: 'global', add: '2', remove: '', to: '', runtime: 'gemini-cli', 'wait-ms': '0' } }));
    const cfg = readConfig(tmpDir);

    assert.strictEqual(cfg.workers, 5);
    assert.deepStrictEqual(cfg.workers_spec.map((spec) => spec.id), ['w1', 'w2', 'w3', 'w4', 'w5']);
    assert.strictEqual(cfg.workers_spec[3].runtime, 'gemini-cli');
    assert.strictEqual(cfg.workers_spec[4].runtime, 'gemini-cli');
    assert.deepStrictEqual(spawnCalls.map((call) => call.id), ['w4', 'w5']);
    assert.match(output, /Team scaled: 5 workers/);
  });

  test('scale down by removing w4 writes stop flag and removes active state', async () => {
    writeTeamConfig(tmpDir, teamConfig([
      { id: 'w1', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w2', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w3', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w4', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w5', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
    ]));
    writeWorkerState(tmpDir, 'w4', 'WORKING');

    const { createScaleCommand } = require('../bin/commands/team/scale.cjs');
    const command = createScaleCommand(makeDeps(tmpDir));

    await captureConsole(() => command.run({ args: { projectid: 'global', add: '', remove: 'w4', to: '', runtime: '', 'wait-ms': '0' } }));
    const cfg = readConfig(tmpDir);

    assert.strictEqual(cfg.workers, 4);
    assert.deepStrictEqual(cfg.workers_spec.map((spec) => spec.id), ['w1', 'w2', 'w3', 'w5']);
    assert.ok(fs.existsSync(path.join(tmpDir, '.planning', 'team', 'workers', 'w4', 'stop.flag')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'team', 'workers', 'w4', 'status.json')));
    assert.ok(!fs.existsSync(path.join(tmpDir, '.planning', 'team', 'workers', 'w4', 'mailbox')));
  });

  test('scale to 6 uses runtime override for newly added workers', async () => {
    writeTeamConfig(tmpDir, teamConfig([
      { id: 'w1', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w2', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w3', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
      { id: 'w4', role: 'executor', lane: null, runtime: 'claude-code', runtime_cmd: null },
    ]));

    const { createScaleCommand } = require('../bin/commands/team/scale.cjs');
    const command = createScaleCommand(makeDeps(tmpDir));

    await captureConsole(() => command.run({ args: { projectid: 'global', add: '', remove: '', to: '6', runtime: 'cursor-cli', 'wait-ms': '0' } }));
    const cfg = readConfig(tmpDir);

    assert.strictEqual(cfg.workers, 6);
    assert.deepStrictEqual(cfg.workers_spec.slice(-2).map((spec) => spec.id), ['w5', 'w6']);
    assert.deepStrictEqual(cfg.workers_spec.slice(-2).map((spec) => spec.runtime), ['cursor-cli', 'cursor-cli']);
    assert.deepStrictEqual(spawnCalls.map((call) => call.id), ['w5', 'w6']);
  });
});
