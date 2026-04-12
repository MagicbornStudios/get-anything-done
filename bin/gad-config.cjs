#!/usr/bin/env node
'use strict';

/**
 * gad-config.cjs — GAD configuration reader
 *
 * Reads **gad-config.toml** (canonical) or legacy **planning-config.toml**
 * from the repo root or `.planning/`. Falls back to config.json `planning.*`
 * keys if no TOML file is found (backwards compatibility).
 *
 * Usage (from GAD workflows / commands):
 *   const config = require('./gad-config.cjs').load(projectRoot);
 *   // config.roots, config.docs_sink, config.ignore, config.sprintSize, config.profiles
 *
 * CLI usage:
 *   node bin/gad-config.cjs [--root <dir>] [--json]
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal TOML parser — supports the subset used by planning-config.toml:
//   - [section] and [[array-of-tables]]
//   - key = "string", key = 123, key = true
//   - key = ["array", "values"]
//   - Inline comments (#)
//   - Multi-line string arrays
// ---------------------------------------------------------------------------

function parseToml(src) {
  const root = {};
  let current = root;
  let arrayTableKey = null;
  let arrayTableParent = null;

  const lines = src.split(/\r?\n/);

  for (let raw of lines) {
    // Strip inline comment
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;

    // [[array of tables]]
    const arrMatch = line.match(/^\[\[(.+)\]\]$/);
    if (arrMatch) {
      const keys = arrMatch[1].trim().split('.');
      arrayTableKey = keys[keys.length - 1];
      let parent = root;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!parent[keys[i]]) parent[keys[i]] = {};
        parent = parent[keys[i]];
      }
      if (!Array.isArray(parent[arrayTableKey])) {
        parent[arrayTableKey] = [];
      }
      const entry = {};
      parent[arrayTableKey].push(entry);
      current = entry;
      arrayTableParent = parent;
      continue;
    }

    // [section]
    const secMatch = line.match(/^\[([^\[].+)\]$/);
    if (secMatch) {
      arrayTableKey = null;
      arrayTableParent = null;
      const keys = secMatch[1].trim().split('.');
      current = root;
      for (const key of keys) {
        if (!current[key]) current[key] = {};
        current = current[key];
      }
      continue;
    }

    // key = value
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    const rawVal = line.slice(eqIdx + 1).trim();
    current[key] = parseTomlValue(rawVal);
  }

  return root;
}

function parseTomlValue(raw) {
  // Boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;

  // Quoted string
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }

  // Integer / float
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return Number(raw);
  }

  // Inline array
  if (raw.startsWith('[')) {
    // Simple single-line array only
    const inner = raw.slice(1, raw.lastIndexOf(']'));
    if (!inner.trim()) return [];
    return inner.split(',').map(s => parseTomlValue(s.trim())).filter(v => v !== undefined && v !== '');
  }

  // Fallback: return as string
  return raw;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Preferred TOML filenames (first match wins). */
const GAD_TOML_PRIMARY = 'gad-config.toml';
const GAD_TOML_LEGACY = 'planning-config.toml';

/**
 * Resolve path to GAD TOML config, or null if neither primary nor legacy exists.
 */
