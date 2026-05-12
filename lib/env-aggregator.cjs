'use strict';
/**
 * env-aggregator — read-only snapshot of env schema + values across all
 * planning roots that have .env.example files.
 *
 * Extracted from bin/commands/env-web.cjs so apps/platform/app/api/env can
 * load the data layer via vendorRequire without depending on node:http or
 * the citty command shell. The CLI keeps working — env-web.cjs continues
 * to define its own copies of these helpers; this module is purely the
 * data-side seam for Next route consumption.
 *
 * Returns from aggregate():
 *   {
 *     snapshot_at, repo_root,
 *     projects: [{ id, root, relPath, sourceCount }],
 *     environments: ["local", "development", "production", "default"],
 *   }
 *
 * Returns from loadProjectSnapshot(repoRoot, projectId, environment):
 *   {
 *     project: { id, root, relPath },
 *     environment,
 *     sources: string[],
 *     sections: [{ name, sourceRelPath, vars: [{ key, defaultValue, description, categories }] }],
 *     values: { [key]: string },
 *     provenance: { [key]: { source, file } },
 *   }
 *
 * Phase 195, task 195-02. Decision GLOBAL-D-338.
 */

const fs = require('fs');
const path = require('path');

// ─── Repo root discovery ─────────────────────────────────────────────────────

function findRepoRoot(start) {
  let dir = start || process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return start || process.cwd();
}

// ─── gad-config.toml roots reader ────────────────────────────────────────────

function readPlanningRoots(repoRoot) {
  const cfgPath = path.join(repoRoot, 'gad-config.toml');
  if (!fs.existsSync(cfgPath)) return [{ id: 'global', path: '.', absolute: repoRoot }];
  const raw = fs.readFileSync(cfgPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const roots = [];
  let cur = null;
  let inSection = false;
  let sectionMatchesRoots = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const sectionMatch = trimmed.match(/^\[\[\s*([\w.]+)\s*\]\]$/);
    if (sectionMatch) {
      if (cur && sectionMatchesRoots) roots.push(cur);
      cur = {};
      inSection = true;
      sectionMatchesRoots = sectionMatch[1] === 'planning.roots' || sectionMatch[1] === 'planning.sections';
      continue;
    }
    if (trimmed.startsWith('[') && !trimmed.startsWith('[[')) {
      if (cur && sectionMatchesRoots) roots.push(cur);
      cur = null;
      inSection = false;
      sectionMatchesRoots = false;
      continue;
    }
    if (inSection && cur) {
      const m = trimmed.match(/^([\w_]+)\s*=\s*(.+?)\s*$/);
      if (m) {
        let v = m[2];
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        cur[m[1]] = v;
      }
    }
  }
  if (cur && sectionMatchesRoots) roots.push(cur);
  const out = roots
    .filter((r) => r && r.id && (r.path !== undefined))
    .map((r) => ({ id: r.id, path: r.path, absolute: path.resolve(repoRoot, r.path) }));
  if (!out.find((r) => r.id === 'global')) {
    out.unshift({ id: 'global', path: '.', absolute: repoRoot });
  }
  return out;
}

// ─── Schema discovery ────────────────────────────────────────────────────────

function discoverEnvExamples(rootAbsPath) {
  const sources = [];
  const tryAdd = (absPath) => {
    if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
      sources.push({
        absPath,
        relPath: path.relative(rootAbsPath, absPath).replace(/\\/g, '/'),
      });
    }
  };
  tryAdd(path.join(rootAbsPath, '.env.example'));
  const appsDir = path.join(rootAbsPath, 'apps');
  if (fs.existsSync(appsDir) && fs.statSync(appsDir).isDirectory()) {
    for (const entry of fs.readdirSync(appsDir)) {
      tryAdd(path.join(appsDir, entry, '.env.example'));
    }
  }
  return sources;
}

// ─── .env.example parser ─────────────────────────────────────────────────────

