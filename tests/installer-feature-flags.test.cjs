/**
 * Installer feature flags — end-to-end test (task 44-32 follow-up)
 *
 * Covers the 44-28 spine flag surface added to bin/install.js:
 *
 *   --planning  → scaffolds canonical .planning/ XML ledgers
 *   --site      → drops the standalone site bundle (or warns if missing)
 *   --node      → deprecated no-op (44-34 cancelled), prints notice
 *   --target    → routes the feature install to a specific dir
 *   --help      → lists the new "Feature flags (44-28 spine)" block
 *
 * These run install.js as a child process via execFileSync (NOT as a
 * required module — install.js bails out as a stub when GAD_TEST_MODE is
 * set, which would skip the entire flag dispatch we want to exercise).
 *
 * Reference: references/installer-feature-flags.md
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const INSTALL_JS = path.join(REPO_ROOT, 'bin', 'install.js');

function runInstaller(args) {
  try {
    const stdout = execFileSync(process.execPath, [INSTALL_JS, ...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15_000,
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    return {
      ok: false,
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message,
      status: err.status,
    };
  }
}

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmTmp(dir) {
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

// ─── --help lists the new feature-flag block ────────────────────────────────

describe('installer-feature-flags — --help surface', () => {
  test('lists feature flags under the 44-28 spine block', () => {
    const result = runInstaller(['--help']);
    assert.equal(result.ok, true, `--help failed: ${result.stderr}`);
    const out = result.stdout;
    assert.match(out, /Feature flags \(44-28 spine/);
    assert.match(out, /--planning\b/);
    assert.match(out, /--site\b/);
    assert.match(out, /--from-release\b/);
    assert.match(out, /--target\b/);
    // --node should be present but tagged as deprecated/no-op
    assert.match(out, /--node\b/);
    assert.match(out, /(deprecated|no-op|cancelled)/i);
  });
});

// ─── --planning scaffolds the canonical XML ledgers ─────────────────────────

describe('installer-feature-flags — --planning', () => {
  let target;
  before(() => { target = mkTmp('gad-installer-planning-'); });
  after(() => rmTmp(target));

  test('scaffolds 6 canonical XML ledgers in <target>/.planning/', () => {
    const result = runInstaller(['--planning', '--target', target]);
    assert.equal(result.ok, true, `install failed: ${result.stderr}`);
    const planDir = path.join(target, '.planning');
    assert.equal(fs.existsSync(planDir), true, `.planning/ not created at ${planDir}`);
    const expected = [
      'STATE.xml',
      'ROADMAP.xml',
      'TASK-REGISTRY.xml',
      'DECISIONS.xml',
      'REQUIREMENTS.xml',
      'ERRORS-AND-ATTEMPTS.xml',
    ];
    for (const f of expected) {
      const p = path.join(planDir, f);
      assert.equal(fs.existsSync(p), true, `expected scaffold file missing: ${f}`);
      const body = fs.readFileSync(p, 'utf8');
      assert.match(body, /<\?xml version="1\.0"/, `${f} missing XML decl`);
    }
  });

  test('refuses to overwrite a non-empty .planning/ silently (idempotent)', () => {
    // re-run on the same target — should leave the existing dir alone
    const result = runInstaller(['--planning', '--target', target]);
    assert.equal(result.ok, true);
    assert.match(result.stdout, /already exists/);
  });

  test('derives projectid from target folder basename', () => {
    const named = mkTmp('gad-installer-projectid-test-');
    try {
      const result = runInstaller(['--planning', '--target', named]);
      assert.equal(result.ok, true, result.stderr);
      const state = fs.readFileSync(path.join(named, '.planning', 'STATE.xml'), 'utf8');
      // basename → lowercase, non-alphanum collapsed to dashes
      assert.match(state, /project="gad-installer-projectid-test-/);
    } finally {
      rmTmp(named);
    }
  });
});

// ─── --site warns cleanly when no bundle is available ───────────────────────

describe('installer-feature-flags — --site (no bundle present)', () => {
  let target;
  before(() => { target = mkTmp('gad-installer-site-'); });
  after(() => rmTmp(target));

  test('prints warning + recovery hint when no packed bundle exists', () => {
    const result = runInstaller(['--site', '--target', target]);
    assert.equal(result.ok, true, `install failed: ${result.stderr}`);
    // Standalone build may or may not exist depending on whether the developer
    // has run `pnpm build:site` — don't assert on the success path; only
    // assert that the missing-bundle path is graceful.
    const builtPath = path.join(REPO_ROOT, 'site', '.next', 'standalone', 'server.js');
    if (!fs.existsSync(builtPath)) {
      assert.match(result.stdout, /No site bundle found/);
      assert.match(result.stdout, /pnpm pack:site|--from-release/);
    }
  });
});

// ─── --node prints deprecation notice (44-34 cancelled) ─────────────────────

describe('installer-feature-flags — --node (deprecated, 44-34 cancelled)', () => {
  let target;
  before(() => { target = mkTmp('gad-installer-node-'); });
  after(() => rmTmp(target));

  test('prints deprecation notice and writes nothing under .planning/', () => {
    const result = runInstaller(['--node', '--target', target]);
    assert.equal(result.ok, true, `install failed: ${result.stderr}`);
    assert.match(result.stdout, /deprecated/);
    assert.match(result.stdout, /44-34/);
    // Should NOT create .planning/.node/ scaffolding (cleanup of pre-cancellation stub)
    const nodeDir = path.join(target, '.planning', '.node');
    assert.equal(fs.existsSync(nodeDir), false, `--node should be no-op; ${nodeDir} should not exist`);
  });
});

// ─── --planning + --site combined into one invocation ───────────────────────

describe('installer-feature-flags — combined --planning --site', () => {
  let target;
  before(() => { target = mkTmp('gad-installer-combined-'); });
  after(() => rmTmp(target));

  test('runs both feature installs in one shot, prints feature-install-complete banner', () => {
    const result = runInstaller(['--planning', '--site', '--target', target]);
    assert.equal(result.ok, true, `install failed: ${result.stderr}`);
    assert.match(result.stdout, /Feature install complete/);
    assert.equal(fs.existsSync(path.join(target, '.planning', 'STATE.xml')), true);
  });
});
