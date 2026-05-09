'use strict';
/**
 * settings-registry.cjs — canonical schema + resolution for gad settings.
 *
 * Precedence (first hit wins):
 *   1. process.env[envVar]  — coerced to declared type
 *   2. project gad-config.toml [settings] table
 *   3. user settings.toml  ($LOCALAPPDATA/gad/settings.toml on Windows,
 *                           $XDG_CONFIG_HOME/gad/settings.toml or
 *                           ~/.config/gad/settings.toml elsewhere)
 *   4. REGISTRY default
 *
 * No new dependencies — TOML read/write uses the tiny helpers in this file.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REGISTRY = [
  {
    key: 'kael.dual_generate.enabled',
    type: 'boolean',
    default: true,
    envVar: 'VITE_KAEL_DUAL_GENERATE',
    scope: 'user',
    description: 'Whether Kael fires SLM + frontier in parallel per chat submit',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'kael.slm.enabled',
    type: 'boolean',
    default: false,
    envVar: 'VITE_KAEL_USE_SLM',
    scope: 'user',
    description: 'Whether the local SLM is active in the Kael stack',
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'kael.slm.proxy_url',
    type: 'string|null',
    default: null,
    envVar: 'VITE_KAEL_SLM_PROXY_URL',
    scope: 'user',
    description: 'URL of the local SLM proxy (null = not configured)',
    validate: (v) => v === null || typeof v === 'string',
  },
  {
    key: 'kael.slm.health_probe_interval_ms',
    type: 'integer',
    default: 60000,
    scope: 'user',
    description: 'Interval in ms between SLM health probes',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'team.worker.max_inner_rotations',
    type: 'integer',
    default: 3,
    scope: 'project',
    description: 'Max inner retry rotations inside a worker step before giving up',
    validate: (v) => Number.isInteger(v) && v >= 1,
  },
  {
    key: 'team.rate_limit.max_retries',
    type: 'integer',
    default: 3,
    scope: 'project',
    description: 'Max retry attempts on rate-limit before aborting a worker job',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'team.rate_limit.cooldown_ms',
    type: 'integer',
    default: 900000,
    scope: 'project',
    description: 'Cooldown wait in ms after a rate-limit hit (default 15 min)',
    validate: (v) => Number.isInteger(v) && v >= 0,
  },
  {
    key: 'handoffs.reclaim.stale_after_ms',
    type: 'integer',
    default: 21600000,
    scope: 'project',
    description: 'Age threshold in ms before a claimed handoff is reclaimed (default 6 h)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'handoffs.heartbeat.stale_after_ms',
    type: 'integer',
    default: 300000,
    scope: 'project',
    description: 'Age threshold in ms before a heartbeat is considered stale (default 5 min)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
  {
    key: 'team.status.alarm.stale_claim_after_s',
    type: 'integer',
    default: 21600,
    scope: 'project',
    description: 'Age threshold in seconds after which status alarm fires for a stale claim (default 6 h)',
    validate: (v) => Number.isInteger(v) && v > 0,
  },
];

// ---------------------------------------------------------------------------
// TOML helpers (minimal, covers flat [section] tables only)
// ---------------------------------------------------------------------------

/**
 * Parse a TOML file returning { sections: Map<string, Map<string, string>> }
 * where the top-level (before any header) is section ''.
 * Only supports scalar values and simple quoted/unquoted strings; sufficient
 * for the flat [settings] table we write.
 */
function parseTomlSections(text) {
  const sections = new Map();
  sections.set('', new Map());
  let current = '';
  const rawLines = text.split(/\r?\n/);
  for (const line of rawLines) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const headerMatch = stripped.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      current = headerMatch[1].trim();
      if (!sections.has(current)) sections.set(current, new Map());
      continue;
    }
    const eqIdx = stripped.indexOf('=');
    if (eqIdx === -1) continue;
    const k = stripped.slice(0, eqIdx).trim();
    const rawV = stripped.slice(eqIdx + 1).trim();
    sections.get(current).set(k, rawV);
  }
  return sections;
}

function parseTomlScalar(rawV) {
  if (rawV === 'true') return true;
  if (rawV === 'false') return false;
  if (rawV === 'null') return null;
  const dq = rawV.match(/^"(.*)"$/s);
  if (dq) return dq[1].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const sq = rawV.match(/^'(.*)'$/s);
  if (sq) return sq[1];
  const num = Number(rawV);
  if (!isNaN(num) && rawV !== '') return num;
  return rawV;
}

function tomlScalarSerialize(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    return `"${escaped}"`;
  }
  return `"${String(v)}"`;
}

/**
 * Read a TOML file and return the value at [section][key], or undefined.
 * Returns the JS-typed value (boolean, number, string, null).
 */
function readTomlKey(filePath, section, key) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return undefined;
    throw e;
  }
  const sections = parseTomlSections(text);
  const sec = sections.get(section);
  if (!sec) return undefined;
  const rawV = sec.get(key);
  if (rawV === undefined) return undefined;
  return parseTomlScalar(rawV);
}

/**
 * Write (or remove when value===UNSET_SENTINEL) a single key in [section]
 * of a TOML file.  Preserves all other sections and comments line-by-line.
 * Creates the file + parent dirs if absent.
 */