function resolveTomlPath(root) {
  const candidates = [
    path.join(root, GAD_TOML_PRIMARY),
    path.join(root, '.planning', GAD_TOML_PRIMARY),
    path.join(root, GAD_TOML_LEGACY),
    path.join(root, '.planning', GAD_TOML_LEGACY),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function mergeSectionsIntoRoots(roots, sections) {
  const seen = new Set(roots.map((r) => r.id));
  const out = roots.slice();
  for (const s of sections || []) {
    const id = (s.id && String(s.id).trim()) || 'global';
    if (seen.has(id)) continue;
    seen.add(id);
    const planningDir = s.planningDir || s.planning_dir || '.planning';
    out.push({
      id,
      path: '.',
      planningDir,
      discover: s.discover === true,
      // `enabled: false` excludes this root from sink compile + snapshot
      // discovery. Default true when omitted (backwards compatible).
      enabled: s.enabled !== false,
    });
  }
  return out;
}

/**
 * Load GAD configuration for a project root.
 *
 * Resolution order:
 *   1. <root>/gad-config.toml
 *   2. <root>/.planning/gad-config.toml
 *   3. <root>/planning-config.toml (legacy)
 *   4. <root>/.planning/planning-config.toml (legacy)
 *   5. <root>/config.json  (backwards compat — reads planning.* keys)
 *
 * @param {string} [root] - Project root directory. Defaults to cwd.
 * @returns {{
 *   roots: Array<{id: string, path: string, planningDir: string, discover: boolean}>,
 *   docs_sink: string|null,
 *   ignore: string[],
 *   sprintSize: number,
 *   profiles: Record<string, {description: string}>,
 *   currentProfile: string,
 *   conventionsPaths: string[],
 *   docsProjects: Array<{id: string, sinkPath: string, description: string, kind: string, contentSkill: string|null, repo: string|null}>,
 *   source: 'toml'|'json'|'defaults'
 * }}
 */
function load(root) {
  root = root || process.cwd();

  const tomlPath = resolveTomlPath(root);
  const jsonPath = path.join(root, 'config.json');

  if (tomlPath) {
    return fromToml(tomlPath, root);
  }

  if (fs.existsSync(jsonPath)) {
    return fromJson(jsonPath, root);
  }

  return defaults(root);
}

function fromToml(tomlPath, root) {
  const raw = fs.readFileSync(tomlPath, 'utf8');
  const data = parseToml(raw);
  const planning = data.planning || {};
  const profiles = data.profiles || {};
  const docs = data.docs || {};

  const rootsTable = (planning.roots || []).map((r) => ({
    id: r.id || path.basename(r.path || root),
    path: r.path || '.',
    planningDir: r.planningDir || r.planning_dir || '.planning',
    discover: r.discover === true,
    // `enabled: false` excludes this root from sink compile. Default true.
    enabled: r.enabled !== false,
  }));
  const rootsMerged = mergeSectionsIntoRoots(rootsTable, planning.sections);

  return {
    configPath: tomlPath,
    roots: rootsMerged,
    docs_sink: planning.docs_sink || null,
    // Bulk ignore list for `gad sink compile` — project ids skipped
    // regardless of `enabled` per-root flag. Persistent filter used by
    // phase 08 to turn off sections without removing them from config.
    docs_sink_ignore: Array.isArray(planning.docs_sink_ignore) ? planning.docs_sink_ignore : [],
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles,
    currentProfile: planning.currentProfile || 'human',
    conventionsPaths: planning.conventionsPaths || [],
    docsProjects: (docs.projects || []).map(p => ({
      id: p.id || '',
      sinkPath: p.sinkPath || p.id || '',
      description: p.description || '',
      kind: p.kind || 'app',
      contentSkill: p['content-skill'] || null,
      repo: p.repo || null,
    })),
    source: 'toml',
    legacyToml: path.basename(tomlPath) === GAD_TOML_LEGACY,
  };
}

function fromJson(jsonPath, root) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    return defaults(root);
  }

  const planning = data.planning || {};
  const subRepos = planning.sub_repos || [];

  // Map config.json sub_repos to roots format
  const roots = subRepos.map(sr => ({
    id: sr.id || path.basename(sr.path || sr),
    path: typeof sr === 'string' ? sr : (sr.path || sr),
    planningDir: sr.planningDir || '.planning',
    discover: false,
    enabled: sr.enabled !== false,
  }));

  // Always include the root itself if no explicit entry for '.'
  if (!roots.find(r => r.path === '.')) {
    roots.unshift({
      id: planning.id || 'root',
      path: '.',
      planningDir: planning.planningDir || '.planning',
      discover: false,
      enabled: true,
    });
  }

  return {
    configPath: jsonPath,
    roots,
    docs_sink: planning.docs_sink || null,
    docs_sink_ignore: Array.isArray(planning.docs_sink_ignore) ? planning.docs_sink_ignore : [],
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: planning.conventionsPaths || [],
    docsProjects: [],
    source: 'json',
    legacyToml: false,
  };
}

function defaults(root) {
  return {
    configPath: null,
    roots: [{
      id: path.basename(root),
      path: '.',
      planningDir: '.planning',
      discover: false,
      enabled: true,
    }],
    docs_sink: null,
    docs_sink_ignore: [],
    ignore: ['**/node_modules/**', '**/dist/**'],
    sprintSize: 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: [],
    docsProjects: [],
    source: 'defaults',
    legacyToml: false,
  };
}

module.exports = { load, parseToml, resolveTomlPath, GAD_TOML_PRIMARY, GAD_TOML_LEGACY };

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let asJson = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root' && args[i + 1]) {
      root = args[++i];
    } else if (args[i] === '--json') {
      asJson = true;
    }
  }

  const config = load(root);

  if (asJson) {
    console.log(JSON.stringify(config, null, 2));
  } else {
    console.log(`Source: ${config.source}`);
    console.log(`Sprint size: ${config.sprintSize}`);
    console.log(`Docs sink: ${config.docs_sink || '(none)'}`);
    console.log(`Roots (${config.roots.length}):`);
    for (const r of config.roots) {
      console.log(`  [${r.id}] ${r.path}/${r.planningDir}${r.discover ? ' (discover)' : ''}`);
    }
    if (config.conventionsPaths.length) {
      console.log(`Conventions: ${config.conventionsPaths.join(', ')}`);
    }
    if (config.docsProjects.length) {
      console.log(`Docs projects (${config.docsProjects.length}):`);
      for (const p of config.docsProjects) {
        console.log(`  [${p.id}] ${p.sinkPath}  ${p.kind}${p.contentSkill ? ` (skill: ${p.contentSkill})` : ''}`);
      }
    }
  }
}
