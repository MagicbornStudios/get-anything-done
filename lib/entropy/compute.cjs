'use strict';

// Pressure compute — observable-signal MVP.
//
// Phase 88 (Skill Entropy formalization) ships the formal math (Garrard 2026,
// decision GLOBAL-D-291). Phase 107-06 wires that formal math into this
// module. Until then, this MVP aggregates observable signals from .gad-log
// + open handoffs to produce a non-zero pressure score so the statusline +
// snapshot surface real numbers, not placeholder zeros.
//
// Signals (each weighted, summed, normalized to 0-1):
//   1. Rate-limit incidents (last 24h, runtime-rate-limit-on-call events)
//   2. Repeated unclaim_history per open handoff (>=2 unclaims = pressure)
//   3. Open-handoff backlog (more open work = more pressure)
//   4. Recent worker exit_code != 0 events
//   5. ERRORS-AND-ATTEMPTS entries in last 7 days (open status entries)
//
// Top phase: pressure events bucketed by phase id (parsed from handoff
// refs / task ids). Returns the phase with highest sum.

const fs = require('fs');
const path = require('path');
const os = require('os');

function getPressureCachePath(projectid, homeDir = os.homedir()) {
  return path.join(homeDir, '.cache', 'gad', `pressure-${projectid}.json`);
}

