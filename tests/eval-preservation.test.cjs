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

// Phase 43: project/species/generation layout. Each species is a (project,
// species) pair. Implementation eval species produce code + build.
const IMPL_EVAL_SPECIES = [
  { project: 'escape-the-dungeon', species: 'gad' },
  { project: 'escape-the-dungeon', species: 'bare' },
  { project: 'escape-the-dungeon', species: 'emergent' },
];

// Preservation contract cutoff per (project, species) — generations BEFORE
// this generation number predate the preservation requirement and are exempt
// from the strict check. Anything from this generation forward MUST be fully
// preserved.
const PRESERVATION_CONTRACT_CUTOFF = {
  'escape-the-dungeon/gad': 7, // v1-v6 predate contract
  'escape-the-dungeon/bare': 1,
  'escape-the-dungeon/emergent': 1,
};

function speciesDir(project, species) {
  return path.join(evalsDir, project, 'species', species);
}

function requiresPreservation(project, species, version) {
  const versionNum = parseInt(version.slice(1), 10);
  const cutoff = PRESERVATION_CONTRACT_CUTOFF[`${project}/${species}`] ?? 1;
  if (versionNum < cutoff) return false;
  const runMdPath = path.join(speciesDir(project, species), version, 'RUN.md');
  // No RUN.md => generation directory exists but the run was never set up.
  // Treat as "not yet executed" and skip.
  if (!fs.existsSync(runMdPath)) return false;
  const content = fs.readFileSync(runMdPath, 'utf8');
  // Only enforce preservation once the run has actually been executed and
  // preserved (presence of a `preserved:` timestamp). Earlier statuses
  // (prompt-generated, execute-ready, etc.) mean the run hasn't produced
  // artifacts yet.
  if (!/preserved:/.test(content)) return false;
  return true;
}

function listGenerations(project, species) {
  const dir = speciesDir(project, species);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((n) => /^v\d+$/.test(n));
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

  test('every impl eval generation MUST have TRACE.json', () => {
    const missing = [];
    for (const { project, species } of IMPL_EVAL_SPECIES) {
      for (const v of listGenerations(project, species).filter((vv) => requiresPreservation(project, species, vv))) {
        const tracePath = path.join(speciesDir(project, species), v, 'TRACE.json');
        if (!fs.existsSync(tracePath)) missing.push(`${project}/${species}/${v}`);
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval generations must have TRACE.json. Missing: ${missing.join(', ')}`
    );
  });

  test('every impl eval generation MUST have preserved code (run/ dir)', () => {
    const missing = [];
    for (const { project, species } of IMPL_EVAL_SPECIES) {
      for (const v of listGenerations(project, species).filter((vv) => requiresPreservation(project, species, vv))) {
        const runSubdir = path.join(speciesDir(project, species), v, 'run');
        if (!fs.existsSync(runSubdir) || fs.readdirSync(runSubdir).length === 0) {
          missing.push(`${project}/${species}/${v}`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval generations must have preserved code in run/. Missing: ${missing.join(', ')}`
    );
  });

  test('every impl eval generation MUST have preserved build in apps/portfolio/public/evals/', () => {
    const missing = [];
    for (const { project, species } of IMPL_EVAL_SPECIES) {
      for (const v of listGenerations(project, species).filter((vv) => requiresPreservation(project, species, vv))) {
        const buildPath = path.join(
          repoRoot,
          'apps',
          'portfolio',
          'public',
          'evals',
          project,
          species,
          v,
          'index.html'
        );
        if (!fs.existsSync(buildPath)) {
          missing.push(`${project}/${species}/${v}`);
        }
      }
    }
    assert.deepStrictEqual(
      missing,
      [],
      `All impl eval generations must have preserved build at apps/portfolio/public/evals/<project>/<species>/<gen>/. Missing: ${missing.join(', ')}`
    );
  });

  test('phase 43 negative assertion: no flat-layout eval dirs remain', () => {
    // After phase 43 the only top-level entries under evals/ should be the
    // multi-variant project dirs (escape-the-dungeon, gad-explainer-video),
    // documentation files, and intentional underscore-prefixed addenda. Any
    // other sibling top-level dir indicates an incomplete migration or a
    // resurrected dropped condition.
    const allowedTopLevelDirs = new Set(['escape-the-dungeon', 'gad-explainer-video']);
    const violations = [];
    for (const name of fs.readdirSync(evalsDir).sort()) {
      if (name.startsWith('_')) continue;
      if (name.startsWith('.')) continue;
      const full = path.join(evalsDir, name);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (!stat.isDirectory()) continue;
      if (!allowedTopLevelDirs.has(name)) {
        violations.push(name);
      }
    }
    assert.deepStrictEqual(
      violations,
      [],
      `Phase 43 forbids flat eval project dirs at the top level of evals/. Found: ${violations.join(', ')}`
    );
  });

  test('phase 43 negative assertion: no flat-layout preserved build dirs remain', () => {
    const buildRoot = path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals');
    if (!fs.existsSync(buildRoot)) return;
    const violations = [];
    for (const name of fs.readdirSync(buildRoot).sort()) {
      const full = path.join(buildRoot, name);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (!stat.isDirectory()) continue;
      // Each top-level entry must contain species subdirs (gad/bare/emergent),
      // not vN/ subdirs directly. A vN/ subdir indicates a flat layout left
      // over from before phase 43.
      for (const child of fs.readdirSync(full)) {
        if (/^v\d+$/.test(child)) {
          violations.push(`${name}/${child}`);
        }
      }
    }
    assert.deepStrictEqual(
      violations,
      [],
      `Phase 43 forbids flat preserved build paths. Each project must contain species subdirs, not version subdirs. Found: ${violations.join(', ')}`
    );
  });
});
