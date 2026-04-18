'use strict';
/**
 * user-settings.cjs — per-user, non-checked-in settings for the logged-in
 * operator. Lives outside any repo so the same file covers every GAD
 * project on this machine.
 *
 * Task 63-03 (phase 63 agent/state hygiene). Answers "who is logged in,
 * which project were they on last, which soul should be injected for
 * this project?" for gad startup, gad snapshot, and SessionStart hooks.
 *
 * Resolve order (first hit wins):
 *   1. $GAD_USER_SETTINGS env override (testing / explicit control)
 *   2. $XDG_CONFIG_HOME/gad/user.json
 *   3. ~/.config/gad/user.json
 *   4. ~/.claude/gad-user.json (Claude Code fallback, per draft manifest)
 *
 * All helpers return defaults when the file is missing. Writes create
 * the file at the resolved write-path (first of 2/3/4). Gitignored by
 * virtue of living outside any repo tree.
 *
 * Contract: deterministic read, atomic write (tmp + rename), no network,
 * no LLM. Injectable `fsImpl` / `osImpl` for tests.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class UserSettingsError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'UserSettingsError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

const DEFAULT_SETTINGS = Object.freeze({
  displayName: '',
  lastActiveProjectid: '',
  assignedSouls: {},
  lastSessionId: '',
  preferredRuntime: '',
  teachingSnoozeUntil: '',
});

function candidatePaths({ envImpl, osImpl } = {}) {
  const env = envImpl || process.env;
  const osMod = osImpl || os;
  const home = osMod.homedir();
  const paths = [];
  if (env.GAD_USER_SETTINGS) paths.push(env.GAD_USER_SETTINGS);
  if (env.XDG_CONFIG_HOME) paths.push(path.join(env.XDG_CONFIG_HOME, 'gad', 'user.json'));
  paths.push(path.join(home, '.config', 'gad', 'user.json'));
  paths.push(path.join(home, '.claude', 'gad-user.json'));
  return paths;
}

function resolveReadPath({ fsImpl, envImpl, osImpl } = {}) {
  const impl = fsImpl || fs;
  for (const p of candidatePaths({ envImpl, osImpl })) {
    if (impl.existsSync(p)) return p;
  }
  return null;
}

function resolveWritePath({ envImpl, osImpl } = {}) {
  return candidatePaths({ envImpl, osImpl })[0];
}

function read({ fsImpl, envImpl, osImpl } = {}) {
  const impl = fsImpl || fs;
  const osMod = osImpl || os;
  const readPath = resolveReadPath({ fsImpl: impl, envImpl, osImpl: osMod });
  const base = { ...DEFAULT_SETTINGS, assignedSouls: {} };
  if (!readPath) {
    base.displayName = osMod.userInfo().username || '';
    return { settings: base, path: null };
  }
  let raw;
  try {
    raw = impl.readFileSync(readPath, 'utf8');
  } catch (e) {
    throw new UserSettingsError('READ_FAILED', `could not read ${readPath}: ${e.message}`, e);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new UserSettingsError('MALFORMED_JSON', `user settings not valid JSON at ${readPath}: ${e.message}`, e);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new UserSettingsError('MALFORMED_JSON', `user settings at ${readPath} is not a JSON object`);
  }
  const merged = { ...base, ...parsed };
  if (!merged.displayName) merged.displayName = osMod.userInfo().username || '';
  if (!merged.assignedSouls || typeof merged.assignedSouls !== 'object' || Array.isArray(merged.assignedSouls)) {
    merged.assignedSouls = {};
  }
  return { settings: merged, path: readPath };
}

function write(settings, { fsImpl, envImpl, osImpl } = {}) {
  const impl = fsImpl || fs;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new UserSettingsError('VALIDATION_FAILED', 'settings must be a plain object');
  }
  const writePath = resolveReadPath({ fsImpl: impl, envImpl, osImpl }) || resolveWritePath({ envImpl, osImpl });
  const dir = path.dirname(writePath);
  try {
    if (!impl.existsSync(dir)) impl.mkdirSync(dir, { recursive: true });
  } catch (e) {
    throw new UserSettingsError('WRITE_FAILED', `could not create ${dir}: ${e.message}`, e);
  }
  const normalized = {
    ...DEFAULT_SETTINGS,
    ...settings,
    assignedSouls: (settings.assignedSouls && typeof settings.assignedSouls === 'object' && !Array.isArray(settings.assignedSouls))
      ? { ...settings.assignedSouls }
      : {},
  };
  const serialized = `${JSON.stringify(normalized, null, 2)}\n`;
  const tmp = `${writePath}.tmp-${process.pid}-${Date.now()}`;
  try {
    impl.writeFileSync(tmp, serialized, { mode: 0o600 });
  } catch (e) {
    throw new UserSettingsError('WRITE_FAILED', `tmp write failed: ${e.message}`, e);
  }
  try {
    impl.renameSync(tmp, writePath);
  } catch (e) {
    try { impl.unlinkSync(tmp); } catch (_) { /* best-effort */ }
    throw new UserSettingsError('WRITE_FAILED', `atomic rename failed: ${e.message}`, e);
  }
  return { path: writePath, settings: normalized };
}

function update(mutator, ctx = {}) {
  const current = read(ctx).settings;
  const next = mutator({ ...current, assignedSouls: { ...current.assignedSouls } }) || current;
  return write(next, ctx);
}

function getDisplayName(ctx) { return read(ctx).settings.displayName; }
function getLastActiveProjectid(ctx) { return read(ctx).settings.lastActiveProjectid; }
function getAssignedSoul(projectid, ctx) {
  const { settings } = read(ctx);
  return (settings.assignedSouls && settings.assignedSouls[projectid]) || '';
}
function setLastActiveProjectid(projectid, ctx) {
  return update((s) => { s.lastActiveProjectid = String(projectid || ''); return s; }, ctx);
}
function setAssignedSoul(projectid, soulSlug, ctx) {
  return update((s) => {
    if (!projectid) throw new UserSettingsError('VALIDATION_FAILED', 'projectid required');
    if (soulSlug) s.assignedSouls[projectid] = String(soulSlug);
    else delete s.assignedSouls[projectid];
    return s;
  }, ctx);
}

module.exports = {
  UserSettingsError,
  DEFAULT_SETTINGS,
  candidatePaths,
  resolveReadPath,
  resolveWritePath,
  read,
  write,
  update,
  getDisplayName,
  getLastActiveProjectid,
  getAssignedSoul,
  setLastActiveProjectid,
  setAssignedSoul,
};
