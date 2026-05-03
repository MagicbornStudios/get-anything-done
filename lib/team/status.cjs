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
const { readConfig } = require('./config.cjs');
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

function compareWorkerIds(a, b) {
  const an = Number(String(a).replace(/^w/, ''));
  const bn = Number(String(b).replace(/^w/, ''));
  if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
  return String(a).localeCompare(String(b));
}

function listWorkerIds(baseDir) {
  const cfg = readConfig(baseDir);
  if (cfg && Array.isArray(cfg.workers_spec) && cfg.workers_spec.length > 0) {
    return cfg.workers_spec
      .map((spec) => spec && spec.id)
      .filter(Boolean)
      .sort(compareWorkerIds);
  }
  const dir = workersRoot(baseDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort(compareWorkerIds);
}

module.exports = { readStatus, writeStatus, updateStatus, listWorkerIds, compareWorkerIds };
