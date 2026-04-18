'use strict';
/**
 * env-defaults-store.cjs — non-secret env defaults, scope-resolved.
 *
 * Companion to lib/secrets-store.cjs (60-02), introduced for task 60-07b.
 * Decision gad-268.
 *
 * Why a separate store: not every env var is a secret. Operators routinely
 * want to set MODEL_NAME, BASE_URL, MAX_TOKENS, REGION, etc. per-eval or
 * per-species without paying the encryption tax (no passphrase prompt, no
 * keychain round-trip, no audit log). Keeping the secret and non-secret
 * stores apart also makes the non-secret values diffable and reviewable
 * in regular tooling.
 *
 * On-disk layout:
 *   .gad/env/<projectId>.json                  (planning project)
 *   .gad/env/<projectId>/<scope>.json          (eval / species)
 *
 * File format: pretty-printed JSON
 *   { "schemaVersion": 1, "values": { "MODEL_NAME": "gpt-5", ... } }
 *
 * Gitignore: by default we add `.gad/env/` to the project's .gitignore on
 * first write — non-secret does NOT mean "always safe to commit" (some
 * vars are PII or environment-specific). Operators can opt in to commit
 * by removing the gitignore line manually; we never override their choice
 * once set.
 *
 * Scope chain semantics: identical to secrets-store.listChain — most-
 * specific wins, parents fill in missing keys, shadowed values are
 * exposed in `shadows[]` so the UI can surface what's hidden.
 *
 * Public API:
 *   list({ projectId, scope? })            → rows
 *   listChain({ projectId, scopeChain })   → rows + shadows[]
 *   get({ projectId, key, scope? })        → string | undefined
 *   set({ projectId, key, value, scope? })
 *   unset({ projectId, key, scope? })
 *   resolveChain({ projectId, scopeChain }) → { KEY: value }
 *
 * Test hooks:
 *   _setProjectRootForTest(projectId, dir)
 */

const fs = require('fs');
const path = require('path');

