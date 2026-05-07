'use strict';
/**
 * lib/mcp-app/index.cjs — MCP app manifest schema + loader (Phase 161).
 *
 * AJV is not a dependency of this package; validation is hand-rolled.
 * If AJV were added, replace `validateManifest` with an Ajv instance
 * compiled against schema.json — the public API is identical.
 *
 * Exports:
 *   loadManifest(planningDir)          → parsed + validated manifest object
 *   validateManifest(obj)              → same but takes in-memory object
 *   aggregateManifests(projects)       → merged registry across projects
 *   findComponent(registry, intent, projectFilter?) → ranked matches
 */

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_FILENAME = 'mcp-app.json';
const VALID_SURFACES = new Set(['transient', 'popup', 'sidebar', 'inline']);
const VALID_CAPABILITIES = new Set(['read', 'write', 'long-running', 'file-export', 'needs-confirmation']);
const VALID_ARG_TYPES = new Set(['string', 'number', 'boolean']);
const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function err(fieldPath, msg) {
  throw new Error(`mcp-app manifest validation error at "${fieldPath}": ${msg}`);
}

function requireString(obj, key, fieldPath, { pattern, minLen = 1 } = {}) {
  if (typeof obj[key] !== 'string') err(`${fieldPath}.${key}`, `must be a string (got ${typeof obj[key]})`);
  if (obj[key].length < minLen) err(`${fieldPath}.${key}`, `must not be empty`);
  if (pattern && !pattern.test(obj[key])) err(`${fieldPath}.${key}`, `does not match pattern ${pattern}`);
}

function requireEnum(obj, key, fieldPath, validValues) {
  const valid = Array.isArray(validValues) ? validValues : [...validValues];
  if (!valid.includes(obj[key])) err(`${fieldPath}.${key}`, `must be one of [${valid.join(', ')}] (got "${obj[key]}")`);
}

function noExtra(obj, allowedKeys, fieldPath) {
  for (const k of Object.keys(obj)) {
    if (!allowedKeys.includes(k)) err(fieldPath, `unexpected property "${k}"`);
  }
}

// ---------------------------------------------------------------------------
// Component validation
// ---------------------------------------------------------------------------

