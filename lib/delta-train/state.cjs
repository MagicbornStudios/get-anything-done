'use strict';

const fs = require('fs');
const path = require('path');
const { statePath, historyPath, heartbeatPath, pidPath, deltaTrainRoot } = require('./paths.cjs');

const SCHEMA_V = 1;

function getDefaultState() {
  return {
    schema_v: SCHEMA_V,
    loop_started_at: null,
    last_tick_at: null,
    next_tick_at: null,
    interval_seconds: 1800,
    last_pull_ts: null,
    current_canonical: null,
    current_candidate: null,
    tick_count: 0,
    promotion_count: 0,
    discard_count: 0,
    skip_count: 0,
    consecutive_failures: 0,
  };
}

function loadState(baseDir) {
  const p = statePath(baseDir);
  if (!fs.existsSync(p)) return getDefaultState();
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (data.schema_v !== SCHEMA_V) {
      // Migrate if needed
    }
    return data;
  } catch (e) {
    console.error(`[delta-train] Failed to load state from ${p}: ${e.message}`);
    return getDefaultState();
  }
}

function saveState(baseDir, state) {
  const p = statePath(baseDir);
  const root = deltaTrainRoot(baseDir);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmp, p);
}

function appendHistory(baseDir, record) {
  const p = historyPath(baseDir);
  const root = deltaTrainRoot(baseDir);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  
  fs.appendFileSync(p, `${JSON.stringify(record)}\n`, 'utf8');
}

function writeHeartbeat(baseDir, data) {
  const p = heartbeatPath(baseDir);
  const root = deltaTrainRoot(baseDir);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  
  const heartbeat = {
    pid: process.pid,
    wrote_at: new Date().toISOString(),
    ...data,
  };
  fs.writeFileSync(p, JSON.stringify(heartbeat, null, 2), 'utf8');
}

function acquirePidLock(baseDir) {
  const p = pidPath(baseDir);
  const root = deltaTrainRoot(baseDir);
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  
  if (fs.existsSync(p)) {
    const existingPid = parseInt(fs.readFileSync(p, 'utf8'), 10);
    if (!Number.isNaN(existingPid)) {
      try {
        process.kill(existingPid, 0);
        return { success: false, pid: existingPid };
      } catch (e) {
        // PID doesn't exist, we can take the lock
      }
    }
  }
  fs.writeFileSync(p, String(process.pid), 'utf8');
  return { success: true, pid: process.pid };
}

function releasePidLock(baseDir) {
  const p = pidPath(baseDir);
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch (e) {
      // Ignore
    }
  }
}

module.exports = {
  SCHEMA_V,
  loadState,
  saveState,
  appendHistory,
  writeHeartbeat,
  acquirePidLock,
  releasePidLock,
};
