#!/usr/bin/env node
// scripts/git-hooks/test-pre-push.mjs
//
// Synthesizes throwaway git repos, drives the pre-push hook against each,
// and asserts the expected pass/fail outcome.
//
// Run: `node scripts/git-hooks/test-pre-push.mjs`
//
// Each test:
//   1. Creates a temp dir.
//   2. `git init` and `git init --bare` for a fake remote.
//   3. Stages a scenario-specific tree, commits.
//   4. Pipes a synthesized pre-push stdin line into the hook.
//   5. Asserts exit code matches expectation, and stderr mentions the
//      expected kind ('oversized-blob', 'banned-path', 'secret',
//      'submodule-rot').
//
// No external deps — only node + git on PATH.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Drive the Node implementation directly (skip the POSIX-sh dispatcher).
// The dispatcher only resolves which `node` to invoke; the .cjs is the
// source of truth and is what we want to exercise in tests.
const HOOK = resolve(__dirname, 'pre-push.cjs');

const ZERO = '0000000000000000000000000000000000000000';
let failed = 0;
let passed = 0;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts });
  if (opts.expectFail) return r;
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}): ${r.stderr || r.stdout}`);
  }
  return r;
}

function setupRepo(scenarioName) {
  const root = mkdtempSync(join(tmpdir(), `prepush-${scenarioName}-`));
  const remoteDir = join(root, 'remote.git');
  const workDir = join(root, 'work');
  mkdirSync(remoteDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });
  sh('git', ['init', '--bare', '--initial-branch=main', remoteDir]);
  sh('git', ['init', '--initial-branch=main', workDir]);
  sh('git', ['config', 'user.email', 'test@example.com'], { cwd: workDir });
  sh('git', ['config', 'user.name', 'Test'], { cwd: workDir });
  sh('git', ['remote', 'add', 'origin', remoteDir], { cwd: workDir });

  // Seed one commit + push so we have a baseline.
  writeFileSync(join(workDir, 'README.md'), '# test\n');
  sh('git', ['add', 'README.md'], { cwd: workDir });
  sh('git', ['commit', '-m', 'init'], { cwd: workDir });
  sh('git', ['push', '-u', 'origin', 'main'], { cwd: workDir });

  return { root, remoteDir, workDir };
}

function runHook(workDir, opts = {}) {
  const head = sh('git', ['rev-parse', 'HEAD'], { cwd: workDir }).stdout.trim();
  const remoteHead = opts.remoteHead || sh('git', ['rev-parse', 'origin/main'], { cwd: workDir }).stdout.trim();
  const stdin = `refs/heads/main ${head} refs/heads/main ${remoteHead}\n`;
  // Locate node.exe on Windows where /usr/bin/env node may fail in bash.
  const nodeExe = process.execPath;
  const r = spawnSync(nodeExe, [HOOK, 'origin', 'file://' + opts.remoteDir], {
    input: stdin,
    encoding: 'utf8',
    cwd: workDir,
    env: { ...process.env, REPO_HYGIENE_SKIP_SECRETS: opts.skipSecrets ? '1' : '0' },
  });
  return { code: r.status, stderr: r.stderr || '', stdout: r.stdout || '' };
}

function assert(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    if (detail) console.log(`        ${detail}`);
  }
}

// ---------------------------------------------------------------------------
// Test 1: clean push → exit 0.
// ---------------------------------------------------------------------------
function testCleanPush() {
  console.log('\n[test] clean push → expect exit 0');
  const { root, remoteDir, workDir } = setupRepo('clean');
  try {
    writeFileSync(join(workDir, 'a.txt'), 'hello\n');
    sh('git', ['add', 'a.txt'], { cwd: workDir });
    sh('git', ['commit', '-m', 'add a.txt'], { cwd: workDir });
    const { code, stderr } = runHook(workDir, { remoteDir, skipSecrets: true });
    assert('clean push exits 0', code === 0, `stderr=${stderr}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 2: big blob → exit 1 with oversized-blob.
