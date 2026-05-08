'use strict';
/**
 * lib/inventory.cjs
 *
 * Cross-project inventory collectors for `gad inventory`.
 * Read-only — never modifies or removes any file.
 *
 * Sections:
 *   collectRuntimeClis()      — runtime CLI installs + versions
 *   collectLocalModels()      — slm-learning REGISTRY.json lanes
 *   collectEmbeddingModels()  — .gad/models/ installed embedding models
 *   collectGadSidecars()      — %LOCALAPPDATA%/Programs/gad/bin/ (Win) or /usr/local/bin/gad* (Unix)
 *   collectBuiltBinaries()    — vendor/get-anything-done/dist/release/ exe/bin
 *   collectPerProjectBins()   — bin/ or tools/ dirs per planning root
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)}GB`;
}

function formatMtime(mtime) {
  if (!mtime) return '';
  const d = new Date(mtime);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function spawnVersion(command, args, timeoutMs) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: timeoutMs || 2000,
      shell: false,
      env: process.env,
    });
    if (result.error) return null;
    if (result.signal === 'SIGTERM') return null;
    const text = ((result.stdout || '') + '\n' + (result.stderr || '')).trim();
    const line = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (!line) return null;
    const m = line.match(/([0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9._-]+)?)/);
    return m ? m[1] : line.slice(0, 60);
  } catch {
    return null;
  }
}

function statSafe(filePath) {
  try { return fs.statSync(filePath); } catch { return null; }
}

function dirSizeBytes(dirPath) {
  let total = 0;
  const walk = (p) => {
    let st;
    try { st = fs.statSync(p); } catch { return; }
    if (st.isDirectory()) {
      let entries;
      try { entries = fs.readdirSync(p); } catch { return; }
      for (const name of entries) walk(path.join(p, name));
    } else {
      total += st.size;
    }
  };
  walk(dirPath);
  return total;
}

function isExecutable(filePath) {
  // On Windows, check extension; on Unix check execute bit.
  if (process.platform === 'win32') {
    return /\.(exe|cmd|bat|ps1|sh|cjs|js)$/i.test(filePath);
  }
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Section A: Runtime CLIs
// ---------------------------------------------------------------------------

const RUNTIME_CLI_DEFS = [
  { id: 'claude-code',   bin: 'claude',    versionArgs: ['--version'] },
  { id: 'codex-cli',     bin: 'codex',     versionArgs: ['--version'] },
  { id: 'gemini-cli',    bin: 'gemini',    versionArgs: ['--version'] },
  { id: 'opencode',      bin: 'opencode',  versionArgs: ['--version'] },
  { id: 'cursor-agent',  bin: 'cursor',    versionArgs: ['--version'] },
];

/**
 * Reuse lib/runtime-health checkInstall when available; fall back to direct probe.
 */
