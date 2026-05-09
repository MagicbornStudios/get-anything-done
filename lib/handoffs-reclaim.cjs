'use strict';
/**
 * handoffs-reclaim.cjs — stale-claim sweeper.
 *
 * Today's failure mode (2026-05-09): worker-loop never calls completeHandoff;
 * sandboxed `gad handoffs complete` calls fail silently; when workers die,
 * orphaned claims sit in claimed/ forever. This module sweeps claimed/,
 * checks if the claimer is alive, and unclaims (claimed/ → open/) any stale
 * orphans so the queue can flow again.
 *
 * Exports:
 *   reclaimStaleClaims({ baseDir, staleAfterMs, dryRun }) → { reclaimed, skipped }
 *
 * Algorithm:
 *   1. List all files in <baseDir>/.planning/handoffs/claimed/.
 *   2. Parse frontmatter; pull claimed_by + claimed_at.
 *   3. Determine claimer presence:
 *      - team-w<N> pattern → read .planning/team/workers/w<N>/status.json
 *        - state === 'STOPPED'  → dead
 *        - state IN (IDLE, WORKING) AND now-last_heartbeat > 5min AND
 *          status.current_ref !== this handoff id → dead/disengaged
 *      - free-form agent name → check .planning/sessions/ for any session
 *        file mentioning agent_id with mtime > 5min ago. Stale → dead.
 *      - unable to determine AND age > staleAfterMs → dead.
 *   4. If claimer dead AND age > staleAfterMs: unclaim with reason
 *      'orphaned-claim' and by 'reclaim-sweeper'. Add to reclaimed.
 *   5. Else: skip with reason.
 *   6. dryRun=true → compute, do NOT call unclaim.
 */

const fs = require('fs');
const path = require('path');

const {
  parseFrontmatter,
  unclaimHandoff,
} = require('./handoffs.cjs');

const DEFAULT_STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 hours
const HEARTBEAT_STALE_MS = 5 * 60 * 1000;          // 5 minutes
const SESSION_RECENCY_MS = 5 * 60 * 1000;          // 5 minutes

function claimedDir(baseDir) {
  return path.join(baseDir, '.planning', 'handoffs', 'claimed');
}

function workerDir(baseDir, workerId) {
  return path.join(baseDir, '.planning', 'team', 'workers', workerId);
}

function sessionsDir(baseDir) {
  return path.join(baseDir, '.planning', 'sessions');
}

/**
 * Parse "team-wN" or "wN-team" patterns out of a claimed_by string.
 * Returns the worker id (e.g. "w6") or null.
 */
function extractWorkerId(claimedBy) {
  if (!claimedBy || typeof claimedBy !== 'string') return null;
  const m = claimedBy.match(/team-(w\d+)/i) || claimedBy.match(/^(w\d+)\b/i);
  return m ? m[1].toLowerCase() : null;
}

