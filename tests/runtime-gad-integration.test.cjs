const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const GAD = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const HAS_RUNTIME_SUBSTRATE = fs.existsSync(path.join(REPO_ROOT, 'scripts', 'runtime-substrate-core.mjs'));

function gadJson(args) {
  const out = execFileSync(process.execPath, [GAD, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(out);
}

describe('gad runtime command integration', () => {
  test('snapshot -> runtime select uses shared project/session context envelope', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const snapshot = gadJson([
      'snapshot',
      '--projectid', 'global',
      '--sessionid', 's1',
      '--json',
    ]);
    assert.equal(snapshot.project, 'global');

    const selected = gadJson([
      'runtime', 'select',
      '--projectid', 'global',
      '--sessionid', 's1',
      '--runtimes', 'claude-code',
      '--json',
    ]);
    assert.equal(selected.projectId, 'global');
    assert.equal(selected.sessionId, 's1');
    assert.ok(selected.contextProvenance);
    assert.equal(typeof selected.contextProvenance.snapshotSource.present, 'boolean');
    assert.equal(typeof selected.contextProvenance.taskShape.source, 'string');
  });

  test('project override precedence uses global=assist mode', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'select',
      '--projectid', 'global',
      '--runtimes', 'claude-code',
      '--json',
    ]);
    assert.equal(payload.mode, 'assist');
  });

  test('CLI mode override takes precedence over config', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'select',
      '--projectid', 'global',
      '--runtimes', 'claude-code',
      '--mode', 'active',
      '--json',
    ]);
    assert.equal(payload.mode, 'active');
  });

  test('force-runtime bypasses selector', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'select',
      '--projectid', 'global',
      '--runtimes', 'claude-code',
      '--force-runtime', 'claude-code',
      '--json',
    ]);
    assert.equal(payload.forceRuntime, 'claude-code');
    assert.equal(payload.computedPrimary, 'claude-code');
    assert.equal(payload.effectivePrimary, 'claude-code');
    assert.equal(payload.selectionTrace.forceRuntimeActive, true);
  });

  test('shadow log toggle suppresses computed payload', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'select',
      '--projectid', 'app-forge',
      '--runtimes', 'claude-code',
      '--mode', 'shadow',
      '--no-shadow-log',
      '--json',
    ]);
    assert.equal(payload.mode, 'shadow');
    assert.equal(payload.computedPrimary, null);
    assert.equal(payload.computed, null);
    assert.equal(payload.selectionTrace.computedPrimary, null);
  });

  test('assist mode keeps fixed primary runtime by default', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'select',
      '--projectid', 'global',
      '--runtimes', 'claude-code',
      '--mode', 'assist',
      '--json',
    ]);
    assert.equal(payload.mode, 'assist');
    assert.equal(payload.primaryRuntimeFixed, true);
    assert.equal(payload.effectivePrimary, 'claude-code');
  });

  test('runtime matrix entrypoint forwards project/session/mode', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'matrix',
      '--projectid', 'app-forge',
      '--sessionid', 's1',
      '--runtimes', 'claude-code',
      '--mode', 'shadow',
      '--no-execute',
      '--no-save',
      '--json',
    ]);
    assert.equal(payload.projectId, 'app-forge');
    assert.equal(payload.substrateMode, 'shadow');
    assert.equal(payload.gadContext.projectId, 'app-forge');
    assert.equal(payload.gadContext.sessionId, 's1');
    assert.ok(payload.selectionTrace);
    assert.equal(typeof payload.selectionTrace.projectOverrideActive, 'boolean');
    assert.equal(typeof payload.selectionTrace.forceRuntimeActive, 'boolean');
    assert.ok(payload.gadContext.contextProvenance);
    assert.equal(payload.gadContext.contextProvenance.projectId, 'app-forge');
  });

  test('runtime pipeline entrypoint forwards context and returns composed JSON', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'pipeline',
      '--projectid', 'global',
      '--sessionid', 's1',
      '--runtimes', 'claude-code',
      '--mode', 'assist',
      '--no-execute',
      '--no-save',
      '--json',
    ]);
    assert.equal(payload.context.projectId, 'global');
    assert.equal(payload.context.sessionId, 's1');
    assert.equal(payload.context.mode, 'assist');
    assert.ok(payload.check && payload.matrix && payload.score && payload.candidates);
    assert.ok(payload.selectionTrace);
    assert.equal(typeof payload.selectionTrace.projectOverrideActive, 'boolean');
    assert.equal(typeof payload.selectionTrace.forceRuntimeActive, 'boolean');
    assert.ok(payload.context.contextProvenance);
    assert.equal(typeof payload.context.contextProvenance.snapshotSource.present, 'boolean');
    assert.equal(typeof payload.context.contextProvenance.handoffInputs.present, 'boolean');
    assert.equal(payload.context.contextProvenance.contextBlocksInjected, payload.context.contextBlockCount);
  });

  test('runtime launch dry-run resolves explicit id alias', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'launch',
      '--projectid', 'global',
      '--sessionid', 's1',
      '--id', 'claude',
      '--dry-run',
      '--json',
    ]);
    assert.equal(payload.runtime, 'claude-code');
    assert.equal(payload.dryRun, true);
    assert.equal(payload.launchInNewShell, true);
    assert.equal(payload.sameShell, false);
    assert.equal(payload.command, 'claude');
    assert.ok(Array.isArray(payload.args));
    assert.ok(payload.contextProvenance);
    assert.equal(typeof payload.contextProvenance.snapshotSource.present, 'boolean');
  });

  test('runtime shorthand with --id dispatches to launch mode', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime',
      '--id', 'codex',
      '--dry-run',
      '--json',
    ]);
    assert.equal(payload.runtime, 'codex-cli');
    assert.equal(payload.dryRun, true);
    assert.equal(payload.launchInNewShell, true);
    assert.ok(Array.isArray(payload.args));
    assert.ok(
      payload.args.some((value) => /scripts[\\/]+codex-trial\.mjs$/i.test(String(value))),
      'expected codex launch args to include scripts/codex-trial.mjs',
    );
  });

  test('runtime launch same-shell flag disables new-shell mode in payload', { skip: !HAS_RUNTIME_SUBSTRATE }, () => {
    const payload = gadJson([
      'runtime', 'launch',
      '--id', 'gemini',
      '--same-shell',
      '--dry-run',
      '--json',
    ]);
    assert.equal(payload.runtime, 'gemini-cli');
    assert.equal(payload.sameShell, true);
    assert.equal(payload.launchInNewShell, false);
    assert.ok(Array.isArray(payload.args));
    assert.ok(
      payload.args.some((value) => /scripts[\\/]+gemini-trial\.mjs$/i.test(String(value))),
      'expected gemini launch args to include scripts/gemini-trial.mjs',
    );
  });
});
