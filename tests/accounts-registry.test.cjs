'use strict';

const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  runtimeAccountsPath,
  registryPath,
  canonicalPathForProvider,
  captureAccount,
  resolveAccountEntry,
  copyProviderAccountToCanonical,
  loadRuntimeRegistry,
  loadGlobalRegistry,
  setAccountStatus,
  removeAccount,
  markRuntimeActiveAccount,
  loadRuntimeAccountState,
} = require('../lib/team/accounts-registry.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-accounts-registry-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

test('captureAccount migrates into runtime and global registries', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"abc"}', 'utf8');

  const account = captureAccount({
    baseDir,
    provider: 'codex',
    label: 'primary',
    env,
  });

  assert.equal(account.label, 'primary');
  assert.equal(fs.existsSync(runtimeAccountsPath(baseDir)), true);
  assert.equal(fs.existsSync(registryPath(env)), true);

  const runtimeRegistry = loadRuntimeRegistry(baseDir);
  assert.equal(runtimeRegistry['codex-cli'].provider, 'codex');
  assert.equal(runtimeRegistry['codex-cli'].accounts.length, 1);
  assert.equal(runtimeRegistry['codex-cli'].accounts[0].credential_ref.kind, 'file');

  const globalRegistry = loadGlobalRegistry(env);
  assert.equal(globalRegistry.accounts.length, 1);
  assert.equal(globalRegistry.accounts[0].provider, 'codex');
});

test('copyProviderAccountToCanonical restores captured credential and marks runtime active', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"one"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });

  fs.writeFileSync(canonicalPath, '{"token":"two"}', 'utf8');

  const resolved = resolveAccountEntry(baseDir, 'codex', 'primary');
  const restoredPath = copyProviderAccountToCanonical('codex', resolved.account, env);
  markRuntimeActiveAccount(baseDir, resolved.runtime, {
    ...resolved.account,
    provider: 'codex',
    index: 0,
  });

  assert.equal(restoredPath, canonicalPath);
  assert.equal(fs.readFileSync(canonicalPath, 'utf8'), '{"token":"one"}');
  const state = loadRuntimeAccountState(baseDir);
  assert.equal(state['codex-cli'].label, 'primary');
});

test('status updates and removal mutate the provider-aware registry', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"abc"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });

  const paused = setAccountStatus(baseDir, 'codex', 'primary', 'paused');
  assert.equal(paused.status, 'paused');

  const removed = removeAccount(baseDir, 'codex', 'primary', env);
  assert.equal(removed.label, 'primary');
  assert.equal(loadRuntimeRegistry(baseDir)['codex-cli'].accounts.length, 0);
  assert.equal(loadGlobalRegistry(env).accounts.length, 0);
});
