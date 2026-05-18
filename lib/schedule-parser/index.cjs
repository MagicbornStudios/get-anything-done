'use strict';

/**
 * schedule-parser — unified schedule syntax parser
 * Phase 254-02 | 2026-05-18
 *
 * Accepts:
 *   interval   "30s" | "5m" | "1h" | "1d"
 *   hz         "10hz"
 *   cron       "0 3 * * *"
 *   shorthand  "@daily" | "@weekly" | "@monthly" | "@hourly" | "@yearly"
 *   event      "on:commit" | "on:phase-close" | "on:level-up" | "on:task-stamp"
 *   predicate  "when:level_delta >= 2" | "when:dataset_delta_mb > 500"
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHORTHAND_MAP = {
  '@yearly':  '0 0 1 1 *',
  '@annually':'0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly':  '0 0 * * 0',
  '@daily':   '0 0 * * *',
  '@midnight':'0 0 * * *',
  '@hourly':  '0 * * * *',
};

const INTERVAL_UNITS_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const VALID_OPERATORS = ['>=', '<=', '>', '<', '==', '!='];

const KNOWN_EVENTS = new Set([
  'commit', 'phase-close', 'level-up', 'task-stamp',
  'deploy', 'bench-complete', 'evolution', 'session-start',
]);

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

const RE_INTERVAL = /^(\d+(?:\.\d+)?)(s|m|h|d)$/i;
const RE_HZ       = /^(\d+(?:\.\d+)?)hz$/i;
// 5-field cron: each field is a non-whitespace token
const RE_CRON     = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;
const RE_EVENT    = /^on:([a-zA-Z0-9_-]+)$/;
const RE_PRED     = /^when:([a-zA-Z_][a-zA-Z0-9_]*)\s*(>=|<=|>|<|==|!=)\s*(.+)$/;

// ---------------------------------------------------------------------------
// parse(scheduleString) -> ParsedSchedule
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {ParsedSchedule}
 * @throws {Error} if unrecognised
 */
function parse(raw) {
  if (typeof raw !== 'string') throw new TypeError(`schedule-parser: expected string, got ${typeof raw}`);
  const s = raw.trim();
  if (!s) throw new Error('schedule-parser: empty string');

  // --- interval ---
  const mInterval = s.match(RE_INTERVAL);
  if (mInterval) {
    const num  = parseFloat(mInterval[1]);
    const unit = mInterval[2].toLowerCase();
    const ms   = num * INTERVAL_UNITS_MS[unit];
    return { kind: 'interval', ms, value: num, unit, raw: s };
  }

  // --- hz ---
  const mHz = s.match(RE_HZ);
  if (mHz) {
    const hz = parseFloat(mHz[1]);
    if (hz <= 0) throw new Error(`schedule-parser: hz must be > 0, got ${hz}`);
    const intervalMs = 1000 / hz;
    return { kind: 'hz', hz, intervalMs, raw: s };
  }

  // --- shorthand (@daily etc.) ---
  const lower = s.toLowerCase();
  if (SHORTHAND_MAP[lower]) {
    const expression = SHORTHAND_MAP[lower];
    return { kind: 'cron', expression, shorthand: lower, raw: s };
  }

  // --- 5-field cron ---
  const mCron = s.match(RE_CRON);
  if (mCron) {
    const expression = s;
    _validateCronFields(mCron.slice(1));
    return { kind: 'cron', expression, shorthand: null, raw: s };
  }

  // --- event-driven ---
  const mEvent = s.match(RE_EVENT);
  if (mEvent) {
    const event = mEvent[1];
    return { kind: 'event', event, known: KNOWN_EVENTS.has(event), raw: s };
  }

  // --- predicate ---
  const mPred = s.match(RE_PRED);
  if (mPred) {
    const identifier = mPred[1];
    const op         = mPred[2];
    const rawValue   = mPred[3].trim();
    const value      = _parsePredicateValue(rawValue);
    if (!VALID_OPERATORS.includes(op)) {
      throw new Error(`schedule-parser: unknown operator "${op}"`);
    }
    return { kind: 'predicate', identifier, op, value, raw: s };
  }

  throw new Error(`schedule-parser: unrecognised schedule string "${s}"`);
}