class EnvDefaultsError extends Error {
  constructor(code, message, details) {
    super(`${code}: ${message}`);
    this.name = 'EnvDefaultsError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

const KEY_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const projectRootOverrides = new Map();

function _setProjectRootForTest(projectId, dir) {
  if (dir === null || dir === undefined) projectRootOverrides.delete(projectId);
  else projectRootOverrides.set(projectId, dir);
}

function resolveProjectRoot(projectId) {
  if (projectRootOverrides.has(projectId)) return projectRootOverrides.get(projectId);
  const envOverride = process.env.GAD_PROJECT_ROOT;
  if (envOverride && fs.existsSync(envOverride)) return envOverride;
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const hasConfig =
      fs.existsSync(path.join(dir, 'gad-config.toml')) ||
      fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
      fs.existsSync(path.join(dir, 'planning-config.toml'));
    if (hasConfig) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

function normalizeScope(scope) {
  if (scope === undefined || scope === null) return null;
  const s = String(scope).trim();
  if (!s) return null;
  if (s.startsWith('/') || s.endsWith('/')) {
    throw new EnvDefaultsError('VALIDATION', `scope "${scope}" must not start or end with "/"`);
  }
  if (/\\/.test(s)) {
    throw new EnvDefaultsError('VALIDATION', `scope "${scope}" must not contain backslashes`);
  }
  for (const part of s.split('/')) {
    if (!part || part === '.' || part === '..') {
      throw new EnvDefaultsError('VALIDATION', `scope "${scope}" contains an invalid segment`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(part)) {
      throw new EnvDefaultsError('VALIDATION', `scope segment "${part}" must match [A-Za-z0-9._-]+`);
    }
  }
  return s;
}

function filePath(projectId, scope) {
  const root = resolveProjectRoot(projectId);
  const norm = normalizeScope(scope);
  if (!norm) return path.join(root, '.gad', 'env', `${projectId}.json`);
  const parts = norm.split('/');
  const last = parts.pop();
  return path.join(root, '.gad', 'env', projectId, ...parts, `${last}.json`);
}

function gitignorePath(projectId) {
  const root = resolveProjectRoot(projectId);
  return path.join(root, '.gitignore');
}

const GITIGNORE_MARKER = '# Added by gad env defaults — non-secret env values, may contain PII';
const GITIGNORE_LINE = '.gad/env/';

function gitignoreCovers(contents) {
  const lines = String(contents || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (
      line === '.gad/' ||
      line === '.gad' ||
      line === '.gad/**' ||
      line === '.gad/env' ||
      line === '.gad/env/' ||
      line === '.gad/env/**'
    ) {
      return true;
    }
  }
  return false;
}

function ensureGitignore(projectId) {
  const p = gitignorePath(projectId);
  let existing = '';
  let existed = false;
  try {
    if (fs.existsSync(p)) {
      existed = true;
      existing = fs.readFileSync(p, 'utf8');
    }
  } catch (e) {
    throw new EnvDefaultsError('GITIGNORE_WRITE_FAILED', `could not read ${p}: ${e.message}`);
  }
  if (gitignoreCovers(existing)) return;
  const trailingNewline = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  const prefix = existing.length === 0 ? '' : '\n';
  const appended = `${existing}${trailingNewline}${prefix}${GITIGNORE_MARKER}\n${GITIGNORE_LINE}\n`;
  try {
    fs.writeFileSync(p, appended, { flag: 'w' });
  } catch (e) {
    throw new EnvDefaultsError(
      'GITIGNORE_WRITE_FAILED',
      `could not ${existed ? 'update' : 'create'} ${p}: ${e.message}`,
    );
  }
}

function readFile(projectId, scope) {
  const p = filePath(projectId, scope);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new EnvDefaultsError('FILE_CORRUPT', `${p} is not valid JSON: ${e.message}`);
  }
  if (!parsed || typeof parsed !== 'object' || parsed.schemaVersion !== 1 || typeof parsed.values !== 'object') {
    throw new EnvDefaultsError('FILE_CORRUPT', `${p} is not a v1 env-defaults file`);
  }
  return parsed;
}

function writeFile(projectId, scope, payload) {
  const p = filePath(projectId, scope);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
}

function requireString(name, val) {
  if (typeof val !== 'string' || !val) {
    throw new EnvDefaultsError('VALIDATION', `${name} is required and must be a non-empty string`);
  }
}

function requireKey(key) {
  requireString('key', key);
  if (!KEY_NAME_RE.test(key)) {
    throw new EnvDefaultsError('VALIDATION', `key "${key}" must match ${KEY_NAME_RE.source}`);
  }
}

function list({ projectId, scope }) {
  requireString('projectId', projectId);
  const norm = normalizeScope(scope);
  const file = readFile(projectId, norm);
  if (!file) return [];
  return Object.entries(file.values).map(([key, value]) => ({
    key,
    value: String(value),
    scopeBag: norm || null,
  }));
}

function listChain({ projectId, scopeChain }) {
  requireString('projectId', projectId);
  if (!Array.isArray(scopeChain) || scopeChain.length === 0) {
    throw new EnvDefaultsError('VALIDATION', 'scopeChain is required and must be a non-empty array');
  }
  const winners = new Map();
  const shadowsByKey = new Map();
  for (const rawScope of scopeChain) {
    const norm = normalizeScope(rawScope);
    const rows = list({ projectId, scope: norm });
    for (const r of rows) {
      if (winners.has(r.key)) {
        if (!shadowsByKey.has(r.key)) shadowsByKey.set(r.key, []);
        shadowsByKey.get(r.key).push(norm);
      } else {
        winners.set(r.key, r);
      }
    }
  }
  return [...winners.values()].map((r) => ({ ...r, shadows: shadowsByKey.get(r.key) || [] }));
}

function get({ projectId, key, scope }) {
  requireString('projectId', projectId);
  requireKey(key);
  const file = readFile(projectId, scope);
  if (!file) return undefined;
  const v = file.values[key];
  return v === undefined ? undefined : String(v);
}

function set({ projectId, key, value, scope }) {
  requireString('projectId', projectId);
  requireKey(key);
  if (typeof value !== 'string') {
    throw new EnvDefaultsError('VALIDATION', `value must be a string (got ${typeof value})`);
  }
  ensureGitignore(projectId);
  const norm = normalizeScope(scope);
  const file = readFile(projectId, norm) || { schemaVersion: 1, values: {} };
  file.values[key] = value;
  writeFile(projectId, norm, file);
}

function unset({ projectId, key, scope }) {
  requireString('projectId', projectId);
  requireKey(key);
  const norm = normalizeScope(scope);
  const file = readFile(projectId, norm);
  if (!file) return false;
  if (!(key in file.values)) return false;
  delete file.values[key];
  writeFile(projectId, norm, file);
  return true;
}

function resolveChain({ projectId, scopeChain }) {
  const rows = listChain({ projectId, scopeChain });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

module.exports = {
  list,
  listChain,
  get,
  set,
  unset,
  resolveChain,
  normalizeScope,
  filePath,
  gitignorePath,
  EnvDefaultsError,
  _setProjectRootForTest,
};
