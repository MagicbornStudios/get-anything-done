'use strict';
/**
 * Tests for `gad dev` launch resolution logic.
 *
 * Covers the three context detection paths:
 *   1. monorepo cwd  → kael=tauri-dev + browser surfaces for consumer-web + platform
 *   2. unrelated gad project (only .planning/, no apps/) → kael=global-build
 *   3. apps/desktop cwd → kael=tauri-dev, no other surfaces
 *
 * Uses os.tmpdir() fixture dirs. Global-build path resolution is tested by
 * temporarily writing a fake exe to a LOCALAPPDATA candidate path then
 * restoring env after each test.
 *
 * All tests use --dry-run --json to avoid spawning any real process.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs   = require('node:fs');
const os   = require('node:os');
const path = require('node:path');

const GAD = path.resolve(__dirname, '..', 'bin', 'gad.cjs');

/**
 * Invoke `gad dev --dry-run --json` from a given cwd.
 * Returns the parsed JSON resolution object.
 */
function resolveFrom(cwd, extraArgs = [], extraEnv = {}) {
  const out = execFileSync(
    process.execPath,
    [GAD, 'dev', '--dry-run', '--json', ...extraArgs],
    {
      cwd,
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
    }
  );
  return JSON.parse(out.trim());
}

/**
 * Create a minimal monorepo fixture:
 *   <root>/
 *     pnpm-workspace.yaml
 *     apps/desktop/package.json   (name: @gad/desktop)
 *     apps/platform/package.json  (name: @gad/platform)
 *     .planning/
 */
function makeMonorepoFixture(tmpDir) {
  const root = path.join(tmpDir, 'mono');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n', 'utf8');
  const desktopDir  = path.join(root, 'apps', 'desktop');
  const platformDir = path.join(root, 'apps', 'platform');
  fs.mkdirSync(desktopDir,  { recursive: true });
  fs.mkdirSync(platformDir, { recursive: true });
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(desktopDir,  'package.json'), JSON.stringify({ name: '@gad/desktop',  version: '0.0.0' }), 'utf8');
  fs.writeFileSync(path.join(platformDir, 'package.json'), JSON.stringify({ name: '@gad/platform', version: '0.0.0' }), 'utf8');
  return root;
}

/**
 * Create a minimal apps/desktop fixture:
 *   <root>/
 *     pnpm-workspace.yaml
 *     apps/desktop/
 *       package.json (name: @gad/desktop)  ← cwd is THIS dir
 *     .planning/
 */
function makeDesktopFixture(tmpDir) {
  const root = makeMonorepoFixture(tmpDir);  // includes pnpm-workspace.yaml
  return path.join(root, 'apps', 'desktop'); // cwd is apps/desktop
}

/**
 * Create an unrelated gad project fixture:
 *   <root>/
 *     .planning/
 *     (no apps/desktop, no apps/platform)
 */
function makeGadProjectFixture(tmpDir) {
  const root = path.join(tmpDir, 'gadproj');
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  return root;
}

// ---------------------------------------------------------------------------
// Test 1: monorepo cwd
// ---------------------------------------------------------------------------
describe('gad dev resolution — monorepo cwd', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-dev-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('resolves kael to tauri-dev and includes consumer-web + platform surfaces', () => {
    const root = makeMonorepoFixture(tmp);
    const result = resolveFrom(root);

    assert.strictEqual(result.context, 'monorepo', 'context should be monorepo');

    // Kael must be tauri-dev
    assert.ok(result.kael, 'kael resolution must be present');
    assert.strictEqual(result.kael.mode, 'tauri-dev', 'kael mode should be tauri-dev in monorepo');
    assert.ok(result.kael.command.includes('pnpm'), 'kael command should use pnpm');
    assert.ok(result.kael.command.includes('dev'), 'kael command should include dev script');

    // Must include consumer-web and platform surfaces
    const surfaceNames = result.surfaces.map(s => s.name);
    assert.ok(surfaceNames.includes('consumer-web'), 'surfaces must include consumer-web');
    assert.ok(surfaceNames.includes('platform'), 'surfaces must include platform');

    const web = result.surfaces.find(s => s.name === 'consumer-web');
    assert.ok(web.url, 'consumer-web must have a url');
    assert.strictEqual(web.mode, 'browser', 'consumer-web mode must be browser');

    const plat = result.surfaces.find(s => s.name === 'platform');
    assert.ok(plat.url, 'platform must have a url');
    assert.strictEqual(plat.mode, 'browser', 'platform mode must be browser');
  });
});

// ---------------------------------------------------------------------------
// Test 2: unrelated gad project (only .planning/, no apps/)
// ---------------------------------------------------------------------------
describe('gad dev resolution — unrelated gad project', () => {
  let tmp;
  let fakeExePath;
  let origLocalAppData;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-dev-test-'));
    // Fake LOCALAPPDATA pointing into tmp so findGlobalKaelBuild() finds a fake exe
    const fakeLocalAppData = path.join(tmp, 'AppData', 'Local');
    const fakeKaelDir = path.join(fakeLocalAppData, 'Programs', 'Kael');
    fs.mkdirSync(fakeKaelDir, { recursive: true });
    fakeExePath = path.join(fakeKaelDir, 'Kael.exe');
    fs.writeFileSync(fakeExePath, '#!/bin/sh\necho fake-kael\n', 'utf8');

    origLocalAppData = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = fakeLocalAppData;
  });
  afterEach(() => {
    if (origLocalAppData === undefined) {
      delete process.env.LOCALAPPDATA;
    } else {
      process.env.LOCALAPPDATA = origLocalAppData;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('resolves kael to global-build and produces no other surfaces', () => {
    const root = makeGadProjectFixture(tmp);
    const result = resolveFrom(root, [], { LOCALAPPDATA: process.env.LOCALAPPDATA });

    assert.strictEqual(result.context, 'gad-project', 'context should be gad-project');

    assert.ok(result.kael, 'kael resolution must be present');
    assert.strictEqual(result.kael.mode, 'global-build', 'kael mode must be global-build for unrelated project');
    assert.ok(result.kael.exe, 'kael must have an exe path');
    assert.ok(fs.existsSync(result.kael.exe), 'kael exe path must exist on disk');

    // No other surfaces for an unrelated gad project
    assert.strictEqual(result.surfaces.length, 0, 'no other surfaces for unrelated gad project');
  });
});

// ---------------------------------------------------------------------------
// Test 3: apps/desktop cwd
// ---------------------------------------------------------------------------
describe('gad dev resolution — apps/desktop cwd', () => {
  let tmp;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-dev-test-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('resolves kael to tauri-dev and produces no other surfaces', () => {
    const desktopCwd = makeDesktopFixture(tmp);
    const result = resolveFrom(desktopCwd);

    assert.strictEqual(result.context, 'desktop', 'context should be desktop');

    assert.ok(result.kael, 'kael resolution must be present');
    assert.strictEqual(result.kael.mode, 'tauri-dev', 'kael mode should be tauri-dev for apps/desktop cwd');
    assert.ok(result.kael.command.includes('pnpm'), 'kael command should use pnpm');

    // No extra surfaces when running from apps/desktop directly
    assert.strictEqual(result.surfaces.length, 0, 'no extra surfaces when cwd is apps/desktop');
  });
});
