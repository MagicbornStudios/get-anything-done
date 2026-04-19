const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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
});
