'use strict';
/**
 * lib/team/watchdog.cjs — dispatcher watchdog wrapper.
 *
 * Exports `runWithWatchdog(fn, opts)` which:
 *  1. Starts the dispatcher via fn().
 *  2. Polls the heartbeat file mtime on a configurable interval.
 *  3. If heartbeat mtime is > staleSec seconds old, calls restartFn to respawn.
 *  4. Tracks restart timestamps; if > maxRestarts in windowMs, writes the alarm
 *     file and stops retrying.
 *
 * `runWithWatchdog` is intentionally I/O-only — it does not spawn processes
 * directly. Callers supply fn + restartFn so the watchdog stays testable.
 *
 * Used by `gad team dispatcher start --watchdog` (planned CLI surface).
 * Can also be imported by integration harnesses.
 */

const fs = require('fs');
const path = require('path');
const { dispatcherHeartbeatPath, readHeartbeat } = require('./dispatcher.cjs');
const { checkAndLogRestart, writeDispatcherAlarm, STORM_MAX, STORM_WINDOW_MS } = require('./restart-log.cjs');

const DEFAULT_STALE_SEC = 90;      // heartbeat older than this → consider dispatcher stalled
const DEFAULT_POLL_MS = 15_000;    // how often watchdog checks heartbeat mtime
const DEFAULT_MAX_RESTARTS = 3;    // mirror of STORM_MAX; passed through to checkAndLogRestart
const DEFAULT_WINDOW_MS = STORM_WINDOW_MS;

/**
 * Run a function under watchdog supervision.
 *
 * @param {() => void} fn - Start the dispatcher (called immediately, then on each allowed restart).
 * @param {{
 *   baseDir: string,
 *   projectid?: string,
 *   restartFn?: () => void,   // defaults to fn
 *   onStall?: (ageS: number) => void,
 *   staleSec?: number,        // heartbeat age threshold before restart fires
 *   pollMs?: number,          // how often to check mtime
 *   maxRestarts?: number,     // max allowed restarts before storm-block
 *   windowMs?: number,        // window for counting restarts
 * }} opts
 *
 * @returns {{ stop: () => void }}  Call stop() to cancel the watchdog.
 */
function runWithWatchdog(fn, opts = {}) {
  const {
    baseDir,
    projectid = '',
    restartFn,
    onStall,
    staleSec = DEFAULT_STALE_SEC,
    pollMs = DEFAULT_POLL_MS,
  } = opts;

  if (!baseDir) throw new Error('watchdog: baseDir is required');

  const doRestart = typeof restartFn === 'function' ? restartFn : fn;
  let stopped = false;
  let timer = null;

  // Launch the initial dispatcher.
  try { fn(); } catch (err) {
    // Initial launch failure is logged but not fatal to the watchdog itself.
    process.stderr.write(`[watchdog] Initial start failed: ${err.message}\n`);
  }

  function check() {
    if (stopped) return;
    try {
      const hb = readHeartbeat(baseDir);
      const ageS = hb.age_s;

      if (hb.state === 'DEAD' || (ageS != null && ageS > staleSec)) {
        // Heartbeat is stale or missing — dispatcher may be wedged.
        if (typeof onStall === 'function') {
          try { onStall(ageS != null ? ageS : Infinity); } catch {}
        }

        const { blocked, count } = checkAndLogRestart(baseDir, projectid, 'watchdog-stall');
        if (blocked) {
          process.stderr.write(
            `[watchdog] Storm prevention: ${count} restarts in the last ${Math.round(STORM_WINDOW_MS / 60000)} min. Stopping watchdog restarts.\n`,
          );
          // Alarm already written by checkAndLogRestart. Stop the watchdog poll.
          stop();
          return;
        }

        process.stderr.write(`[watchdog] Heartbeat stale (age=${ageS}s > staleSec=${staleSec}). Restarting dispatcher.\n`);
        try { doRestart(); } catch (restartErr) {
          process.stderr.write(`[watchdog] Restart threw: ${restartErr.message}\n`);
        }
      }
    } catch (err) {
      // Non-fatal — keep polling.
      process.stderr.write(`[watchdog] Check error: ${err.message}\n`);
    }

    if (!stopped) {
      timer = setTimeout(check, pollMs);
    }
  }

  // Start polling after first interval.
  timer = setTimeout(check, pollMs);

  function stop() {
    stopped = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  return { stop };
}

module.exports = {
  runWithWatchdog,
  DEFAULT_STALE_SEC,
  DEFAULT_POLL_MS,
};
