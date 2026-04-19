const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const repoRoot = path.resolve(__dirname, '..');

describe('release build deprecation contract', () => {
  test('keeps Bun primary and SEA as a temporary escape hatch', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const seaScript = fs.readFileSync(path.join(repoRoot, 'scripts', 'build-release.mjs'), 'utf8');

    assert.equal(pkg.scripts['build:release'], 'node scripts/build-bun-release.mjs');
    assert.equal(pkg.scripts['build:release:bun'], 'node scripts/build-bun-release.mjs');
    assert.equal(pkg.scripts['build:release:sea'], 'node scripts/build-release.mjs');
    assert.match(seaScript, /deprecatedAsOf: '1\.35\.0'/);
    assert.match(seaScript, /kept for one release/);
    assert.match(seaScript, /removeAfter: '1\.36\.0'/);
    assert.match(seaScript, /npm run build:release/);
  });

  test('does not deprecate the npm tarball publish chain', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));

    assert.equal(pkg.scripts.publish, undefined);
    assert.equal(pkg.scripts['publish:release'], 'node scripts/publish-release.mjs');
    assert.equal(pkg.scripts.prepublishOnly, 'npm run build:hooks && npm run build:cli');
  });

  test('publish-release.mjs treats the npm tarball as a release asset', async () => {
    // Regression guard for v1.35.0 (no tarball asset, /gad-update broke).
    // See .planning/notes/2026-04-18-v1.35.0-missing-npm-tarball.md.
    const mod = await import(pathToFileURL(path.join(repoRoot, 'scripts', 'publish-release.mjs')).href);
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const tarballName = `${pkg.name}-${pkg.version}.tgz`;

    assert.equal(typeof mod.isReleaseArtifactName, 'function');
    assert.equal(typeof mod.ensureReleaseTarball, 'function');
    assert.equal(
      mod.isReleaseArtifactName(tarballName),
      true,
      `${tarballName} must be recognised as a release artifact`,
    );
    assert.equal(mod.isReleaseArtifactName('install-gad-windows.ps1'), true);
    assert.equal(mod.isReleaseArtifactName('INSTALL.txt'), true);
    assert.equal(
      mod.isReleaseArtifactName(`gad-v${pkg.version}-linux-x64`),
      true,
    );
    assert.equal(mod.isReleaseArtifactName('not-a-release-asset.txt'), false);
  });

  test('publish-release.mjs treats the site zip as a release asset and guards its presence', async () => {
    // Regression guard for 44-32/44-33: shipping a release without
    // site-vX.Y.Z.zip would make `gad install --site --from-release vX.Y.Z`
    // 404. Same shape as the npm-tarball guard above.
    const mod = await import(pathToFileURL(path.join(repoRoot, 'scripts', 'publish-release.mjs')).href);
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const siteZipName = `site-v${pkg.version}.zip`;

    assert.equal(typeof mod.ensureSiteZipIfRequired, 'function');
    assert.equal(
      mod.isReleaseArtifactName(siteZipName),
      true,
      `${siteZipName} must be recognised as a release artifact`,
    );

    // Guard throws when zip is missing in an empty release dir
    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gad-site-guard-'));
    try {
      assert.throws(
        () => mod.ensureSiteZipIfRequired(tmpDir),
        /Site bundle .* missing/,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    // Guard is a no-op when GAD_SKIP_SITE_ZIP_GUARD=1
    const tmpDir2 = fs.mkdtempSync(path.join(require('os').tmpdir(), 'gad-site-guard-skip-'));
    try {
      const prev = process.env.GAD_SKIP_SITE_ZIP_GUARD;
      process.env.GAD_SKIP_SITE_ZIP_GUARD = '1';
      try {
        assert.doesNotThrow(() => mod.ensureSiteZipIfRequired(tmpDir2));
      } finally {
        if (prev === undefined) delete process.env.GAD_SKIP_SITE_ZIP_GUARD;
        else process.env.GAD_SKIP_SITE_ZIP_GUARD = prev;
      }
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  test('release-binaries workflow uploads the npm tarball', () => {
    // Regression guard: the publish job must npm-pack and verify the
    // tarball is present before uploading. Otherwise tag pushes ship
    // Bun-binaries-only releases and /gad-update breaks (v1.35.0).
    const yml = fs.readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'release-binaries.yml'),
      'utf8',
    );
    assert.match(yml, /npm pack --pack-destination dist\/release-upload/);
    assert.match(yml, /get-anything-done-\*\.tgz/);
  });
});
