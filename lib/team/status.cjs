'use strict';
/**
 * lib/team/status.cjs — worker status.json reads/updates.
 * Status doc shape:
 *   {
 *     id, role, lane, runtime, runtime_cmd,
 *     pid, started_at, last_heartbeat,
 *     current_ref, current_started_at,
 *     state: "NOT_STARTED" | "IDLE" | "CLAIMING" | "WORKING" | "STOPPED",
 *     stopped_at
 *   }
 */

const fs = require('fs');
const { readJsonSafe, writeJson } = require('./io.cjs');
const { workersRoot, workerStatus } = require('./paths.cjs');

function readStatus(baseDir, id) {
  return readJsonSafe(workerStatus(baseDir, id), null);
}

function writeStatus(baseDir, id, doc) {
  writeJson(workerStatus(baseDir, id), doc);
}

function updateStatus(baseDir, id, patch) {
  const cur = readStatus(baseDir, id) || { id };
  writeJson(workerStatus(baseDir, id), { ...cur, ...patch });
}

function listWorkerIds(baseDir) {
  const dir = workersRoot(baseDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort();
}

module.exports = { readStatus, writeStatus, updateStatus, listWorkerIds };