// ---------------------------------------------------------------------------
function testBigBlob() {
  console.log('\n[test] >50MB blob → expect exit 1 with oversized-blob');
  const { root, remoteDir, workDir } = setupRepo('big');
  try {
    // 51 MB of zero bytes — git compresses this VERY well, but the blob
    // (uncompressed) size is what we check, so this should trip the limit.
    const big = Buffer.alloc(51 * 1024 * 1024, 0x41); // 'A' bytes
    writeFileSync(join(workDir, 'big.bin'), big);
    sh('git', ['add', 'big.bin'], { cwd: workDir });
    sh('git', ['commit', '-m', 'add big'], { cwd: workDir });
    const { code, stderr } = runHook(workDir, { remoteDir, skipSecrets: true });
    assert('big blob exits 1', code === 1);
    assert('big blob mentions oversized-blob', /oversized-blob/.test(stderr), stderr.slice(0, 400));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 3: banned path → exit 1 with banned-path.
// ---------------------------------------------------------------------------
function testBannedPath() {
  console.log('\n[test] .planning/datasets/ path → expect exit 1 with banned-path');
  const { root, remoteDir, workDir } = setupRepo('banned');
  try {
    mkdirSync(join(workDir, '.planning', 'datasets'), { recursive: true });
    writeFileSync(join(workDir, '.planning', 'datasets', 'x.jsonl'), '{"a":1}\n');
    sh('git', ['add', '.planning/datasets/x.jsonl'], { cwd: workDir });
    sh('git', ['commit', '-m', 'add dataset'], { cwd: workDir });
    const { code, stderr } = runHook(workDir, { remoteDir, skipSecrets: true });
    assert('banned path exits 1', code === 1);
    assert('banned path mentions banned-path', /banned-path/.test(stderr), stderr.slice(0, 400));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 4: secret regex hit → exit 1 with secret.
// ---------------------------------------------------------------------------
function testSecret() {
  console.log('\n[test] file containing fake Stripe key → expect exit 1 with secret');
  const { root, remoteDir, workDir } = setupRepo('secret');
  try {
    // Composed at runtime so this source file itself doesn't trip scanners.
    const fakeKey = 'sk' + '_live_' + 'A'.repeat(32);
    writeFileSync(join(workDir, 'leak.txt'), `key = ${fakeKey}\n`);
    sh('git', ['add', 'leak.txt'], { cwd: workDir });
    sh('git', ['commit', '-m', 'leaked key'], { cwd: workDir });
    const { code, stderr } = runHook(workDir, { remoteDir, skipSecrets: false });
    assert('secret exits 1', code === 1);
    assert('secret mentions secret', /secret/.test(stderr), stderr.slice(0, 400));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 5: submodule ahead of upstream → exit 1 with submodule-rot.
// ---------------------------------------------------------------------------
function testSubmoduleRot() {
  console.log('\n[test] submodule ahead of upstream → expect exit 1 with submodule-rot');
  const { root, remoteDir, workDir } = setupRepo('submod');
  try {
    // Create a "submodule" remote + a working clone we'll embed.
    const subRemote = join(root, 'subremote.git');
    const subWork = join(root, 'subwork');
    mkdirSync(subRemote, { recursive: true });
    mkdirSync(subWork, { recursive: true });
    sh('git', ['init', '--bare', '--initial-branch=main', subRemote]);
    sh('git', ['init', '--initial-branch=main', subWork]);
    sh('git', ['config', 'user.email', 'test@example.com'], { cwd: subWork });
    sh('git', ['config', 'user.name', 'Test'], { cwd: subWork });
    sh('git', ['remote', 'add', 'origin', subRemote], { cwd: subWork });
    writeFileSync(join(subWork, 'a.txt'), 'one\n');
    sh('git', ['add', 'a.txt'], { cwd: subWork });
    sh('git', ['commit', '-m', 'one'], { cwd: subWork });
    sh('git', ['push', '-u', 'origin', 'main'], { cwd: subWork });

    // Add as submodule of the outer repo. Use file:// URL so git allows it.
    sh('git', ['-c', 'protocol.file.allow=always', 'submodule', 'add', `file://${subRemote.replace(/\\/g, '/')}`, 'subs/x'], { cwd: workDir });
    sh('git', ['commit', '-m', 'add submod'], { cwd: workDir });

    // Now make the submodule HEAD ahead of its upstream (don't push).
    const innerSub = join(workDir, 'subs', 'x');
    sh('git', ['config', 'user.email', 'test@example.com'], { cwd: innerSub });
    sh('git', ['config', 'user.name', 'Test'], { cwd: innerSub });
    sh('git', ['checkout', 'main'], { cwd: innerSub });
    writeFileSync(join(innerSub, 'b.txt'), 'two\n');
    sh('git', ['add', 'b.txt'], { cwd: innerSub });
    sh('git', ['commit', '-m', 'two (unpushed)'], { cwd: innerSub });

    const { code, stderr } = runHook(workDir, { remoteDir, skipSecrets: true });
    assert('submodule rot exits 1', code === 1);
    assert('submodule rot mentions submodule-rot', /submodule-rot/.test(stderr), stderr.slice(0, 400));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------
const tests = [testCleanPush, testBigBlob, testBannedPath, testSecret, testSubmoduleRot];

console.log(`[test-pre-push] running ${tests.length} scenarios against ${HOOK}`);
for (const t of tests) {
  try {
    t();
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${t.name} — uncaught: ${err.message}`);
  }
}

console.log(`\n[test-pre-push] ${passed} passed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
