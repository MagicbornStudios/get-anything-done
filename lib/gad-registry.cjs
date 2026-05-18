'use strict';
/**
 * lib/gad-registry.cjs — global GAD project registry at ~/.gad/registry.json
 *
 * Enables `gad config register/unregister/list` to track project roots
 * across directories so cross-repo commands can locate planning data
 * without requiring the user to cd into each root.
 *
 * Schema: { projects: [{ id, path, registered_at }] }
 *
 * Phase 121-03 (2026-05-18)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const GAD_HOME = path.join(os.homedir(), '.gad');
const REGISTRY_PATH = path.join(GAD_HOME, 'registry.json');

function ensureGadHome() {
  if (!fs.existsSync(GAD_HOME)) {
    fs.mkdirSync(GAD_HOME, { recursive: true });
  }
}

function loadRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.projects)) return parsed;
  } catch {
    // File doesn't exist or is malformed — start fresh
  }
  return { projects: [] };
}

function saveRegistry(registry) {
  ensureGadHome();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
}

/**
 * Register a project root in the global registry.
 * If the project id already exists, update its path.
 * Auto-detects id from gad-config.toml or uses directory basename.
 *
 * @param {string} projectPath - Absolute path to the project root
 * @param {string} [id] - Explicit project id (auto-detected if omitted)
 * @returns {{ id: string, path: string, registered_at: string, action: 'added'|'updated' }}
 */
function registerProject(projectPath, id) {
  const absPath = path.resolve(projectPath);
  let projectId = id;
  if (!projectId) {
    // Try to read id from gad-config.toml roots[0] or use basename
    try {
      const gadConfig = require('./gad-config-loader.cjs') || require('../bin/gad-config.cjs');
      const cfg = gadConfig.load(absPath);
      if (cfg && cfg.roots && cfg.roots[0] && cfg.roots[0].id) {
        projectId = cfg.roots[0].id;
      }
    } catch {
      // ignore
    }
    if (!projectId) {
      projectId = path.basename(absPath);
    }
  }

  const registry = loadRegistry();
  const existing = registry.projects.findIndex((p) => p.id === projectId);
  const entry = {
    id: projectId,
    path: absPath,
    registered_at: new Date().toISOString(),
  };
  let action;
  if (existing >= 0) {
    registry.projects[existing] = entry;
    action = 'updated';
  } else {
    registry.projects.push(entry);
    action = 'added';
  }
  saveRegistry(registry);
  return { ...entry, action };
}

/**
 * Remove a project from the registry by id or path.
 * @param {string} idOrPath
 * @returns {boolean} true if removed, false if not found
 */
function unregisterProject(idOrPath) {
  const registry = loadRegistry();
  const absPath = path.resolve(idOrPath);
  const before = registry.projects.length;
  registry.projects = registry.projects.filter(
    (p) => p.id !== idOrPath && p.path !== absPath,
  );
  if (registry.projects.length === before) return false;
  saveRegistry(registry);
  return true;
}

/**
 * List all registered projects. Marks stale entries (path no longer exists).
 * @returns {Array<{ id: string, path: string, registered_at: string, stale: boolean }>}
 */
function listProjects() {
  const registry = loadRegistry();
  return registry.projects.map((p) => ({
    ...p,
    stale: !fs.existsSync(p.path),
  }));
}

/**
 * Look up a registered project by id.
 * @param {string} id
 * @returns {{ id: string, path: string, registered_at: string }|null}
 */
function findProject(id) {
  const registry = loadRegistry();
  return registry.projects.find((p) => p.id === id) || null;
}

/**
 * Auto-register the current repo root if it has a gad-config.toml or .planning/.
 * Called from findRepoRoot success path (non-destructive if already registered).
 * @param {string} repoRoot
 * @param {string} [id]
 */
function autoRegister(repoRoot, id) {
  try {
    const registry = loadRegistry();
    const absPath = path.resolve(repoRoot);
    const existingById = id && registry.projects.find((p) => p.id === id);
    const existingByPath = registry.projects.find((p) => p.path === absPath);
    // Only auto-register if not already present — avoid writing on every CLI call
    if (!existingById && !existingByPath) {
      registerProject(absPath, id);
    }
  } catch {
    // Auto-register is best-effort; never crash the CLI
  }
}

module.exports = {
  REGISTRY_PATH,
  GAD_HOME,
  loadRegistry,
  saveRegistry,
  registerProject,
  unregisterProject,
  listProjects,
  findProject,
  autoRegister,
};
