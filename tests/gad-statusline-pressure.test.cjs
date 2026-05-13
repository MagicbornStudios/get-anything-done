'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  findProjectContext,
  getPressureCachePath,
  readPressureSnapshot,
  renderPressureSegment,
  renderStatusline,
} = require('../hooks/gad-statusline.js');

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

test('findProjectContext resolves the deepest matching planning root from gad-config.toml', () => {
  const repoRoot = mkdtemp('gad-statusline-root-');
  const nestedRoot = path.join(repoRoot, 'vendor', 'get-anything-done');
  const nestedWorkdir = path.join(nestedRoot, 'hooks');
  fs.mkdirSync(path.join(repoRoot, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(nestedRoot, '.planning'), { recursive: true });
  fs.mkdirSync(nestedWorkdir, { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'gad-config.toml'), [
    '[[planning.roots]]',
    'id = "global"',
    'path = "."',
    'planningDir = ".planning"',
    '',
    '[[planning.roots]]',
    'id = "get-anything-done"',
    'path = "vendor/get-anything-done"',
    'planningDir = ".planning"',
    '',
  ].join('\n'));

  const result = findProjectContext(nestedWorkdir);
  assert.deepStrictEqual(result, {
    projectId: 'get-anything-done',
    rootPath: nestedRoot,
  });

  cleanup(repoRoot);
});

test('readPressureSnapshot falls back to a zeroed pressure payload when cache is absent', () => {
  const homeDir = mkdtemp('gad-statusline-home-');
  const snapshot = readPressureSnapshot('global', homeDir);
  assert.equal(snapshot.projectid, 'global');
  assert.equal(snapshot.score, 0);
  assert.equal(snapshot.top_phase, 'placeholder');
  cleanup(homeDir);
});

test('renderPressureSegment styles high pressure with evolve-now callout', () => {
  const output = renderPressureSegment({
    projectid: 'global',
    score: 0.91,
    top_phase: '107',
    top_phase_score: 0.91,
  });
  assert.match(output, /\u26A1/);
  assert.match(output, /EVOLVE NOW/);
  assert.match(output, /\u001b\[5;31m/);
});

test('renderStatusline appends pressure segment from shared cache for the active project', () => {
  const repoRoot = mkdtemp('gad-statusline-project-');
  const homeDir = mkdtemp('gad-statusline-cache-');
  fs.mkdirSync(path.join(repoRoot, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, 'gad-config.toml'), [
    '[project]',
    'id = "global"',
    '',
    '[[planning.roots]]',
    'id = "global"',
    'path = "."',
    'planningDir = ".planning"',
    '',
  ].join('\n'));

  const cachePath = getPressureCachePath(homeDir, 'global');
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({
    updated_at: '2026-05-04T00:00:00.000Z',
    projectid: 'global',
    score: 0.41,
    top_phase: '107',
    top_phase_score: 0.62,
  }));

  const realHomedir = os.homedir;
  os.homedir = () => homeDir;
  try {
    const output = renderStatusline({
      model: { display_name: 'Claude Test' },
      workspace: { current_dir: repoRoot },
      session_id: '',
    });
    assert.match(output, /Claude Test/);
    assert.match(output, /\u26A1 \[/);
    assert.match(output, /0\.41/);
  } finally {
    os.homedir = realHomedir;
  }

  cleanup(repoRoot);
  cleanup(homeDir);
});
