'use strict';
/**
 * env-doctor — CJS port of apps/platform/lib/gad-env/{resolver,loader}.ts.
 *
 * Validates a project's env against its gad-env.schema.toml and produces:
 *   - per-feature satisfied/missing status,
 *   - per-var resolution (which layer it came from),
 *   - shared-pool location diagnostic,
 *   - optional operator-todo seeding for missing required vars.
 *
 * Resolution chain (Q1=B / Q3=A in decision GLOBAL-D-344-ish):
 *   process.env > <project>/.env.local > <project>/.env > <workspaceRoot>/.gad/env.shared
 *
 * Shared-pool discovery: walk up from <project> until we find a gad-config.toml
 * (or .planning/gad-config.toml); adjacent .gad/env.shared is canonical.
 *
 * Schema reader uses @iarna/toml hoisted at the monorepo root. We resolve it
 * via createRequire bound to the workspace's package.json so node finds it
 * regardless of whether vendor/get-anything-done has its own node_modules.
 *
 * Operator-todo seeder writes to <workspaceRoot>/.planning/datasets/operator-todos/<YYYY-MM-DD>.jsonl
 * following the shape declared in apps/platform/lib/operator-todos/types.ts
 * (kind="paste_env_var", payload={env_var, provider, validation_prefix?,
 * help_url?, min_length?}).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');

// ---------------------------------------------------------------------------
// TOML loader — resolve @iarna/toml via the nearest workspace's package.json
// ---------------------------------------------------------------------------

let _tomlMod = null;
function getToml(workspaceRoot) {
  if (_tomlMod) return _tomlMod;
  // Try local require first (works in installed gad binary or when
  // vendor/get-anything-done has @iarna/toml as a dep).
  try {
    _tomlMod = require('@iarna/toml');
    return _tomlMod;
  } catch (_) {
    // fall through to createRequire dance
  }
  // Bind a require to <workspaceRoot>/package.json so node walks the
  // monorepo's hoisted node_modules.
  const anchor = workspaceRoot
    ? path.join(workspaceRoot, 'package.json')
    : path.join(process.cwd(), 'package.json');
  try {
    const req = createRequire(anchor);
    _tomlMod = req('@iarna/toml');
    return _tomlMod;
  } catch (err) {
    throw new Error(
      `env-doctor: cannot load @iarna/toml. Tried local require and ${anchor}. ` +
      `Install it at the workspace root or in vendor/get-anything-done. ` +
      `Underlying error: ${err && err.message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Resolver — dotenv parser + layered lookup
// ---------------------------------------------------------------------------

const DOTENV_LINE_RE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

const layerCache = new Map(); // filePath -> { source, path, vars } | null
const sharedPoolCache = new Map(); // projectRoot -> Layer | null

function unquote(raw) {
  let v = raw;
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return v;
}

function parseDotenv(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(DOTENV_LINE_RE);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if (!value.startsWith('"') && !value.startsWith("'")) {
      const hashIdx = value.indexOf(' #');
      if (hashIdx >= 0) value = value.slice(0, hashIdx).trim();
    }
    out[key] = unquote(value);
  }
  return out;
}

function readLayerFile(filePath, source) {
  if (layerCache.has(filePath)) return layerCache.get(filePath);
  let layer = null;
  try {
    if (fs.existsSync(filePath)) {
      const text = fs.readFileSync(filePath, 'utf8');
      layer = { source, path: filePath, vars: parseDotenv(text) };
    }
  } catch (_) {
    layer = null;
  }
  layerCache.set(filePath, layer);
  return layer;
}

/**
 * Walk up from startDir for the nearest gad-config.toml (or
 * .planning/gad-config.toml). Returns the containing dir, or null.
 */
