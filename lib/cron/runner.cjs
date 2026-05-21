'use strict';
/**
 * Cron runner — event-bus dispatch for `on:<event>` schedule entries.
 *
 * Phase 254-03. The OS-level schedulers (scheduler-windows.cjs +
 * scheduler-unix.cjs) only handle time-based cron expressions. This file
 * adds in-process dispatch for entries whose schedule kind is `event` —
 * i.e. entries shaped like { schedule: "on:commit", command: "..." } in
 * .planning/cron.json.
 *
 * Public surface:
 *   - emitEvent(planningDir, event, payload?)
 *       Writes one line to .planning/.gad-log/events-YYYY-MM-DD.jsonl
 *       and synchronously dispatches every matching `on:<event>` cron
 *       entry. Returns the run result(s).
 *   - listEventSubscribers(planningDir, event)
 *       Returns the cron entries whose parsed schedule is `event` and
 *       whose `event` matches.
 *   - eventsLogPath(planningDir, [date])
 *       Returns the absolute path to the events log for a given day
 *       (default: today).
 *
 * Dispatch invokes gad subcommands through the same `node bin/gad.cjs …`
 * shell as `cron run-now` — disabled entries are skipped, every fire is
 * recorded back to events-*.jsonl with status + ms + exit_code.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { readCronJson } = require('./index.cjs');
const scheduleParser = require('../schedule-parser/index.cjs');

const EVENTS_LOG_PREFIX = 'events-';
const EVENTS_LOG_DIR = '.gad-log';

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function eventsLogDir(planningDir) {
  return path.join(planningDir, EVENTS_LOG_DIR);
}

function ymd(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}`;
}

function eventsLogPath(planningDir, date) {
  const d = date instanceof Date ? date : new Date();
  return path.join(eventsLogDir(planningDir), `${EVENTS_LOG_PREFIX}${ymd(d)}.jsonl`);
}

function appendEventLine(planningDir, entry) {
  const dir = eventsLogDir(planningDir);
  fs.mkdirSync(dir, { recursive: true });
  const p = eventsLogPath(planningDir);
  fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Subscriber discovery
// ---------------------------------------------------------------------------

/**
 * Return cron.json entries whose parsed schedule fires on `event`.
 * Entry must have schedule = "on:<event>" and enabled !== false.
 *
 * @param {string} planningDir absolute path to .planning/
 * @param {string} event       event name to match (e.g. "commit")
 * @returns {Array} matching entries
 */
function listEventSubscribers(planningDir, event) {
  const entries = readCronJson(planningDir);
  const matches = [];
  for (const e of entries) {
    if (e.enabled === false || e.status === 'disabled') continue;
    if (typeof e.schedule !== 'string') continue;
    try {
      const parsed = scheduleParser.parse(e.schedule);
      if (parsed.kind === 'event' && parsed.event === event) {
        matches.push(e);
      }
    } catch {
      // malformed entry — skip silently; gad schedule validate surfaces it
    }
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch a single subscriber entry. Invokes `node <gadCjs> <entry.command>`
 * and returns the run record. Does NOT touch the events log itself —
 * caller (emitEvent) handles aggregation.
 */
function dispatchEntry(entry, gadCjsPath, opts) {
  const dryRun = Boolean(opts && opts.dryRun);
  const startedAt = new Date().toISOString();
  const argv = String(entry.command).trim().split(/\s+/).filter(Boolean);

  if (dryRun) {
    return {
      name: entry.id || entry.name,
      command: entry.command,
      started_at: startedAt,
      finished_at: startedAt,
      exit_code: 0,
      dry_run: true,
    };
  }

  const result = spawnSync(process.execPath, [gadCjsPath, ...argv], {
    stdio: 'pipe',
    encoding: 'utf8',
    windowsHide: true,
  });
  return {
    name: entry.id || entry.name,
    command: entry.command,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: result.status ?? 1,
    stdout_tail: tail(result.stdout || '', 200),
    stderr_tail: tail(result.stderr || '', 200),
  };
}

function tail(s, n) {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(-n);
}

/**
 * Emit an event: write to the events log and dispatch every matching
 * `on:<event>` subscriber.
 *
 * @param {object} opts
 * @param {string} opts.planningDir absolute path to .planning/
 * @param {string} opts.event       event name (no `on:` prefix)
 * @param {object} [opts.payload]   optional payload (serialised into log entry)
 * @param {string} [opts.gadCjsPath] path to gad.cjs for dispatch (required for
 *                                   real dispatch; absent => dry-run)
 * @param {boolean} [opts.dryRun]   if true, log but skip dispatch
 * @returns {{ event: string, ts: string, subscribers: number, runs: Array }}
 */
function emitEvent(opts) {
  const { planningDir, event, payload, gadCjsPath, dryRun = false } = opts;
  if (!planningDir || typeof planningDir !== 'string') {
    throw new TypeError('emitEvent: planningDir required');
  }
  if (!event || typeof event !== 'string') {
    throw new TypeError('emitEvent: event required (string)');
  }

  const ts = new Date().toISOString();
  const subscribers = listEventSubscribers(planningDir, event);

  // Log the emit itself first so consumers see the event even when no
  // subscriber is wired.
  appendEventLine(planningDir, {
    type: 'emit',
    event,
    ts,
    payload: payload || null,
    subscriber_count: subscribers.length,
  });

  const runs = [];
  for (const sub of subscribers) {
    let run;
    if (dryRun || !gadCjsPath) {
      run = dispatchEntry(sub, gadCjsPath, { dryRun: true });
    } else {
      run = dispatchEntry(sub, gadCjsPath, { dryRun: false });
    }
    appendEventLine(planningDir, {
      type: 'dispatch',
      event,
      ts: new Date().toISOString(),
      ...run,
    });
    runs.push(run);
  }

  return { event, ts, subscribers: subscribers.length, runs };
}

module.exports = {
  emitEvent,
  listEventSubscribers,
  eventsLogPath,
  eventsLogDir,
};
