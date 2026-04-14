/**
 * Eval loader — project ⊇ species inheritance contract.
 *
 * Task 42.4-15, decision gad-184.
 *
 * The eval layout (phase 43, finalized by 42.4-14) is:
 *
 *     evals/<project>/project.json
 *     evals/<project>/species/<species>/species.json
 *
 * `project.json` declares defaults that every species in the project inherits:
 * `techStack`, `contextFramework`, `installedSkills`, `defaultContent`, and
 * any other project-wide metadata (domain, description, human_review_rubric,
 * scoring, cardImage, heroImage, etc.).
 *
 * `species.json` may override any of those fields, and also carries
 * species-only fields:
 *   - `inherits_from`: parent species name within the same project
 *   - `dna`: workflow + skill manifest summary
 *   - `description`: species-specific description (overrides project's)
 *
 * Readers MUST NOT manually combine a project + species pair. Instead they
 * go through {@link loadResolvedSpecies} / {@link loadAllResolvedSpecies} /
 * {@link mergeProjectSpecies}, which apply the merge in a single canonical
 * place so that every consumer (CLI, forge editor, site prebuild) sees the
 * same shape.
 *
 * Merge semantics (decision gad-184):
 *   1. Start from `project.json` as the base.
 *   2. Walk the `inherits_from` chain (species -> parent species within the
 *      same project), deepest parent first, applying each species on top
 *      of the previous layer. Cycles throw a clear error.
 *   3. Apply the target species last. Last write wins.
 *   4. Species-only fields (`inherits_from`, `dna`, species description)
 *      stay on the merged result but do NOT back-propagate to the shared
 *      project defaults.
 *   5. Array fields like `installedSkills` are REPLACED, not concatenated.
 *      A future `_extends: true` convention could opt into merging, but for
 *      now the simpler replace semantics win — documented and enforced by
 *      tests so no caller depends on concat.
 *
 * @typedef {Object} ProjectConfig
 * @property {string} [id]                  project id (dir name)
 * @property {string} [name]
 * @property {string} [slug]
 * @property {string} [description]
 * @property {string} [domain]
 * @property {string} [techStack]
 * @property {string} [contextFramework]
 * @property {string[]} [installedSkills]
 * @property {*}       [defaultContent]     paths or refs to default assets
 * @property {Object}  [human_review_rubric]
 * @property {Object}  [scoring]
 *
 * @typedef {Object} SpeciesConfig
 * @property {string}  [id]
 * @property {string}  [name]
 * @property {string}  [description]
 * @property {string}  [workflow]
 * @property {string}  [inherits_from]       parent species id within same project
 * @property {*}       [dna]
 * @property {string}  [techStack]           may override project
 * @property {string}  [contextFramework]    may override project
 * @property {string[]} [installedSkills]    REPLACES project list
 * @property {*}       [defaultContent]
 *
 * @typedef {Object} ResolvedSpecies
 * @property {string} project                project id
 * @property {string} species                species id
 * Plus every merged field from ProjectConfig + SpeciesConfig chain.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/** Read a JSON file, returning {} if missing, throwing on parse error. */
function readJsonOrEmpty(p) {
  if (!fs.existsSync(p)) return {};
  const raw = fs.readFileSync(p, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`eval-loader: failed to parse ${p}: ${err.message}`);
  }
}

/**
 * Load a project's `project.json`. Returns {} if the file is missing so
 * degenerate projects without declared defaults still work.
 * @param {string} projectDir absolute path to evals/<project>/
 * @returns {ProjectConfig}
 */
function loadProject(projectDir) {
  const cfg = readJsonOrEmpty(path.join(projectDir, 'project.json'));
  if (!cfg.id) cfg.id = path.basename(projectDir);
  return cfg;
}

/**
 * Load a single species' raw `species.json`. Throws if the species
 * directory or file does not exist — callers should handle that.
 * @param {string} projectDir
 * @param {string} speciesName
 * @returns {SpeciesConfig}
 */
function loadSpecies(projectDir, speciesName) {
  const speciesDir = path.join(projectDir, 'species', speciesName);
  const speciesJson = path.join(speciesDir, 'species.json');
  if (!fs.existsSync(speciesJson)) {
    throw new Error(`eval-loader: species.json not found at ${speciesJson}`);
  }
  const cfg = readJsonOrEmpty(speciesJson);
  if (!cfg.id) cfg.id = speciesName;
  return cfg;
}

/**
 * List all species config objects under a project (unmerged). Used by
 * merge chain resolution so we don't re-read species.json repeatedly.
 * @param {string} projectDir
 * @returns {Record<string, SpeciesConfig>} keyed by species name
 */