function findGadWorkspaceRoot(startDir) {
  let dir = path.resolve(startDir);
  const home = process.env.USERPROFILE || process.env.HOME || path.parse(dir).root;
  let guard = 50;
  while (guard-- > 0) {
    if (fs.existsSync(path.join(dir, 'gad-config.toml'))) return dir;
    if (fs.existsSync(path.join(dir, '.planning', 'gad-config.toml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    if (path.resolve(parent) === path.resolve(home)) {
      if (fs.existsSync(path.join(parent, 'gad-config.toml'))) return parent;
      return null;
    }
    dir = parent;
  }
  return null;
}

function loadSharedPool(projectRoot) {
  if (sharedPoolCache.has(projectRoot)) return sharedPoolCache.get(projectRoot);
  const workspaceRoot = findGadWorkspaceRoot(projectRoot);
  if (!workspaceRoot) {
    sharedPoolCache.set(projectRoot, null);
    return null;
  }
  const poolPath = path.join(workspaceRoot, '.gad', 'env.shared');
  const layer = readLayerFile(poolPath, 'shared_pool');
  sharedPoolCache.set(projectRoot, layer);
  return layer;
}

/** Resolve a single env var through process.env -> .env.local -> .env -> shared pool. */
function resolveEnv(name, projectRoot, opts) {
  const root = path.resolve(projectRoot || process.cwd());
  const ignoreProcess = !!(opts && opts.ignoreProcess);
  if (!ignoreProcess) {
    const fromProcess = process.env[name];
    if (fromProcess !== undefined && fromProcess !== '') {
      return { name, value: fromProcess, source: 'process' };
    }
  }
  const local = readLayerFile(path.join(root, '.env.local'), 'project_local');
  if (local && local.vars[name] !== undefined) {
    return { name, value: local.vars[name], source: 'project_local', sourcePath: local.path };
  }
  const project = readLayerFile(path.join(root, '.env'), 'project');
  if (project && project.vars[name] !== undefined) {
    return { name, value: project.vars[name], source: 'project', sourcePath: project.path };
  }
  const shared = loadSharedPool(root);
  if (shared && shared.vars[name] !== undefined) {
    return { name, value: shared.vars[name], source: 'shared_pool', sourcePath: shared.path };
  }
  return { name, value: undefined, source: 'missing' };
}

function resolveEnvBatch(names, projectRoot, opts) {
  const out = {};
  for (const n of names) out[n] = resolveEnv(n, projectRoot, opts);
  return out;
}

function describePoolLocation(projectRoot) {
  const root = path.resolve(projectRoot || process.cwd());
  const ws = findGadWorkspaceRoot(root);
  if (!ws) return { workspaceRoot: null, poolPath: null, poolExists: false };
  const poolPath = path.join(ws, '.gad', 'env.shared');
  return { workspaceRoot: ws, poolPath, poolExists: fs.existsSync(poolPath) };
}

// ---------------------------------------------------------------------------
// Schema loader
// ---------------------------------------------------------------------------

const schemaCache = new Map();
const ancestorVarsCache = new Map();

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string');
}

function normalizeFeature(key, raw) {
  return {
    key,
    title: raw.title || key,
    required: asStringArray(raw.required),
    optional: asStringArray(raw.optional),
    unlocks: raw.unlocks,
    degrades_to: raw.degrades_to,
  };
}

function normalizeVar(name, raw) {
  return {
    name,
    provider: raw.provider,
    prefix: raw.prefix,
    mode_prefixes: raw.mode_prefixes,
    help_url: raw.help_url,
    sensitive: raw.sensitive,
    example: raw.example,
    description: raw.description,
  };
}

/**
 * Walk up from `startDir` looking for an ancestor `.gad/env.schema.toml`
 * (parallel to `.gad/env.shared`). Returns its vars{} map — canonical
 * metadata for cross-cutting env vars (RUNPOD_API_KEY, OPENAI_API_KEY,
 * Sentry, Supabase) shared across projects. Features are NOT inherited.
 */
function loadAncestorVars(startDir) {
  const cacheKey = path.resolve(startDir);
  if (ancestorVarsCache.has(cacheKey)) return ancestorVarsCache.get(cacheKey);

  const workspaceRoot = findGadWorkspaceRoot(cacheKey) || cacheKey;
  const toml = getToml(workspaceRoot);

  let dir = cacheKey;
  let guard = 50;
  while (guard-- > 0) {
    const candidate = path.join(dir, '.gad', 'env.schema.toml');
    if (fs.existsSync(candidate)) {
      try {
        const raw = toml.parse(fs.readFileSync(candidate, 'utf8'));
        const out = {};
        for (const [name, body] of Object.entries(raw.vars || {})) {
          out[name] = normalizeVar(name, body);
        }
        ancestorVarsCache.set(cacheKey, out);
        return out;
      } catch {
        break; // bad TOML at ancestor — no inheritance
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  ancestorVarsCache.set(cacheKey, {});
  return {};
}

/**
 * Load <projectRoot>/gad-env.schema.toml, merging ancestor vars from
 * any <ancestor>/.gad/env.schema.toml found by walking up. Project vars
 * override ancestor vars on key collision. Returns null only when
 * neither the project schema nor any ancestor schema exists.
 */
function loadSchema(projectRoot) {
  const abs = path.resolve(projectRoot);
  if (schemaCache.has(abs)) return schemaCache.get(abs);
  const schemaPath = path.join(abs, 'gad-env.schema.toml');
  const ancestorVars = loadAncestorVars(abs);
  const hasProjectSchema = fs.existsSync(schemaPath);

  if (!hasProjectSchema && Object.keys(ancestorVars).length === 0) {
    schemaCache.set(abs, null);
    return null;
  }

  const workspaceRoot = findGadWorkspaceRoot(abs) || abs;
  const toml = getToml(workspaceRoot);
  let raw = {};
  if (hasProjectSchema) {
    raw = toml.parse(fs.readFileSync(schemaPath, 'utf8'));
  }

  const features = [];
  for (const [key, body] of Object.entries(raw.features || {})) {
    features.push(normalizeFeature(key, body));
  }
  // Merge ancestor first, project vars override on collision.
  const vars = Object.assign({}, ancestorVars);
  for (const [name, body] of Object.entries(raw.vars || {})) {
    vars[name] = normalizeVar(name, body);
  }
  const schema = {
    meta: {
      project: (raw.meta && raw.meta.project) || path.basename(abs),
      description: raw.meta && raw.meta.description,
      schemaPath: hasProjectSchema ? schemaPath : null,
    },
    features,
    vars,
  };
  schemaCache.set(abs, schema);
  return schema;
}

// ---------------------------------------------------------------------------
// Feature status
// ---------------------------------------------------------------------------

function isResolved(rv) {
  return rv && rv.source !== 'missing' && rv.value !== undefined && rv.value !== '';
}

function featureStatus(feature, projectRoot) {
  const allVars = [...feature.required, ...feature.optional];
  const varStatuses = resolveEnvBatch(allVars, projectRoot);
  const missingRequired = feature.required.filter((n) => !isResolved(varStatuses[n]));
  const missingOptional = feature.optional.filter((n) => !isResolved(varStatuses[n]));
  return {
    feature,
    satisfied: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    varStatuses,
  };
}

function listFeatures(projectRoot) {
  const schema = loadSchema(projectRoot);
  if (!schema) return [];
  return schema.features.map((f) => featureStatus(f, projectRoot));
}

function isFeatureEnabled(featureKey, projectRoot) {
  const schema = loadSchema(projectRoot);
  if (!schema) return false;
  const f = schema.features.find((x) => x.key === featureKey);
  if (!f) return false;
  return featureStatus(f, projectRoot).satisfied;
}

// ---------------------------------------------------------------------------
// Operator-todo seeder
// ---------------------------------------------------------------------------

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function generateTodoId(kind) {
  const ts = nowIso().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const rand = crypto.randomBytes(3).toString('hex');
  return `${kind}-${ts}-${rand}`;
}

function readJsonlSafe(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const out = [];
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try { out.push(JSON.parse(line)); } catch (_) { /* skip malformed */ }
  }
  return out;
}

/**
 * Group JSONL lines by id, latest-wins, then filter to open|in_progress
 * paste_env_var todos. Returns Set<env_var> already-open.
 */
function readOpenPasteEnvSet(workspaceRoot, maxDays = 30) {
  const dir = path.join(workspaceRoot, '.planning', 'datasets', 'operator-todos');
  if (!fs.existsSync(dir)) return new Set();
  let files;
  try { files = fs.readdirSync(dir); } catch (_) { return new Set(); }
  const jsonl = files
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(n))
    .sort()
    .slice(-maxDays);
  const byId = new Map();
  // iterate ascending so later writes (newer dates / lines) override
  for (const name of jsonl) {
    for (const todo of readJsonlSafe(path.join(dir, name))) {
      if (!todo || !todo.id) continue;
      byId.set(todo.id, todo);
    }
  }
  const open = new Set();
  for (const t of byId.values()) {
    if (t.kind !== 'paste_env_var') continue;
    if (t.status !== 'open' && t.status !== 'in_progress') continue;
    const envVar = t.payload && t.payload.env_var;
    if (typeof envVar === 'string') open.add(envVar);
  }
  return open;
}

function buildPasteEnvTodo(varName, schemaVar, feature, phaseId) {
  const provider = (schemaVar && schemaVar.provider) || 'Unknown';
  const helpUrl = schemaVar && schemaVar.help_url;
  // validation_prefix: prefer literal prefix; otherwise pick the first
  // mode_prefix (operator can paste either live/test).
  let validationPrefix = schemaVar && schemaVar.prefix;
  if (!validationPrefix && schemaVar && schemaVar.mode_prefixes) {
    const mp = Object.values(schemaVar.mode_prefixes).filter((v) => typeof v === 'string');
    if (mp.length > 0) validationPrefix = mp[0];
  }
  const payload = { env_var: varName, provider };
  if (validationPrefix) payload.validation_prefix = validationPrefix;
  if (helpUrl) payload.help_url = helpUrl;
  // min_length heuristic: api keys >=32, urls >=10, ids ~12
  if (varName.endsWith('_KEY') || varName.endsWith('_TOKEN') || varName.endsWith('_SECRET')) {
    payload.min_length = 32;
  } else if (validationPrefix === 'https://' || validationPrefix === '+') {
    payload.min_length = 10;
  } else if (validationPrefix === 'price_') {
    payload.min_length = 12;
  } else if (validationPrefix === 'AC') {
    payload.min_length = 34;
  }
  const id = generateTodoId('paste_env_var');
  const description = schemaVar && schemaVar.description
    ? schemaVar.description
    : `${provider} — required by feature "${feature ? feature.title : ''}".`;
  return {
    id,
    kind: 'paste_env_var',
    title: `Paste ${varName}`,
    description,
    payload,
    required_components: ['InlineEnvVarRequest'],
    action_to_complete: {
      verb: 'env-var-set',
      args: { name: varName },
      http: { method: 'POST', path: `/api/operator-todos/${id}/done` },
    },
    phase_id: phaseId || null,
    task_id: null,
    soul_id: 'kael',
    priority: 'high',
    status: 'open',
    created_at: nowIso(),
    completed_at: null,
    result: null,
  };
}

/**
 * Create paste_env_var todos for every REQUIRED var still missing after
 * resolution. Skips vars already covered by an open/in_progress todo.
 * Returns { created: [envVar...], skipped: [envVar...], filePath }.
 */
function seedTodosForMissing(projectRoot, options) {
  const opts = options || {};
  const workspaceRoot = findGadWorkspaceRoot(projectRoot);
  if (!workspaceRoot) {
    throw new Error(
      `env-doctor: cannot seed todos — no gad workspace found above ${projectRoot}`,
    );
  }
  const features = listFeatures(projectRoot);
  const schema = loadSchema(projectRoot);
  if (!schema) return { created: [], skipped: [], filePath: null };

  const openSet = readOpenPasteEnvSet(workspaceRoot);
  const missing = new Map(); // varName -> { feature, schemaVar }
  for (const fs2 of features) {
    for (const v of fs2.missingRequired) {
      if (!missing.has(v)) {
        missing.set(v, { feature: fs2.feature, schemaVar: schema.vars[v] });
      }
    }
  }

  const dir = path.join(workspaceRoot, '.planning', 'datasets', 'operator-todos');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${todayUtc()}.jsonl`);

  const created = [];
  const skipped = [];
  for (const [varName, ctx] of missing) {
    if (openSet.has(varName)) {
      skipped.push(varName);
      continue;
    }
    const todo = buildPasteEnvTodo(varName, ctx.schemaVar, ctx.feature, opts.phaseId);
    fs.appendFileSync(filePath, JSON.stringify(todo) + '\n', 'utf8');
    created.push(varName);
  }
  return { created, skipped, filePath };
}

// ---------------------------------------------------------------------------
// Cache invalidation (used by tests)
// ---------------------------------------------------------------------------

function invalidateCache() {
  layerCache.clear();
  sharedPoolCache.clear();
  schemaCache.clear();
  ancestorVarsCache.clear();
}

module.exports = {
  // resolver
  resolveEnv,
  resolveEnvBatch,
  describePoolLocation,
  findGadWorkspaceRoot,
  // schema
  loadSchema,
  // features
  listFeatures,
  isFeatureEnabled,
  // todos
  seedTodosForMissing,
  // utils
  invalidateCache,
};
