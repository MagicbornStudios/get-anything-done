#!/usr/bin/env node
'use strict';

/**
 * gad-config.cjs — GAD configuration reader
 *
 * Reads **gad-config.toml** (canonical) or legacy **planning-config.toml**
 * from the repo root or `.planning/`. Falls back to compatibility JSON files
 * (`.planning/config.json`, then `config.json`) if no TOML file is found.
 *
 * Usage (from GAD workflows / commands):
 *   const config = require('./gad-config.cjs').load(projectRoot);
 *   // config.roots, config.docs_sink, config.docs_path, config.ignore, config.sprintSize, config.profiles
 *
 * CLI usage:
 *   node bin/gad-config.cjs [--root <dir>] [--json]
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Minimal TOML parser — supports the subset used by gad-config.toml:
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

function serializeTomlValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => serializeTomlValue(entry)).join(', ')}]`;
  return JSON.stringify(String(value ?? ''));
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
 *   5. <root>/.planning/config.json (backwards compat)
 *   6. <root>/config.json  (backwards compat — reads planning.* keys)
 *
 * @param {string} [root] - Project root directory. Defaults to cwd.
 * @returns {{
 *   roots: Array<{id: string, path: string, planningDir: string, discover: boolean}>,
 *   docs_sink: string|null,
 *   docs_path: string|null,
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
  const planningJsonPath = path.join(root, '.planning', 'config.json');
  const jsonPath = path.join(root, 'config.json');

  if (tomlPath) {
    return fromToml(tomlPath, root);
  }

  if (fs.existsSync(planningJsonPath)) {
    return fromJson(planningJsonPath, root);
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
  const verify = data.verify || {};
  const verifyProjects = (verify.projects && typeof verify.projects === 'object') ? verify.projects : {};

  const rootsTable = (planning.roots || []).map((r) => ({
    id: r.id || path.basename(r.path || root),
    path: r.path || '.',
    planningDir: r.planningDir || r.planning_dir || '.planning',
    discover: r.discover === true,
    // `enabled: false` excludes this root from sink compile. Default true.
    enabled: r.enabled !== false,
  }));
  const rootsMerged = mergeSectionsIntoRoots(rootsTable, planning.sections);

  // [[evals.roots]] — multi-root eval discovery (task 42.4-12).
  // Each entry: path = "..." (relative to repo root or absolute),
  // optional id = "..." (defaults to basename). The default eval root
  // (vendor/get-anything-done/evals/) is always appended implicitly
  // unless explicitly configured.
  const evals = data.evals || {};
  const evalsRoots = (evals.roots || []).map((r) => ({
    id: r.id || path.basename(r.path || root),
    path: r.path || '.',
    enabled: r.enabled !== false,
  }));

  return {
    configPath: tomlPath,
    mode: data.mode || 'interactive',
    model_profile: data.model_profile || 'off',
    commit_docs: data.commit_docs !== false,
    parallelization: data.parallelization !== false,
    search_gitignored: data.search_gitignored === true,
    brave_search: data.brave_search === true,
    firecrawl: data.firecrawl === true,
    exa_search: data.exa_search === true,
    roots: rootsMerged,
    evalsRoots,
    docs_sink: planning.docs_sink || null,
    docs_path: docs.path || docs.docs_path || planning.docs_path || null,
    // Bulk ignore list for `gad sink compile` — project ids skipped
    // regardless of `enabled` per-root flag. Persistent filter used by
    // phase 08 to turn off sections without removing them from config.
    docs_sink_ignore: Array.isArray(planning.docs_sink_ignore) ? planning.docs_sink_ignore : [],
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles,
    currentProfile: planning.currentProfile || 'human',
    conventionsPaths: planning.conventionsPaths || [],
    git: {
      branching_strategy: data.git?.branching_strategy || 'none',
      phase_branch_template: data.git?.phase_branch_template || 'gad/phase-{phase}-{slug}',
      milestone_branch_template: data.git?.milestone_branch_template || 'gad/{milestone}-{slug}',
      quick_branch_template: data.git?.quick_branch_template || null,
    },
    workflow: {
      research: data.workflow?.research !== false,
      plan_check: data.workflow?.plan_check !== false,
      verifier: data.workflow?.verifier !== false,
      nyquist_validation: data.workflow?.nyquist_validation !== false,
      auto_advance: data.workflow?.auto_advance === true,
      node_repair: data.workflow?.node_repair !== false,
      node_repair_budget: typeof data.workflow?.node_repair_budget === 'number' ? data.workflow.node_repair_budget : 2,
      ui_phase: data.workflow?.ui_phase !== false,
      ui_safety_gate: data.workflow?.ui_safety_gate !== false,
      text_mode: data.workflow?.text_mode === true,
      research_before_questions: data.workflow?.research_before_questions === true,
      discuss_mode: data.workflow?.discuss_mode || 'discuss',
      skip_discuss: data.workflow?.skip_discuss === true,
      max_discuss_passes: typeof data.workflow?.max_discuss_passes === 'number' ? data.workflow.max_discuss_passes : 3,
    },
    hooks: {
      context_warnings: data.hooks?.context_warnings !== false,
      community: data.hooks?.community === true,
    },
    agent_skills: data.agent_skills || {},
    docsProjects: (docs.projects || []).map(p => ({
      id: p.id || '',
      sinkPath: p.sinkPath || p.id || '',
      description: p.description || '',
      kind: p.kind || 'app',
      contentSkill: p['content-skill'] || null,
      repo: p.repo || null,
    })),
    verify: {
      buildCommands: Array.isArray(verify.build_commands)
        ? verify.build_commands.map((entry) => String(entry || '').trim()).filter(Boolean)
        : (Array.isArray(verify.buildCommands)
            ? verify.buildCommands.map((entry) => String(entry || '').trim()).filter(Boolean)
            : []),
      projects: Object.fromEntries(
        Object.entries(verifyProjects).map(([projectId, projectCfg]) => {
          const cfg = projectCfg && typeof projectCfg === 'object' ? projectCfg : {};
          const buildCommands = Array.isArray(cfg.build_commands)
            ? cfg.build_commands
            : (Array.isArray(cfg.buildCommands) ? cfg.buildCommands : []);
          return [
            String(projectId || '').trim(),
            {
              buildCommands: buildCommands.map((entry) => String(entry || '').trim()).filter(Boolean),
            },
          ];
        }).filter(([projectId]) => Boolean(projectId)),
      ),
    },
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

  const planning = data.planning || data || {};
  const verify = data.verify || planning.verify || {};
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
    mode: data.mode || planning.mode || 'interactive',
    model_profile: data.model_profile || planning.model_profile || 'off',
    commit_docs: data.commit_docs !== false && planning.commit_docs !== false,
    parallelization: data.parallelization !== false && planning.parallelization !== false,
    search_gitignored: data.search_gitignored === true || planning.search_gitignored === true,
    brave_search: data.brave_search === true || planning.brave_search === true,
    firecrawl: data.firecrawl === true || planning.firecrawl === true,
    exa_search: data.exa_search === true || planning.exa_search === true,
    roots,
    evalsRoots: [],
    docs_sink: planning.docs_sink || null,
    docs_path: planning.docs_path || data.docs_path || null,
    docs_sink_ignore: Array.isArray(planning.docs_sink_ignore) ? planning.docs_sink_ignore : [],
    ignore: planning.ignore || ['**/node_modules/**', '**/dist/**'],
    sprintSize: typeof planning.sprintSize === 'number' ? planning.sprintSize : 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: planning.conventionsPaths || [],
    git: {
      branching_strategy: data.git?.branching_strategy || 'none',
      phase_branch_template: data.git?.phase_branch_template || 'gad/phase-{phase}-{slug}',
      milestone_branch_template: data.git?.milestone_branch_template || 'gad/{milestone}-{slug}',
      quick_branch_template: data.git?.quick_branch_template || null,
    },
    workflow: {
      research: data.workflow?.research !== false,
      plan_check: data.workflow?.plan_check !== false && data.workflow?.plan_checker !== false,
      verifier: data.workflow?.verifier !== false,
      nyquist_validation: data.workflow?.nyquist_validation !== false,
      auto_advance: data.workflow?.auto_advance === true,
      node_repair: data.workflow?.node_repair !== false,
      node_repair_budget: typeof data.workflow?.node_repair_budget === 'number' ? data.workflow.node_repair_budget : 2,
      ui_phase: data.workflow?.ui_phase !== false,
      ui_safety_gate: data.workflow?.ui_safety_gate !== false,
      text_mode: data.workflow?.text_mode === true,
      research_before_questions: data.workflow?.research_before_questions === true,
      discuss_mode: data.workflow?.discuss_mode || 'discuss',
      skip_discuss: data.workflow?.skip_discuss === true,
      max_discuss_passes: typeof data.workflow?.max_discuss_passes === 'number' ? data.workflow.max_discuss_passes : 3,
    },
    hooks: {
      context_warnings: data.hooks?.context_warnings !== false,
      community: data.hooks?.community === true,
    },
    agent_skills: data.agent_skills || {},
    docsProjects: [],
    verify: {
      buildCommands: Array.isArray(verify.build_commands)
        ? verify.build_commands.map((entry) => String(entry || '').trim()).filter(Boolean)
        : (Array.isArray(verify.buildCommands)
            ? verify.buildCommands.map((entry) => String(entry || '').trim()).filter(Boolean)
            : []),
      projects: (verify.projects && typeof verify.projects === 'object')
        ? Object.fromEntries(
            Object.entries(verify.projects).map(([projectId, projectCfg]) => {
              const cfg = projectCfg && typeof projectCfg === 'object' ? projectCfg : {};
              const buildCommands = Array.isArray(cfg.build_commands)
                ? cfg.build_commands
                : (Array.isArray(cfg.buildCommands) ? cfg.buildCommands : []);
              return [
                String(projectId || '').trim(),
                {
                  buildCommands: buildCommands.map((entry) => String(entry || '').trim()).filter(Boolean),
                },
              ];
            }).filter(([projectId]) => Boolean(projectId)),
          )
        : {},
    },
    source: 'json',
    legacyToml: false,
  };
}

function toCompatJson(config, existing = {}) {
  const planning = existing.planning && typeof existing.planning === 'object'
    ? { ...existing.planning }
    : {};

  planning.id = planning.id || 'root';
  planning.planningDir = planning.planningDir || '.planning';
  planning.docs_sink = config.docs_sink || planning.docs_sink || null;
  planning.docs_path = config.docs_path || planning.docs_path || null;
  planning.docs_sink_ignore = Array.isArray(config.docs_sink_ignore) ? config.docs_sink_ignore : (planning.docs_sink_ignore || []);
  planning.ignore = Array.isArray(config.ignore) ? config.ignore : (planning.ignore || []);
  planning.sprintSize = typeof config.sprintSize === 'number' ? config.sprintSize : (planning.sprintSize || 5);
  planning.currentProfile = config.currentProfile || planning.currentProfile || 'human';
  planning.conventionsPaths = Array.isArray(config.conventionsPaths) ? config.conventionsPaths : (planning.conventionsPaths || []);
  planning.sub_repos = Array.isArray(config.roots)
    ? config.roots.map((root) => ({
        id: root.id,
        path: root.path,
        planningDir: root.planningDir || '.planning',
        enabled: root.enabled !== false,
      }))
    : (planning.sub_repos || []);

  const docs = existing.docs && typeof existing.docs === 'object' ? { ...existing.docs } : {};
  if (config.docs_path) {
    docs.path = config.docs_path;
  }
  if (Array.isArray(config.docsProjects) && config.docsProjects.length > 0) {
    docs.projects = config.docsProjects.map((project) => ({
      id: project.id,
      sinkPath: project.sinkPath,
      description: project.description,
      kind: project.kind,
      repo: project.repo || undefined,
      'content-skill': project.contentSkill || undefined,
    }));
  }

  const out = {
    ...existing,
    mode: config.mode || existing.mode || 'interactive',
    model_profile: config.model_profile || existing.model_profile || 'off',
    commit_docs: config.commit_docs !== false,
    parallelization: config.parallelization !== false,
    search_gitignored: config.search_gitignored === true,
    brave_search: config.brave_search === true,
    firecrawl: config.firecrawl === true,
    exa_search: config.exa_search === true,
    git: config.git || existing.git || {},
    workflow: config.workflow || existing.workflow || {},
    hooks: config.hooks || existing.hooks || {},
    agent_skills: config.agent_skills || existing.agent_skills || {},
    planning,
  };
  if (Object.keys(docs).length > 0) out.docs = docs;
  return out;
}

function writeCompatJson(root, config, extra = {}) {
  const planningDir = path.join(root, '.planning');
  const compatPath = path.join(planningDir, 'config.json');
  if (!fs.existsSync(planningDir)) {
    fs.mkdirSync(planningDir, { recursive: true });
  }

  let existing = {};
  try {
    if (fs.existsSync(compatPath)) {
      existing = JSON.parse(fs.readFileSync(compatPath, 'utf8'));
    }
  } catch {
    existing = {};
  }

  const merged = { ...toCompatJson(config, existing), ...extra };
  fs.writeFileSync(compatPath, JSON.stringify(merged, null, 2) + '\n');
  return compatPath;
}

function writeToml(root, config) {
  const outPath = path.join(root, GAD_TOML_PRIMARY);
  const lines = [];

  lines.push('# gad-config.toml — canonical GAD project configuration');
  lines.push(`mode = ${serializeTomlValue(config.mode || 'interactive')}`);
  lines.push(`model_profile = ${serializeTomlValue(config.model_profile || 'off')}`);
  lines.push(`commit_docs = ${serializeTomlValue(config.commit_docs !== false)}`);
  lines.push(`parallelization = ${serializeTomlValue(config.parallelization !== false)}`);
  lines.push(`search_gitignored = ${serializeTomlValue(config.search_gitignored === true)}`);
  lines.push(`brave_search = ${serializeTomlValue(config.brave_search === true)}`);
  lines.push(`firecrawl = ${serializeTomlValue(config.firecrawl === true)}`);
  lines.push(`exa_search = ${serializeTomlValue(config.exa_search === true)}`);
  lines.push('');

  lines.push('[git]');
  lines.push(`branching_strategy = ${serializeTomlValue(config.git?.branching_strategy || 'none')}`);
  lines.push(`phase_branch_template = ${serializeTomlValue(config.git?.phase_branch_template || 'gad/phase-{phase}-{slug}')}`);
  lines.push(`milestone_branch_template = ${serializeTomlValue(config.git?.milestone_branch_template || 'gad/{milestone}-{slug}')}`);
  if (config.git?.quick_branch_template != null) {
    lines.push(`quick_branch_template = ${serializeTomlValue(config.git.quick_branch_template)}`);
  }
  lines.push('');

  lines.push('[workflow]');
  for (const [key, value] of Object.entries(config.workflow || {})) {
    lines.push(`${key} = ${serializeTomlValue(value)}`);
  }
  lines.push('');

  lines.push('[hooks]');
  for (const [key, value] of Object.entries(config.hooks || {})) {
    lines.push(`${key} = ${serializeTomlValue(value)}`);
  }
  lines.push('');

  lines.push('[planning]');
  if (config.docs_sink != null) lines.push(`docs_sink = ${serializeTomlValue(config.docs_sink)}`);
  if (Array.isArray(config.docs_sink_ignore) && config.docs_sink_ignore.length) lines.push(`docs_sink_ignore = ${serializeTomlValue(config.docs_sink_ignore)}`);
  lines.push(`ignore = ${serializeTomlValue(Array.isArray(config.ignore) ? config.ignore : ['**/node_modules/**', '**/dist/**'])}`);
  lines.push(`sprintSize = ${serializeTomlValue(typeof config.sprintSize === 'number' ? config.sprintSize : 5)}`);
  lines.push(`currentProfile = ${serializeTomlValue(config.currentProfile || 'human')}`);
  lines.push(`conventionsPaths = ${serializeTomlValue(Array.isArray(config.conventionsPaths) ? config.conventionsPaths : [])}`);
  lines.push('');

  if (config.docs_path != null) {
    lines.push('[docs]');
    lines.push(`path = ${serializeTomlValue(config.docs_path)}`);
    lines.push('');
  }

  for (const rootEntry of config.roots || []) {
    lines.push('[[planning.roots]]');
    lines.push(`id = ${serializeTomlValue(rootEntry.id)}`);
    lines.push(`path = ${serializeTomlValue(rootEntry.path)}`);
    lines.push(`planningDir = ${serializeTomlValue(rootEntry.planningDir || '.planning')}`);
    lines.push(`discover = ${serializeTomlValue(rootEntry.discover === true)}`);
    lines.push(`enabled = ${serializeTomlValue(rootEntry.enabled !== false)}`);
    lines.push('');
  }

  for (const evalRoot of config.evalsRoots || []) {
    lines.push('[[evals.roots]]');
    lines.push(`id = ${serializeTomlValue(evalRoot.id)}`);
    lines.push(`path = ${serializeTomlValue(evalRoot.path)}`);
    lines.push(`enabled = ${serializeTomlValue(evalRoot.enabled !== false)}`);
    lines.push('');
  }

  for (const docProject of config.docsProjects || []) {
    lines.push('[[docs.projects]]');
    lines.push(`id = ${serializeTomlValue(docProject.id)}`);
    lines.push(`sinkPath = ${serializeTomlValue(docProject.sinkPath)}`);
    lines.push(`description = ${serializeTomlValue(docProject.description || '')}`);
    lines.push(`kind = ${serializeTomlValue(docProject.kind || 'app')}`);
    if (docProject.contentSkill) lines.push(`content-skill = ${serializeTomlValue(docProject.contentSkill)}`);
    if (docProject.repo) lines.push(`repo = ${serializeTomlValue(docProject.repo)}`);
    lines.push('');
  }

  fs.writeFileSync(outPath, lines.join('\n').trimEnd() + '\n');
  return outPath;
}

function defaults(root) {
  return {
    configPath: null,
    mode: 'interactive',
    model_profile: 'off',
    commit_docs: true,
    parallelization: true,
    search_gitignored: false,
    brave_search: false,
    firecrawl: false,
    exa_search: false,
    roots: [{
      id: path.basename(root),
      path: '.',
      planningDir: '.planning',
      discover: false,
      enabled: true,
    }],
    evalsRoots: [],
    docs_sink: null,
    docs_path: null,
    docs_sink_ignore: [],
    ignore: ['**/node_modules/**', '**/dist/**'],
    sprintSize: 5,
    profiles: {},
    currentProfile: 'human',
    conventionsPaths: [],
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gad/phase-{phase}-{slug}',
      milestone_branch_template: 'gad/{milestone}-{slug}',
      quick_branch_template: null,
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
      auto_advance: false,
      node_repair: true,
      node_repair_budget: 2,
      ui_phase: true,
      ui_safety_gate: true,
      text_mode: false,
      research_before_questions: false,
      discuss_mode: 'discuss',
      skip_discuss: false,
      max_discuss_passes: 3,
    },
    hooks: {
      context_warnings: true,
      community: false,
    },
    agent_skills: {},
    docsProjects: [],
    verify: {
      buildCommands: [],
      projects: {},
    },
    source: 'defaults',
    legacyToml: false,
  };
}

module.exports = { load, parseToml, resolveTomlPath, toCompatJson, writeCompatJson, writeToml, GAD_TOML_PRIMARY, GAD_TOML_LEGACY };

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
    console.log(`Docs path: ${config.docs_path || '(none)'}`);
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
