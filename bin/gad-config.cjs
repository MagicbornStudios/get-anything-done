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
/** Hidden user-local override file (phase 121-05). Loaded and merged on top of primary. */
const GAD_TOML_USER_LOCAL = '.gad-config.toml';
const GAD_TOML_LEGACY = 'planning-config.toml';

// Track roots that have already received the dual-config deprecation warning so we
// emit it at most once per process, not once per gadConfig.load() call.
const _dualConfigWarnedRoots = new Set();

/**
 * Resolve path to GAD TOML config, or null if neither primary nor legacy exists.
 *
 * Bug 2 fix (2026-05-07): if BOTH <root>/gad-config.toml AND
 * <root>/.planning/gad-config.toml exist, emit a deprecation warning on stderr
 * (once per root per process).  Root-level file is always authoritative;
 * .planning/ is legacy fallback only.
 */
function resolveTomlPath(root) {
  const rootPrimary    = path.join(root, GAD_TOML_PRIMARY);
  const planningPrimary = path.join(root, '.planning', GAD_TOML_PRIMARY);
  const rootLegacy     = path.join(root, GAD_TOML_LEGACY);
  const planningLegacy  = path.join(root, '.planning', GAD_TOML_LEGACY);

  const rootExists     = fs.existsSync(rootPrimary);
  const planningExists = fs.existsSync(planningPrimary);

  // Dual-config warning: both root and .planning copies present.
  if (rootExists && planningExists && !_dualConfigWarnedRoots.has(root)) {
    _dualConfigWarnedRoots.add(root);
    process.stderr.write(
      '[gad-config] WARN: .planning/gad-config.toml is deprecated; ' +
      'root gad-config.toml is authoritative. ' +
      'Migrate entries and delete .planning/gad-config.toml.\n'
    );
  }

  // Resolution order: root primary → .planning/ primary (legacy fallback) → legacy filenames
  if (rootExists) return rootPrimary;
  if (planningExists) return planningPrimary;
  if (fs.existsSync(rootLegacy)) return rootLegacy;
  if (fs.existsSync(planningLegacy)) return planningLegacy;
  return null;
}

/**
 * Resolve path to user-local override TOML (.gad-config.toml), or null if not present.
 * Phase 121-05: user-local overrides take precedence over canonical config entries.
 */
function resolveUserLocalTomlPath(root) {
  const p = path.join(root, GAD_TOML_USER_LOCAL);
  return fs.existsSync(p) ? p : null;
}

/**
 * Deep-merge two config objects. `override` values win over `base`.
 * Arrays are replaced (not concatenated) by the override.
 * Nested objects are recursively merged.
 * Phase 121-05.
 *
 * @param {object} base
 * @param {object} override
 * @returns {object}
 */
function deepMergeConfig(base, override) {
  if (!override || typeof override !== 'object') return base;
  if (!base || typeof base !== 'object') return override;
  const out = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val) &&
        typeof out[key] === 'object' && out[key] !== null && !Array.isArray(out[key])) {
      out[key] = deepMergeConfig(out[key], val);
    } else {
      out[key] = val;
    }
  }
  return out;
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
 *   0. GAD_CONFIG env var (absolute or relative path to a TOML or JSON config file)
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

  // Priority 0: GAD_CONFIG env var override.
  // Supports absolute paths or paths relative to cwd.
  const gadConfigEnv = process.env.GAD_CONFIG;
  if (gadConfigEnv && gadConfigEnv.trim()) {
    const envPath = path.isAbsolute(gadConfigEnv)
      ? gadConfigEnv
      : path.resolve(process.cwd(), gadConfigEnv);
    if (!fs.existsSync(envPath)) {
      process.stderr.write(
        `[gad-config] WARN: GAD_CONFIG="${gadConfigEnv}" resolves to "${envPath}" which does not exist. Falling back to default resolution.\n`,
      );
    } else {
      const ext = path.extname(envPath).toLowerCase();
      if (ext === '.json') {
        return fromJson(envPath, path.dirname(envPath));
      }
      // Treat as TOML for .toml or any other extension
      return fromToml(envPath, path.dirname(envPath));
    }
  }

  const tomlPath = resolveTomlPath(root);
  const userLocalPath = resolveUserLocalTomlPath(root);
  const planningJsonPath = path.join(root, '.planning', 'config.json');
  const jsonPath = path.join(root, 'config.json');

  let base;
  if (tomlPath) {
    base = fromToml(tomlPath, root);
  } else if (fs.existsSync(planningJsonPath)) {
    base = fromJson(planningJsonPath, root);
  } else if (fs.existsSync(jsonPath)) {
    base = fromJson(jsonPath, root);
  } else {
    base = defaults(root);
  }

  // Phase 121-05: apply user-local .gad-config.toml overrides on top of base.
  // User-local file takes precedence over canonical config entries.
  if (userLocalPath) {
    try {
      const userLocalRaw = fs.readFileSync(userLocalPath, 'utf8');
      const userLocalData = parseToml(userLocalRaw);
      // Re-parse through fromToml shape by writing to a temp structure,
      // then deep-merge scalar/leaf fields only (avoid full re-parse overhead).
      const userOverride = fromToml(userLocalPath, root);
      base = deepMergeConfig(base, userOverride);
      base.userLocalConfigPath = userLocalPath;
    } catch (err) {
      process.stderr.write(
        `[gad-config] WARN: Failed to load user-local config "${userLocalPath}": ${err.message}\n`,
      );
    }
  }

  return base;
}

