const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const gadBin = path.join(repoRoot, 'bin', 'gad.cjs');
const evalsDir = path.join(repoRoot, 'evals');

describe('generation preserve signature', () => {
  test('accepts project species version and writes into nested species path', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-generation-preserve-'));
    const projectId = `test-generation-preserve-${Date.now()}`;
    const speciesId = 'gad';
    const generationId = 'v1';
    const speciesDir = path.join(evalsDir, projectId, 'species', speciesId);
    const runDir = path.join(speciesDir, generationId);

    try {
      const gameDir = path.join(tmpDir, 'game');
      fs.mkdirSync(path.join(gameDir, 'src'), { recursive: true });
      fs.mkdirSync(path.join(gameDir, '.planning'), { recursive: true });
      fs.mkdirSync(path.join(gameDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(gameDir, 'src', 'main.ts'), '// test');
      fs.writeFileSync(path.join(gameDir, '.planning', 'STATE.xml'), '<state/>');
      fs.writeFileSync(path.join(gameDir, 'dist', 'index.html'), '<html/>');
      fs.writeFileSync(path.join(gameDir, 'package.json'), '{}');
      fs.mkdirSync(runDir, { recursive: true });

      execSync(
        `node "${gadBin}" generation preserve ${projectId} ${speciesId} ${generationId} --from "${tmpDir}"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      assert.equal(fs.existsSync(path.join(runDir, 'run', 'src', 'main.ts')), true);
      assert.equal(fs.existsSync(path.join(runDir, 'RUN.md')), true);
      const runMd = fs.readFileSync(path.join(runDir, 'RUN.md'), 'utf8');
      assert.match(runMd, new RegExp(`project: ${projectId}`));
      assert.match(runMd, new RegExp(`species: ${speciesId}`));

      const buildPath = path.join(
        repoRoot,
        'apps',
        'portfolio',
        'public',
        'evals',
        projectId,
        speciesId,
        generationId,
        'index.html'
      );
      assert.equal(fs.existsSync(buildPath), true);
      fs.rmSync(path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', projectId), { recursive: true, force: true });
    } finally {
      fs.rmSync(path.join(evalsDir, projectId), { recursive: true, force: true });
      fs.rmSync(path.join(repoRoot, 'apps', 'portfolio', 'public', 'evals', projectId), { recursive: true, force: true });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
