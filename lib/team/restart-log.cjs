'use strict';
/**
 * lib/team/restart-log.cjs — append-only JSONL log for dispatcher auto-restart attempts.
 *
 * Each entry: { ts, projectid, reason, success }
 * Storm prevention: if 3+ entries in the last 5 minutes, refuse and append a
 * "restart-storm-blocked" entry instead.
 * When a storm is detected, writes dispatcher.alarm.json to the team root so
 * operators and monitoring tools can detect the condition.
 *
 * File location: <teamRoot>/dispatcher.restart.log
 */

const fs = require('fs');
const path = require('path');
const { teamRoot } = require('./paths.cjs');
const { appendJsonl } = require('./io.cjs');

const STORM_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const STORM_MAX = 3;                    // refuse on >= 3 restarts in window

function dispatcherAlarmPath(baseDir) {
  return path.join(teamRoot(baseDir), 'dispatcher.alarm.json');
}

/**
 * Write (or update) the alarm file when a restart storm is detected.
 * Format: { ts, projectid, restart_count, storm_window_ms, message }
 */
function writeDispatcherAlarm(baseDir, projectid, restartCount) {
  try {
    const alarmPath = dispatcherAlarmPath(baseDir);
    const alarm = {
      ts: new Date().toISOString(),
      projectid: projectid || '',
      restart_count: restartCount,
      storm_window_ms: STORM_WINDOW_MS,
      message: `Dispatcher restart-stormed ${restartCount} times in the last ${STORM_WINDOW_MS / 60000} minutes. Manual investigation required.`,
    };
    fs.mkdirSync(teamRoot(baseDir), { recursive: true });
    fs.writeFileSync(alarmPath, JSON.stringify(alarm, null, 2));
  } catch { /* non-fatal — alarm is best-effort */ }
}

function restartLogPath(baseDir) {
  return path.join(teamRoot(baseDir), 'dispatcher.restart.log');
}

/**
 * Read all restart log entries from the last 5 minutes.
 * Returns the full parsed entries array (may be empty).
 */
function recentEntries(baseDir) {
  const logPath = restartLogPath(baseDir);
  if (!fs.existsSync(logPath)) return [];
  let lines;
  try { lines = fs.readFileSync(logPath, 'utf8').split('\n'); }
  catch { return []; }
  const cutoff = Date.now() - STORM_WINDOW_MS;
  const entries = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const entry = JSON.parse(trimmed);
      if (entry.ts && Date.parse(entry.ts) >= cutoff) {
        entries.push(entry);
      }
    } catch { /* malformed line — skip */ }
  }
  return entries;
}

/**
 * Count how many actual restart attempts (not blocked entries) sit in the
 * last 5-minute window.
 */
function recentRestartCount(baseDir) {
  return recentEntries(baseDir).filter(e => e.reason !== 'restart-storm-blocked').length;
}

/**
 * Append one entry to the restart log.
 * @param {string} baseDir
 * @param {{ projectid: string, reason: string, success: boolean }} opts
 */
function logRestart(baseDir, opts) {
  const entry = {
    ts: new Date().toISOString(),
    projectid: opts.projectid || '',
    reason: opts.reason || 'auto-restart',
    success: !!opts.success,
  };
  appendJsonl(restartLogPath(baseDir), entry);
  return entry;
}

/**
 * Check storm threshold, then conditionally log the attempt.
 *
 * - If storm prevention fires (>= STORM_MAX restarts in window):
 *   logs a "restart-storm-blocked" entry and returns { blocked: true, count }.
 * - Otherwise: logs the attempt immediately (success=false until the caller
 *   updates it via logRestart, which appends a follow-up entry), then returns
 *   { blocked: false, count }.
 *
 * Logging upfront is intentional: it increments the in-window count so
 * subsequent calls see the correct tally even before the restart completes.
 * Callers that want to record the final outcome call logRestart separately.
 */
function checkAndLogRestart(baseDir, projectid, reason) {
  const count = recentRestartCount(baseDir);
  if (count >= STORM_MAX) {
    logRestart(baseDir, { projectid, reason: 'restart-storm-blocked', success: false });
    // Write alarm file so monitoring can detect the storm condition.
    writeDispatcherAlarm(baseDir, projectid, count);
    return { blocked: true, count };
  }
  // Pre-log the attempt so the window count is accurate for subsequent calls.
  logRestart(baseDir, { projectid, reason, success: false });
  return { blocked: false, count };
}

module.exports = {
  restartLogPath,
  dispatcherAlarmPath,
  writeDispatcherAlarm,
  recentEntries,
  recentRestartCount,
  logRestart,
  checkAndLogRestart,
  STORM_WINDOW_MS,
  STORM_MAX,
};
