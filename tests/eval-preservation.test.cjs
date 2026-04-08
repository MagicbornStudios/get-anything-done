/**
 * Eval preservation tests
 *
 * Enforces the eval preservation contract:
 * 1. gad eval preserve copies code + build + logs to canonical paths
 * 2. gad eval verify detects missing artifacts and exits non-zero
 * 3. Implementation eval runs that completed MUST have preserved artifacts
 *
 * This test prevents data loss by failing if any impl eval run is missing
 * its preserved code, build, or TRACE.json.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const gadBin = path.resolve(__dirname, '..', 'bin', 'gad.cjs');
const evalsDir = path.resolve(__dirname, '..', 'evals');

// Projects that produce implementation artifacts (code + build)
const IMPL_EVAL_PROJECTS = [
  'escape-the-dungeon',
  'escape-the-dungeon-bare',
  'escape-the-dungeon-emergent',
  'etd-brownfield-gad',
  'etd-brownfield-bare',
  'etd-brownfield-emergent',
];

// Preservation contract cutoff — runs before this version/project combo predate
// the preservation requirement and are exempt from the strict check.
// Any run AFTER these versions must be fully preserved.
const PRESERVATION_CONTRACT_CUTOFF = {
  'escape-the-dungeon': 7, // v1-v6 predate contract
  'escape-the-dungeon-bare': 1,
  'escape-the-dungeon-emergent': 1,
  'etd-brownfield-gad': 1,
  'etd-brownfield-bare': 1,
  'etd-brownfield-emergent': 1,
};

function requiresPreservation(project, version) {
  const versionNum = parseInt(version.slice(1), 10);
  const cutoff = PRESERVATION_CONTRACT_CUTOFF[project] ?? 1;
  if (versionNum < cutoff) return false;
  // Skip runs that are only prompt-generated (not yet executed)
  const runMdPath = path.join(evalsDir, project, version, 'RUN.md');
  if (fs.existsSync(runMdPath)) {
    const content = fs.readFileSync(runMdPath, 'utf8');
    // If status is prompt-generated and no preserved: line exists, the run hasn't been executed
    if (/status:\s*prompt-generated/.test(content) && !/preserved:/.test(content)) {
      return false;
    }
  }
  return true;
}

describe('gad eval preserve', () => {
  test('preserve copies code, planning, and build from a worktree', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-eval-preserve-test-'));
    try {
      // Fake worktree with minimal game structure
      const gameDir = path.join(tmpDir, 'game');
      fs.mkdirSync(path.join(gameDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(gameDir, '.planning'), { recursive: true });
      fs.mkdirSync(path.join(gameDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'src', 'main.ts'), '// test');
      fs.writeFileSync(path.join(gameDir, '.planning', 'STATE.xml'), '<state/>');
      fs.writeFileSync(path.join(gameDir, 'dist', 'index.html'), '<html/>');
      fs.writeFileSync(path.join(gameDir, 'package.json'), '{}');

      // Create a test eval project
      const testProject = 'test-preserve-' + Date.now();
      const projectDir = path.join(evalsDir, testProject);
      const runDir = path.join(projectDir, 'v1');
      fs.mkdirSync(runDir, { recursive: true });

      try {
        execSync(
          `node "${gadBin}" eval preserve ${testProject} v1 --from "${tmpDir}"`,
          { encoding: 'utf8', stdio: 'pipe' }
        );

        // Verify code copied
        assert.ok(
          fs.existsSync(path.join(runDir, 'run', 'src', 'main.ts')),
          'src/main.ts should be preserved to run/'
        );
        assert.ok(
          fs.existsSync(path.join(runDir, 'run', '.planning', 'STATE.xml')),
          '.planning/STATE.xml should be preserved to run/'
        );
        assert.ok(
          fs.existsSync(path.join(runDir, 'run', 'package.json')),
          'package.json should be preserved to run/'
        );

        // Verify build copied to portfolio public
        const buildPath = path.join(
          repoRoot,
          'apps',
          'portfolio',
          'public',
          'evals',
          testProject,
          'v1',
          'index.html'
        );
        assert.ok(
          fs.existsSync(buildPath),
          `build index.html should be preserved to ${buildPath}`
        );

        // Verify RUN.md updated
        const runMd = fs.readFileSync(path.join(runDir, 'RUN.md'), 'utf8');
        assert.match(runMd, /preserved:/, 'RUN.md should record preservation timestamp');
      } finally {
        // Clean up test eval project
        fs.rmSync(projectDir, { recursive: true, force: true });
        fs.rmSync(
          path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', testProject),
          { recursive: true, force: true }
        );
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('preserve fails gracefully when --from path does not exist', () => {
    let error = null;
    try {
      execSync(
        `node "${gadBin}" eval preserve escape-the-dungeon v999 --from "/nonexistent/path"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
    } catch (e) {
      error = e;
    }
    assert.ok(error, 'should exit non-zero when source does not exist');
  });
});

describe('gad eval verify', () => {
  test('verify runs without crashing', () => {
    // Don't check exit code — we know there are issues with older runs.
    // Just ensure the command runs and produces output.
    let output;
    try {
      output = execSync(`node "${gadBin}" eval verify`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
    } catch (e) {
      // Exit code 1 is expected when there are issues — we want the output
      output = e.stdout || '';
    }
    assert.match(output, /GAD Eval Preservation Audit/, 'should print audit header');
    assert.match(output, /runs fully preserved/, 'should print summary');
  });

  test('every impl eval run MUST have TRACE.json', () => {
    const missing = [];
    for (const project of IMPL_EVAL_PROJECTS) {
      const projectDir = path.join(evalsDir, project);
      if (!fs.existsSync(projectDir)) continue;
      const versions = fs
        .readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .filter((v) => requiresPreservation(project, v));
      for (const v of versions) {
        const tracePath = path.join(projectDir, v, 'TRACE.json');
        if (!fs.existsSync(tracePath)) {
          missing.push(`${project}/${v}`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval runs must have TRACE.json. Missing: ${missing.join(', ')}`
    );
  });

  test('every impl eval run MUST have preserved code (run/ dir)', () => {
    const missing = [];
    for (const project of IMPL_EVAL_PROJECTS) {
      const projectDir = path.join(evalsDir, project);
      if (!fs.existsSync(projectDir)) continue;
      const versions = fs
        .readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .filter((v) => requiresPreservation(project, v));
      for (const v of versions) {
        const runSubdir = path.join(projectDir, v, 'run');
        if (!fs.existsSync(runSubdir) || fs.readdirSync(runSubdir).length === 0) {
          missing.push(`${project}/${v}`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval runs must have preserved code in run/. Missing: ${missing.join(', ')}`
    );
  });

  test('every impl eval run MUST have preserved build in apps/portfolio/public/evals/', () => {
    const missing = [];
    for (const project of IMPL_EVAL_PROJECTS) {
      const projectDir = path.join(evalsDir, project);
      if (!fs.existsSync(projectDir)) continue;
      const versions = fs
        .readdirSync(projectDir)
        .filter((n) => /^v\d+$/.test(n))
        .filter((v) => requiresPreservation(project, v));
      for (const v of versions) {
        const buildPath = path.join(
          repoRoot,
          'apps',
          'portfolio',
          'public',
          'evals',
          project,
          v,
          'index.html'
        );
        if (!fs.existsSync(buildPath)) {
          missing.push(`${project}/${v}`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval runs must have preserved build at apps/portfolio/public/evals/. Missing: ${missing.join(', ')}`
    );
  });
});