const UNSET_SENTINEL = Symbol('UNSET');

function writeTomlKey(filePath, section, key, value) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }

  const lines = text.split(/\r?\n/);
  // Remove trailing empty line artifact from split
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let inTargetSection = false;
  let sectionFound = false;
  let keyWritten = false;
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].trim();
    const headerMatch = stripped.match(/^\[([^\]]+)\]$/);
    if (headerMatch) {
      const hdr = headerMatch[1].trim();
      if (inTargetSection && !keyWritten && value !== UNSET_SENTINEL) {
        // Insert key before we leave the section
        out.push(`${key} = ${tomlScalarSerialize(value)}`);
        keyWritten = true;
      }
      inTargetSection = hdr === section;
      if (inTargetSection) sectionFound = true;
      out.push(lines[i]);
      continue;
    }
    if (inTargetSection) {
      const eqIdx = stripped.indexOf('=');
      if (eqIdx !== -1) {
        const k = stripped.slice(0, eqIdx).trim();
        if (k === key) {
          if (value === UNSET_SENTINEL) {
            // Drop the line (unset)
            continue;
          }
          out.push(`${key} = ${tomlScalarSerialize(value)}`);
          keyWritten = true;
          continue;
        }
      }
    }
    out.push(lines[i]);
  }

  if (!sectionFound && value !== UNSET_SENTINEL) {
    out.push('');
    out.push(`[${section}]`);
    out.push(`${key} = ${tomlScalarSerialize(value)}`);
    keyWritten = true;
  } else if (inTargetSection && !keyWritten && value !== UNSET_SENTINEL) {
    out.push(`${key} = ${tomlScalarSerialize(value)}`);
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, out.join('\n') + '\n', 'utf8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

function userSettingsTomlPath() {
  const env = process.env;
  if (env.GAD_USER_SETTINGS_TOML) return env.GAD_USER_SETTINGS_TOML;
  if (process.platform === 'win32') {
    const base = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(base, 'gad', 'settings.toml');
  }
  const xdg = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdg, 'gad', 'settings.toml');
}

function projectTomlPath(opts = {}) {
  if (opts.projectTomlPath) return opts.projectTomlPath;
  // Try to locate gad-config.toml walking up from cwd or baseDir
  const startDir = opts.baseDir || process.cwd();
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'gad-config.toml');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Type coercion
// ---------------------------------------------------------------------------

function coerce(type, raw) {
  if (raw === undefined || raw === null) return raw;
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    return undefined; // uncoerceable
  }
  if (type === 'integer') {
    const n = parseInt(String(raw), 10);
    return isNaN(n) ? undefined : n;
  }
  if (type === 'string|null') {
    if (raw === 'null' || raw === '') return null;
    return String(raw);
  }
  if (type === 'string') return String(raw);
  return raw;
}

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

function findEntry(key) {
  return REGISTRY.find((e) => e.key === key);
}

/**
 * Resolve where a setting's current value comes from.
 * Returns { source: 'env'|'project'|'user'|'default', value }
 */
function resolveSettingSource(key, opts = {}) {
  const entry = findEntry(key);
  if (!entry) return { source: 'default', value: undefined };

  // 1. env
  if (entry.envVar) {
    const raw = process.env[entry.envVar];
    if (raw !== undefined) {
      const coerced = coerce(entry.type, raw);
      if (coerced !== undefined) return { source: 'env', value: coerced };
    }
  }

  // 2. project gad-config.toml [settings]
  const projPath = projectTomlPath(opts);
  if (projPath) {
    const v = readTomlKey(projPath, 'settings', key);
    if (v !== undefined) return { source: 'project', value: coerce(entry.type, v) };
  }

  // 3. user settings.toml
  const userPath = opts.userTomlPath || userSettingsTomlPath();
  const uv = readTomlKey(userPath, 'settings', key);
  if (uv !== undefined) return { source: 'user', value: coerce(entry.type, uv) };

  // 4. default
  return { source: 'default', value: entry.default };
}

/**
 * Get the effective value of a setting.
 * @param {string} key
 * @param {*} [fallbackDefault] — overrides REGISTRY default if provided
 * @param {object} [opts]
 */
function getSetting(key, fallbackDefault, opts = {}) {
  const { source, value } = resolveSettingSource(key, opts);
  if (source === 'default') {
    const entry = findEntry(key);
    if (!entry) return fallbackDefault !== undefined ? fallbackDefault : undefined;
    return fallbackDefault !== undefined ? fallbackDefault : entry.default;
  }
  return value;
}

/**
 * Validate a value against the registry entry.
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateSetting(key, value) {
  const entry = findEntry(key);
  if (!entry) return { valid: false, reason: `Unknown setting key: ${key}` };
  if (typeof entry.validate === 'function') {
    if (!entry.validate(value)) {
      return { valid: false, reason: `Value ${JSON.stringify(value)} fails type/range check for ${key} (expected ${entry.type})` };
    }
  }
  return { valid: true };
}

module.exports = {
  REGISTRY,
  getSetting,
  resolveSettingSource,
  validateSetting,
  // Exported for use by CLI command
  userSettingsTomlPath,
  projectTomlPath,
  writeTomlKey,
  readTomlKey,
  UNSET_SENTINEL,
  coerce,
  findEntry,
};
