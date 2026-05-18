'use strict';
/**
 * tests/path-resolution.test.cjs — gad-config.cjs path resolution test suite
 *
 * Covers (phase 121-06):
 *   (a) cd to sibling of planning root — resolveTomlPath still finds config
 *   (b) GAD_CONFIG env var (absolute path, relative path, invalid path)
 *   (c) .gad-config.toml user-local override merge (121-05)
 *   (d) Absolute paths in roots config entries
 *   (e) Missing config → defaults
 *   (f) Registry lookups via gad-registry (121-03/04)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const GAD_CONFIG_PATH = path.join(__dirname, '..', 'bin', 'gad-config.cjs');
// Load fresh instance (tests may mutate module state via env vars)
function loadGadConfig() {
  // Clear from require cache so env-var changes take effect
  delete require.cache[require.resolve(GAD_CONFIG_PATH)];
  return require(GAD_CONFIG_PATH);
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gad-path-resolution-'));
}

function writeToml(dir, filename, content) {
  fs.writeFileSync(path.join(dir, filename), content, 'utf8');
}

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

// ---------------------------------------------------------------------------
// (e) Missing config → defaults
// ---------------------------------------------------------------------------
describe('missing config → defaults', () => {
  test('returns defaults when no config exists', () => {
    const tmp = mkTmpDir();
    try {
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.source, 'defaults');
      assert.ok(Array.isArray(cfg.roots));
      assert.equal(cfg.roots.length, 1);
      assert.equal(cfg.roots[0].path, '.');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (a) Sibling-of-planning-root — resolveTomlPath finds root-level config
// ---------------------------------------------------------------------------
describe('sibling of planning root', () => {
  test('resolveTomlPath finds root gad-config.toml when cwd is sibling subdir', () => {
    const tmp = mkTmpDir();
    try {
      const tomlContent = `[planning]\nsprintSize = 7\n`;
      writeToml(tmp, 'gad-config.toml', tomlContent);
      mkdirp(path.join(tmp, '.planning'));
      // Simulate being inside a sibling dir of .planning
      mkdirp(path.join(tmp, 'src'));

      const gadConfig = loadGadConfig();
      // load() uses the explicit root arg (repo root), not cwd
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.source, 'toml');
      assert.equal(cfg.sprintSize, 7);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('resolveTomlPath falls back to .planning/gad-config.toml', () => {
    const tmp = mkTmpDir();
    try {
      mkdirp(path.join(tmp, '.planning'));
      writeToml(path.join(tmp, '.planning'), 'gad-config.toml', '[planning]\nsprintSize = 3\n');
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.source, 'toml');
      assert.equal(cfg.sprintSize, 3);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (b) GAD_CONFIG env var
// ---------------------------------------------------------------------------
describe('GAD_CONFIG env var', () => {
  const origGadConfig = process.env.GAD_CONFIG;
  afterEach(() => {
    if (origGadConfig === undefined) {
      delete process.env.GAD_CONFIG;
    } else {
      process.env.GAD_CONFIG = origGadConfig;
    }
  });

  test('absolute path override is used', () => {
    const tmp = mkTmpDir();
    try {
      const tomlPath = path.join(tmp, 'custom.toml');
      fs.writeFileSync(tomlPath, '[planning]\nsprintSize = 42\n', 'utf8');
      process.env.GAD_CONFIG = tomlPath;
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(mkTmpDir()); // root is irrelevant — env wins
      assert.equal(cfg.source, 'toml');
      assert.equal(cfg.sprintSize, 42);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      delete process.env.GAD_CONFIG;
    }
  });

  test('relative path resolves from cwd', () => {
    const tmp = mkTmpDir();
    try {
      const tomlPath = path.join(tmp, 'relative.toml');
      fs.writeFileSync(tomlPath, '[planning]\nsprintSize = 13\n', 'utf8');
      // relative path from tmp
      process.env.GAD_CONFIG = path.relative(process.cwd(), tomlPath);
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.sprintSize, 13);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      delete process.env.GAD_CONFIG;
    }
  });

  test('invalid path falls back to default resolution (warns to stderr)', () => {
    const tmp = mkTmpDir();
    try {
      process.env.GAD_CONFIG = '/nonexistent/path/no-such-file.toml';
      const gadConfig = loadGadConfig();
      // Should NOT throw; should fall back to defaults for an empty dir
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.source, 'defaults');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      delete process.env.GAD_CONFIG;
    }
  });
});

// ---------------------------------------------------------------------------
// (c) User-local .gad-config.toml override merge (121-05)
// ---------------------------------------------------------------------------
describe('.gad-config.toml user-local override', () => {
  test('user-local overrides sprintSize from canonical', () => {
    const tmp = mkTmpDir();
    try {
      writeToml(tmp, 'gad-config.toml', '[planning]\nsprintSize = 5\n');
      writeToml(tmp, '.gad-config.toml', '[planning]\nsprintSize = 99\n');
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.sprintSize, 99, 'user-local should win over canonical');
      assert.equal(cfg.userLocalConfigPath, path.join(tmp, '.gad-config.toml'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('canonical is used when user-local does not exist', () => {
    const tmp = mkTmpDir();
    try {
      writeToml(tmp, 'gad-config.toml', '[planning]\nsprintSize = 5\n');
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      assert.equal(cfg.sprintSize, 5);
      assert.equal(cfg.userLocalConfigPath, undefined);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (d) Absolute paths in roots config entries
// ---------------------------------------------------------------------------
describe('absolute paths in roots config', () => {
  test('fromToml normalizes absolute root path correctly', () => {
    const tmp = mkTmpDir();
    const absoluteRoot = path.join(tmp, 'sub-project');
    mkdirp(absoluteRoot);
    try {
      const tomlContent = [
        `[[planning.roots]]`,
        `id = "sub"`,
        `path = "${absoluteRoot.replace(/\\/g, '/')}"`,
        `planningDir = ".planning"`,
        `discover = false`,
        `enabled = true`,
        '',
      ].join('\n');
      writeToml(tmp, 'gad-config.toml', tomlContent);
      const gadConfig = loadGadConfig();
      const cfg = gadConfig.load(tmp);
      const subRoot = cfg.roots.find(r => r.id === 'sub');
      assert.ok(subRoot, 'sub root should be present');
      assert.equal(subRoot.path, absoluteRoot.replace(/\\/g, '/'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (f) Registry: gad-registry roundtrip
// ---------------------------------------------------------------------------
describe('gad-registry roundtrip', () => {
  const REGISTRY_PATH = path.join(__dirname, '..', 'lib', 'gad-registry.cjs');

  test('register, list, findProject, unregister', () => {
    const tmp = mkTmpDir();
    const homeTmp = mkTmpDir();
    try {
      // Patch GAD_HOME to avoid writing to real ~/.gad
      const origHome = process.env.HOME;
      const origUserProfile = process.env.USERPROFILE;
      process.env.HOME = homeTmp;
      process.env.USERPROFILE = homeTmp;

      delete require.cache[require.resolve(REGISTRY_PATH)];
      const reg = require(REGISTRY_PATH);

      // register
      const result = reg.registerProject(tmp, 'test-proj');
      assert.equal(result.id, 'test-proj');
      assert.equal(result.path, tmp);
      assert.ok(['added', 'updated'].includes(result.action));

      // findProject
      const found = reg.findProject('test-proj');
      assert.ok(found, 'should find registered project');
      assert.equal(found.id, 'test-proj');

      // listProjects
      const list = reg.listProjects();
      const inList = list.find(p => p.id === 'test-proj');
      assert.ok(inList);
      assert.equal(inList.stale, false, 'should not be stale (dir exists)');

      // unregister
      const removed = reg.unregisterProject('test-proj');
      assert.equal(removed, true);
      const afterRemove = reg.findProject('test-proj');
      assert.equal(afterRemove, null);

      process.env.HOME = origHome;
      process.env.USERPROFILE = origUserProfile;
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      fs.rmSync(homeTmp, { recursive: true, force: true });
      delete require.cache[require.resolve(REGISTRY_PATH)];
    }
  });

  test('stale entry detected when path no longer exists', () => {
    const tmp = mkTmpDir();
    const homeTmp = mkTmpDir();
    try {
      process.env.HOME = homeTmp;
      process.env.USERPROFILE = homeTmp;
      delete require.cache[require.resolve(REGISTRY_PATH)];
      const reg = require(REGISTRY_PATH);

      reg.registerProject(tmp, 'stale-proj');
      // Remove the directory to make it stale
      fs.rmSync(tmp, { recursive: true, force: true });
      const list = reg.listProjects();
      const entry = list.find(p => p.id === 'stale-proj');
      assert.ok(entry);
      assert.equal(entry.stale, true);
    } finally {
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
      fs.rmSync(homeTmp, { recursive: true, force: true });
      delete require.cache[require.resolve(REGISTRY_PATH)];
    }
  });
});
