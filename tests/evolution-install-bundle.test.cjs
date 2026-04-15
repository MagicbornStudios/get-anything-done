/**
 * Verifies `gad evolution install` and `gad evolution promote` handle the
 * proto-skill bundle shape defined by decision gad-191.
 *
 * Bundle shape:
 *   .planning/proto-skills/<slug>/
 *     SKILL.md            (frontmatter: status: proto, workflow: ./workflow.md)
 *     workflow.md         (sibling, relative path resolvable from SKILL.md dir)
 *     PROVENANCE.md
 *     CANDIDATE.md        (optional)
 *
 * Uses node:test and spawnSync on bin/gad.cjs to exercise the real CLI path.
 */

process.env.GAD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const GAD_CLI = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
const PROTO_DIR = path.resolve(__dirname, '..', '.planning', 'proto-skills');

const SLUG = 'bundle-shape-fixture';
const fixturePath = path.join(PROTO_DIR, SLUG);

function runGad(args, cwd) {
  return spawnSync('node', [GAD_CLI, ...args], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
  });
}

function writeFixture() {
  fs.mkdirSync(fixturePath, { recursive: true });
  fs.writeFileSync(
    path.join(fixturePath, 'SKILL.md'),
    [
      '---',
      'name: bundle-shape-fixture',
      'status: proto',
      'workflow: ./workflow.md',
      'description: >-',
      '  Test fixture for evolution install bundle shape (gad-191).',
      '---',
      '',
      '# bundle-shape-fixture',
      '',
      'Test fixture. Points at sibling workflow.md.',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(fixturePath, 'workflow.md'),
    '# Workflow body\n\nSibling workflow file referenced by ./workflow.md.\n'
  );
  fs.writeFileSync(
    path.join(fixturePath, 'PROVENANCE.md'),
    '# Provenance\n\ncandidate: bundle-shape-fixture\nphase: test\n'
  );
  fs.writeFileSync(
    path.join(fixturePath, 'CANDIDATE.md'),
    '# Candidate\n\nOriginal candidate payload for the fixture.\n'
  );
}

function cleanupFixture() {
  if (fs.existsSync(fixturePath)) {
    fs.rmSync(fixturePath, { recursive: true, force: true });
  }
}

describe('gad evolution install — proto-skill bundle shape (gad-191)', () => {
  let tmpRuntimeRoot;

  before(() => {
    writeFixture();
    tmpRuntimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-evo-install-'));
  });

  after(() => {
    cleanupFixture();
    if (tmpRuntimeRoot && fs.existsSync(tmpRuntimeRoot)) {
      fs.rmSync(tmpRuntimeRoot, { recursive: true, force: true });
    }
  });

  test('install copies the whole bundle into the runtime target', () => {
    const result = runGad(
      ['evolution', 'install', SLUG, '--claude', '--config-dir', tmpRuntimeRoot],
      path.resolve(__dirname, '..')
    );
    assert.strictEqual(result.status, 0, `CLI exit: ${result.stderr}`);

    // Native dir: <config-dir>/skills/<slug>/
    const nativeDir = path.join(tmpRuntimeRoot, 'skills', SLUG);
    assert.ok(fs.existsSync(nativeDir), 'native dir created');

    for (const file of ['SKILL.md', 'workflow.md', 'PROVENANCE.md', 'CANDIDATE.md']) {
      assert.ok(
        fs.existsSync(path.join(nativeDir, file)),
        `bundle file ${file} copied whole`
      );
    }

    // SKILL.md frontmatter `workflow: ./workflow.md` still resolves relative
    // to the installed SKILL.md dir (sibling).
    const installedSkill = fs.readFileSync(path.join(nativeDir, 'SKILL.md'), 'utf8');
    assert.match(installedSkill, /workflow:\s*\.\/workflow\.md/);
    const siblingWorkflow = path.join(nativeDir, 'workflow.md');
    assert.ok(fs.existsSync(siblingWorkflow), 'sibling workflow.md resolves post-install');
  });
});