function fromToml(tomlPath, root) {
  const raw = fs.readFileSync(tomlPath, 'utf8');
  const data = parseToml(raw);
  const planning = data.planning || {};
  const profiles = data.profiles || {};
  const docs = data.docs || {};
  const verify = data.verify || {};
  const tasks = data.tasks || {};
  const skills = data.skills || {};
  const verifyProjects = (verify.projects && typeof verify.projects === 'object') ? verify.projects : {};
  const requireEvidenceOnStamp =
    tasks.require_evidence_on_stamp === true ||
    tasks.require_evidence_on_stamp === 'true' ||
    planning.require_evidence_on_stamp === true ||
    planning.require_evidence_on_stamp === 'true';

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

  // [runtimes.<projectid>] — per-project account allowlist (GLOBAL-T-87-03).
  // Shape: { <projectid>: { <provider>: string[] } }. Consumers in
  // lib/team/per-project-scope.cjs filter the global account pool.
  const runtimesScope = (data.runtimes && typeof data.runtimes === 'object') ? data.runtimes : {};

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
    runtimes: runtimesScope,
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
    skills: {
      scope: skills.scope && typeof skills.scope === 'object' ? skills.scope : {},
    },
    planning: {
      require_evidence_on_stamp: requireEvidenceOnStamp,
    },
    tasks: {
      require_evidence_on_stamp: requireEvidenceOnStamp,
    },
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
      enabled: p.enabled !== false,
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
  const tasks = data.tasks || {};
  const verify = data.verify || planning.verify || {};
  const skills = data.skills || {};
  const subRepos = planning.sub_repos || [];
  const requireEvidenceOnStamp =
    tasks.require_evidence_on_stamp === true ||
    tasks.require_evidence_on_stamp === 'true' ||
    planning.require_evidence_on_stamp === true ||
    planning.require_evidence_on_stamp === 'true';

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
    skills: {
      scope: skills.scope && typeof skills.scope === 'object' ? skills.scope : {},
    },
    planning: {
      require_evidence_on_stamp: requireEvidenceOnStamp,
    },
    tasks: {
      require_evidence_on_stamp: requireEvidenceOnStamp,
    },
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
  planning.require_evidence_on_stamp = config.tasks?.require_evidence_on_stamp === true || config.planning?.require_evidence_on_stamp === true;
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
    skills: config.skills || existing.skills || {},
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

  const skillScope = config.skills?.scope;
  if (skillScope && typeof skillScope === 'object') {
    lines.push('[skills.scope]');
    lines.push(`enabled = ${serializeTomlValue(skillScope.enabled !== false)}`);
    if (Array.isArray(skillScope.default) && skillScope.default.length > 0) {
      lines.push(`default = ${serializeTomlValue(skillScope.default)}`);
    }
    if (Array.isArray(skillScope.standing) && skillScope.standing.length > 0) {
      lines.push(`standing = ${serializeTomlValue(skillScope.standing)}`);
    }
    if (Array.isArray(skillScope.standing_contexts) && skillScope.standing_contexts.length > 0) {
      lines.push(`standing_contexts = ${serializeTomlValue(skillScope.standing_contexts)}`);
    }
    lines.push('');
    if (skillScope.runtime && typeof skillScope.runtime === 'object' && Object.keys(skillScope.runtime).length > 0) {
      lines.push('[skills.scope.runtime]');
      for (const [key, value] of Object.entries(skillScope.runtime)) {
        lines.push(`${key} = ${serializeTomlValue(Array.isArray(value) ? value : [value])}`);
      }
      lines.push('');
    }
    if (skillScope.context && typeof skillScope.context === 'object' && Object.keys(skillScope.context).length > 0) {
      lines.push('[skills.scope.context]');
      for (const [key, value] of Object.entries(skillScope.context)) {
        lines.push(`${key} = ${serializeTomlValue(Array.isArray(value) ? value : [value])}`);
      }
      lines.push('');
    }
  }

  lines.push('[planning]');
  if (config.docs_sink != null) lines.push(`docs_sink = ${serializeTomlValue(config.docs_sink)}`);
  if (Array.isArray(config.docs_sink_ignore) && config.docs_sink_ignore.length) lines.push(`docs_sink_ignore = ${serializeTomlValue(config.docs_sink_ignore)}`);
  lines.push(`ignore = ${serializeTomlValue(Array.isArray(config.ignore) ? config.ignore : ['**/node_modules/**', '**/dist/**'])}`);
  lines.push(`sprintSize = ${serializeTomlValue(typeof config.sprintSize === 'number' ? config.sprintSize : 5)}`);
  lines.push(`currentProfile = ${serializeTomlValue(config.currentProfile || 'human')}`);
  lines.push(`conventionsPaths = ${serializeTomlValue(Array.isArray(config.conventionsPaths) ? config.conventionsPaths : [])}`);
  if (config.planning?.require_evidence_on_stamp) {
    lines.push(`require_evidence_on_stamp = true`);
  }
  lines.push('');

  lines.push('[tasks]');
  if (config.tasks?.require_evidence_on_stamp) {
    lines.push(`require_evidence_on_stamp = true`);
  }
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
      lines.push(`enabled = ${serializeTomlValue(docProject.enabled !== false)}`);
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
    skills: {
      scope: {},
    },
    planning: {
      require_evidence_on_stamp: false,
    },
    tasks: {
      require_evidence_on_stamp: false,
    },
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
