/**
 * eval-data-access.cjs — unified CRUD for eval projects, species, and generations.
 *
 * Decision gad-203: filesystem-as-database. JSON files on disk are the database.
 * This module is the single entry point for both CLI commands and /api/dev/evals/
 * routes. The prebuild-generated TS files remain the production path for the
 * static site — this module is additive for dev/editor use.
 *
 * Read ops delegate to eval-loader.cjs (decision gad-184 merge semantics).
 * Write ops are new — create/update/archive for projects and species.
 *
 * Discovery reuses gad-config.cjs [[evals.roots]] + default root pattern
 * from bin/gad.cjs (task 42.4-12).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const evalLoader = require('./eval-loader.cjs');

// ---------------------------------------------------------------------------
// Eval root discovery (mirrors bin/gad.cjs getEvalRoots logic)
// ---------------------------------------------------------------------------

let _gadConfig;
function getGadConfig() {
  if (!_gadConfig) {
    try {
      _gadConfig = require('../bin/gad-config.cjs');
    } catch {
      _gadConfig = null;
    }
  }
  return _gadConfig;
}

/** Walk up from startDir looking for .git or .planning to find repo root. */
function findRepoRoot(startDir) {
  let dir = startDir || path.resolve(__dirname, '..');
  const seen = new Set();
  while (dir && !seen.has(dir)) {
    seen.add(dir);
    if (
      fs.existsSync(path.join(dir, '.git')) ||
      fs.existsSync(path.join(dir, '.planning'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Return ordered eval root dirs, deduped.
 * Each entry: { id, dir }
 */
function getEvalRoots() {
  const gadDir = path.resolve(__dirname, '..');
  const defaultRoot = {
    id: 'get-anything-done',
    dir: path.resolve(gadDir, 'evals'),
  };

  let configuredRoots = [];
  try {
    const cfg = getGadConfig();
    if (cfg) {
      const visited = new Set();
      let dir = findRepoRoot();
      while (dir && !visited.has(dir)) {
        visited.add(dir);
        try {
          const loaded = cfg.load(dir);
          if (loaded && Array.isArray(loaded.evalsRoots) && loaded.evalsRoots.length > 0) {
            configuredRoots = loaded.evalsRoots
              .filter((r) => r && r.enabled !== false && r.path)
              .map((r) => ({
                id: r.id || path.basename(r.path),
                dir: path.isAbsolute(r.path) ? r.path : path.resolve(dir, r.path),
              }));
            break;
          }
        } catch {}
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  } catch {
    configuredRoots = [];
  }

  const seenDirs = new Set();
  const ordered = [];
  for (const r of configuredRoots) {
    const key = path.resolve(r.dir).toLowerCase();
    if (seenDirs.has(key)) continue;
    seenDirs.add(key);
    ordered.push(r);
  }
  const defaultKey = path.resolve(defaultRoot.dir).toLowerCase();
  if (!seenDirs.has(defaultKey)) {
    ordered.push(defaultRoot);
  }
  return ordered;
}

/** Primary (submodule) evals dir. */
function defaultEvalsDir() {
  return path.resolve(__dirname, '..', 'evals');
}

// ---------------------------------------------------------------------------
// READ — Projects
// ---------------------------------------------------------------------------

/**
 * List all eval projects across all roots.
 * Returns [{ id, projectDir, rootId }], sorted by id.
 */
function listProjects() {
  const roots = getEvalRoots();
  const byId = new Map();
  for (const root of roots) {
    if (!fs.existsSync(root.dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(root.dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const projectDir = path.join(root.dir, e.name);
      if (byId.has(e.name)) continue; // first root wins
      byId.set(e.name, { id: e.name, projectDir, rootId: root.id });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Resolve a project id to its directory. Returns null if not found.
 */
function resolveProject(projectId) {
  const roots = getEvalRoots();
  for (const root of roots) {
    const candidate = path.join(root.dir, projectId);
    if (fs.existsSync(candidate)) {
      return { id: projectId, projectDir: candidate, rootId: root.id };
    }
  }
  return null;
}

/**
 * Get full project config (project.json).
 * Delegates to eval-loader.cjs.
 */
function getProject(projectId) {
  const resolved = resolveProject(projectId);
  if (!resolved) return null;
  const cfg = evalLoader.loadProject(resolved.projectDir);
  cfg._meta = { projectDir: resolved.projectDir, rootId: resolved.rootId };
  return cfg;
}

// ---------------------------------------------------------------------------
// READ — Species
// ---------------------------------------------------------------------------

/**
 * List all species for a project (raw, unmerged).
 * Returns { [speciesName]: SpeciesConfig }.
 */
function listSpecies(projectId) {
  const resolved = resolveProject(projectId);
  if (!resolved) return {};
  return evalLoader.loadAllSpeciesRaw(resolved.projectDir);
}

/**
 * Get a single species, fully resolved (merged with project + inheritance).
 */
function getSpecies(projectId, speciesName) {
  const resolved = resolveProject(projectId);
  if (!resolved) return null;
  try {
    return evalLoader.loadResolvedSpecies(resolved.projectDir, speciesName);
  } catch {
    return null;
  }
}

/**
 * Get all species for a project, each fully resolved.
 */
function getAllResolvedSpecies(projectId) {
  const resolved = resolveProject(projectId);
  if (!resolved) return [];
  return evalLoader.loadAllResolvedSpecies(resolved.projectDir);
}

// ---------------------------------------------------------------------------
// READ — Generations (versioned runs)
// ---------------------------------------------------------------------------

/**
 * Resolve the site's public/playable directory for checking publish status.
 * The site lives at <vendor-root>/site/, so public dir is <vendor-root>/site/public/.
 */
function sitePublicDir() {
  return path.resolve(__dirname, '..', 'site', 'public');
}

/**
 * Check if a generation is published (has a public/playable build).
 */
function isGenerationPublished(projectId, speciesName, version) {
  const target = path.join(sitePublicDir(), 'playable', projectId, speciesName, version, 'index.html');
  return fs.existsSync(target);
}

/**
 * List generations for a species. Scans evals/<project>/species/<name>/v<N>/.
 * Returns [{ version, dir, hasTrace, hasRun, hasPrompt, hasExec, isPublished, trace }]
 * sorted newest-first (highest version number).
 */
function listGenerations(projectId, speciesName) {
  const resolved = resolveProject(projectId);
  if (!resolved) return [];

  const speciesDir = path.join(resolved.projectDir, 'species', speciesName);
  if (!fs.existsSync(speciesDir)) return [];

  let entries;
  try {
    entries = fs.readdirSync(speciesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const generations = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const match = e.name.match(/^v(\d+)$/);
    if (!match) continue;

    const vNum = parseInt(match[1], 10);
    const dir = path.join(speciesDir, e.name);

    const traceFile = path.join(dir, 'TRACE.json');
    let trace = null;
    if (fs.existsSync(traceFile)) {
      try {
        trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
      } catch {}
    }

    generations.push({
      version: e.name,
      versionNumber: vNum,
      dir,
      hasTrace: fs.existsSync(traceFile),
      hasRun: fs.existsSync(path.join(dir, 'RUN.md')),
      hasPrompt: fs.existsSync(path.join(dir, 'PROMPT.md')),
      hasExec: fs.existsSync(path.join(dir, 'EXEC.json')),
      isPublished: isGenerationPublished(projectId, speciesName, e.name),
      trace,
    });
  }

  return generations.sort((a, b) => b.versionNumber - a.versionNumber);
}

/**
 * Get a single generation's metadata.
 */
function getGeneration(projectId, speciesName, version) {
  const resolved = resolveProject(projectId);
  if (!resolved) return null;

  const dir = path.join(resolved.projectDir, 'species', speciesName, version);
  if (!fs.existsSync(dir)) return null;

  const traceFile = path.join(dir, 'TRACE.json');
  let trace = null;
  if (fs.existsSync(traceFile)) {
    try {
      trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'));
    } catch {}
  }

  const match = version.match(/^v(\d+)$/);
  return {
    version,
    versionNumber: match ? parseInt(match[1], 10) : null,
    dir,
    hasTrace: fs.existsSync(traceFile),
    hasRun: fs.existsSync(path.join(dir, 'RUN.md')),
    hasPrompt: fs.existsSync(path.join(dir, 'PROMPT.md')),
    hasExec: fs.existsSync(path.join(dir, 'EXEC.json')),
    trace,
  };
}

// ---------------------------------------------------------------------------
// WRITE — Projects
// ---------------------------------------------------------------------------

/**
 * Create a new eval project.
 * @param {string} projectId   kebab-case directory name
 * @param {object} data        project.json fields
 * @param {{ rootId?: string }} [opts]  which root to create in (default: first configured root with evals/)
 * @returns {{ id, projectDir }}
 */
function createProject(projectId, data, opts = {}) {
  if (!projectId || !/^[a-z0-9][a-z0-9-]*$/.test(projectId)) {
    throw new Error(`Invalid project id: "${projectId}" — must be kebab-case`);
  }
  if (resolveProject(projectId)) {
    throw new Error(`Project "${projectId}" already exists`);
  }

  const roots = getEvalRoots();
  let targetRoot;
  if (opts.rootId) {
    targetRoot = roots.find((r) => r.id === opts.rootId);
    if (!targetRoot) throw new Error(`Eval root "${opts.rootId}" not found`);
  } else {
    targetRoot = roots[0];
  }

  const projectDir = path.join(targetRoot.dir, projectId);
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'species'), { recursive: true });

  const now = new Date().toISOString();
  const projectJson = {
    name: data.name || projectId,
    slug: data.slug || projectId,
    description: data.description || '',
    domain: data.domain || null,
    techStack: data.techStack || null,
    tagline: data.tagline || null,
    cardImage: data.cardImage || null,
    heroImage: data.heroImage || null,
    published: data.published === true ? true : false,
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || null,
  };

  fs.writeFileSync(
    path.join(projectDir, 'project.json'),
    JSON.stringify(projectJson, null, 2) + '\n',
    'utf8'
  );

  return { id: projectId, projectDir };
}

/**
 * Update an existing project's project.json. Merges fields (shallow).
 */
function updateProject(projectId, updates) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const jsonPath = path.join(resolved.projectDir, 'project.json');
  let existing = {};
  if (fs.existsSync(jsonPath)) {
    existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  }

  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  // Never overwrite id/slug via update
  if (existing.slug) merged.slug = existing.slug;

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return merged;
}

/**
 * Archive a project — renames dir to _<id> (soft delete).
 */
function archiveProject(projectId) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const archived = path.join(
    path.dirname(resolved.projectDir),
    `_${projectId}`
  );
  if (fs.existsSync(archived)) {
    throw new Error(`Archive path already exists: ${archived}`);
  }
  fs.renameSync(resolved.projectDir, archived);
  return { id: projectId, archivedTo: archived };
}

// ---------------------------------------------------------------------------
// WRITE — Species
// ---------------------------------------------------------------------------

/**
 * Create a new species under a project.
 */
function createSpecies(projectId, speciesName, data) {
  if (!speciesName || !/^[a-z0-9][a-z0-9-]*$/.test(speciesName)) {
    throw new Error(`Invalid species name: "${speciesName}" — must be kebab-case`);
  }

  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const speciesDir = path.join(resolved.projectDir, 'species', speciesName);
  if (fs.existsSync(speciesDir)) {
    throw new Error(`Species "${speciesName}" already exists in project "${projectId}"`);
  }

  fs.mkdirSync(speciesDir, { recursive: true });

  const now = new Date().toISOString();
  const speciesJson = {
    type: data.type || 'eval',
    name: speciesName,
    description: data.description || '',
    workflow: data.workflow || null,
    baseline: data.baseline || null,
    trace: data.trace !== false,
    constraints: data.constraints || {},
    inherits_from: data.inherits_from || null,
    dna: data.dna || null,
    installedSkills: data.installedSkills || null,
    createdAt: now,
    updatedAt: now,
    createdBy: data.createdBy || null,

    // Authorship (decision gad-213)
    authors: data.authors || (data.createdBy ? [data.createdBy] : null),
    authoredAt: data.authoredAt || now,

    // Usage tracking (decision gad-213)
    usageCount: data.usageCount || 0,
    lastUsed: data.lastUsed || null,
    projectsUsedIn: data.projectsUsedIn || null,

    // Showcase media (decision gad-213)
    showcaseMedia: data.showcaseMedia || null,
    featuredGeneration: data.featuredGeneration || null,

    // Transferability (decision gad-209)
    transferable: data.transferable !== false,
    tags: data.tags || null,
  };

  // Strip null fields and empty arrays for cleaner JSON
  for (const [k, v] of Object.entries(speciesJson)) {
    if (v === null || (Array.isArray(v) && v.length === 0)) delete speciesJson[k];
  }

  fs.writeFileSync(
    path.join(speciesDir, 'species.json'),
    JSON.stringify(speciesJson, null, 2) + '\n',
    'utf8'
  );

  // Scaffold species-level .planning/ directory (decision gad-209)
  const speciesPlanDir = path.join(speciesDir, '.planning');
  if (!fs.existsSync(speciesPlanDir)) {
    fs.mkdirSync(speciesPlanDir, { recursive: true });
    fs.writeFileSync(
      path.join(speciesPlanDir, 'DECISIONS.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<decisions project="${projectId}" species="${speciesName}">\n</decisions>\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(speciesPlanDir, 'NOTES.md'),
      `# ${speciesName}\n\nSpecies-level notes for ${projectId}/${speciesName}.\n`,
      'utf8'
    );
  }

  return { projectId, speciesName, speciesDir };
}

/**
 * Update an existing species.json. Merges fields (shallow).
 */
function updateSpecies(projectId, speciesName, updates) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const jsonPath = path.join(resolved.projectDir, 'species', speciesName, 'species.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Species "${speciesName}" not found in project "${projectId}"`);
  }

  const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  // Preserve identity
  merged.name = existing.name || speciesName;

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return merged;
}

/**
 * Clone a species — copies species.json to a new name, optionally setting
 * inherits_from to the source.
 */
function cloneSpecies(projectId, sourceSpecies, newSpeciesName, opts = {}) {
  if (!newSpeciesName || !/^[a-z0-9][a-z0-9-]*$/.test(newSpeciesName)) {
    throw new Error(`Invalid species name: "${newSpeciesName}" — must be kebab-case`);
  }

  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const sourceDir = path.join(resolved.projectDir, 'species', sourceSpecies);
  const sourceJson = path.join(sourceDir, 'species.json');
  if (!fs.existsSync(sourceJson)) {
    throw new Error(`Source species "${sourceSpecies}" not found in project "${projectId}"`);
  }

  const newDir = path.join(resolved.projectDir, 'species', newSpeciesName);
  if (fs.existsSync(newDir)) {
    throw new Error(`Species "${newSpeciesName}" already exists in project "${projectId}"`);
  }

  fs.mkdirSync(newDir, { recursive: true });

  const source = JSON.parse(fs.readFileSync(sourceJson, 'utf8'));
  const now = new Date().toISOString();
  const cloned = {
    ...source,
    name: newSpeciesName,
    createdAt: now,
    updatedAt: now,
  };

  if (opts.inherit !== false) {
    cloned.inherits_from = sourceSpecies;
  }
  if (opts.description) {
    cloned.description = opts.description;
  }

  // Don't carry over the source's id
  delete cloned.id;

  fs.writeFileSync(
    path.join(newDir, 'species.json'),
    JSON.stringify(cloned, null, 2) + '\n',
    'utf8'
  );

  return { projectId, speciesName: newSpeciesName, speciesDir: newDir, clonedFrom: sourceSpecies };
}

/**
 * Breed two species into a new one — merges configs, sheds redundancy.
 * Decision gad-219: play/spawn/breed are distinct evolutionary operations.
 *
 * Merge rules:
 * - Scalars (workflow, baseline, ...): parentA takes precedence, parentB fills gaps.
 * - Arrays (installedSkills, dna, tags, authors, projectsUsedIn, showcaseMedia): union, deduplicated.
 * - Object (constraints): shallow merge, parentB overrides parentA.
 * - inherits_from: set to parentA (primary parent); bredFrom array records both.
 * - Usage tracking: reset (usageCount=0, lastUsed=null).
 * - Description: explicit opts.description wins; else concat parent descriptions.
 *
 * @param {string} projectId
 * @param {string} parentA - primary parent (precedence on scalar conflicts)
 * @param {string} parentB - secondary parent
 * @param {string} newSpeciesName - kebab-case
 * @param {object} opts - { description, workflow, noInherit }
 * @returns {{projectId, speciesName, speciesDir, bredFrom: string[]}}
 */
function breedSpecies(projectId, parentA, parentB, newSpeciesName, opts = {}) {
  if (!newSpeciesName || !/^[a-z0-9][a-z0-9-]*$/.test(newSpeciesName)) {
    throw new Error(`Invalid species name: "${newSpeciesName}" — must be kebab-case`);
  }
  if (parentA === parentB) {
    throw new Error(`Cannot breed a species with itself: "${parentA}"`);
  }

  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const aPath = path.join(resolved.projectDir, 'species', parentA, 'species.json');
  const bPath = path.join(resolved.projectDir, 'species', parentB, 'species.json');
  if (!fs.existsSync(aPath)) {
    throw new Error(`Parent species "${parentA}" not found in project "${projectId}"`);
  }
  if (!fs.existsSync(bPath)) {
    throw new Error(`Parent species "${parentB}" not found in project "${projectId}"`);
  }

  const newDir = path.join(resolved.projectDir, 'species', newSpeciesName);
  if (fs.existsSync(newDir)) {
    throw new Error(`Species "${newSpeciesName}" already exists in project "${projectId}"`);
  }

  const a = JSON.parse(fs.readFileSync(aPath, 'utf8'));
  const b = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  const now = new Date().toISOString();

  // Union + dedupe array field. Primitives deduped by equality; objects by JSON string.
  const mergeArray = (aArr, bArr) => {
    const all = [...(aArr || []), ...(bArr || [])];
    if (all.length === 0) return null;
    const seen = new Set();
    const out = [];
    for (const item of all) {
      const key = typeof item === 'object' ? JSON.stringify(item) : String(item);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
    return out;
  };

  // parentA precedence for scalars, parentB fills gaps
  const scalar = (key) => (a[key] != null ? a[key] : b[key] != null ? b[key] : null);

  const bred = {
    type: scalar('type') || 'eval',
    name: newSpeciesName,
    description: opts.description
      || (a.description && b.description
          ? `Bred from ${parentA} + ${parentB}: ${a.description} / ${b.description}`
          : scalar('description') || ''),
    workflow: opts.workflow || scalar('workflow'),
    baseline: scalar('baseline'),
    trace: a.trace !== false && b.trace !== false,
    constraints: { ...(b.constraints || {}), ...(a.constraints || {}) },
    inherits_from: opts.noInherit ? null : parentA,
    bredFrom: [parentA, parentB],
    dna: mergeArray(a.dna, b.dna),
    installedSkills: mergeArray(a.installedSkills, b.installedSkills),
    createdAt: now,
    updatedAt: now,
    createdBy: opts.createdBy || null,

    // Authorship (decision gad-213) — union of both parents + createdBy
    authors: mergeArray(
      mergeArray(a.authors, b.authors),
      opts.createdBy ? [opts.createdBy] : []
    ),
    authoredAt: now,

    // Usage tracking reset — this is a new species (decision gad-213)
    usageCount: 0,
    lastUsed: null,
    projectsUsedIn: null,

    // Media carries forward as union, feature reference resets
    showcaseMedia: mergeArray(a.showcaseMedia, b.showcaseMedia),
    featuredGeneration: null,

    // Transferability: require both parents transferable
    transferable: a.transferable !== false && b.transferable !== false,
    tags: mergeArray(a.tags, b.tags),
  };

  // Strip null / empty-array fields for cleaner JSON
  for (const [k, v] of Object.entries(bred)) {
    if (v === null || (Array.isArray(v) && v.length === 0)) delete bred[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) delete bred[k];
  }

  fs.mkdirSync(newDir, { recursive: true });
  fs.writeFileSync(
    path.join(newDir, 'species.json'),
    JSON.stringify(bred, null, 2) + '\n',
    'utf8'
  );

  return {
    projectId,
    speciesName: newSpeciesName,
    speciesDir: newDir,
    bredFrom: [parentA, parentB],
    shed: {
      dna: (a.dna?.length || 0) + (b.dna?.length || 0) - (bred.dna?.length || 0),
      installedSkills:
        (a.installedSkills?.length || 0) +
        (b.installedSkills?.length || 0) -
        (bred.installedSkills?.length || 0),
    },
  };
}

/**
 * Archive a species — renames dir to _<name>.
 */
function archiveSpecies(projectId, speciesName) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const speciesDir = path.join(resolved.projectDir, 'species', speciesName);
  if (!fs.existsSync(speciesDir)) {
    throw new Error(`Species "${speciesName}" not found in project "${projectId}"`);
  }

  const archived = path.join(
    path.dirname(speciesDir),
    `_${speciesName}`
  );
  if (fs.existsSync(archived)) {
    throw new Error(`Archive path already exists: ${archived}`);
  }
  fs.renameSync(speciesDir, archived);
  return { projectId, speciesName, archivedTo: archived };
}

// ---------------------------------------------------------------------------
// READ — Recipes
// ---------------------------------------------------------------------------

/**
 * List all recipes for a project.
 * Scans evals/<project>/recipes/<slug>/recipe.json.
 * Returns [{ slug, ...recipeData }] sorted by name.
 */
function listRecipes(projectId) {
  const resolved = resolveProject(projectId);
  if (!resolved) return [];

  const recipesDir = path.join(resolved.projectDir, 'recipes');
  if (!fs.existsSync(recipesDir)) return [];

  let entries;
  try {
    entries = fs.readdirSync(recipesDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const recipes = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.') || e.name.startsWith('_')) continue;
    const jsonPath = path.join(recipesDir, e.name, 'recipe.json');
    if (!fs.existsSync(jsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      recipes.push({ slug: e.name, ...data });
    } catch {}
  }

  return recipes.sort((a, b) => (a.name || a.slug).localeCompare(b.name || b.slug));
}

/**
 * Get a single recipe by slug.
 */
function getRecipe(projectId, recipeSlug) {
  const resolved = resolveProject(projectId);
  if (!resolved) return null;

  const jsonPath = path.join(resolved.projectDir, 'recipes', recipeSlug, 'recipe.json');
  if (!fs.existsSync(jsonPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    return { slug: recipeSlug, ...data };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// WRITE — Recipes
// ---------------------------------------------------------------------------

/**
 * Create a new recipe under a project.
 */
function createRecipe(projectId, slug, data) {
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    throw new Error(`Invalid recipe slug: "${slug}" — must be kebab-case`);
  }

  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const recipeDir = path.join(resolved.projectDir, 'recipes', slug);
  if (fs.existsSync(recipeDir)) {
    throw new Error(`Recipe "${slug}" already exists in project "${projectId}"`);
  }

  fs.mkdirSync(recipeDir, { recursive: true });

  const now = new Date().toISOString();
  const recipeJson = {
    name: data.name || slug,
    description: data.description || '',
    workflow: data.workflow || null,
    constraints: data.constraints || {},
    installedSkills: data.installedSkills || [],
    trace: data.trace !== false,
    createdAt: now,
    updatedAt: now,
  };

  // Strip null fields for cleaner JSON
  for (const [k, v] of Object.entries(recipeJson)) {
    if (v === null) delete recipeJson[k];
  }

  fs.writeFileSync(
    path.join(recipeDir, 'recipe.json'),
    JSON.stringify(recipeJson, null, 2) + '\n',
    'utf8'
  );

  return { projectId, slug, recipeDir };
}

/**
 * Update an existing recipe.json. Merges fields (shallow).
 */
function updateRecipe(projectId, slug, updates) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const jsonPath = path.join(resolved.projectDir, 'recipes', slug, 'recipe.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Recipe "${slug}" not found in project "${projectId}"`);
  }

  const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const merged = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  // Preserve identity
  if (existing.name) merged.name = updates.name || existing.name;

  fs.writeFileSync(jsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return merged;
}

/**
 * Delete a recipe directory.
 */
function deleteRecipe(projectId, slug) {
  const resolved = resolveProject(projectId);
  if (!resolved) throw new Error(`Project "${projectId}" not found`);

  const recipeDir = path.join(resolved.projectDir, 'recipes', slug);
  if (!fs.existsSync(recipeDir)) {
    throw new Error(`Recipe "${slug}" not found in project "${projectId}"`);
  }

  fs.rmSync(recipeDir, { recursive: true, force: true });
  return { projectId, slug, deleted: true };
}

/**
 * Apply a recipe to create a new species from the recipe template.
 * The recipe's config fields become the initial species data.
 */
function applyRecipe(projectId, recipeSlug, speciesName) {
  const recipe = getRecipe(projectId, recipeSlug);
  if (!recipe) {
    throw new Error(`Recipe "${recipeSlug}" not found in project "${projectId}"`);
  }

  const speciesData = {
    description: recipe.description || `Created from recipe "${recipeSlug}"`,
    workflow: recipe.workflow || null,
    constraints: recipe.constraints || {},
    installedSkills: recipe.installedSkills || [],
    trace: recipe.trace !== false,
    createdBy: `recipe:${recipeSlug}`,
  };

  return createSpecies(projectId, speciesName, speciesData);
}

// ---------------------------------------------------------------------------
// Aggregate queries
// ---------------------------------------------------------------------------

/**
 * Full project summary — project config + all resolved species + generation counts.
 * Used by the editor detail view.
 */
function getProjectSummary(projectId) {
  const project = getProject(projectId);
  if (!project) return null;

  const speciesRaw = listSpecies(projectId);
  const speciesNames = Object.keys(speciesRaw).sort();

  const species = speciesNames.map((name) => {
    const resolved = getSpecies(projectId, name);
    const generations = listGenerations(projectId, name);
    return {
      ...resolved,
      generationCount: generations.length,
      latestGeneration: generations[0] || null,
    };
  });

  const { _meta, ...projectData } = project;
  return {
    ...projectData,
    _meta,
    species,
    speciesCount: species.length,
    totalGenerations: species.reduce((sum, s) => sum + s.generationCount, 0),
  };
}

/**
 * List all projects with species counts (lightweight listing).
 */
function listProjectSummaries() {
  const projects = listProjects();
  return projects.map((p) => {
    const cfg = evalLoader.loadProject(p.projectDir);
    const speciesRaw = evalLoader.loadAllSpeciesRaw(p.projectDir);
    const speciesNames = Object.keys(speciesRaw);
    let totalGens = 0;
    for (const name of speciesNames) {
      const speciesDir = path.join(p.projectDir, 'species', name);
      try {
        const entries = fs.readdirSync(speciesDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && /^v\d+$/.test(e.name)) totalGens++;
        }
      } catch {}
    }
    return {
      id: p.id,
      name: cfg.name || p.id,
      slug: cfg.slug || p.id,
      description: cfg.description || '',
      domain: cfg.domain || null,
      techStack: cfg.techStack || null,
      published: cfg.published === true,
      rootId: p.rootId,
      speciesCount: speciesNames.length,
      totalGenerations: totalGens,
    };
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Discovery
  getEvalRoots,
  defaultEvalsDir,

  // Projects — read
  listProjects,
  resolveProject,
  getProject,
  listProjectSummaries,
  getProjectSummary,

  // Projects — write
  createProject,
  updateProject,
  archiveProject,

  // Species — read
  listSpecies,
  getSpecies,
  getAllResolvedSpecies,

  // Species — write
  createSpecies,
  updateSpecies,
  cloneSpecies,
  breedSpecies,
  archiveSpecies,

  // Recipes — read
  listRecipes,
  getRecipe,

  // Recipes — write
  createRecipe,
  updateRecipe,
  deleteRecipe,
  applyRecipe,

  // Generations — read
  listGenerations,
  getGeneration,
  isGenerationPublished,
  sitePublicDir,
};
