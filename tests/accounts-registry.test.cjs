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
  recordAccountQuotaState,
  removeAccount,
  markRuntimeActiveAccount,
  loadRuntimeAccountState,
} = require('../lib/team/accounts-registry.cjs');
const { rotateRuntimeAccount } = require('../lib/team/rate-limit.cjs');
const { pollOnce } = require('../lib/team/account-poller.cjs');

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

// ---------------------------------------------------------------------------
// 110-06: recordAccountQuotaState — quota state persistence with reset hints
// ---------------------------------------------------------------------------

test('recordAccountQuotaState persists quota state with reset_at on rate-limit', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"abc"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });

  const resetAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
  const updated = recordAccountQuotaState(baseDir, 'codex', 'primary', {
    status: 'rate-limited',
    last_error: 'You have hit your usage limit',
    reset_at: resetAt,
    error_class: 'quota_hard_cap',
    reason_text: 'quota_hard_cap: billing/plan cap',
    cooldown_ms: 4 * 60 * 60 * 1000,
  });

  assert.equal(updated.status, 'rate-limited');
  assert.equal(updated.last_error, 'You have hit your usage limit');
  assert.equal(updated.reset_at, resetAt);
  assert.equal(updated.current_quota.reset_at, resetAt);
  assert.equal(updated.current_quota.error_class, 'quota_hard_cap');
  assert.equal(updated.current_quota.cooldown_ms, 4 * 60 * 60 * 1000);

  // Re-load from disk to confirm persistence.
  const registry = loadRuntimeRegistry(baseDir);
  const stored = registry['codex-cli'].accounts.find((a) => a.label === 'primary');
  assert.equal(stored.status, 'rate-limited');
  assert.equal(stored.reset_at, resetAt);
  assert.equal(stored.current_quota.reset_at, resetAt);
});

test('recordAccountQuotaState returns null for unknown provider/label (silent no-op)', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"abc"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });

  assert.equal(
    recordAccountQuotaState(baseDir, 'codex', 'nonexistent-label', { reset_at: 'x' }),
    null,
  );
  assert.equal(
    recordAccountQuotaState(baseDir, 'unknown-provider', 'primary', { reset_at: 'x' }),
    null,
  );
  // No-op should not crash on empty observation either.
  assert.equal(
    recordAccountQuotaState(baseDir, '', '', {}),
    null,
  );
});

test('account-poller auto-flips rate-limited → active after reset_at passes', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  fs.writeFileSync(canonicalPath, '{"token":"abc"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });

  // Mark rate-limited with a reset_at already in the past.
  const pastResetAt = new Date(Date.now() - 60 * 1000).toISOString();
  recordAccountQuotaState(baseDir, 'codex', 'primary', {
    status: 'rate-limited',
    last_error: 'transient cap',
    reset_at: pastResetAt,
    error_class: 'quota_soft',
  });

  const before = loadRuntimeRegistry(baseDir)['codex-cli'].accounts[0];
  assert.equal(before.status, 'rate-limited');

  const passResult = pollOnce({ projectRoot: baseDir });
  assert.ok(passResult.updated >= 1, 'expected at least one account to flip');

  const after = loadRuntimeRegistry(baseDir)['codex-cli'].accounts[0];
  assert.equal(after.status, 'active');
  assert.equal(after.last_error, null);
});

// ---------------------------------------------------------------------------
// 110-10: end-to-end add → rotate → pause → resume → remove flow
// ---------------------------------------------------------------------------

test('e2e: add → rotate → pause → resume → remove per provider', () => {
  const baseDir = makeTempDir();
  const homeDir = path.join(baseDir, 'home');
  const env = { ...process.env, HOME: homeDir, USERPROFILE: homeDir };
  const canonicalPath = canonicalPathForProvider('codex', env);
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });

  // --- add: two accounts under codex ---
  fs.writeFileSync(canonicalPath, '{"token":"primary"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'primary', env });
  fs.writeFileSync(canonicalPath, '{"token":"secondary"}', 'utf8');
  captureAccount({ baseDir, provider: 'codex', label: 'secondary', env });

  const after_add = loadRuntimeRegistry(baseDir)['codex-cli'].accounts;
  assert.equal(after_add.length, 2);
  assert.equal(after_add[0].status, 'active');
  assert.equal(after_add[1].status, 'active');

  // --- rotate: should advance to the next usable account ---
  const rotated = rotateRuntimeAccount(baseDir, 'codex-cli', [], env);
  assert.ok(rotated, 'expected rotation to return a new account');
  assert.notEqual(rotated.label, rotated.previous_label);
  const stateAfterRotate = loadRuntimeAccountState(baseDir);
  assert.equal(stateAfterRotate['codex-cli'].label, rotated.label);

  // --- pause: secondary goes to paused ---
  const paused = setAccountStatus(baseDir, 'codex', 'secondary', 'paused');
  assert.equal(paused.status, 'paused');

  // After pause, rotateRuntimeAccount should not pick the paused account.
  // (we already rotated once; rotate again — only 'primary' is usable now).
  const rotateAfterPause = rotateRuntimeAccount(baseDir, 'codex-cli', [], env);
  // Either rotation cycled to primary, or returned null if we were already on
  // primary. Either way the active account must be 'primary' or null.
  if (rotateAfterPause) {
    assert.equal(rotateAfterPause.label, 'primary');
    assert.equal(rotateAfterPause.status, 'active');
  }

  // --- resume: secondary back to active ---
  const resumed = setAccountStatus(baseDir, 'codex', 'secondary', 'active');
  assert.equal(resumed.status, 'active');

  // --- quota state: mark primary rate-limited, then poller restores it ---
  const past = new Date(Date.now() - 1000).toISOString();
  recordAccountQuotaState(baseDir, 'codex', 'primary', {
    status: 'rate-limited',
    reset_at: past,
    error_class: 'quota_soft',
    reason_text: 'transient',
  });
  const beforePoll = loadRuntimeRegistry(baseDir)['codex-cli'].accounts
    .find((a) => a.label === 'primary');
  assert.equal(beforePoll.status, 'rate-limited');

  pollOnce({ projectRoot: baseDir });

  const afterPoll = loadRuntimeRegistry(baseDir)['codex-cli'].accounts
    .find((a) => a.label === 'primary');
  assert.equal(afterPoll.status, 'active');

  // --- remove: secondary disappears from both registries ---
  removeAccount(baseDir, 'codex', 'secondary', env);
  const afterRemove = loadRuntimeRegistry(baseDir)['codex-cli'].accounts;
  assert.equal(afterRemove.length, 1);
  assert.equal(afterRemove[0].label, 'primary');
  assert.equal(loadGlobalRegistry(env).accounts.length, 1);
});
