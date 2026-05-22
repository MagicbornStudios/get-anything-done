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
  cooldownPath,
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
  const primaryFile = path.join(baseDir, 'accounts', 'codex-primary.json');
  const secondaryFile = path.join(baseDir, 'accounts', 'codex-secondary.json');
  fs.mkdirSync(path.dirname(primaryFile), { recursive: true });
  fs.writeFileSync(primaryFile, '{}', 'utf8');
  fs.writeFileSync(secondaryFile, '{}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': {
      provider: 'codex',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: primaryFile, canonical_filename: 'auth.json' }, status: 'active' },
        { label: 'secondary', type: 'oauth-file', credential_ref: { kind: 'file', path: secondaryFile, canonical_filename: 'auth.json' }, status: 'active' },
      ],
    },
  });

  const active = getActiveRuntimeAccount(baseDir, 'codex-cli', process.env, { workerId: 'w1' });
  assert.equal(active.label, 'primary');
  assert.equal(path.basename(active.env.HOME), 'primary');
  assert.equal(path.basename(active.env.CODEX_HOME), '.codex');
  assert.equal(fs.existsSync(path.join(active.env.CODEX_HOME, 'auth.json')), true);

  const rotated = rotateRuntimeAccount(baseDir, 'codex-cli', process.env, { workerId: 'w1' });
  assert.equal(rotated.label, 'secondary');
  assert.equal(rotated.previous_label, 'primary');
  assert.equal(path.basename(rotated.env.HOME), 'secondary');
  assert.equal(path.basename(rotated.env.CODEX_HOME), '.codex');
  assert.equal(fs.existsSync(path.join(rotated.env.CODEX_HOME, 'auth.json')), true);
});

test('logs runtime-account-rotated before requeue when accounts are exhausted', () => {
  const baseDir = makeTempDir();
  const primaryFile = path.join(baseDir, 'accounts', 'codex-primary.json');
  const secondaryFile = path.join(baseDir, 'accounts', 'codex-secondary.json');
  fs.mkdirSync(path.dirname(primaryFile), { recursive: true });
  fs.writeFileSync(primaryFile, '{}', 'utf8');
  fs.writeFileSync(secondaryFile, '{}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': {
      provider: 'codex',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: primaryFile, canonical_filename: 'auth.json' }, status: 'active' },
        { label: 'secondary', type: 'oauth-file', credential_ref: { kind: 'file', path: secondaryFile, canonical_filename: 'auth.json' }, status: 'active' },
      ],
    },
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
  assert.equal(second.action, 'requeued');

  const rotatedIdx = events.findIndex((entry) => entry.kind === 'runtime-account-rotated');
  const requeuedIdx = events.findIndex((entry) => entry.kind === 'runtime-rate-limit-on-call');
  assert.notEqual(rotatedIdx, -1, 'rotation event should be logged');
  assert.notEqual(requeuedIdx, -1, 'rate-limit event should be logged');
  assert.ok(rotatedIdx < requeuedIdx, 'rotation should be logged before requeue');
  assert.equal(fs.existsSync(cooldownPath(baseDir)), false, 'just-try-it should not write cooldown state');
});

test('stages distinct CODEX_HOME directories for concurrent workers', () => {
  const baseDir = makeTempDir();
  const primaryFile = path.join(baseDir, 'accounts', 'codex-primary.json');
  const secondaryFile = path.join(baseDir, 'accounts', 'codex-secondary.json');
  fs.mkdirSync(path.dirname(primaryFile), { recursive: true });
  fs.writeFileSync(primaryFile, '{"token":"primary"}', 'utf8');
  fs.writeFileSync(secondaryFile, '{"token":"secondary"}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': {
      provider: 'codex',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: primaryFile, canonical_filename: 'auth.json' }, status: 'active' },
        { label: 'secondary', type: 'oauth-file', credential_ref: { kind: 'file', path: secondaryFile, canonical_filename: 'auth.json' }, status: 'active' },
      ],
    },
  });

  const activeW1 = getActiveRuntimeAccount(baseDir, 'codex-cli', process.env, { workerId: 'w1' });
  const rotatedW2 = rotateRuntimeAccount(baseDir, 'codex-cli', process.env, { workerId: 'w2' });

  assert.notEqual(activeW1.env.CODEX_HOME, rotatedW2.env.CODEX_HOME);
  assert.equal(
    fs.readFileSync(path.join(activeW1.env.CODEX_HOME, 'auth.json'), 'utf8'),
    '{"token":"primary"}',
  );
  assert.equal(
    fs.readFileSync(path.join(rotatedW2.env.CODEX_HOME, 'auth.json'), 'utf8'),
    '{"token":"secondary"}',
  );
});

