'use strict';
/**
 * Platform dispatch for gad cron schedulers.
 * Selects scheduler-windows.cjs or scheduler-unix.cjs based on process.platform.
 *
 * Phase 254-05: cron.json schema accepts unified schedule strings
 * (interval / hz / cron / shorthand / on:event / when:predicate) via
 * `validateScheduleEntry` + `validateCronJsonShape`. Readers tolerate
 * both legacy array shape AND the object form `{ entries: [...] }`.
 */

const path = require('path');
const fs = require('fs');

const CRON_JSON_FILENAME = 'cron.json';

// schedule-parser is the canonical syntax authority for unified strings.
// Phase 254-02 lib; required lazily to avoid a circular import if cron is
// ever pulled into the parser's surface.
let _scheduleParser = null;
function getScheduleParser() {
  if (_scheduleParser) return _scheduleParser;
  _scheduleParser = require('../schedule-parser/index.cjs');
  return _scheduleParser;
}

// ---------------------------------------------------------------------------
// Platform scheduler
// ---------------------------------------------------------------------------
function getScheduler() {
  if (process.platform === 'win32') {
    return require('./scheduler-windows.cjs');
  }
  return require('./scheduler-unix.cjs');
}

// ---------------------------------------------------------------------------
// Cron expression validation
// ---------------------------------------------------------------------------
const CRON_FIELD_RE = /^(\*|(\d+|\*)(\/\d+)?(-(\d+|\*))?(,(\d+|\*)(\/\d+)?(-(\d+|\*))?)*)/;
const CRON_RE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

/**
 * Validate a 5-field cron expression.
 * @param {string} expr
 * @returns {boolean}
 */
function isValidCronExpr(expr) {
  return CRON_RE.test(expr.trim());
}

// ---------------------------------------------------------------------------
// JSON store helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the path to cron.json for the given planning dir.
 * @param {string} planningDir - absolute path to .planning/
 * @returns {string}
 */
function cronJsonPath(planningDir) {
  return path.join(planningDir, CRON_JSON_FILENAME);
}

/**
 * Read cron.json. Returns [] if missing or malformed.
 *
 * Tolerant of two shapes:
 *   1. Legacy array form          [{ name, schedule, command, ... }]
 *   2. Object form (phase 254-05) { entries: [{ id, schedule, command, ... }] }
 *
 * @param {string} planningDir
 * @returns {Array}
 */
function readCronJson(planningDir) {
  const p = cronJsonPath(planningDir);
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.entries)) return raw.entries;
    return [];
  } catch {
    return [];
  }
}

/**
 * Write cron.json atomically.
 * @param {string} planningDir
 * @param {Array} entries
 */
function writeCronJson(planningDir, entries) {
  const p = cronJsonPath(planningDir);
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(entries, null, 2) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Log helpers
// ---------------------------------------------------------------------------
const CRON_LOG_FILENAME = 'cron.log.jsonl';

function cronLogPath(planningDir) {
  return path.join(planningDir, CRON_LOG_FILENAME);
}

function appendCronLog(planningDir, entry) {
  const p = cronLogPath(planningDir);
  fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Unified schedule validation (phase 254-05)
// ---------------------------------------------------------------------------

/**
 * Validate a single schedule string under the unified syntax.
 * Accepts: interval / hz / 5-field cron / @shorthand / on:event / when:predicate.
 *
 * @param {string} schedule
 * @returns {{ valid: boolean, error?: string, kind?: string }}
 */
function validateScheduleString(schedule) {
  if (typeof schedule !== 'string' || !schedule.trim()) {
    return { valid: false, error: 'schedule must be a non-empty string' };
  }
  const parser = getScheduleParser();
  const result = parser.validate(schedule);
  if (!result.valid) return result;
  try {
    const parsed = parser.parse(schedule);
    return { valid: true, kind: parsed.kind };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * Validate a cron-entry object against the phase 254-05 schema.
 * Entries are accepted in either gad-cron-CLI shape (name + schedule + command)
 * or design-doc shape (id + schedule + command). One of name/id is required.
 *
 * @param {object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateScheduleEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    return { valid: false, errors: ['entry must be an object'] };
  }
  const id = entry.id || entry.name;
  if (!id || typeof id !== 'string') {
    errors.push('entry must have id (or legacy name) as a non-empty string');
  } else if (!/^[\w:-]+$/.test(id)) {
    errors.push(`entry id "${id}" must match /^[\\w:-]+$/`);
  }
  if (typeof entry.schedule !== 'string' || !entry.schedule.trim()) {
    errors.push('entry.schedule must be a non-empty string');
  } else {
    const sr = validateScheduleString(entry.schedule);
    if (!sr.valid) errors.push(`entry.schedule: ${sr.error}`);
  }
  if (typeof entry.command !== 'string' || !entry.command.trim()) {
    errors.push('entry.command must be a non-empty string (gad-CLI args or shell command)');
  }
  // Optional fields tolerated; only flag types when present.
  if (entry.enabled != null && typeof entry.enabled !== 'boolean') {
    errors.push('entry.enabled, if present, must be boolean');
  }
  if (entry.status != null && typeof entry.status !== 'string') {
    errors.push('entry.status, if present, must be string');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validate the top-level cron.json document (either shape).
 *
 * @param {unknown} doc parsed JSON
 * @returns {{ valid: boolean, errors: string[], entries: Array }}
 */
function validateCronJsonShape(doc) {
  const errors = [];
  let entries = [];

  if (Array.isArray(doc)) {
    entries = doc;
  } else if (doc && typeof doc === 'object' && Array.isArray(doc.entries)) {
    entries = doc.entries;
  } else {
    return {
      valid: false,
      errors: ['cron.json must be an array or { entries: [...] } object'],
      entries: [],
    };
  }

  const seenIds = new Set();
  entries.forEach((entry, idx) => {
    const r = validateScheduleEntry(entry);
    if (!r.valid) {
      for (const err of r.errors) errors.push(`entries[${idx}]: ${err}`);
    }
    const id = entry && (entry.id || entry.name);
    if (id) {
      if (seenIds.has(id)) errors.push(`entries[${idx}]: duplicate id "${id}"`);
      seenIds.add(id);
    }
  });

  return { valid: errors.length === 0, errors, entries };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
  getScheduler,
  isValidCronExpr,
  readCronJson,
  writeCronJson,
  cronJsonPath,
  cronLogPath,
  appendCronLog,
  CRON_JSON_FILENAME,
  // Phase 254-05: unified schedule validation
  validateScheduleString,
  validateScheduleEntry,
  validateCronJsonShape,
};