function validateComponent(comp, idx, allIds) {
  const fp = `components[${idx}]`;
  if (typeof comp !== 'object' || comp === null || Array.isArray(comp)) err(fp, 'must be an object');
  noExtra(comp, ['id', 'title', 'intent', 'route', 'surface', 'args', 'capabilities', 'tags'], fp);

  requireString(comp, 'id', fp, { pattern: KEBAB_RE });
  if (allIds.has(comp.id)) err(`${fp}.id`, `duplicate id "${comp.id}" — ids must be unique within the manifest`);
  allIds.add(comp.id);

  requireString(comp, 'title', fp);
  requireString(comp, 'intent', fp);
  requireString(comp, 'route', fp, { pattern: /^\// });
  requireEnum(comp, 'surface', fp, VALID_SURFACES);

  // args
  if (comp.args !== undefined) {
    if (!Array.isArray(comp.args)) err(`${fp}.args`, 'must be an array');
    comp.args.forEach((arg, i) => {
      const afp = `${fp}.args[${i}]`;
      if (typeof arg !== 'object' || arg === null || Array.isArray(arg)) err(afp, 'must be an object');
      noExtra(arg, ['name', 'type', 'required'], afp);
      requireString(arg, 'name', afp);
      requireEnum(arg, 'type', afp, VALID_ARG_TYPES);
      if (arg.required !== undefined && typeof arg.required !== 'boolean') err(`${afp}.required`, 'must be a boolean');
    });
  }

  // capabilities
  if (comp.capabilities !== undefined) {
    if (!Array.isArray(comp.capabilities)) err(`${fp}.capabilities`, 'must be an array');
    comp.capabilities.forEach((cap, i) => {
      if (!VALID_CAPABILITIES.has(cap)) err(`${fp}.capabilities[${i}]`, `unknown capability "${cap}"`);
    });
  }

  // tags
  if (comp.tags !== undefined) {
    if (!Array.isArray(comp.tags)) err(`${fp}.tags`, 'must be an array');
    comp.tags.forEach((tag, i) => {
      if (typeof tag !== 'string' || tag.length === 0) err(`${fp}.tags[${i}]`, 'must be a non-empty string');
    });
  }
}

// ---------------------------------------------------------------------------
// Intent-capture validation
// ---------------------------------------------------------------------------

function validateIntentCapture(item, idx) {
  const fp = `intent_capture[${idx}]`;
  if (typeof item !== 'object' || item === null || Array.isArray(item)) err(fp, 'must be an object');
  noExtra(item, ['id', 'trigger_kinds', 'form_route', 'surface'], fp);

  requireString(item, 'id', fp);
  if (!Array.isArray(item.trigger_kinds) || item.trigger_kinds.length === 0) {
    err(`${fp}.trigger_kinds`, 'must be a non-empty array');
  }
  item.trigger_kinds.forEach((k, i) => {
    if (typeof k !== 'string' || k.length === 0) err(`${fp}.trigger_kinds[${i}]`, 'must be a non-empty string');
  });
  requireString(item, 'form_route', fp, { pattern: /^\// });
  requireEnum(item, 'surface', fp, VALID_SURFACES);
}

// ---------------------------------------------------------------------------
// Agent-issues validation
// ---------------------------------------------------------------------------

function validateAgentIssues(obj) {
  const fp = 'agent_issues';
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) err(fp, 'must be an object');
  noExtra(obj, ['intake_route', 'ledger_path'], fp);
  if (obj.intake_route !== undefined) requireString(obj, 'intake_route', fp, { pattern: /^\// });
  if (obj.ledger_path !== undefined) requireString(obj, 'ledger_path', fp);
}

// ---------------------------------------------------------------------------
// Top-level validate
// ---------------------------------------------------------------------------

/**
 * Validate an in-memory manifest object. Throws with a field-path error on
 * any violation. Returns the parsed object (same reference) on success.
 */
function validateManifest(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('mcp-app manifest must be a JSON object');
  }
  noExtra(obj, ['project', 'version', 'components', 'intent_capture', 'agent_issues'], 'manifest');

  requireString(obj, 'project', 'manifest');
  if (obj.version !== 1) err('manifest.version', `must be the integer 1 (got ${JSON.stringify(obj.version)})`);

  if (!Array.isArray(obj.components)) err('manifest.components', 'must be an array');
  const seenIds = new Set();
  obj.components.forEach((c, i) => validateComponent(c, i, seenIds));

  if (obj.intent_capture !== undefined) {
    if (!Array.isArray(obj.intent_capture)) err('manifest.intent_capture', 'must be an array');
    obj.intent_capture.forEach((item, i) => validateIntentCapture(item, i));
  }

  if (obj.agent_issues !== undefined) {
    validateAgentIssues(obj.agent_issues);
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Load from disk
// ---------------------------------------------------------------------------

/**
 * Load and validate `<planningDir>/mcp-app.json`.
 * Throws if the file is missing or invalid.
 */
function loadManifest(planningDir) {
  const manifestPath = path.join(planningDir, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`mcp-app manifest not found: ${manifestPath}`);
  }
  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (e) {
    throw new Error(`mcp-app manifest read error (${manifestPath}): ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`mcp-app manifest JSON parse error (${manifestPath}): ${e.message}`);
  }
  return validateManifest(parsed);
}

// ---------------------------------------------------------------------------
// Aggregate across projects
// ---------------------------------------------------------------------------

/**
 * Walk the projects array (each element: { projectId, rootPath, planningDir })
 * and aggregate all manifests that exist.
 *
 * Returns:
 *   {
 *     components: [...],       — each tagged with project: <id>
 *     intent_capture: [...],   — each tagged with project: <id>
 *     agent_issues: { <projectId>: { ... } }
 *   }
 *
 * Projects without a manifest file are silently skipped.
 * Projects with an invalid manifest cause a warning on stderr (not a throw)
 * so one bad manifest doesn't block the others.
 */
function aggregateManifests(projects) {
  const components = [];
  const intent_capture = [];
  const agent_issues = {};

  for (const proj of projects) {
    const { projectId, planningDir } = proj;
    const manifestPath = path.join(planningDir, MANIFEST_FILENAME);
    if (!fs.existsSync(manifestPath)) continue;

    let manifest;
    try {
      manifest = loadManifest(planningDir);
    } catch (e) {
      process.stderr.write(`[mcp-app] WARNING: skipping project "${projectId}" — ${e.message}\n`);
      continue;
    }

    for (const comp of manifest.components) {
      components.push({ ...comp, project: projectId });
    }
    for (const ic of manifest.intent_capture || []) {
      intent_capture.push({ ...ic, project: projectId });
    }
    if (manifest.agent_issues) {
      agent_issues[projectId] = manifest.agent_issues;
    }
  }

  return { components, intent_capture, agent_issues };
}

// ---------------------------------------------------------------------------
// findComponent — keyword scoring, no embeddings
// ---------------------------------------------------------------------------

/**
 * Score:
 *   3 pts — exact phrase appears in title (case-insensitive)
 *   2 pts — any query word appears in intent (case-insensitive)
 *   1 pt  — any query word appears in a tag (case-insensitive)
 *
 * Returns top 5 by descending score, alphabetical tie-break on id.
 *
 * @param {object} registry — output of aggregateManifests
 * @param {string} intent   — query string
 * @param {string} [projectFilter] — optional project id to restrict to
 */
function findComponent(registry, intent, projectFilter) {
  if (!intent || typeof intent !== 'string') return [];
  const query = intent.trim().toLowerCase();
  if (!query) return [];

  const words = query.split(/\s+/).filter(Boolean);

  let candidates = registry.components || [];
  if (projectFilter) {
    candidates = candidates.filter((c) => c.project === projectFilter);
  }

  const scored = candidates.map((comp) => {
    let score = 0;
    const titleLower = (comp.title || '').toLowerCase();
    const intentLower = (comp.intent || '').toLowerCase();
    const tags = (comp.tags || []).map((t) => t.toLowerCase());

    // 3 pts — exact phrase in title
    if (titleLower.includes(query)) score += 3;

    // 2 pts — any word in intent
    for (const w of words) {
      if (intentLower.includes(w)) { score += 2; break; }
    }

    // 1 pt — any word in any tag
    for (const w of words) {
      if (tags.some((t) => t.includes(w))) { score += 1; break; }
    }

    return { score, comp };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.comp.id.localeCompare(b.comp.id))
    .slice(0, 5)
    .map((s) => s.comp);
}

module.exports = { loadManifest, validateManifest, aggregateManifests, findComponent };
