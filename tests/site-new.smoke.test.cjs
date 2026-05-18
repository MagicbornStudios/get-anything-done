'use strict';
/**
 * Smoke test for `gad site new <slug>` generator (task 84-05).
 *
 * Verifies that the generator:
 *   1. Writes the expected file set into a fresh temp dir.
 *   2. Substitutes {{slug}} placeholders.
 *   3. Produces a valid package.json with the expected name.
 *   4. Emits the .env.example with the normalized placeholders from 84-04.
 *   5. Seeds .planning/ with ROADMAP.xml and DECISIONS.xml.
 *   6. Idempotently updates a sandboxed pnpm-workspace.yaml.
 *
 * Intentionally does NOT install / build / run dev — those need pnpm and
 * a network and would balloon CI time. The "runnable workspace member"
 * promise from the task goal is checked structurally (package.json scripts
 * + workspace listing). For the full manual build smoke see
 * vendor/get-anything-done/docs/site-new-smoke.md.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  generateSite,
  addToPnpmWorkspace,
} = require('../lib/site-template/index.cjs');

function mkTmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

test('generateSite writes a runnable workspace skeleton', () => {
  const slug = 'test-site-' + Date.now().toString(36);
  const tmp = mkTmp('gad-site-new-');
  const targetDir = path.join(tmp, 'sites', slug);

  try {
    const result = generateSite({ slug, targetDir });
    assert.deepStrictEqual(result.errors, [], 'no generator errors');
    assert.ok(result.files.length > 0, 'wrote at least one file');

    // Core files exist.
    const expected = [
      'package.json',
      'tsconfig.json',
      'next.config.ts',
      'README.md',
      '.env.example',
      '.planning/ROADMAP.xml',
      '.planning/DECISIONS.xml',
      '.planning/PROJECT.md',
    ];
    for (const rel of expected) {
      assert.ok(
        fs.existsSync(path.join(targetDir, rel)),
        `expected file missing: ${rel}`,
      );
    }

    // package.json is parseable + named after slug.
    const pkg = JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.name, `@gad/site-${slug}`, 'package.json name substituted');
    assert.ok(pkg.scripts && pkg.scripts.dev, 'dev script present');
    assert.ok(pkg.scripts.build, 'build script present');

    // {{slug}} placeholder fully substituted (no Mustache leak).
    const readme = fs.readFileSync(path.join(targetDir, 'README.md'), 'utf8');
    assert.ok(!readme.includes('{{slug}}'), 'README placeholders substituted');
    assert.ok(readme.includes(slug), 'README contains slug');

    // .env.example carries the normalized placeholders from 84-04.
    const env = fs.readFileSync(path.join(targetDir, '.env.example'), 'utf8');
    assert.match(env, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key-here>/);
    assert.match(env, /CLERK_SECRET_KEY=<your-clerk-secret-key-here>/);
    assert.match(env, /AI_GATEWAY_API_KEY=<your-ai-gateway-key-here>/);

    // ROADMAP / DECISIONS XML stubs are well-formed enough to be valid XML
    // prologue + a root element.
    const roadmap = fs.readFileSync(path.join(targetDir, '.planning/ROADMAP.xml'), 'utf8');
    assert.match(roadmap, /<roadmap projectId="/);
    assert.ok(roadmap.includes(`projectId="${slug}"`), 'ROADMAP projectId substituted');

    const decisions = fs.readFileSync(path.join(targetDir, '.planning/DECISIONS.xml'), 'utf8');
    assert.match(decisions, /<decisions projectId="/);
    assert.ok(decisions.includes(`projectId="${slug}"`), 'DECISIONS projectId substituted');
  } finally {
    rmrf(tmp);
  }
});

test('addToPnpmWorkspace is a no-op when sites/* glob exists', () => {
  const tmp = mkTmp('gad-site-new-ws-');
  const wsPath = path.join(tmp, 'pnpm-workspace.yaml');
  fs.writeFileSync(wsPath, 'packages:\n  - "apps/*"\n  - "sites/*"\n', 'utf8');
  try {
    const r = addToPnpmWorkspace({ slug: 'fresh-site', workspaceYamlPath: wsPath });
    assert.strictEqual(r.touched, false, 'glob coverage means no write');
    assert.match(r.reason, /sites\/\*/, 'reason names the glob');
  } finally {
    rmrf(tmp);
  }
});

test('addToPnpmWorkspace appends explicit entry when no glob covers it', () => {
  const tmp = mkTmp('gad-site-new-ws-');
  const wsPath = path.join(tmp, 'pnpm-workspace.yaml');
  fs.writeFileSync(wsPath, 'packages:\n  - "apps/*"\n  - "packages/*"\n', 'utf8');
  try {
    const r = addToPnpmWorkspace({ slug: 'new-site', workspaceYamlPath: wsPath });
    assert.strictEqual(r.touched, true, 'explicit append performed');
    const after = fs.readFileSync(wsPath, 'utf8');
    assert.match(after, /- "sites\/new-site"/, 'explicit entry written');
    // Idempotent — second call is a no-op.
    const r2 = addToPnpmWorkspace({ slug: 'new-site', workspaceYamlPath: wsPath });
    assert.strictEqual(r2.touched, false, 'idempotent on second call');
  } finally {
    rmrf(tmp);
  }
});

test('addToPnpmWorkspace returns non-fatal reason when file missing', () => {
  const tmp = mkTmp('gad-site-new-ws-');
  const wsPath = path.join(tmp, 'no-such.yaml');
  try {
    const r = addToPnpmWorkspace({ slug: 'x', workspaceYamlPath: wsPath });
    assert.strictEqual(r.touched, false);
    assert.match(r.reason, /not found/);
  } finally {
    rmrf(tmp);
  }
});
