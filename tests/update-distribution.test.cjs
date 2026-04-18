const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  compareVersions,
  listReleaseTagsFromLsRemote,
  normalizeRepoSlug,
  normalizeVersion,
} = require('../hooks/gad-check-update.js');
const { cleanup } = require('./helpers.cjs');

async function loadPublishReleaseModule() {
  const target = pathToFileURL(path.join(__dirname, '..', 'scripts', 'publish-release.mjs')).href;
  return import(`${target}?t=${Date.now()}`);
}

describe('gad-check-update release lookup helpers', () => {
  test('normalizeRepoSlug accepts GitHub URLs and owner/repo slugs', () => {
    assert.equal(normalizeRepoSlug('git+https://github.com/MagicbornStudios/get-anything-done.git'), 'MagicbornStudios/get-anything-done');
    assert.equal(normalizeRepoSlug('git@github.com:MagicbornStudios/get-anything-done.git'), 'MagicbornStudios/get-anything-done');
    assert.equal(normalizeRepoSlug('MagicbornStudios/get-anything-done'), 'MagicbornStudios/get-anything-done');
  });

  test('compareVersions prefers stable releases over prereleases', () => {
    assert.ok(compareVersions('1.34.0', '1.33.9') > 0);
    assert.ok(compareVersions('1.34.0', '1.34.0-rc.1') > 0);
    assert.ok(compareVersions('1.34.0-rc.2', '1.34.0-rc.1') > 0);
    assert.equal(normalizeVersion('v1.34.0'), '1.34.0');
  });

  test('listReleaseTagsFromLsRemote returns semver tags in ascending order', () => {
    const output = [
      'abc123\trefs/tags/v1.34.0',
      'def456\trefs/tags/v1.33.9',
      'ghi789\trefs/tags/not-a-version',
      'jkl012\trefs/tags/v1.34.0-rc.1',
    ].join('\n');
    assert.deepStrictEqual(listReleaseTagsFromLsRemote(output), [
      'v1.33.9',
      'v1.34.0-rc.1',
      'v1.34.0',
    ]);
  });
});

describe('update workflow distribution docs', () => {
  test('workflow/update.md uses GitHub Releases tarball flow instead of npm install', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'workflows', 'update.md'), 'utf8');
    assert.ok(content.includes('gh release download'), 'expected workflow to download release tarball');
    assert.ok(!content.includes('npx -y get-anything-done@latest'), 'workflow should not install from npm');
    assert.ok(!content.includes('npm view get-anything-done version'), 'workflow should not query npm for latest version');
  });
});

describe('publish-release GitHub binary handling', () => {
  test('ensureReleaseTarball is a no-op under the Bun release model', async () => {
    const mod = await loadPublishReleaseModule();
    assert.equal(mod.ensureReleaseTarball(), false);
  });

  test('getArtifacts keeps only current-version Bun/GitHub release assets', async () => {
    const mod = await loadPublishReleaseModule();
    const currentVersion = mod.parseArgs([]).tag.replace(/^v/, '');
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-release-'));
    const releaseDir = path.join(tmpRoot, 'dist', 'release');
    fs.mkdirSync(releaseDir, { recursive: true });
    fs.writeFileSync(path.join(releaseDir, `gad-v${currentVersion}-windows-x64.exe`), 'exe');
    fs.writeFileSync(path.join(releaseDir, `gad-v${currentVersion}-linux-x64`), 'linux');
    fs.writeFileSync(path.join(releaseDir, 'INSTALL.txt'), 'notes');
    fs.writeFileSync(path.join(releaseDir, 'install-gad-windows.ps1'), 'installer');
    fs.writeFileSync(path.join(releaseDir, 'get-anything-done-1.34.1.tgz'), 'old tgz');
    fs.writeFileSync(path.join(releaseDir, 'gad-v1.34.1-windows-x64.exe'), 'old exe');

    const artifacts = mod.getArtifacts(releaseDir).map((file) => path.basename(file)).sort();
    assert.deepStrictEqual(artifacts, [
      'INSTALL.txt',
      `gad-v${currentVersion}-linux-x64`,
      `gad-v${currentVersion}-windows-x64.exe`,
      'install-gad-windows.ps1',
    ]);

    cleanup(tmpRoot);
  });
});