test('account staging does not overwrite the canonical codex auth file', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalAuthDir = path.join(homeDir, '.codex');
  const canonicalAuthPath = path.join(canonicalAuthDir, 'auth.json');
  const primaryFile = path.join(baseDir, 'accounts', 'codex-primary.json');
  const secondaryFile = path.join(baseDir, 'accounts', 'codex-secondary.json');
  fs.mkdirSync(canonicalAuthDir, { recursive: true });
  fs.mkdirSync(path.dirname(primaryFile), { recursive: true });
  fs.writeFileSync(canonicalAuthPath, '{"token":"canonical"}', 'utf8');
  fs.writeFileSync(primaryFile, '{"token":"primary"}', 'utf8');
  fs.writeFileSync(secondaryFile, '{"token":"secondary"}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'codex-cli': {
      provider: 'codex',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: primaryFile, canonical_filename: 'auth.json' }, status: 'active' },
        { label: 'secondary', type: 'oauth-file', credential_ref: { kind: 'file', path: secondaryFile, canonical_filename: 'auth.json' }, status: 'active' },
      ],
    },
  });

  const active = getActiveRuntimeAccount(baseDir, 'codex-cli', env, { workerId: 'w1' });
  const rotated = rotateRuntimeAccount(baseDir, 'codex-cli', env, { workerId: 'w1' });

  assert.equal(fs.readFileSync(canonicalAuthPath, 'utf8'), '{"token":"canonical"}');
  assert.equal(fs.readFileSync(path.join(active.env.CODEX_HOME, 'auth.json'), 'utf8'), '{"token":"primary"}');
  assert.equal(fs.readFileSync(path.join(rotated.env.CODEX_HOME, 'auth.json'), 'utf8'), '{"token":"secondary"}');
});

test('gemini and opencode accounts stage isolated profile directories', () => {
  const baseDir = makeTempDir();
  const geminiFile = path.join(baseDir, 'accounts', 'gemini-primary.json');
  const opencodeFile = path.join(baseDir, 'accounts', 'opencode-primary.json');
  fs.mkdirSync(path.dirname(geminiFile), { recursive: true });
  fs.writeFileSync(geminiFile, '{"token":"gemini"}', 'utf8');
  fs.writeFileSync(opencodeFile, '{"token":"opencode"}', 'utf8');
  writeJson(runtimeAccountsPath(baseDir), {
    'gemini-cli': {
      provider: 'gemini',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: geminiFile, canonical_filename: 'oauth_creds.json' }, status: 'active' },
      ],
    },
    opencode: {
      provider: 'opencode',
      accounts: [
        { label: 'primary', type: 'oauth-file', credential_ref: { kind: 'file', path: opencodeFile, canonical_filename: 'auth.json' }, status: 'active' },
      ],
    },
  });

  const gemini = getActiveRuntimeAccount(baseDir, 'gemini-cli', process.env, { workerId: 'w7' });
  assert.equal(path.basename(gemini.env.HOME), 'primary');
  assert.equal(path.basename(gemini.env.GEMINI_CONFIG_DIR), '.gemini');
  assert.equal(path.basename(gemini.env.XDG_CONFIG_HOME), '.config');
  assert.equal(
    fs.readFileSync(path.join(gemini.env.GEMINI_CONFIG_DIR, 'oauth_creds.json'), 'utf8'),
    '{"token":"gemini"}',
  );

  const opencode = getActiveRuntimeAccount(baseDir, 'opencode', process.env, { workerId: 'w8' });
  assert.equal(path.basename(opencode.env.HOME), 'primary');
  assert.equal(path.basename(opencode.env.XDG_CONFIG_HOME), '.config');
  assert.equal(path.basename(opencode.env.XDG_DATA_HOME), 'share');
  assert.equal(path.basename(opencode.env.OPENCODE_HOME), 'opencode');
  assert.equal(path.basename(opencode.env.OPENCODE_CONFIG_DIR), 'opencode');
  assert.equal(
    fs.readFileSync(path.join(opencode.env.OPENCODE_HOME, 'auth.json'), 'utf8'),
    '{"token":"opencode"}',
  );
});
