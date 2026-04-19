const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

describe('release workflow environment', () => {
  test('sets no-side-effects mode while building release artifacts', () => {
    const workflow = fs.readFileSync(
      path.join(repoRoot, '.github', 'workflows', 'release-binaries.yml'),
      'utf8',
    );
    const buildStep = workflow.match(/- name: Build Bun release artifact[\s\S]*?run: npm run build:release/);

    assert.ok(buildStep, 'release workflow must build with npm run build:release');
    assert.match(buildStep[0], /env:\s*\n\s*GAD_RELEASE_BUILD: '1'\s*\n\s*run: npm run build:release/);
  });
});
