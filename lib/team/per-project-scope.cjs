'use strict';
/**
 * lib/team/per-project-scope.cjs — read `[runtimes.<projectid>]` from
 * gad-config.toml and filter the global account pool to the project's
 * allowlist.
 *
 * Design: .planning/notes/2026-05-18-per-project-runtime-scoping-design.md
 * Task:   GLOBAL-T-87-03
 *
 * Schema (in gad-config.toml at repo root):
 *
 *   [runtimes.<projectid>]
 *   <provider> = ["label-1", "label-2", ...]
 *
 * Semantics:
 *   - `[runtimes]` missing entirely         → no scoping anywhere.
 *   - `[runtimes.<projectid>]` missing      → no scoping for this project.
 *   - provider key missing                  → full pool for that provider.
 *   - provider key empty []                 → full pool for that provider (explicit "all").
 *   - provider key non-empty                → ALLOWLIST (only listed labels).
 *
 * This file is read-only. It does not mutate the global pool. Callers that
 * want a filtered view call `filterAccountsForProject(rawAccounts, scope, provider)`
 * or `isAccountInProjectScope(scope, provider, label)`.
 */

const fs = require('fs');
const path = require('path');

// Lazy require to avoid circular import with gad-config.cjs at module load.
function loadGadConfigToml(repoRoot) {
  const gadConfig = require('../../bin/gad-config.cjs');
  return gadConfig.load(repoRoot);
}

/**
 * Read the per-project runtime scope from gad-config.toml.
 *
 * @param {string} repoRoot - absolute path to monorepo root
 * @param {string} projectid - active project id (e.g. 'slm-learning')
 * @returns {object|null} { <provider>: string[] } or null if no scoping
 */
function loadProjectAccountScope(repoRoot, projectid) {
  if (!projectid) return null;
  const cfg = loadGadConfigToml(repoRoot);
  const runtimes = cfg && cfg.runtimes;
  if (!runtimes || typeof runtimes !== 'object') return null;
  const scope = runtimes[projectid];
  if (!scope || typeof scope !== 'object') return null;
  // Normalize: lowercase provider keys, ensure values are arrays of strings.
  const normalized = {};
  for (const [provider, labels] of Object.entries(scope)) {
    if (!Array.isArray(labels)) continue;
    normalized[String(provider).toLowerCase()] = labels
      .map((l) => String(l || '').trim())
      .filter(Boolean);
  }
  return normalized;
}

/**
 * Is this (provider, label) usable for the project?
 *
 * @param {object|null} scope - return value of loadProjectAccountScope
 * @param {string} provider - 'codex' | 'claude' | 'gemini' | 'opencode' | ...
 * @param {string} label
 * @returns {boolean}
 */
function isAccountInProjectScope(scope, provider, label) {
  if (!scope) return true;                                // unscoped → allow
  const allow = scope[String(provider || '').toLowerCase()];
  if (!Array.isArray(allow)) return true;                 // provider unrestricted
  if (allow.length === 0) return true;                    // explicit "all"
  return allow.includes(String(label || ''));
}

/**
 * Filter an array of accounts (as produced by accounts-registry / rate-limit
 * listing) to those allowed by the project scope.
 *
 * @param {Array<object>} accounts - each item must have `provider` and `label`.
 * @param {object|null} scope
 * @returns {Array<object>}
 */
function filterAccountsForProject(accounts, scope) {
  if (!Array.isArray(accounts)) return [];
  if (!scope) return accounts.slice();
  return accounts.filter((a) =>
    isAccountInProjectScope(scope, a && a.provider, a && a.label),
  );
}

/**
 * Convenience: load the scope and return a per-(provider,label) predicate.
 * Returns `() => true` if scope is absent.
 */
function makeScopePredicate(repoRoot, projectid) {
  const scope = loadProjectAccountScope(repoRoot, projectid);
  return (provider, label) => isAccountInProjectScope(scope, provider, label);
}

module.exports = {
  loadProjectAccountScope,
  isAccountInProjectScope,
  filterAccountsForProject,
  makeScopePredicate,
};
