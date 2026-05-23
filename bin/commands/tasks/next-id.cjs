'use strict';
/**
 * gad tasks next-id — atomically reserve the next task ID for a (projectid, phase) pair.
 *
 * Prevents the 282-111 collision pattern where parallel agents both read the
 * same max ID via `gad tasks list | tail -10` and then clobber each other's
 * tasks add call.
 *
 * Usage:
 *   gad tasks next-id --projectid <id> --phase <N>
 *   gad tasks next-id --projectid <id> --phase <N> --reserve=false   # predict only, no marker
 *
 * Exit 0 prints the reserved ID to stdout.
 * Exit 1 on lock-acquire failure after retries.
 *
 * --reserve (default true): atomically creates
 *   .planning/tasks/<phase>-<NNN>.reserved as a marker file.
 *   gad tasks add converts the marker to a real .json on first use.
 *   Markers auto-expire after 5 minutes (stale markers are skipped when
 *   scanning for max, and cleaned up during next-id calls).
 *
 * --no-reserve: just predicts the next ID without writing a marker file.
 *   Collision still possible if multiple callers use this concurrently.
 *
 * Migration path for callers using explicit IDs:
 *   OLD: gad tasks list --projectid X --phase 282 | tail -10  → pick next manually
 *        gad tasks add 282-111 ...
 *   NEW (option A — fully atomic): gad tasks add --auto-id --projectid X --phase 282 ...
 *   NEW (option B — two-step):     gad tasks next-id --projectid X --phase 282
 *                                  gad tasks add <returned-id> ...
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

/** How long a .reserved marker is considered valid (ms). */
const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Max retries to acquire the directory lock file. */
const LOCK_RETRIES = 10;

/** Base delay for exponential backoff on lock contention (ms). */
const LOCK_BASE_DELAY_MS = 20;

/**
 * Acquire an exclusive file-system lock using O_EXCL (atomic create).
 * Returns the lock file path on success; throws on failure after retries.
 */
function acquireLock(lockPath, retries, baseDelay) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // O_EXCL + O_CREAT = atomic: fails if file exists
      const fd = fs.openSync(lockPath, 'wx');
      fs.closeSync(fd);
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Stale lock? If older than TTL, remove and retry immediately.
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > RESERVATION_TTL_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch { /* stat failed — lock may have been released already, retry */ }
      if (attempt === retries) {
        throw new Error(
          `Could not acquire lock after ${retries} retries: ${lockPath}\n` +
          'Another process may be holding it. Delete the .lock file manually if stuck.'
        );
      }
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * baseDelay);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch { /* already gone — fine */ }
}

/**
 * Parse the numeric suffix from a task ID like "282-05" or "282-05a".
 * Returns NaN for IDs that do not match <phase>-<digits>.
 */
function parseSeq(id, phase) {
  // ID format: <phase>-<NNN> where NNN may have trailing letters (e.g. 05a)
  const prefix = `${phase}-`;
  if (!id.startsWith(prefix)) return NaN;
  const rest = id.slice(prefix.length);
  const num = parseInt(rest, 10);
  return isNaN(num) ? NaN : num;
}

/**
 * Remove stale .reserved marker files older than TTL.
 * Called while holding the lock so no concurrent mutation.
 */
function pruneStaleReservations(tasksDir, phase) {
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { return; }
  const now = Date.now();
  for (const entry of entries) {
    if (!entry.endsWith('.reserved')) continue;
    if (!entry.startsWith(`${phase}-`)) continue;
    const fullPath = path.join(tasksDir, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > RESERVATION_TTL_MS) {
        fs.unlinkSync(fullPath);
      }
    } catch { /* file may have been removed by another process */ }
  }
}

/**
 * Core logic: find max existing sequence for (phase), pick next, optionally reserve.
 * Must be called while holding the lock.
 */
function pickNextId(tasksDir, phase, reserve) {
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { entries = []; }

  let maxSeq = 0;
  for (const entry of entries) {
    // Count both .json and live .reserved files as occupied slots
    if (!entry.endsWith('.json') && !entry.endsWith('.reserved')) continue;
    const base = entry.replace(/\.(json|reserved)$/, '');
    const seq = parseSeq(base, phase);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }

  const nextSeq = maxSeq + 1;
  const nextId = `${phase}-${String(nextSeq).padStart(2, '0')}`;

  if (reserve) {
    const markerPath = path.join(tasksDir, `${nextId}.reserved`);
    // O_EXCL guarantees atomicity (we hold the dir lock anyway, but belt+suspenders)
    const fd = fs.openSync(markerPath, 'wx');
    fs.closeSync(fd);
  }

  return nextId;
}

function createTasksNextIdCommand(deps) {
  return defineCommand({
    meta: {
      name: 'next-id',
      description:
        'Atomically reserve the next task ID for a (projectid, phase) pair. ' +
        'Prevents ID collisions when parallel agents add tasks concurrently. ' +
        'Prints the reserved ID to stdout (e.g. "282-12"). ' +
        'Use --reserve=false to predict without reserving (collision still possible). ' +
        'Migration: replace manual list|tail+add with --auto-id flag on gad tasks add, ' +
        'or call this command first and pass the returned ID to gad tasks add.',
    },
    args: {
      projectid: { type: 'string', description: 'Project id (e.g. global)', required: true },
      phase: { type: 'string', description: 'Phase number/id (e.g. 282)', required: true },
      reserve: {
        type: 'boolean',
        description:
          'Atomically reserve the slot with a .reserved marker file (default: true). ' +
          'Pass --no-reserve to predict only without writing a marker.',
        default: true,
      },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);
      const tasksDir = path.join(planningDir, 'tasks');

      // Ensure tasks dir exists
      try { fs.mkdirSync(tasksDir, { recursive: true }); } catch { /* exists */ }

      const lockPath = path.join(tasksDir, '.lock');

      let nextId;
      try {
        acquireLock(lockPath, LOCK_RETRIES, LOCK_BASE_DELAY_MS);
      } catch (err) {
        deps.outputError(`tasks next-id: ${err.message}`);
        process.exit(1);
        return;
      }

      try {
        pruneStaleReservations(tasksDir, String(args.phase));
        nextId = pickNextId(tasksDir, String(args.phase), args.reserve !== false);
      } catch (err) {
        releaseLock(lockPath);
        deps.outputError(`tasks next-id: ${err.message}`);
        process.exit(1);
        return;
      }

      releaseLock(lockPath);
      process.stdout.write(nextId + '\n');
    },
  });
}

module.exports = { createTasksNextIdCommand };