function parseEnvExample(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let curSection = { name: '', vars: [] };
  sections.push(curSection);
  let pendingComments = [];
  let lastWasBanner = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed.match(/^#\s*=+\s*$/)) {
      if (!lastWasBanner) {
        const title = (lines[i + 1] || '').replace(/^\s*#\s*/, '').trim();
        if (title && !title.match(/^=+$/)) {
          if (curSection.vars.length > 0 || curSection.name) {
            curSection = { name: title, vars: [] };
            sections.push(curSection);
          } else {
            curSection.name = title;
          }
        }
        lastWasBanner = true;
      } else {
        lastWasBanner = false;
        pendingComments = [];
      }
      continue;
    }
    if (lastWasBanner) {
      if (trimmed === '' || trimmed.match(/^#\s*=+/)) {
        if (trimmed === '') lastWasBanner = false;
      }
      continue;
    }
    if (trimmed === '') { pendingComments = []; continue; }
    if (trimmed.startsWith('#')) {
      pendingComments.push(trimmed.replace(/^#\s?/, ''));
      continue;
    }
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) { pendingComments = []; continue; }
    let defaultValue = m[2];
    if ((defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
        (defaultValue.startsWith("'") && defaultValue.endsWith("'"))) {
      defaultValue = defaultValue.slice(1, -1);
    }
    const description = pendingComments.join('\n').trim();
    const categories = [...description.matchAll(/\[([A-Z][A-Z_-]*)\]/g)].map((mm) => mm[1]);
    curSection.vars.push({ key: m[1], defaultValue, description, categories });
    pendingComments = [];
  }
  return { sections: sections.filter((s) => s.vars.length > 0 || s.name) };
}

// ─── Value file readers ──────────────────────────────────────────────────────

function envFileNameFor(environment) {
  const map = { local: '.env.local', production: '.env.production', development: '.env.development', 'default': '.env' };
  return map[environment] || '.env.local';
}

function envFilePathsFor(schemaSourceAbsPath, environment) {
  const dir = path.dirname(schemaSourceAbsPath);
  return {
    base: path.join(dir, '.env'),
    override: path.join(dir, envFileNameFor(environment)),
  };
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { values: {}, raw: '' };
  const raw = fs.readFileSync(filePath, 'utf8');
  const values = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    values[m[1]] = v;
  }
  return { values, raw };
}

// ─── Aggregated schema (all sources for a project) ───────────────────────────

function buildAggregateSchema(projectAbsPath) {
  const sources = discoverEnvExamples(projectAbsPath);
  const sections = [];
  for (const src of sources) {
    const text = fs.readFileSync(src.absPath, 'utf8');
    const parsed = parseEnvExample(text);
    for (const sec of parsed.sections) {
      sections.push({
        name: sec.name,
        sourceRelPath: src.relPath,
        vars: sec.vars,
      });
    }
  }
  return { sections, sources: sources.map((s) => s.relPath) };
}

function loadAggregateValues(projectAbsPath, environment) {
  const sources = discoverEnvExamples(projectAbsPath);
  const values = {};
  const provenance = {};
  // Reverse so earlier source ends up applied LAST and wins on conflicts.
  for (let i = sources.length - 1; i >= 0; i--) {
    const src = sources[i];
    const { base, override } = envFilePathsFor(src.absPath, environment);
    if (fs.existsSync(base)) {
      const r = readEnvFile(base);
      for (const [k, v] of Object.entries(r.values)) {
        values[k] = v;
        provenance[k] = { source: src.relPath, file: '.env' };
      }
    }
    if (fs.existsSync(override)) {
      const r = readEnvFile(override);
      for (const [k, v] of Object.entries(r.values)) {
        values[k] = v;
        provenance[k] = { source: src.relPath, file: envFileNameFor(environment) };
      }
    }
  }
  return { values, provenance };
}

// ─── Project list builder ────────────────────────────────────────────────────

function listProjects(repoRoot) {
  const roots = readPlanningRoots(repoRoot);
  const projects = [];
  for (const r of roots) {
    if (!fs.existsSync(r.absolute) || !fs.statSync(r.absolute).isDirectory()) continue;
    const sources = discoverEnvExamples(r.absolute);
    if (sources.length === 0) continue;
    projects.push({
      id: r.id,
      root: r.absolute,
      relPath: r.path,
      sourceCount: sources.length,
    });
  }
  return projects;
}

function findProject(repoRoot, projectId) {
  const projects = listProjects(repoRoot);
  return projects.find((p) => p.id === projectId) || null;
}

// ─── Top-level snapshot ──────────────────────────────────────────────────────

const ENVIRONMENTS = ['local', 'development', 'production', 'default'];

function aggregate(repoRoot) {
  const root = repoRoot || findRepoRoot();
  return {
    snapshot_at: new Date().toISOString(),
    repo_root: root,
    projects: listProjects(root),
    environments: ENVIRONMENTS.slice(),
  };
}

function loadProjectSnapshot(repoRoot, projectId, environment) {
  const root = repoRoot || findRepoRoot();
  const env = ENVIRONMENTS.includes(environment) ? environment : 'local';
  const proj = projectId ? findProject(root, projectId) : (listProjects(root)[0] || null);
  if (!proj) return null;
  const schema = buildAggregateSchema(proj.root);
  const { values, provenance } = loadAggregateValues(proj.root, env);
  return {
    project: { id: proj.id, root: proj.root, relPath: proj.relPath },
    environment: env,
    sources: schema.sources,
    sections: schema.sections,
    values,
    provenance,
  };
}

module.exports = {
  aggregate,
  loadProjectSnapshot,
  listProjects,
  findProject,
  findRepoRoot,
  ENVIRONMENTS,
};