function collectRuntimeClis() {
  let checkInstall = null;
  try {
    const rh = require('./runtime-health/index.cjs');
    checkInstall = rh.checkInstall;
  } catch {}

  const results = [];
  for (const def of RUNTIME_CLI_DEFS) {
    let installed = false;
    let version = null;
    let binPath = null;

    if (checkInstall && def.id !== 'cursor-agent') {
      // runtime-health knows claude-code, codex-cli, gemini-cli, opencode
      try {
        const r = checkInstall(def.id, { timeoutMs: 2000 });
        installed = r.install === 'ok';
        version = r.version || null;
        binPath = r.path || null;
      } catch {
        // fall through to direct probe
      }
    }

    if (!installed && version === null) {
      // Direct probe (cursor-agent or fallback)
      const v = spawnVersion(def.bin, def.versionArgs, 2000);
      if (v !== null) {
        installed = true;
        version = v;
        binPath = def.bin;
      } else {
        installed = false;
        version = null;
        binPath = null;
      }
    }

    results.push({
      id: def.id,
      installed: installed ? 'yes' : 'no',
      version: version || 'n/a',
      path: binPath || 'n/a',
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Section B: Local Models (slm-learning REGISTRY.json)
// ---------------------------------------------------------------------------

const SLM_REGISTRY_PATH = path.join(
  os.homedir(),
  'Documents',
  'slm_learning',
  'models',
  'REGISTRY.json',
);

function resolveModelSizeOnDisk(modelId, registryDir) {
  // HuggingFace-style: <registry_dir>/<org>/<model>  or  <registry_dir>/<model>
  const parts = String(modelId || '').split('/');
  const candidates = [
    path.join(registryDir, ...parts),
    path.join(registryDir, parts[parts.length - 1]),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return dirSizeBytes(candidate);
    }
  }
  return null;
}

function flattenLaneModels(laneName, laneData, registryDir) {
  const rows = [];
  const push = (id, status, scores) => {
    if (!id) return;
    const sizeBytes = resolveModelSizeOnDisk(id, registryDir);
    rows.push({
      lane: laneName,
      id,
      status,
      scores: scores ? JSON.stringify(scores).slice(0, 80) : 'n/a',
      size: sizeBytes != null ? formatBytes(sizeBytes) : 'remote',
    });
  };

  if (laneData.canonical) {
    push(laneData.canonical, 'canonical', laneData.canonical_score);
  }
  for (const m of laneData.staging || []) {
    const id = typeof m === 'string' ? m : m.id;
    push(id, 'staging', null);
  }
  for (const m of laneData.candidates || []) {
    const id = typeof m === 'string' ? m : m.id;
    push(id, 'candidate', m.scores || null);
  }
  for (const m of laneData.rejected || []) {
    const id = typeof m === 'string' ? m : m.id;
    push(id, 'rejected', m.scores || null);
  }
  return rows;
}

function collectLocalModels() {
  const registryPath = SLM_REGISTRY_PATH;
  if (!fs.existsSync(registryPath)) {
    return { error: `REGISTRY.json not found at ${registryPath}`, models: [] };
  }
  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (e) {
    return { error: `Failed to parse REGISTRY.json: ${e.message}`, models: [] };
  }

  const registryDir = path.dirname(registryPath);
  const models = [];
  const lanes = registry.lanes || {};
  for (const [laneName, laneData] of Object.entries(lanes)) {
    for (const row of flattenLaneModels(laneName, laneData, registryDir)) {
      models.push(row);
    }
  }
  return { error: null, models };
}

// ---------------------------------------------------------------------------
// Section C: Embedding Models
// ---------------------------------------------------------------------------

function collectEmbeddingModels(repoRoot) {
  const results = [];
  try {
    const emb = require('./embeddings.cjs');
    const installed = emb.listInstalledModels(repoRoot || process.cwd());
    for (const m of installed) {
      const curated = emb.CURATED_MODELS.find((c) => c.id === m.id);
      results.push({
        id: m.id,
        tag: curated ? curated.tag : 'custom',
        dim: curated ? String(curated.dim) : 'n/a',
        size: formatBytes(m.sizeBytes),
        path: m.path,
      });
    }
  } catch {
    // embeddings lib not available or no models installed — return empty
  }
  return results;
}

// ---------------------------------------------------------------------------
// Section D: GAD Sidecars (installed programs directory)
// ---------------------------------------------------------------------------

function gadSidecarDir() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'Programs', 'gad', 'bin');
  }
  return '/usr/local/bin';
}