function defaultPressure(projectid = 'unknown') {
  return {
    updated_at: new Date().toISOString(),
    projectid,
    score: 0,
    top_phase: 'placeholder',
    top_phase_score: 0,
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function tryReadJsonl(filepath, maxLines = 5000) {
  try {
    const txt = fs.readFileSync(filepath, 'utf8');
    const lines = txt.split('\n').filter(Boolean);
    const tail = lines.slice(-maxLines);
    return tail.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function tryReadDir(dir) {
  try { return fs.readdirSync(dir); } catch { return []; }
}

function tryStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

// Walk up from cwd looking for .planning/ — used when caller doesn't pass baseDir.
function findProjectBaseDir(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function parsePhaseFromRef(ref) {
  // Handoff ids like h-2026-05-04T20-30-23-global-115 -> phase is LAST
  // numeric segment (115). Walking from start would catch "2026" from the
  // timestamp. Task ids like 88-04 -> first numeric segment (88).
  if (!ref || typeof ref !== 'string') return null;
  if (ref.startsWith('h-')) {
    const parts = ref.split('-');
    for (let i = parts.length - 1; i >= 0; i--) {
      if (/^\d+(\.\d+)?$/.test(parts[i])) return parts[i];
    }
    return null;
  }
  const m = ref.match(/^(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}

function recentDayKeys(days = 2) {
  const out = [];
  const now = Date.now();
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 86400_000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    out.push(`${yyyy}-${mm}-${dd}`);
  }
  return out;
}

function collectGadLogSignals(baseDir) {
  const logsDir = path.join(baseDir, '.planning', '.gad-log');
  const events = [];
  for (const day of recentDayKeys(2)) {
    const file = path.join(logsDir, `${day}.jsonl`);
    events.push(...tryReadJsonl(file, 10000));
  }
  return events;
}

function collectWorkerLogSignals(baseDir) {
  const teamDir = path.join(baseDir, '.planning', 'team', 'workers');
  const events = [];
  for (const id of tryReadDir(teamDir)) {
    const log = path.join(teamDir, id, 'log.jsonl');
    events.push(...tryReadJsonl(log, 2000));
  }
  return events;
}

function collectOpenHandoffSignals(baseDir) {
  const dir = path.join(baseDir, '.planning', 'handoffs', 'open');
  const handoffs = [];
  for (const fname of tryReadDir(dir)) {
    if (!fname.endsWith('.md')) continue;
    try {
      const body = fs.readFileSync(path.join(dir, fname), 'utf8');
      const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) continue;
      const id = fname.replace(/\.md$/, '');
      const phase = parsePhaseFromRef(id);
      const unclaimMatch = fmMatch[1].match(/^unclaim_history:\s*(.+)$/m);
      let unclaimCount = 0;
      let rateLimitCount = 0;
      if (unclaimMatch) {
        try {
          const arr = JSON.parse(unclaimMatch[1]);
          if (Array.isArray(arr)) {
            unclaimCount = arr.length;
            rateLimitCount = arr.filter((e) => e && e.reason === 'rate-limit').length;
          }
        } catch { /* tolerate bad json */ }
      }
      handoffs.push({ id, phase, unclaimCount, rateLimitCount });
    } catch { /* skip unreadable */ }
  }
  return handoffs;
}

function readErrorsAttempts(baseDir, withinDays = 7) {
  const file = path.join(baseDir, '.planning', 'ERRORS-AND-ATTEMPTS.xml');
  const stat = tryStat(file);
  if (!stat) return { recent: 0, openStatus: 0 };
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const cutoff = Date.now() - withinDays * 86400_000;
    const entries = [...txt.matchAll(/<entry[^>]*date="([^"]+)"[^>]*(?:status="([^"]+)")?/g)];
    let recent = 0;
    let openStatus = 0;
    for (const m of entries) {
      const date = Date.parse(m[1]);
      if (Number.isFinite(date) && date >= cutoff) {
        recent++;
        if (m[2] === 'open') openStatus++;
      }
    }
    return { recent, openStatus };
  } catch {
    return { recent: 0, openStatus: 0 };
  }
}

function aggregatePressure(signals) {
  const phaseScores = new Map();
  function bump(phase, weight) {
    if (!phase) return;
    phaseScores.set(phase, (phaseScores.get(phase) || 0) + weight);
  }

  let raw = 0;

  // 1. Rate-limit incidents (gad-log + worker log) — strong signal but
  //    rate-limits are common in multi-runtime teams; light weight.
  const rlEvents = signals.gadLog.filter(
    (e) => e && (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream'),
  ).length + signals.workerLog.filter(
    (e) => e && (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream'),
  ).length;
  raw += rlEvents * 0.01;
  for (const e of signals.workerLog) {
    if (e && e.kind === 'runtime-rate-limit-on-call' && e.ref) {
      bump(parsePhaseFromRef(e.ref), 0.01);
    }
  }

  // 2. Open handoff backlog (work waiting to be picked up)
  raw += signals.openHandoffs.length * 0.01;
  for (const h of signals.openHandoffs) bump(h.phase, 0.01);

  // 3. Open handoffs with prior unclaims (repeated strain — strong signal
  //    that this work doesn't fit any existing skill)
  for (const h of signals.openHandoffs) {
    raw += h.unclaimCount * 0.02 + h.rateLimitCount * 0.02;
    bump(h.phase, h.unclaimCount * 0.02 + h.rateLimitCount * 0.02);
  }

  // 4. Worker exit_code != 0 events (real failures, not rate-limits)
  const failures = signals.workerLog.filter(
    (e) => e && e.kind === 'work-complete' && e.exit_code != null && e.exit_code !== 0,
  ).length;
  raw += failures * 0.02;
  for (const e of signals.workerLog) {
    if (e && e.kind === 'work-complete' && e.exit_code != null && e.exit_code !== 0 && e.ref) {
      bump(parsePhaseFromRef(e.ref), 0.02);
    }
  }

  // 5. ERRORS-AND-ATTEMPTS — open entries are unfixed structural pain
  raw += signals.errors.recent * 0.01 + signals.errors.openStatus * 0.03;

  // Top phase
  let topPhase = 'placeholder';
  let topScore = 0;
  for (const [phase, score] of phaseScores) {
    if (score > topScore) {
      topPhase = phase;
      topScore = score;
    }
  }

  return {
    score: clamp(raw, 0, 1),
    top_phase: topPhase,
    top_phase_score: clamp(topScore, 0, 1),
    breakdown: {
      rate_limits: rlEvents,
      open_handoffs: signals.openHandoffs.length,
      handoffs_with_unclaims: signals.openHandoffs.filter((h) => h.unclaimCount > 0).length,
      worker_failures: failures,
      errors_recent: signals.errors.recent,
      errors_open: signals.errors.openStatus,
    },
  };
}

function computePressure(projectid = 'unknown', options = {}) {
  const baseDir = options.baseDir || findProjectBaseDir();
  if (!baseDir) return defaultPressure(projectid);

  const signals = {
    gadLog: collectGadLogSignals(baseDir),
    workerLog: collectWorkerLogSignals(baseDir),
    openHandoffs: collectOpenHandoffSignals(baseDir),
    errors: readErrorsAttempts(baseDir),
  };

  const agg = aggregatePressure(signals);
  return {
    updated_at: new Date().toISOString(),
    projectid,
    score: agg.score,
    top_phase: agg.top_phase,
    top_phase_score: agg.top_phase_score,
    breakdown: agg.breakdown,
  };
}

function writePressureCache(projectid, pressure, homeDir = os.homedir()) {
  const resolved = pressure || computePressure(projectid);
  const cachePath = getPressureCachePath(projectid, homeDir);
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({
    ...defaultPressure(projectid),
    ...resolved,
    projectid,
  }, null, 2));
  return cachePath;
}

module.exports = {
  computePressure,
  defaultPressure,
  getPressureCachePath,
  writePressureCache,
  // Exported for tests + debugging:
  parsePhaseFromRef,
  aggregatePressure,
  collectOpenHandoffSignals,
};
