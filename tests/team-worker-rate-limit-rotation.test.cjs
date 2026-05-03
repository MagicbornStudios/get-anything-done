'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { handleRateLimitedHandoff } = require('../lib/team/worker-loop.cjs');
const {
  getActiveRuntimeAccount,
  rotateRuntimeAccount,
  runtimeAccountsPath,
} = require('../lib/team/rate-limit.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-rate-limit-'));
  tempDirs.push(dir);
  return dir;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

test('resolves active account env and rotates to the next configured account', () => {
  const baseDir = makeTempDir();
  const primaryDir = path.join(baseDir, 'accounts', 'codex-primary');
  const secondaryDir = path.join(baseDir, 'accounts', 'codex-secondary');
  fs.mkdirSync(primaryDir, { recursive: true });
  fs.mkdirSync(secondaryDir, { recursive: true });
  fs.writeFileSync(path.join(primaryDir, 'auth.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(secondaryDir, 'auth.json'), '{}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': [
      { label: 'primary', env_file: path.join(primaryDir, 'auth.json') },
      { label: 'secondary', env_file: path.join(secondaryDir, 'auth.json') },
    ],
  });

  const active = getActiveRuntimeAccount(baseDir, 'codex-cli');
  assert.equal(active.label, 'primary');
  assert.equal(active.env.CODEX_HOME, primaryDir);

  const rotated = rotateRuntimeAccount(baseDir, 'codex-cli');
  assert.equal(rotated.label, 'secondary');
  assert.equal(rotated.previous_label, 'primary');
  assert.equal(rotated.env.CODEX_HOME, secondaryDir);
});

test('logs runtime-account-rotated before parking when accounts are exhausted', () => {
  const baseDir = makeTempDir();
  const primaryDir = path.join(baseDir, 'accounts', 'codex-primary');
  const secondaryDir = path.join(baseDir, 'accounts', 'codex-secondary');
  fs.mkdirSync(primaryDir, { recursive: true });
  fs.mkdirSync(secondaryDir, { recursive: true });
  fs.writeFileSync(path.join(primaryDir, 'auth.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(secondaryDir, 'auth.json'), '{}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': [
      { label: 'primary', env_file: path.join(primaryDir, 'auth.json') },
      { label: 'secondary', env_file: path.join(secondaryDir, 'auth.json') },
    ],
  });

  const events = [];
  const handoffsLib = {
    unclaimHandoff() {
      events.push({ kind: 'unclaim-call' });
    },
  };
  const logWrite = (entry) => events.push(entry);
  const work = { ref: 'h-test-87' };

  const first = handleRateLimitedHandoff({
    baseDir,
    runtime: 'codex-cli',
    work,
    handoffsLib,
    workerId: 'w6',
    logWrite,
    attemptedAccountIndexes: [0],
  });
  assert.equal(first.action, 'rotated');
  assert.equal(first.account.label, 'secondary');

  const second = handleRateLimitedHandoff({
    baseDir,
    runtime: 'codex-cli',
    work,
    handoffsLib,
    workerId: 'w6',
    logWrite,
    attemptedAccountIndexes: [0, 1],
  });
  assert.equal(second.action, 'parked');

  const rotatedIdx = events.findIndex((entry) => entry.kind === 'runtime-account-rotated');
  const parkedIdx = events.findIndex((entry) => entry.kind === 'runtime-rate-limited');
  assert.notEqual(rotatedIdx, -1, 'rotation event should be logged');
  assert.notEqual(parkedIdx, -1, 'park event should be logged');
  assert.ok(rotatedIdx < parkedIdx, 'rotation should be logged before parking');
});
