const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { runGadCli, createTempDir, cleanup, GAD_CLI_PATH } = require('./helpers.cjs');

const tempDirs = [];

function trackTempDir(prefix) {
  const dir = createTempDir(prefix);
  tempDirs.push(dir);
  return dir;
}

function runCliArgs(args, cwd) {
  try {
    const output = execFileSync(process.execPath, [GAD_CLI_PATH, ...args], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
    });
    return { success: true, output, error: '' };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString() || '',
      error: err.stderr?.toString() || err.message,
    };
  }
}

afterEach(() => {
  while (tempDirs.length > 0) cleanup(tempDirs.pop());
});

describe('install routing', () => {
  test('internal install token routes into install.js without leaking as an unknown command', () => {
    const cwd = trackTempDir('gad-install-internal-');
    const result = runCliArgs(['__gad_internal_install__', '--local', '--cursor'], cwd);

    assert.ok(result.success, `internal install route failed: ${(result.error || result.output).slice(0, 400)}`);
    assert.doesNotMatch(result.output + result.error, /Unknown command __gad_internal_install__/);
    assert.ok(fs.existsSync(path.join(cwd, '.cursor')), 'cursor runtime install should land in the target directory');
  });

  test('bare gad install --runtime... delegates to the full installer', () => {
    const cwd = trackTempDir('gad-install-alias-');
    const result = runGadCli(['install', '--claude', '--opencode', '--local'], cwd);

    assert.ok(result.success, `install alias failed: ${(result.error || result.output).slice(0, 400)}`);
    assert.ok(fs.existsSync(path.join(cwd, '.claude')), 'claude runtime install should exist');
    assert.ok(fs.existsSync(path.join(cwd, '.opencode')), 'opencode runtime install should exist');
  });

  test('gad install all --uninstall keeps all-surface semantics', () => {
    const cwd = trackTempDir('gad-install-uninstall-');
    const installResult = runGadCli(['install', '--claude', '--cursor', '--local'], cwd);
    assert.ok(installResult.success, `setup install failed: ${(installResult.error || installResult.output).slice(0, 400)}`);
    assert.ok(fs.existsSync(path.join(cwd, '.claude')), 'claude runtime install should exist before uninstall');
    assert.ok(fs.existsSync(path.join(cwd, '.cursor')), 'cursor runtime install should exist before uninstall');

    const uninstallResult = runGadCli(['install', 'all', '--uninstall', '--local'], cwd);
    assert.ok(uninstallResult.success, `install all --uninstall failed: ${(uninstallResult.error || uninstallResult.output).slice(0, 400)}`);
    assert.doesNotMatch(uninstallResult.output + uninstallResult.error, /Unknown command __gad_internal_install__/);
    assert.ok(!fs.existsSync(path.join(cwd, '.claude', 'get-anything-done')), 'claude framework payload should be removed');
    assert.ok(!fs.existsSync(path.join(cwd, '.cursor', 'get-anything-done')), 'cursor framework payload should be removed');
    assert.deepStrictEqual(
      fs.readdirSync(path.join(cwd, '.claude', 'skills')).filter((name) => name.startsWith('gad-')),
      [],
      'claude gad-* skills should be removed',
    );
    assert.deepStrictEqual(
      fs.readdirSync(path.join(cwd, '.cursor', 'skills')).filter((name) => name.startsWith('gad-')),
      [],
      'cursor gad-* skills should be removed',
    );
  });
});