// ---------------------------------------------------------------------------
// validate(scheduleString) -> {valid, error?}
// ---------------------------------------------------------------------------

/**
 * @param {string} raw
 * @returns {{ valid: boolean, error?: string }}
 */
function validate(raw) {
  try {
    parse(raw);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// nextRun(parsed, now?) -> Date | null
// ---------------------------------------------------------------------------

/**
 * @param {ParsedSchedule} parsed - result of parse()
 * @param {Date} [now] - reference time (default: new Date())
 * @returns {Date|null}
 *   - interval/hz: next occurrence from now
 *   - cron: next cron fire after now (basic calculation, minute-precision)
 *   - event/predicate: null (fire time is unknown until event occurs)
 */
function nextRun(parsed, now) {
  const ref = now instanceof Date ? now : new Date();

  switch (parsed.kind) {
    case 'interval':
      return new Date(ref.getTime() + parsed.ms);

    case 'hz':
      return new Date(ref.getTime() + parsed.intervalMs);

    case 'cron':
      return _cronNextRun(parsed.expression, ref);

    case 'event':
    case 'predicate':
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _parsePredicateValue(raw) {
  if (raw === 'true')  return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  if (!isNaN(n)) return n;
  // strip surrounding quotes
  if ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

/**
 * Minimal cron field validator — rejects obvious malformed fields.
 * Full validation deferred to croner/node-cron at runtime.
 */
function _validateCronFields(fields) {
  // fields = [minute, hour, dom, month, dow]
  const ranges = [
    [0, 59],  // minute
    [0, 23],  // hour
    [1, 31],  // dom
    [1, 12],  // month
    [0, 7],   // dow
  ];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f === '*' || f === '?' ) continue;
    // step syntax */N
    if (/^\*\/\d+$/.test(f)) continue;
    // range N-M
    if (/^\d+-\d+$/.test(f)) continue;
    // list 1,2,3
    if (/^\d+(,\d+)+$/.test(f)) continue;
    // single number
    if (/^\d+$/.test(f)) {
      const n = parseInt(f, 10);
      if (n < ranges[i][0] || n > ranges[i][1]) {
        throw new Error(`schedule-parser: cron field ${i} value ${n} out of range [${ranges[i]}]`);
      }
      continue;
    }
    throw new Error(`schedule-parser: invalid cron field "${f}" at position ${i}`);
  }
}

/**
 * Basic cron next-run calculator (minute precision, no DST correction).
 * Walks forward minute-by-minute (capped at 366 days) until fields match.
 *
 * For production use, swap with croner.nextRun() — this covers test needs.
 *
 * @param {string} expression  5-field cron string
 * @param {Date}   from        reference date
 * @returns {Date|null}
 */
function _cronNextRun(expression, from) {
  const [fMin, fHour, fDom, fMonth, fDow] = expression.split(/\s+/);

  // Start from the next minute
  const candidate = new Date(from.getTime());
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  const maxIter = 366 * 24 * 60; // 1 year of minutes
  for (let i = 0; i < maxIter; i++) {
    if (_cronFieldMatch(fMin,   candidate.getMinutes())          &&
        _cronFieldMatch(fHour,  candidate.getHours())            &&
        _cronFieldMatch(fDom,   candidate.getDate())             &&
        _cronFieldMatch(fMonth, candidate.getMonth() + 1)        &&
        _cronFieldMatch(fDow,   candidate.getDay())) {
      return new Date(candidate);
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null; // unreachable for valid cron
}

/**
 * @param {string} field  cron field: "*", "5", "1-5", "STAR/15", "1,3,5"
 * @param {number} value  current date part value
 * @returns {boolean}
 */
function _cronFieldMatch(field, value) {
  if (field === '*' || field === '?') return true;

  // step: */N
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) return value % parseInt(stepMatch[1], 10) === 0;

  // range: N-M
  const rangeMatch = field.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    return value >= parseInt(rangeMatch[1], 10) && value <= parseInt(rangeMatch[2], 10);
  }

  // list: 1,2,3
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  // single
  return parseInt(field, 10) === value;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { parse, validate, nextRun };
