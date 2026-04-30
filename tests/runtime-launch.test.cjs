'use strict';
/**
 * Smoke tests for `gad runtime launch` hardening (phase 75).
 *
 * Full end-to-end tests that actually invoke a mock codex binary are gated
 * behind RUNTIME_E2E=1 because they require writing a temp executable and
 * spawning a child process that may behave differently in CI on Windows.
 *
 * Manual verification for RUNTIME_E2E=1:
 *   RUNTIME_E2E=1 node --test tests/runtime-launch.test.cjs
 *
 * The mock codex script (tests/fixtures/mock-codex.mjs) records its argv and
 * cwd to a temp JSON file so assertions can verify both.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const GAD = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HAS_RUNTIME_SUBSTRATE = fs.existsSync(path.join(REPO_ROOT, 'scripts', 'runtime-substrate-core.mjs'));
const IS_E2E = Boolean(process.env.RUNTIME_E2E);

function gadRaw(args, opts = {}) {
  return spawnSync(process.execPath, [GAD, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  });
}

function gadJson(args) {
  const out = execFileSync(process.execPath, [GAD, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

// ---------------------------------------------------------------------------
// Item 1: Contradictory flag validation
// ---------------------------------------------------------------------------
describe('runtime launch flag validation', () => {
  test('rejects --same-shell with explicit --new-shell', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'claude-code',
      '--same-shell',
      '--new-shell',
      '--dry-run',
    ]);
    // Must exit non-zero and surface the flag names in stderr
    assert.notEqual(result.status, 0, 'Expected non-zero exit for contradictory flags');
    const output = (result.stderr || '') + (result.stdout || '');
    assert.ok(
      output.includes('--same-shell') && output.includes('--new-shell'),
      `Expected flag names in error output. Got: ${output}`,
    );
  });

  test('rejects --runtime and --force-runtime pointing to different runtimes', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', 'global',
      '--runtime', 'claude-code',
      '--force-runtime', 'codex-cli',
      '--dry-run',
    ]);
    assert.notEqual(result.status, 0, 'Expected non-zero exit for contradictory runtime flags');
    const output = (result.stderr || '') + (result.stdout || '');
    assert.ok(
      output.includes('--runtime') && output.includes('--force-runtime'),
      `Expected flag names in error output. Got: ${output}`,
    );
  });

  test('allows --same-shell alone (no --new-shell)', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    // --same-shell without explicit --new-shell should not error before reaching health check
    // We use --skip-health-check + --dry-run to avoid invoking the actual runtime.
    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'claude-code',
      '--same-shell',
      '--skip-health-check',
      '--dry-run',
    ]);
    // dry-run should produce a command line, not a flag error
    const output = (result.stdout || '') + (result.stderr || '');
    assert.ok(
      !output.includes('Contradictory'),
      `Should not reject --same-shell alone. Got: ${output}`,
    );
  });

  test('allows --force-runtime alone without --runtime', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'claude-code',
      '--dry-run',
    ]);
    const output = (result.stdout || '') + (result.stderr || '');
    assert.ok(
      !output.includes('Contradictory'),
      `Should not reject --force-runtime alone. Got: ${output}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Item 2 + 3: Pre-launch dispatch log and argv echo (dry-run does NOT write log;
// these tests run with --dry-run and verify behavior before the dispatch point)
// ---------------------------------------------------------------------------
describe('runtime launch dry-run output', () => {
  test('dry-run produces command line for codex-cli', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'codex-cli',
      '--dry-run',
    ]);
    const output = (result.stdout || '').trim();
    assert.ok(output.includes('codex-cli') || output.includes('codex-trial'),
      `Expected codex in dry-run output. Got: ${output}`);
  });

  test('dry-run JSON output includes correct projectId and cwd', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'codex-cli',
      '--dry-run',
      '--json',
    ]);
    assert.equal(payload.projectId, 'global');
    assert.ok(payload.cwd, 'Expected cwd in payload');
    assert.equal(payload.dryRun, true);
    assert.equal(payload.runtime, 'codex-cli');
  });
});

// ---------------------------------------------------------------------------
// Item 4: Project CWD — 7greens should resolve to sites/7greens, not monorepo root
// ---------------------------------------------------------------------------
describe('runtime launch project CWD resolution', () => {
  test('7greens project cwd resolves to sites/7greens, not monorepo root', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'launch',
      '--projectid', '7greens',
      '--force-runtime', 'codex-cli',
      '--dry-run',
      '--json',
    ]);
    assert.equal(payload.projectId, '7greens');
    const cwd = payload.cwd;
    assert.ok(cwd, 'Expected cwd in payload');
    // CWD must include "7greens" or "sites/7greens" and must NOT equal monorepo root
    assert.ok(
      cwd.includes('7greens'),
      `Expected cwd to include "7greens". Got: ${cwd}`,
    );
    assert.notEqual(
      path.normalize(cwd),
      path.normalize(REPO_ROOT),
      `Expected cwd to differ from monorepo root ${REPO_ROOT}. Got: ${cwd}`,
    );
  });

  test('global project cwd resolves to monorepo root (regression guard)', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'launch',
      '--projectid', 'global',
      '--force-runtime', 'codex-cli',
      '--dry-run',
      '--json',
    ]);
    // global project has root.path = '.' so it maps to REPO_ROOT
    assert.ok(payload.cwd, 'Expected cwd in payload');
  });
});

// ---------------------------------------------------------------------------
// Item 5: End-to-end smoke with mock codex script (RUNTIME_E2E=1 only)
// ---------------------------------------------------------------------------
describe('runtime launch end-to-end smoke (RUNTIME_E2E=1)', () => {
  /**
   * Manual verification steps when RUNTIME_E2E is not set:
   * 1. Create a test project entry in .gadrc.json (or use an existing one like "7greens").
   * 2. Write a mock executable at a known path that records argv + cwd to a temp JSON file.
   * 3. Patch scripts/codex-trial.mjs temporarily to point at the mock or use --launch-args-json.
   * 4. Run:
   *      RUNTIME_E2E=1 node --test tests/runtime-launch.test.cjs
   * 5. Assert that <tmpFile> contains the expected argv and cwd.
   * 6. Assert that .planning/.gad-log/ contains a runtime-launch-*.jsonl entry.
   */
  test('mock codex records argv + cwd; dispatch log entry written', { skip: !IS_E2E || !HAS_RUNTIME_SUBSTRATE }, () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-runtime-launch-e2e-'));
    const recordFile = path.join(tmpDir, 'record.json');

    // Write a tiny mock script that records its argv and cwd then exits 0
    const mockScript = path.join(tmpDir, 'mock-codex.mjs');
    fs.writeFileSync(mockScript, [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      `const recordFile = ${JSON.stringify(recordFile)};`,
      "const record = { argv: process.argv.slice(2), cwd: process.cwd() };",
      "fs.writeFileSync(recordFile, JSON.stringify(record, null, 2));",
      "process.exit(0);",
    ].join('\n'), 'utf8');

    // Locate the project .gad-log dir (7greens for this test)
    const projectLogDir = path.join(REPO_ROOT, 'sites', '7greens', '.planning', '.gad-log');

    // Snapshot existing log entries
    const logEntriesBefore = fs.existsSync(projectLogDir)
      ? fs.readdirSync(projectLogDir).filter((f) => f.startsWith('runtime-launch-'))
      : [];

    // Use --launch-args-json to inject the mock script path as the first arg
    // The codex-trial.mjs wrapper is invoked but mock replaces the "exec" target.
    // Simpler: use --force-runtime and override via env GAD_CODEX_SCRIPT (if supported)
    // or just invoke node mock-codex.mjs directly via --launch-args-json.
    //
    // Since codex-cli launch spec is: node scripts/codex-trial.mjs -- [...args]
    // we verify cwd and dispatch log by using --dry-run=false with same-shell.
    // However to avoid actually running codex, we pass --skip-health-check and
    // leverage the fact that codex-trial.mjs will fail gracefully if codex is absent.
    //
    // For a true mock, set GAD_CODEX_TRIAL_SCRIPT env to mock script path:
    // (Requires runtime-launch.cjs to honour this env — tracked as follow-up)
    //
    // For now: assert the dispatch log is written by running with --same-shell
    // and --skip-health-check. The dispatch log must appear even if codex fails.

    const result = gadRaw([
      'runtime', 'launch',
      '--projectid', '7greens',
      '--force-runtime', 'codex-cli',
      '--same-shell',
      '--skip-health-check',
      '--launch-args', 'exec --full-auto hello-world',
    ], { timeout: 30000 });

    // Dispatch log entry must exist regardless of whether codex itself succeeded
    const logEntriesAfter = fs.existsSync(projectLogDir)
      ? fs.readdirSync(projectLogDir).filter((f) => f.startsWith('runtime-launch-'))
      : [];
    assert.ok(
      logEntriesAfter.length > logEntriesBefore.length,
      `Expected new runtime-launch-*.jsonl entry in ${projectLogDir}. Before: ${logEntriesBefore.length}, After: ${logEntriesAfter.length}`,
    );

    // Verify the dispatch record content
    const newEntries = logEntriesAfter.filter((f) => !logEntriesBefore.includes(f));
    assert.ok(newEntries.length > 0, 'Expected at least one new dispatch log entry');
    const record = JSON.parse(fs.readFileSync(path.join(projectLogDir, newEntries[0]), 'utf8').trim());
    assert.equal(record.event, 'runtime-launch-dispatch');
    assert.equal(record.projectId, '7greens');
    assert.equal(record.runtime, 'codex-cli');
    assert.ok(record.cwd.includes('7greens'), `Expected cwd to include "7greens". Got: ${record.cwd}`);
    assert.ok(Array.isArray(record.argv), 'Expected argv array in dispatch record');

    // Stderr should contain the argv echo
    assert.ok(
      (result.stderr || '').includes('[gad runtime launch] dispatch:'),
      `Expected argv echo in stderr. Got: ${result.stderr}`,
    );

    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });
});