function collectGadSidecars() {
  const dir = gadSidecarDir();
  const results = [];
  if (!fs.existsSync(dir)) return results;

  let entries;
  try { entries = fs.readdirSync(dir); } catch { return results; }

  for (const name of entries.sort()) {
    const filePath = path.join(dir, name);
    const st = statSafe(filePath);
    if (!st || !st.isFile()) continue;

    // On Unix, limit to gad* files; on Win include all exe/cjs
    if (process.platform !== 'win32' && !name.startsWith('gad')) continue;
    if (!isExecutable(filePath)) continue;

    // Try to get version from the binary (only for gad.exe / gad.cjs, not TUI or old backups)
    let version = 'n/a';
    const isMainGad = /^gad\.(exe|cjs)$/i.test(name);
    if (isMainGad && !name.includes('.old-')) {
      const v = spawnVersion(filePath, ['--version'], 2000);
      // Only accept a clean semver string, not multi-line startup noise
      if (v && /^[0-9]+\.[0-9]+\.[0-9]+/.test(v)) version = v;
    }

    results.push({
      name,
      version,
      size: formatBytes(st.size),
      mtime: formatMtime(st.mtime),
      path: filePath,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Section E: Built Binaries (dist/release/)
// ---------------------------------------------------------------------------

function collectBuiltBinaries(gadVendorDir) {
  const results = [];
  const releaseDir = path.join(gadVendorDir, 'dist', 'release');
  if (!fs.existsSync(releaseDir)) return results;

  let entries;
  try { entries = fs.readdirSync(releaseDir); } catch { return results; }

  const exts = process.platform === 'win32' ? /\.(exe)$/i : /\.(bin|sh)$/i;
  // Also always include .exe for cross-platform visibility
  const allBinExts = /\.(exe|bin|sh)$/i;

  for (const name of entries.sort()) {
    if (!allBinExts.test(name)) continue;
    const filePath = path.join(releaseDir, name);
    const st = statSafe(filePath);
    if (!st || !st.isFile()) continue;

    results.push({
      name,
      size: formatBytes(st.size),
      mtime: formatMtime(st.mtime),
      path: filePath,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Section F: Per-Project Bins
// ---------------------------------------------------------------------------

function walkBinDir(dirPath, projectId) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return results; }

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    const filePath = path.join(dirPath, entry.name);
    if (!isExecutable(filePath)) continue;
    // Skip node_modules (shouldn't be here, but guard)
    if (filePath.includes('node_modules')) continue;
    const st = statSafe(filePath);
    if (!st) continue;
    results.push({
      project: projectId,
      name: entry.name,
      size: formatBytes(st.size),
      mtime: formatMtime(st.mtime),
      path: filePath,
    });
  }
  return results;
}

function collectPerProjectBins(gadVendorDir) {
  const results = [];
  // Collect from the monorepo roots referenced by gad config, and the vendor submodule itself
  const searchRoots = [];

  // gad vendor itself
  if (gadVendorDir) {
    searchRoots.push({ root: gadVendorDir, id: 'get-anything-done' });
  }

  // Try to read gad-config.toml roots from the monorepo root
  try {
    const monorepoRoot = path.resolve(gadVendorDir, '..', '..');
    const configPath = path.join(monorepoRoot, 'gad-config.toml');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      // Parse [[projects]] blocks for path fields
      const pathMatches = content.matchAll(/path\s*=\s*["']?([^"'\r\n]+)["']?/g);
      const idMatches = [...content.matchAll(/id\s*=\s*["']?([^"'\r\n]+)["']?/g)];
      let idx = 0;
      for (const m of pathMatches) {
        const rootPath = path.join(monorepoRoot, m[1].trim());
        const projectId = idMatches[idx] ? idMatches[idx][1].trim() : path.basename(rootPath);
        searchRoots.push({ root: rootPath, id: projectId });
        idx++;
      }
    }
  } catch {}

  const seen = new Set();
  for (const { root, id } of searchRoots) {
    for (const subdir of ['bin', 'tools']) {
      const dirPath = path.join(root, subdir);
      if (seen.has(dirPath)) continue;
      seen.add(dirPath);
      for (const row of walkBinDir(dirPath, id)) {
        results.push(row);
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * runInventory(opts?)
 * Collects all sections and returns structured data.
 *
 * @param {{ gadVendorDir?: string, repoRoot?: string }} opts
 * @returns {{ runtime_clis, local_models, embedding_models, gad_sidecars, built_binaries, per_project_bins }}
 */
function runInventory(opts = {}) {
  const gadVendorDir = opts.gadVendorDir || path.resolve(__dirname, '..');
  const repoRoot = opts.repoRoot || path.resolve(gadVendorDir, '..', '..');

  return {
    runtime_clis: collectRuntimeClis(),
    local_models: collectLocalModels(),
    embedding_models: collectEmbeddingModels(repoRoot),
    gad_sidecars: collectGadSidecars(),
    built_binaries: collectBuiltBinaries(gadVendorDir),
    per_project_bins: collectPerProjectBins(gadVendorDir),
  };
}

module.exports = {
  runInventory,
  collectRuntimeClis,
  collectLocalModels,
  collectEmbeddingModels,
  collectGadSidecars,
  collectBuiltBinaries,
  collectPerProjectBins,
  formatBytes,
};