function loadAllSpeciesRaw(projectDir) {
  const speciesRoot = path.join(projectDir, 'species');
  const out = {};
  if (!fs.existsSync(speciesRoot)) return out;
  for (const name of fs.readdirSync(speciesRoot)) {
    const dir = path.join(speciesRoot, name);
    let stat;
    try { stat = fs.statSync(dir); } catch { continue; }
    if (!stat.isDirectory()) continue;
    const speciesJson = path.join(dir, 'species.json');
    if (!fs.existsSync(speciesJson)) continue;
    try {
      const cfg = readJsonOrEmpty(speciesJson);
      if (!cfg.id) cfg.id = name;
      out[name] = cfg;
    } catch (err) {
      // surface parse errors but don't block other species
      throw err;
    }
  }
  return out;
}

/**
 * Pure merge function — takes a project config, a target species config,
 * and a lookup of all sibling species configs, and returns the fully
 * resolved species. Exposed so tests and tools can exercise the merge
 * without touching the filesystem.
 *
 * @param {ProjectConfig} projectCfg
 * @param {SpeciesConfig} speciesCfg
 * @param {{ allSpeciesInProject?: Record<string, SpeciesConfig> }} [opts]
 * @returns {ResolvedSpecies}
 */
function mergeProjectSpecies(projectCfg, speciesCfg, opts = {}) {
  const allSpecies = opts.allSpeciesInProject || {};
  const chain = resolveInheritanceChain(speciesCfg, allSpecies);
  // Apply: project defaults -> ancestor species (deepest first) -> target.
  // `chain` is ordered deepest-ancestor -> ... -> target species (last).
  /** @type {Record<string, any>} */
  const merged = {};
  applyLayer(merged, projectCfg);
  for (const layer of chain) {
    applyLayer(merged, layer);
  }
  // Stamp identifiers
  if (projectCfg && projectCfg.id) merged.project = projectCfg.id;
  if (speciesCfg && speciesCfg.id) merged.species = speciesCfg.id;
  return merged;
}

/**
 * Shallow-apply one config layer onto the accumulator. Arrays and nested
 * objects are replaced wholesale, not deep-merged. Keys whose value is
 * `undefined` are skipped so partial layers don't clobber earlier values.
 */
function applyLayer(acc, layer) {
  if (!layer || typeof layer !== 'object') return;
  for (const [key, val] of Object.entries(layer)) {
    if (val === undefined) continue;
    acc[key] = val;
  }
}

/**
 * Walk the `inherits_from` chain for a species. Returns an array of
 * SpeciesConfig objects ordered deepest-ancestor first, target species last.
 * Throws on cycles and on unknown parent references.
 */
function resolveInheritanceChain(speciesCfg, allSpecies) {
  const chain = [];
  const seen = new Set();
  let current = speciesCfg;
  while (current) {
    const id = current.id;
    if (id && seen.has(id)) {
      const cycle = [...seen, id].join(' -> ');
      throw new Error(`eval-loader: inherits_from cycle detected: ${cycle}`);
    }
    if (id) seen.add(id);
    chain.unshift(current);
    const parentId = current.inherits_from;
    if (!parentId) break;
    const parent = allSpecies[parentId];
    if (!parent) {
      throw new Error(
        `eval-loader: species '${id}' inherits_from '${parentId}' but no such species exists in project`
      );
    }
    current = parent;
  }
  return chain;
}

/**
 * Load and fully resolve one species — convenience wrapper around
 * {@link loadProject} + {@link loadAllSpeciesRaw} + {@link mergeProjectSpecies}.
 *
 * @param {string} projectDir
 * @param {string} speciesName
 * @returns {ResolvedSpecies}
 */
function loadResolvedSpecies(projectDir, speciesName) {
  const projectCfg = loadProject(projectDir);
  const allSpecies = loadAllSpeciesRaw(projectDir);
  const speciesCfg = allSpecies[speciesName];
  if (!speciesCfg) {
    // Fall back to direct load so we get the "not found" error from loadSpecies
    loadSpecies(projectDir, speciesName);
  }
  return mergeProjectSpecies(projectCfg, speciesCfg, { allSpeciesInProject: allSpecies });
}

/**
 * Load every species under a project, each fully resolved against the
 * project defaults and the inheritance chain. Returned array is sorted by
 * species name for deterministic output.
 *
 * @param {string} projectDir
 * @returns {ResolvedSpecies[]}
 */
function loadAllResolvedSpecies(projectDir) {
  const projectCfg = loadProject(projectDir);
  const allSpecies = loadAllSpeciesRaw(projectDir);
  const names = Object.keys(allSpecies).sort();
  return names.map((name) =>
    mergeProjectSpecies(projectCfg, allSpecies[name], { allSpeciesInProject: allSpecies })
  );
}

module.exports = {
  loadProject,
  loadSpecies,
  loadAllSpeciesRaw,
  loadResolvedSpecies,
  loadAllResolvedSpecies,
  mergeProjectSpecies,
  resolveInheritanceChain,
};
