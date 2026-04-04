#!/usr/bin/env node
'use strict';

/**
 * gad-config.cjs — GAD configuration reader
 *
 * Reads planning-config.toml from the project root and returns a parsed
 * configuration object. Falls back to config.json `planning.*` keys if no
 * TOML file is found (backwards compatibility).
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

/**
 * Load GAD configuration for a project root.
 *
 * Resolution order:
 *   1. <root>/planning-config.toml
 *   2. <root>/config.json  (backwards compat — reads planning.* keys)
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
 *   source: 'toml'|'json'|'defaults'
 * }}
 */
function load(root) {
  root = root || process.cwd();

  // Check root-level first, then .planning/ subdir (portfolio convention)
  const tomlPath = fs.existsSync(path.join(root, 'planning-config.toml'))
    ? path.join(root, 'planning-config.toml')
    : path.join(root, '.planning', 'planning-config.toml');
  const jsonPath = path.join(root, 'config.json');

  if (fs.existsSync(tomlPath)) {
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

  return {
    roots: (planning.roots || []).map(r => ({
      id: r.id || path.basename(r.path || root),
      path: r.path || '.',
      planningDir: r.planningDir || '.planning',
      discover: r.discover === true,
    })),
    docs_sink: planning.docs_sink || null,
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles,
    currentProfile: planning.currentProfile || 'human',
    conventionsPaths: planning.conventionsPaths || [],
    source: 'toml',
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
  }));

  // Always include the root itself if no explicit entry for '.'
  if (!roots.find(r => r.path === '.')) {
    roots.unshift({
      id: planning.id || 'root',
      path: '.',
      planningDir: planning.planningDir || '.planning',
      discover: false,
    });
  }

  return {
    roots,
    docs_sink: planning.docs_sink || null,
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: planning.conventionsPaths || [],
    source: 'json',
  };
}

function defaults(root) {
  return {
    roots: [{
      id: path.basename(root),
      path: '.',
      planningDir: '.planning',
      discover: false,
    }],
    docs_sink: null,
    ignore: ['**/node_modules/**', '**/dist/**'],
    sprintSize: 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: [],
    source: 'defaults',
  };
}

module.exports = { load, parseToml };

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
  }
}
