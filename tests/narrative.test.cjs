'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { listNarratives, enterNarrative } = require('../lib/narrative.cjs');

function writeFile(filePath, body) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
}

test('explicit narrative roots override planning-root ids while preserving planning fallback', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-narrative-'));
  writeFile(path.join(repoRoot, 'gad-config.toml'), [
    '[[planning.roots]]',
    'id = "global"',
    'path = "."',
    '',
    '[[planning.roots]]',
    'id = "magicborn"',
    'path = "projects/magicborn"',
    '',
    '[[narrative.roots]]',
    'id = "get-anything-done-corp"',
    'path = "."',
    'narrativeDir = "narrative"',
    '',
  ].join('\n'));

  writeFile(path.join(repoRoot, 'narrative', 'narrative.toml'), [
    'project = "get-anything-done-corp"',
    'activeSoul = "gilgamesh"',
    '',
  ].join('\n'));
  writeFile(path.join(repoRoot, 'narrative', 'souls', 'gilgamesh.md'), 'I am Gilgamesh.');

  writeFile(path.join(repoRoot, 'projects', 'magicborn', 'narrative', 'narrative.toml'), [
    'project = "magicborn-narrative"',
    'activeSoul = "kael"',
    '',
    '[[books]]',
    'slug = "book-one"',
    'title = "Book One"',
    'order = 1',
    '',
  ].join('\n'));
  writeFile(path.join(repoRoot, 'projects', 'magicborn', 'narrative', 'souls', 'kael.md'), 'I am Kael.');

  const rows = listNarratives(repoRoot);
  assert.deepEqual(
    rows.map((row) => row.projectId),
    ['get-anything-done-corp', 'magicborn'],
  );
  assert.equal(rows[0].activeSoul, 'gilgamesh');
  assert.equal(rows[1].bookCount, 1);

  const corp = enterNarrative(repoRoot, 'get-anything-done-corp');
  assert.equal(corp.ok, true);
  assert.match(corp.soulBody, /Gilgamesh/);

  const magicborn = enterNarrative(repoRoot, 'magicborn');
  assert.equal(magicborn.ok, true);
  assert.match(magicborn.soulBody, /Kael/);
});
