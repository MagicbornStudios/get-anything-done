/**
 * evolution-install.test.cjs — Smoke test for task 107-08.
 *
 * Verifies:
 *   1. `gad evolution install <slug> --claude --local` reads from the
 *      project-root .planning/proto-skills/ (not the GAD vendor dir) when
 *      invoked from the monorepo root (CWD-based path resolution).
 *   2. `gad evolution install <slug> --all --local --projectid <id>` resolves
 *      the proto-skills dir from the named project root via gad-config.toml.
 *   3. The SKILL.md appears at .claude/skills/<slug>/SKILL.md (local claude).
 *
 * Uses node:test + spawnSync on bin/gad.cjs.
 */

process.env.GAD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const GAD_CLI = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
// The monorepo root is two levels up from vendor/get-anything-done.
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// Derive a random slug to avoid collisions with real proto-skills.
const RAND = Math.random().toString(36).slice(2, 7);
const SLUG = `test-smoke-${RAND}`;

// Proto-skills dir lives at the monorepo root (the project being served).
const PROTO_SKILLS_DIR = path.join(MONOREPO_ROOT, '.planning', 'proto-skills');
const FIXTURE_DIR = path.join(PROTO_SKILLS_DIR, SLUG);

function runGad(args, cwd, env) {
  return spawnSync('node', [GAD_CLI, ...args], {
    cwd: cwd || MONOREPO_ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
  });
}

function writeFixture(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    [
      '---',
      `name: ${SLUG}`,
      'status: proto',
      'description: >-',
      '  Smoke-test proto-skill for task 107-08. Auto-deleted after test.',
      '---',
      '',
      `# ${SLUG}`,
      '',
      'Smoke test fixture. Created by evolution-install.test.cjs.',
      '',
    ].join('\n')
  );
}

function cleanupFixture() {
  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
}

function cleanupInstalled(configDir) {
  if (configDir && fs.existsSync(configDir)) {
    fs.rmSync(configDir, { recursive: true, force: true });
  }
}

describe('gad evolution install — project-root proto-skills (task 107-08)', () => {
  let tmpConfigDir;

  before(() => {
    // Write the fixture into the monorepo's .planning/proto-skills/
    writeFixture(FIXTURE_DIR);
    // Temporary directory to serve as the runtime config root (avoids touching real ~/.claude)
    tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-evo-smoke-'));
  });

  after(() => {
    cleanupFixture();
    cleanupInstalled(tmpConfigDir);
  });

  test('install resolves proto-skill from monorepo .planning/proto-skills/ via CWD', () => {
    // Run from MONOREPO_ROOT so findRepoRoot() resolves to the monorepo.
    const result = runGad(
      ['evolution', 'install', SLUG, '--claude', '--config-dir', tmpConfigDir],
      MONOREPO_ROOT
    );
    assert.strictEqual(
      result.status,
      0,
      `CLI should exit 0. stderr: ${result.stderr}\nstdout: ${result.stdout}`
    );

    // File should land at <tmpConfigDir>/skills/<slug>/SKILL.md
    const installedSkill = path.join(tmpConfigDir, 'skills', SLUG, 'SKILL.md');
    assert.ok(
      fs.existsSync(installedSkill),
      `Expected SKILL.md at ${installedSkill}`
    );

    const content = fs.readFileSync(installedSkill, 'utf8');
    assert.match(content, /status:\s*proto/, 'Installed SKILL.md retains proto status');
  });

  test('install with --projectid global resolves proto-skill from monorepo root', () => {
    // Clean the tmp dir between sub-tests so we get a fresh copy.
    if (fs.existsSync(path.join(tmpConfigDir, 'skills', SLUG))) {
      fs.rmSync(path.join(tmpConfigDir, 'skills', SLUG), { recursive: true, force: true });
    }

    const result = runGad(
      ['evolution', 'install', SLUG, '--claude', '--config-dir', tmpConfigDir, '--projectid', 'global'],
      MONOREPO_ROOT
    );
    assert.strictEqual(
      result.status,
      0,
      `CLI should exit 0 with --projectid global. stderr: ${result.stderr}\nstdout: ${result.stdout}`
    );

    const installedSkill = path.join(tmpConfigDir, 'skills', SLUG, 'SKILL.md');
    assert.ok(
      fs.existsSync(installedSkill),
      `Expected SKILL.md at ${installedSkill} after --projectid global`
    );
  });

  test('install fails gracefully when slug not found', () => {
    const missing = `nonexistent-slug-${RAND}`;
    const result = runGad(
      ['evolution', 'install', missing, '--claude', '--config-dir', tmpConfigDir],
      MONOREPO_ROOT
    );
    assert.strictEqual(result.status, 1, 'Should exit 1 for missing slug');
    assert.match(result.stderr, /No proto-skill found/, 'stderr should mention missing skill');
  });

  test('GAD_PROTO_SKILLS_DIR env override takes highest priority', () => {
    // Create a separate temp directory as an alternate proto-skills store.
    const altProtoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-alt-proto-'));
    const altSlug = `alt-${RAND}`;
    const altFixture = path.join(altProtoDir, altSlug);
    fs.mkdirSync(altFixture, { recursive: true });
    fs.writeFileSync(path.join(altFixture, 'SKILL.md'), '---\nname: alt\nstatus: proto\n---\n# alt\n');

    const altTmpConfig = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-alt-cfg-'));
    try {
      const result = runGad(
        ['evolution', 'install', altSlug, '--claude', '--config-dir', altTmpConfig],
        MONOREPO_ROOT,
        { GAD_PROTO_SKILLS_DIR: altProtoDir }
      );
      assert.strictEqual(result.status, 0, `Alt install should exit 0. stderr: ${result.stderr}`);
      const installed = path.join(altTmpConfig, 'skills', altSlug, 'SKILL.md');
      assert.ok(fs.existsSync(installed), 'Skill from alt dir should be installed');
    } finally {
      fs.rmSync(altProtoDir, { recursive: true, force: true });
      fs.rmSync(altTmpConfig, { recursive: true, force: true });
    }
  });
});
