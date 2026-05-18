'use strict';
/**
 * lib/pressure/forecast.cjs — Phase-velocity forecast (task 246-10)
 *
 * Computes historical phase completion velocity from git log + .planning/tasks/
 * and forecasts future phase completion dates via simple linear regression
 * (Prophet-inspired, pure JS, zero deps).
 *
 * Exports:
 *   computeVelocity(opts)   — {phases: [{id,openDate,closeDate,daysOpen}], velocityDays, stdDev}
 *   forecastPhases(opts)    — Array<{phaseId,predictedCloseDate,lower,upper,daysFromNow}>
 *   linearRegression(xs,ys) — {slope,intercept,r2}  (utility, exported for tests)
 */

const fs   = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/**
 * Simple OLS linear regression.
 * @param {number[]} xs
 * @param {number[]} ys
 * @returns {{slope:number, intercept:number, r2:number}}
 */
function linearRegression(xs, ys) {
  const n = xs.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0, r2: 0 };

  const mx = mean(xs);
  const my = mean(ys);

  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }

  const slope     = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const r2        = sxx === 0 || syy === 0 ? 0 : (sxy * sxy) / (sxx * syy);

  return { slope, intercept, r2 };
}

// ---------------------------------------------------------------------------
// Phase date extraction from .planning/tasks/
// ---------------------------------------------------------------------------

function readTaskFiles(planningDir) {
  const tasksDir = path.join(planningDir, 'tasks');
  if (!fs.existsSync(tasksDir)) return [];
  try {
    return fs.readdirSync(tasksDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try { return JSON.parse(fs.readFileSync(path.join(tasksDir, f), 'utf8')); } catch { return null; }
      })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Derive phase open/close dates from task files.
 * Phase open date = earliest task created_at in that phase.
 * Phase close date = latest task completed_at when ALL tasks in phase are done.
 */
function derivePhaseWindows(tasks) {
  const byPhase = {};
  for (const t of tasks) {
    const ph = String(t.phase || '');
    if (!ph) continue;
    if (!byPhase[ph]) byPhase[ph] = { tasks: [] };
    byPhase[ph].tasks.push(t);
  }

  const phases = [];
  for (const [phaseId, { tasks: pts }] of Object.entries(byPhase)) {
    const allDone = pts.every((t) => t.status === 'done' || t.status === 'closed');
    const createdDates = pts.map((t) => t.created_at).filter(Boolean).map((d) => new Date(d)).filter((d) => !isNaN(d));
    const completedDates = pts.map((t) => t.completed_at).filter(Boolean).map((d) => new Date(d)).filter((d) => !isNaN(d));

    if (!createdDates.length) continue;

    const openDate  = new Date(Math.min(...createdDates));
    const closeDate = allDone && completedDates.length
      ? new Date(Math.max(...completedDates))
      : null;

    phases.push({ id: phaseId, openDate, closeDate, daysOpen: closeDate ? (closeDate - openDate) / 86400000 : null, allDone });
  }

  return phases;
}

// ---------------------------------------------------------------------------
// Git log phase extraction (fallback / supplementary)
// ---------------------------------------------------------------------------

function gitPhaseCommits(repoRoot) {
  try {
    const log = execSync('git log --pretty=format:"%H %aI %s" --no-merges', {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return log.split('\n').map((line) => {
      const m = line.match(/^(\S+)\s+(\S+)\s+(.*)/);
      if (!m) return null;
      return { hash: m[1], date: new Date(m[2]), subject: m[3] };
    }).filter(Boolean);
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// computeVelocity
// ---------------------------------------------------------------------------

/**
 * @param {object} opts
 * @param {string} opts.repoRoot
 * @param {string} [opts.planningDir]  — defaults to repoRoot/.planning
 * @returns {{ phases, velocityDays, stdDev, openPhases }}
 */
function computeVelocity({ repoRoot, planningDir } = {}) {
  const pDir = planningDir || path.join(repoRoot || process.cwd(), '.planning');
  const tasks = readTaskFiles(pDir);
  const phases = derivePhaseWindows(tasks);

  const closed = phases.filter((p) => p.closeDate && p.daysOpen !== null && p.daysOpen > 0);
  const durations = closed.map((p) => p.daysOpen);
  const velDays   = mean(durations);
  const sd        = stddev(durations);
  const openPhases = phases.filter((p) => !p.allDone);

  return { phases, closedPhases: closed, openPhases, velocityDays: velDays, stdDev: sd };
}

// ---------------------------------------------------------------------------
// forecastPhases
// ---------------------------------------------------------------------------

/**
 * Forecast completion dates for each currently-open phase.
 *
 * Uses linear regression on (phase_index → days_to_close) over historical
 * closed phases to model whether the team is getting faster/slower.
 * Confidence interval = ±1 stdDev of residuals.
 *
 * @param {object} opts
 * @param {string} opts.repoRoot
 * @param {string} [opts.planningDir]
 * @returns {Array<{phaseId, predictedCloseDate, lower, upper, daysFromNow, confidenceInterval}>}
 */
function forecastPhases({ repoRoot, planningDir } = {}) {
  const { closedPhases, openPhases, velocityDays, stdDev } = computeVelocity({ repoRoot, planningDir });

  let predictDays;
  let ciDays = stdDev;

  if (closedPhases.length >= 3) {
    // Sort closed phases by close date; assign indices
    const sorted = [...closedPhases].sort((a, b) => a.closeDate - b.closeDate);
    const xs = sorted.map((_, i) => i);
    const ys = sorted.map((p) => p.daysOpen);
    const reg = linearRegression(xs, ys);

    // Predict for index = closedPhases.length (next phase)
    const nextIdx = sorted.length;
    predictDays = Math.max(1, reg.slope * nextIdx + reg.intercept);

    // CI from residuals
    const residuals = sorted.map((p, i) => Math.abs(p.daysOpen - (reg.slope * i + reg.intercept)));
    ciDays = mean(residuals) + stddev(residuals);
  } else {
    // Insufficient history — use simple mean
    predictDays = velocityDays || 7;
    ciDays = stdDev || predictDays * 0.5;
  }

  const now = Date.now();
  return openPhases.map((phase) => {
    const baseMs  = phase.openDate ? phase.openDate.getTime() : now;
    const daysElapsed = (now - baseMs) / 86400000;
    const remainingDays = Math.max(0, predictDays - daysElapsed);
    const closeMs = now + remainingDays * 86400000;
    const lowerMs = closeMs - ciDays * 86400000;
    const upperMs = closeMs + ciDays * 86400000;

    return {
      phaseId: phase.id,
      predictedCloseDate: new Date(closeMs).toISOString().slice(0, 10),
      lower: new Date(Math.max(now, lowerMs)).toISOString().slice(0, 10),
      upper: new Date(upperMs).toISOString().slice(0, 10),
      daysFromNow: Math.round(remainingDays * 10) / 10,
      confidenceInterval: Math.round(ciDays * 10) / 10,
    };
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { computeVelocity, forecastPhases, linearRegression };
