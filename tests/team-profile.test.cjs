'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');

const PROFILE_CMD_PATH = require.resolve('../bin/commands/team/profile.cjs');
const SPAWN_PATH = require.resolve('../lib/team/spawn.cjs');

const originalSpawnWorker = require('../lib/team/spawn.cjs').spawnWorker;

function resetModules() {
  delete require.cache[PROFILE_CMD_PATH];
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

function writeProfile(tmpDir, name, profile) {
  const file = path.join(tmpDir, '.planning', 'team', 'profiles', `${name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...profile, name }, null, 2));
}

function readConfig(tmpDir) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'team', 'config.json'), 'utf8'));
}

function readStatus(tmpDir, id) {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'team', 'workers', id, 'status.json'), 'utf8'));
}

describe('team profile load command', () => {
  let tmpDir;
  let spawnCalls;

  beforeEach(() => {
    tmpDir = createTempDir('gad-team-profile-');
    spawnCalls = [];
    require(SPAWN_PATH).spawnWorker = (baseDir, id, gadBinary, options = {}) => {
      spawnCalls.push({ baseDir, id, gadBinary, options });
      return 3000 + spawnCalls.length;
    };
    resetModules();
  });

  afterEach(() => {
    require(SPAWN_PATH).spawnWorker = originalSpawnWorker;
    resetModules();
    cleanup(tmpDir);
  });

  test('load writes config and spawns profile workers', () => {
    writeProfile(tmpDir, 'all-runtimes', {
      description: 'Mixed runtime smoke profile',
      runtime: 'codex-cli',
      workers_spec: [
        { id: 'w1', role: 'executor', lane: 'codex', runtime: 'codex-cli' },
        { id: 'w2', role: 'executor', lane: 'gemini', runtime: 'gemini-cli' },
        { id: 'w3', role: 'executor', lane: 'opencode', runtime: 'opencode', runtime_cmd: 'node scripts/gad-opencode-trial.mjs -- run --format json' },
      ],
      tick_ms: 2000,
      runtime_tick_overrides: { 'gemini-cli': 8000, 'codex-cli': 2000, opencode: 2000 },
      autopause_threshold: 20,
    });

    const { createProfileCommand } = require('../bin/commands/team/profile.cjs');
    const command = createProfileCommand(makeDeps(tmpDir));
    command.subCommands.load.run({ args: { projectid: 'global', name: 'all-runtimes', 'no-spawn': false } });

    const cfg = readConfig(tmpDir);
    assert.equal(cfg.from_profile, 'all-runtimes');
    assert.equal(cfg.workers, 3);
    assert.deepStrictEqual(cfg.workers_spec.map((spec) => spec.runtime), ['codex-cli', 'gemini-cli', 'opencode']);
    assert.deepStrictEqual(spawnCalls.map((call) => call.id), ['w1', 'w2', 'w3']);
    assert.deepStrictEqual(spawnCalls[0].options.cliArgs, ['--projectid', 'global']);

    const opencodeStatus = readStatus(tmpDir, 'w3');
    assert.equal(opencodeStatus.runtime, 'opencode');
    assert.equal(opencodeStatus.runtime_cmd, 'node scripts/gad-opencode-trial.mjs -- run --format json');
    assert.equal(opencodeStatus.state, 'NOT_STARTED');
  });
});
