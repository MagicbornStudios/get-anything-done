'use strict';
/**
 * lib/team/health.cjs — worker + dispatcher liveness diagnostics.
 *
 * Phase 156 (operator standing rule): "we want a lot of processes
 * and automation for staying in sync." First step is knowing when
 * a worker has silently died — heartbeats every N seconds, alarm
 * if last_heartbeat is older than threshold.
 *
 * Sources:
 *   .planning/team/workers/<id>/status.json   — last_heartbeat ts
 *   .planning/team/workers/<id>/log.jsonl     — recent events
 *   .planning/STATE.xml <dispatcher>          — dispatcher heartbeat
 *
 * Returns a structured report; CLI command formats it.
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STALL_SECONDS = 120;        // worker considered stalled if heartbeat >2 min old
const DEFAULT_DISPATCHER_STALL_SECONDS = 180;

function readWorkerStatus(workerDir) {
  const statusPath = path.join(workerDir, 'status.json');
  if (!fs.existsSync(statusPath)) return null;
  try { return JSON.parse(fs.readFileSync(statusPath, 'utf8')); }
  catch (e) { return null; }
}

function readRecentLog(workerDir, limit = 5) {
  const logPath = path.join(workerDir, 'log.jsonl');
  if (!fs.existsSync(logPath)) return [];
  try {
    const lines = fs.readFileSync(logPath, 'utf8').trim().split(/\r?\n/);
    const tail = lines.slice(-limit);
    return tail.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

function readDispatcherHeartbeat(planningDir) {
  const statePath = path.join(planningDir, 'STATE.xml');
  if (!fs.existsSync(statePath)) return null;
  try {
    const xml = fs.readFileSync(statePath, 'utf8');
    const m = xml.match(/<dispatcher\s+last_heartbeat="([^"]+)"\s+pid="(\d+)"\s+projectid="([^"]+)"\s+state="([^"]+)"/);
    if (!m) return null;
    return { last_heartbeat: m[1], pid: parseInt(m[2], 10), projectid: m[3], state: m[4] };
  } catch { return null; }
}

function ageSeconds(tsIso) {
  if (!tsIso) return Infinity;
  return Math.floor((Date.now() - new Date(tsIso).getTime()) / 1000);
}

function classifyWorkerHealth(status, recentLog, stallThreshold) {
  if (!status) return { verdict: 'missing', reason: 'no status.json' };
  const age = ageSeconds(status.last_heartbeat);
  // Look at recent log for rate-limit signals
  const rateLimited = recentLog.some((e) => e.kind === 'runtime-rate-limit-on-call' || (e.rate_limited === true));
  if (status.state === 'NOT_STARTED') {
    return { verdict: 'not_started', reason: 'state=NOT_STARTED', age_seconds: age };
  }
  if (age > stallThreshold) {
    return { verdict: 'stalled', reason: `last_heartbeat ${age}s ago (threshold ${stallThreshold}s)`, age_seconds: age, rate_limited: rateLimited };
  }
  if (rateLimited) {
    return { verdict: 'rate_limited', reason: 'recent log shows rate-limit', age_seconds: age, rate_limited: true };
  }
  return { verdict: 'healthy', age_seconds: age, state: status.state };
}

function classifyDispatcherHealth(dispatcher, stallThreshold) {
  if (!dispatcher) return { verdict: 'missing', reason: 'no <dispatcher> tag in STATE.xml' };
  const age = ageSeconds(dispatcher.last_heartbeat);
  if (dispatcher.state !== 'LIVE') {
    return { verdict: 'down', reason: `state=${dispatcher.state}`, age_seconds: age };
  }
  if (age > stallThreshold) {
    return { verdict: 'stalled', reason: `last_heartbeat ${age}s ago (threshold ${stallThreshold}s)`, age_seconds: age };
  }
  return { verdict: 'healthy', age_seconds: age, pid: dispatcher.pid };
}

/**
 * Run health check across workers + dispatcher for a given project.
 */
function checkProject({ planningDir, stallSeconds = DEFAULT_STALL_SECONDS, dispatcherStallSeconds = DEFAULT_DISPATCHER_STALL_SECONDS }) {
  const teamDir = path.join(planningDir, 'team', 'workers');
  const workers = [];
  if (fs.existsSync(teamDir)) {
    for (const id of fs.readdirSync(teamDir)) {
      const workerDir = path.join(teamDir, id);
      if (!fs.statSync(workerDir).isDirectory()) continue;
      const status = readWorkerStatus(workerDir);
      const recentLog = readRecentLog(workerDir);
      const health = classifyWorkerHealth(status, recentLog, stallSeconds);
      workers.push({ id, status, recent_log: recentLog, health });
    }
  }
  const dispatcher = readDispatcherHeartbeat(planningDir);
  const dispatcherHealth = classifyDispatcherHealth(dispatcher, dispatcherStallSeconds);
  return {
    workers,
    dispatcher: { ...dispatcher, health: dispatcherHealth },
    summary: {
      worker_count: workers.length,
      healthy: workers.filter((w) => w.health.verdict === 'healthy').length,
      stalled: workers.filter((w) => w.health.verdict === 'stalled').length,
      rate_limited: workers.filter((w) => w.health.verdict === 'rate_limited').length,
      not_started: workers.filter((w) => w.health.verdict === 'not_started').length,
      missing: workers.filter((w) => w.health.verdict === 'missing').length,
      dispatcher_verdict: dispatcherHealth.verdict,
    },
  };
}

module.exports = { checkProject, classifyWorkerHealth, classifyDispatcherHealth, DEFAULT_STALL_SECONDS };
