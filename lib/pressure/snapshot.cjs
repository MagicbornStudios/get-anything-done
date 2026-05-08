'use strict';
/**
 * lib/pressure/snapshot.cjs — Combined pressure snapshot.
 *
 * Phase 107-01: aggregates entropy v1+v2, handoff pressure, worker load, and
 * token budget into a single timestamped object for dashboards / CLI.
 *
 * Exports:
 *   snapshotPressure({ projectRoot, since, projectid })
 *     → {
 *         ts,
 *         entropy_v1,    // computePressure output (score, breakdown, …)
 *         entropy_v2,    // computeEntropyV2 v2 object (score, diversity, …)
 *         handoff_pressure: { open, avg_claim_age_hours, mailbox_depth },
 *         worker_load:    { workers: [{ id, in_progress }], total_in_progress },
 *         token_budget,  // costPerHandoff summary | null if not available
 *       }
 *
 * Design constraints:
 *   - Built-ins + existing gad lib only (no external deps).
 *   - DO NOT touch lib/entropy/v1 or v2 — require only.
 *   - lib/runtime-budget may throw or return empty; return null for that field.
 *   - Worker load is read from .planning/tasks/*.json (status=in-progress),
 *     as gad tasks list --json is CLI-only; here we parse the task files
 *     directly since this is a library function.
 */

const path = require('path');
const fs = require('fs');
const { computePressure } = require('../entropy/compute.cjs');
const { computeEntropyV2 } = require('../entropy/v2.cjs');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function tryReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function tryReadJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function parseSinceMs(since) {
  if (!since) return null;
  const daysMatch = String(since).match(/^(\d+)d$/i);
  if (daysMatch) return Date.now() - Number(daysMatch[1]) * 86400_000;
  const ts = Date.parse(since);
  return Number.isFinite(ts) ? ts : null;
}

// ---------------------------------------------------------------------------
// Handoff pressure — open-bucket depth + average claim-age
// ---------------------------------------------------------------------------

function computeHandoffPressure(projectRoot) {
  const openDir = path.join(projectRoot, '.planning', 'handoffs', 'open');
  const files = tryReadDir(openDir).filter((f) => f.endsWith('.md'));

  let ageSum = 0;
  let ageCount = 0;
  const now = Date.now();

  for (const fname of files) {
    try {
      const text = fs.readFileSync(path.join(openDir, fname), 'utf8');
      const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const createdMatch = fmMatch[1].match(/^created_at:\s*(.+)$/m);
      if (createdMatch) {
        const ts = Date.parse(createdMatch[1].trim());
        if (Number.isFinite(ts)) {
          ageSum += now - ts;
          ageCount++;
        }
      }
    } catch { /* skip unreadable */ }
  }

  const avgAgeMs = ageCount > 0 ? ageSum / ageCount : 0;

  return {
    open: files.length,
    avg_claim_age_hours: Math.round((avgAgeMs / 3_600_000) * 100) / 100,
    mailbox_depth: files.length, // same as open for the handoff queue
  };
}

// ---------------------------------------------------------------------------
// Worker load — parse task files for in-progress per worker
// ---------------------------------------------------------------------------

function computeWorkerLoad(projectRoot) {
  const tasksDir = path.join(projectRoot, '.planning', 'tasks');
  const files = tryReadDir(tasksDir).filter((f) => f.endsWith('.json'));

  const workerMap = new Map(); // workerId -> count

  for (const fname of files) {
    const task = tryReadJson(path.join(tasksDir, fname));
    if (!task || task.status !== 'in-progress') continue;

    // Extract worker id from attribution / agent field if present
    const agentRaw = (task.attribution && task.attribution.agent)
      || task.agent
      || task.claimed_by
      || null;

    // Normalize: look for worker-style ids like "w1", "w2", "worker-1"
    const workerMatch = agentRaw && String(agentRaw).match(/^w(\d+)$/i);
    const workerId = workerMatch ? `w${workerMatch[1]}` : (agentRaw || 'unattributed');

    workerMap.set(workerId, (workerMap.get(workerId) || 0) + 1);
  }

  const workers = [];
  for (const [id, in_progress] of workerMap) {
    workers.push({ id, in_progress });
  }
  workers.sort((a, b) => b.in_progress - a.in_progress);

  const total = workers.reduce((s, w) => s + w.in_progress, 0);

  return { workers, total_in_progress: total };
}

// ---------------------------------------------------------------------------
// Token budget — costPerHandoff summary from lib/runtime-budget
// ---------------------------------------------------------------------------

function computeTokenBudget(projectRoot, since) {
  try {
    const { costPerHandoff } = require('../runtime-budget/index.cjs');
    const rows = costPerHandoff({ projectRoot, since });
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Summarize: total tokens + breakdown by runtime
    let totalTokens = 0;
    const byRuntime = {};
    for (const row of rows) {
      totalTokens += row.totalTokens || 0;
      const rt = row.runtime || 'unknown';
      if (!byRuntime[rt]) byRuntime[rt] = { count: 0, totalTokens: 0, avgTokens: 0 };
      byRuntime[rt].count += row.count || 0;
      byRuntime[rt].totalTokens += row.totalTokens || 0;
    }
    for (const rt of Object.keys(byRuntime)) {
      const r = byRuntime[rt];
      r.avgTokens = r.count > 0 ? Math.round(r.totalTokens / r.count) : 0;
    }

    return { total_tokens: totalTokens, by_runtime: byRuntime, since: since || null };
  } catch {
    // runtime-budget may be unavailable or may throw — non-fatal
    return null;
  }
}

// ---------------------------------------------------------------------------
// snapshotPressure
// ---------------------------------------------------------------------------

/**
 * Compute a combined pressure snapshot for a project.
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot] — repo root (defaults to process.cwd())
 * @param {string}  [opts.since]       — "7d", "30d", or "YYYY-MM-DD" for time-windowed metrics
 * @param {string}  [opts.projectid]   — project id for v1 computePressure (default 'unknown')
 * @returns {{
 *   ts: string,
 *   entropy_v1: object,
 *   entropy_v2: object,
 *   handoff_pressure: { open: number, avg_claim_age_hours: number, mailbox_depth: number },
 *   worker_load: { workers: Array, total_in_progress: number },
 *   token_budget: object|null
 * }}
 */
function snapshotPressure({ projectRoot, since, projectid } = {}) {
  const root = projectRoot || process.cwd();
  const pid = projectid || 'unknown';

  // entropy v1 (compute.cjs)
  const entropy_v1 = computePressure(pid, { baseDir: root });

  // entropy v2 (v2.cjs) — includes v1 internally but we surface v2.score separately
  const v2Result = computeEntropyV2({ projectRoot: root, since, projectid: pid });
  const entropy_v2 = v2Result.v2;

  // handoff pressure
  const handoff_pressure = computeHandoffPressure(root);

  // worker load
  const worker_load = computeWorkerLoad(root);

  // token budget (optional)
  const token_budget = computeTokenBudget(root, since || null);

  return {
    ts: new Date().toISOString(),
    entropy_v1,
    entropy_v2,
    handoff_pressure,
    worker_load,
    token_budget,
  };
}

module.exports = { snapshotPressure };