function readJsonSafe(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Classify the claimer's liveness for a given handoff.
 * Returns { dead: boolean, evidence: string }.
 */
function classifyClaimer({ baseDir, claimedBy, handoffId, now }) {
  const workerId = extractWorkerId(claimedBy);
  if (workerId) {
    const statusPath = path.join(workerDir(baseDir, workerId), 'status.json');
    if (!fs.existsSync(statusPath)) {
      return { dead: true, evidence: `worker ${workerId} status.json missing` };
    }
    const status = readJsonSafe(statusPath);
    if (!status) {
      return { dead: true, evidence: `worker ${workerId} status.json unreadable` };
    }
    if (status.state === 'STOPPED') {
      return { dead: true, evidence: `worker ${workerId} state=STOPPED` };
    }
    const hbAge = status.last_heartbeat
      ? now - new Date(status.last_heartbeat).getTime()
      : Infinity;
    const aliveStates = new Set(['IDLE', 'WORKING', 'RUNNING']);
    if (aliveStates.has(status.state) && hbAge > HEARTBEAT_STALE_MS) {
      // disengaged unless this exact handoff is what they're working
      if (status.current_ref && status.current_ref === handoffId) {
        return {
          dead: false,
          evidence: `worker ${workerId} working this handoff (current_ref match) hb_age=${Math.floor(hbAge / 1000)}s`,
        };
      }
      return {
        dead: true,
        evidence: `worker ${workerId} state=${status.state} hb_age=${Math.floor(hbAge / 1000)}s current_ref=${status.current_ref || 'null'}`,
      };
    }
    if (aliveStates.has(status.state)) {
      return {
        dead: false,
        evidence: `worker ${workerId} state=${status.state} hb_age=${Math.floor(hbAge / 1000)}s`,
      };
    }
    if (status.state === 'NOT_STARTED') {
      return { dead: true, evidence: `worker ${workerId} state=NOT_STARTED` };
    }
    return { dead: false, evidence: `worker ${workerId} state=${status.state}` };
  }

  // Free-form agent name path: search sessions/ for recent telemetry.
  const sessDir = sessionsDir(baseDir);
  if (!fs.existsSync(sessDir)) {
    return { dead: true, evidence: 'no team-worker pattern + no sessions/ dir' };
  }
  let entries;
  try {
    entries = fs.readdirSync(sessDir);
  } catch {
    return { dead: true, evidence: 'sessions/ unreadable' };
  }
  const needle = String(claimedBy || '').toLowerCase();
  for (const entry of entries) {
    const full = path.join(sessDir, entry);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    if (now - stat.mtimeMs > SESSION_RECENCY_MS) continue;
    let content;
    try {
      content = fs.readFileSync(full, 'utf8').toLowerCase();
    } catch {
      continue;
    }
    if (content.includes(needle)) {
      return {
        dead: false,
        evidence: `recent session ${entry} mentions ${claimedBy}`,
      };
    }
  }
  return {
    dead: true,
    evidence: `no recent session telemetry for ${claimedBy}`,
  };
}

/**
 * Reclaim stale claims.
 *
 * @param {object} opts
 * @param {string} opts.baseDir
 * @param {number} [opts.staleAfterMs=21600000]
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ reclaimed: Array, skipped: Array }}
 */
function reclaimStaleClaims({
  baseDir,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
  dryRun = false,
} = {}) {
  if (!baseDir) throw new Error('reclaimStaleClaims: baseDir is required');

  const reclaimed = [];
  const skipped = [];
  const dir = claimedDir(baseDir);

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { reclaimed, skipped };
  }

  const now = Date.now();

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(dir, entry);
    const id = entry.replace(/\.md$/, '');

    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      skipped.push({ id, claimer: '', reason: `read-failed: ${e.message}` });
      continue;
    }

    const { frontmatter } = parseFrontmatter(text);
    const claimer = frontmatter.claimed_by || '';
    const claimedAt = frontmatter.claimed_at || '';
    const claimedAtMs = claimedAt ? new Date(claimedAt).getTime() : NaN;
    const ageMs = Number.isFinite(claimedAtMs) ? now - claimedAtMs : Infinity;

    if (!Number.isFinite(claimedAtMs)) {
      // Missing/unparsable claimed_at — treat as ancient.
    }

    if (ageMs <= staleAfterMs) {
      skipped.push({
        id,
        claimer,
        reason: `not-stale (age ${Math.floor(ageMs / 1000)}s <= ${Math.floor(staleAfterMs / 1000)}s)`,
      });
      continue;
    }

    const verdict = classifyClaimer({
      baseDir,
      claimedBy: claimer,
      handoffId: id,
      now,
    });

    if (!verdict.dead) {
      skipped.push({
        id,
        claimer,
        reason: `claimer-alive: ${verdict.evidence}`,
      });
      continue;
    }

    if (dryRun) {
      reclaimed.push({
        id,
        claimer,
        age_ms: ageMs,
        evidence: verdict.evidence,
        dry_run: true,
      });
      continue;
    }

    try {
      unclaimHandoff({
        baseDir,
        id,
        reason: 'orphaned-claim',
        by: 'reclaim-sweeper',
      });
      reclaimed.push({
        id,
        claimer,
        age_ms: ageMs,
        evidence: verdict.evidence,
      });
    } catch (e) {
      skipped.push({
        id,
        claimer,
        reason: `unclaim-failed: ${e.code || ''} ${e.message}`.trim(),
      });
    }
  }

  return { reclaimed, skipped };
}

module.exports = {
  reclaimStaleClaims,
  DEFAULT_STALE_AFTER_MS,
  HEARTBEAT_STALE_MS,
  SESSION_RECENCY_MS,
};
