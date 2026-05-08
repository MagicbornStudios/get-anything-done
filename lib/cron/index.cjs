'use strict';
/**
 * Platform dispatch for gad cron schedulers.
 * Selects scheduler-windows.cjs or scheduler-unix.cjs based on process.platform.
 */

const path = require('path');
const fs = require('fs');

const CRON_JSON_FILENAME = 'cron.json';

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
 * @param {string} planningDir
 * @returns {Array}
 */
function readCronJson(planningDir) {
  const p = cronJsonPath(planningDir);
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
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
};
