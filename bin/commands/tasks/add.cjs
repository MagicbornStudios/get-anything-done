'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

// Inline the core next-id helpers so add.cjs can reserve IDs without a
// subprocess round-trip.  This mirrors the logic in next-id.cjs exactly.
const RESERVATION_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_RETRIES = 10;
const LOCK_BASE_DELAY_MS = 20;

function acquireLock(lockPath, retries, baseDelay) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.closeSync(fd);
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > RESERVATION_TTL_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch { /* lock may have been released */ }
      if (attempt === retries) {
        throw new Error(
          `Could not acquire lock after ${retries} retries: ${lockPath}\n` +
          'Another process may be holding it. Delete the .lock file manually if stuck.'
        );
      }
      const delay = baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * baseDelay);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
    }
  }
}

function releaseLock(lockPath) {
  try { fs.unlinkSync(lockPath); } catch { /* already gone */ }
}

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
      if (now - stat.mtimeMs > RESERVATION_TTL_MS) fs.unlinkSync(fullPath);
    } catch { /* may be gone already */ }
  }
}

function parseSeq(id, phase) {
  const prefix = `${phase}-`;
  if (!id.startsWith(prefix)) return NaN;
  const num = parseInt(id.slice(prefix.length), 10);
  return isNaN(num) ? NaN : num;
}

function pickNextId(tasksDir, phase, reserve) {
  let entries;
  try { entries = fs.readdirSync(tasksDir); } catch { entries = []; }
  let maxSeq = 0;
  for (const entry of entries) {
    if (!entry.endsWith('.json') && !entry.endsWith('.reserved')) continue;
    const base = entry.replace(/\.(json|reserved)$/, '');
    const seq = parseSeq(base, phase);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  }
  const nextSeq = maxSeq + 1;
  const nextId = `${phase}-${String(nextSeq).padStart(2, '0')}`;
  if (reserve) {
    const markerPath = path.join(tasksDir, `${nextId}.reserved`);
    const fd = fs.openSync(markerPath, 'wx');
    fs.closeSync(fd);
  }
  return nextId;
}

/**
 * If the task JSON file already has a matching .reserved marker, remove it.
 * Called after a successful task write so next scan sees the .json not both.
 */
function cleanReservationMarker(tasksDir, id) {
  const markerPath = path.join(tasksDir, `${id}.reserved`);
  try { fs.unlinkSync(markerPath); } catch { /* no marker, fine */ }
}

function createTasksAddCommand(deps) {
  return defineCommand({
    meta: {
      name: 'add',
      description:
        'Register a new task as .planning/tasks/<id>.json. Per-task JSON is the sole source of truth post-63-53. ' +
        'Pass --auto-id to let gad atomically assign the next available ID (prevents parallel-agent collisions). ' +
        'Migration from manual ID assignment: replace "gad tasks add <N>-<M> ..." with "gad tasks add --auto-id --phase <N> ..."',
    },
    args: {
      id: {
        type: 'positional',
        description:
          'Task id (e.g. 60-05a). Omit or pass "--auto-id" to let gad pick the next available ID atomically.',
        required: false,
        default: '',
      },
      projectid: { type: 'string', description: 'Project id whose planning dir to write into', required: true },
      phase: { type: 'string', description: 'Existing phase id this task belongs to', required: true },
      goal: { type: 'string', description: 'One-sentence or longer description of the task outcome', required: true },
      type: { type: 'string', description: 'Optional category (code | site | design | migration | cleanup | framework | …)', default: '' },
      depends: { type: 'string', description: 'Comma-separated list of prerequisite task ids (no spaces)', default: '' },
      status: { type: 'string', description: 'Initial status (default: planned)', default: 'planned' },
      files: { type: 'string', description: 'Comma-separated list of file paths touched by this task', default: '' },
      print: { type: 'boolean', description: 'Print the JSON to stdout instead of writing the file', default: false },
      'auto-id': {
        type: 'boolean',
        description:
          'Atomically reserve the next available task ID for the given --phase (uses file-lock). ' +
          'Prevents ID collisions when multiple agents run gad tasks add concurrently. ' +
          'Ignores any positional <id> argument when set.',
        default: false,
      },
    },
    run({ args }) {
      const resolved = deps.resolveProjectRootById(deps, args.projectid);
      if (!resolved) return;
      const { baseDir, root } = resolved;
      const planningDir = path.join(baseDir, root.path, root.planningDir);
      const tasksDirPath = path.join(planningDir, 'tasks');

      const taskFiles = require('../../../lib/task-files.cjs');

      // Resolve task ID — atomic if --auto-id, explicit otherwise.
      let resolvedId;
      if (args['auto-id']) {
        // Ensure tasks dir exists before locking
        try { fs.mkdirSync(tasksDirPath, { recursive: true }); } catch { /* exists */ }
        const lockPath = path.join(tasksDirPath, '.lock');
        try {
          acquireLock(lockPath, LOCK_RETRIES, LOCK_BASE_DELAY_MS);
        } catch (err) {
          deps.outputError(`tasks add (auto-id): ${err.message}`);
          process.exit(1);
          return;
        }
        try {
          pruneStaleReservations(tasksDirPath, String(args.phase));
          // Reserve=true so the slot is held until we write the real JSON below.
          resolvedId = pickNextId(tasksDirPath, String(args.phase), true);
        } catch (err) {
          releaseLock(lockPath);
          deps.outputError(`tasks add (auto-id): ${err.message}`);
          process.exit(1);
          return;
        }
        releaseLock(lockPath);
      } else {
        if (!args.id) {
          deps.outputError('tasks add: provide a task <id> as positional arg, or use --auto-id to assign one automatically.');
          process.exit(1);
          return;
        }
        resolvedId = String(args.id);
      }

      const def = {
        id: resolvedId,
        phase: String(args.phase),
        status: String(args.status || 'planned'),
        goal: String(args.goal),
        type: String(args.type || ''),
        depends: args.depends ? String(args.depends).split(',').map(s => s.trim()).filter(Boolean) : [],
        files: args.files ? String(args.files).split(',').map(s => s.trim()).filter(Boolean) : [],
      };

      try {
        if (args.print) {
          process.stdout.write(JSON.stringify(taskFiles.normalizeTask(def), null, 2) + '\n');
          return;
        }
        const existing = taskFiles.readOne(planningDir, def.id);
        if (existing) {
          deps.outputError(`Task already exists: ${def.id} (use 'gad tasks update' to change).`);
          process.exit(1);
          return;
        }
        taskFiles.writeOne(planningDir, def);
        // Remove the .reserved marker now that the real JSON is written.
        if (args['auto-id']) {
          cleanReservationMarker(tasksDirPath, def.id);
        }
        console.log(`Added task ${def.id} to phase ${def.phase} (${args.projectid}).`);
        deps.maybeRebuildGraph(baseDir, root);
      } catch (error) {
        deps.outputError(`tasks add: ${error.message}`);
        process.exit(1);
      }
    },
  });
}

module.exports = { createTasksAddCommand };
