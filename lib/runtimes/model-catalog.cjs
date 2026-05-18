'use strict';
/**
 * model-catalog.cjs — loader for .planning/runtimes/model-catalog.toml
 *
 * Exposes:
 *   getModelForKind(runtime, kind)  → primary model string
 *   getModelList(runtime, kind)     → string[] (primary + fallbacks)
 *   listRuntimes()                  → string[] of registered runtime ids
 *
 * Catalog path resolution (first found wins):
 *   1. GAD_MODEL_CATALOG_PATH env var
 *   2. <repoRoot>/.planning/runtimes/model-catalog.toml  (walk up from cwd)
 *   3. <thisFile>/../../../.planning/runtimes/model-catalog.toml  (relative to this module)
 *
 * No external dependencies — uses same minimal TOML parser pattern as
 * settings-registry.cjs (flat [section.subsection] tables only).
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal TOML parser (flat tables only; subset of settings-registry.cjs)
// ---------------------------------------------------------------------------

function parseTomlSections(text) {
  const sections = new Map();
  sections.set('', new Map());
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const headerMatch = stripped.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      current = headerMatch[1].trim();
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const eqIdx = stripped.indexOf('=');
    if (eqIdx === -1) continue;
    const k = stripped.slice(0, eqIdx).trim();
    const rawV = stripped.slice(eqIdx + 1).trim();
    sections.get(current).set(k, rawV);
  }
  return sections;
}

function parseTomlScalar(rawV) {
  const dq = rawV.match(/^"(.*)"$/s);
  if (dq) return dq[1];
  const sq = rawV.match(/^'(.*)'$/s);
  if (sq) return sq[1];
  return rawV;
}

// ---------------------------------------------------------------------------
// Catalog path resolution
// ---------------------------------------------------------------------------

function findRepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    if (
      fs.existsSync(path.join(dir, '.planning', 'runtimes', 'model-catalog.toml'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveCatalogPath() {
  if (process.env.GAD_MODEL_CATALOG_PATH) {
    return process.env.GAD_MODEL_CATALOG_PATH;
  }
  // Walk up from cwd
  const fromCwd = findRepoRoot(process.cwd());
  if (fromCwd) {
    return path.join(fromCwd, '.planning', 'runtimes', 'model-catalog.toml');
  }
  // Relative to this module: lib/runtimes/ → repo root → .planning/runtimes/
  const moduleDir = path.dirname(__filename);
  const candidate = path.resolve(moduleDir, '..', '..', '..', '.planning', 'runtimes', 'model-catalog.toml');
  if (fs.existsSync(candidate)) return candidate;
  return null;
}

// ---------------------------------------------------------------------------
// Parse catalog
// ---------------------------------------------------------------------------

/** @returns {Map<string, {cheap: string, mid: string, heavy: string}>} */
function loadCatalog() {
  const catalogPath = resolveCatalogPath();
  if (!catalogPath || !fs.existsSync(catalogPath)) {
    throw new Error(
      `model-catalog.toml not found. Searched cwd walk-up and module-relative path. ` +
      `Set GAD_MODEL_CATALOG_PATH to override.`
    );
  }
  const text = fs.readFileSync(catalogPath, 'utf8');
  const sections = parseTomlSections(text);
  const catalog = new Map();

  for (const [sectionKey, kvMap] of sections) {
    // We care about sections of the form: runtimes.<runtime-id>
    const match = sectionKey.match(/^runtimes\.(.+)$/);
    if (!match) continue;
    const runtimeId = match[1];
    const entry = {};
    for (const [k, rawV] of kvMap) {
      entry[k] = parseTomlScalar(rawV);
    }
    catalog.set(runtimeId, entry);
  }
  return catalog;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const VALID_KINDS = ['cheap', 'mid', 'heavy'];

/**
 * Return the primary model string for a given runtime + kind.
 * @param {string} runtime  e.g. 'claude-code', 'codex-cli', 'ollama'
 * @param {'cheap'|'mid'|'heavy'} kind
 * @returns {string}  primary model id (first if comma-separated list)
 */
function getModelForKind(runtime, kind) {
  if (!VALID_KINDS.includes(kind)) {
    throw new Error(`Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}`);
  }
  const catalog = loadCatalog();
  const entry = catalog.get(runtime);
  if (!entry) {
    const known = Array.from(catalog.keys()).join(', ');
    throw new Error(`Unknown runtime "${runtime}". Registered: ${known}`);
  }
  const value = entry[kind];
  if (!value) {
    throw new Error(`Runtime "${runtime}" has no "${kind}" tier defined in model-catalog.toml`);
  }
  // Return primary (first in comma-separated list)
  return value.split(',')[0].trim();
}

/**
 * Return all model fallbacks (primary + alternatives) for a runtime + kind.
 * @param {string} runtime
 * @param {'cheap'|'mid'|'heavy'} kind
 * @returns {string[]}
 */
function getModelList(runtime, kind) {
  if (!VALID_KINDS.includes(kind)) {
    throw new Error(`Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}`);
  }
  const catalog = loadCatalog();
  const entry = catalog.get(runtime);
  if (!entry) {
    const known = Array.from(catalog.keys()).join(', ');
    throw new Error(`Unknown runtime "${runtime}". Registered: ${known}`);
  }
  const value = entry[kind];
  if (!value) {
    throw new Error(`Runtime "${runtime}" has no "${kind}" tier defined in model-catalog.toml`);
  }
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Return all registered runtime ids.
 * @returns {string[]}
 */
function listRuntimes() {
  const catalog = loadCatalog();
  return Array.from(catalog.keys());
}

module.exports = {
  getModelForKind,
  getModelList,
  listRuntimes,
  resolveCatalogPath,
};
