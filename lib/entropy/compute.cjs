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
const { buildResolverIndex, resolversFor } = require('../skills/resolver-index.cjs');

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

function aggregatePressure(signals, options = {}) {
  const phaseScores = new Map();
  function bump(phase, weight) {
    if (!phase) return;
    phaseScores.set(phase, (phaseScores.get(phase) || 0) + weight);
  }

  // Phase 136 — resolver-aware dampening.
  // Skills declaring `solves_pressure_source: <pattern>` in SKILL.md
  // frontmatter cause matching signals to count at 1/(1+resolverCount)
  // strength. resolved_signals counts the distinct signal signatures
  // that found at least one resolver — feeds the level-up gate.
  const resolverIndex = options.resolverIndex || new Map();
  const resolvedSignatures = new Set();
  function dampen(signature, baseValue) {
    const slugs = resolversFor(resolverIndex, signature);
    if (slugs.length === 0) return baseValue;
    resolvedSignatures.add(signature);
    return baseValue / (1 + slugs.length);
  }

  let raw = 0;

  // Time-window: only count signals from last 1 hour. Pressure should reflect
  // CURRENT load, not lifetime accumulation. A spike that resolved an hour
  // ago should not pin the bar at max forever (operator pain 2026-05-05:
  // empty-body cascade burned 1000+ rate-limit events in 20s, pinned bar at
  // 100 even after the bug was fixed).
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_HOUR_MS;
  const recentEvent = (e) => {
    if (!e || !e.ts) return false;
    const t = Date.parse(e.ts);
    return Number.isFinite(t) && t >= cutoff;
  };

  // Per-signal contribution cap: no single signal can saturate the bar by
  // itself. With 5 signal categories, each capped at 0.3 means at minimum
  // 2 categories must be high to reach high pressure.
  const SIGNAL_CAP = 0.3;

  // 1. Rate-limit incidents (last hour only) — strong signal but capped.
  const rlEvents = signals.gadLog.filter(
    (e) => recentEvent(e) && (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream'),
  ).length + signals.workerLog.filter(
    (e) => recentEvent(e) && (e.kind === 'runtime-rate-limit-on-call' || e.kind === 'rate-limit-detected-midstream'),
  ).length;
  raw += dampen('rate-limit', Math.min(SIGNAL_CAP, rlEvents * 0.01));
  for (const e of signals.workerLog) {
    if (e && recentEvent(e) && e.kind === 'runtime-rate-limit-on-call' && e.ref) {
      bump(parsePhaseFromRef(e.ref), 0.01);
    }
  }

  // 2. Open handoff backlog (work waiting to be picked up)
  raw += dampen('handoff-backlog', Math.min(SIGNAL_CAP, signals.openHandoffs.length * 0.01));
  for (const h of signals.openHandoffs) bump(h.phase, 0.01);

  // 3. Open handoffs with prior unclaims (repeated strain — strong signal
  //    that this work doesn't fit any existing skill). Cap per-handoff
  //    contribution at 0.05 to prevent one bouncy handoff from dominating.
  let unclaimRaw = 0;
  for (const h of signals.openHandoffs) {
    const v = Math.min(0.05, h.unclaimCount * 0.02 + h.rateLimitCount * 0.02);
    unclaimRaw += v;
    bump(h.phase, v);
  }
  raw += dampen('unclaim-cascade', Math.min(SIGNAL_CAP, unclaimRaw));

  // 4. Worker exit_code != 0 events (real failures, last hour, not rate-limits)
  const failures = signals.workerLog.filter(
    (e) => recentEvent(e) && e.kind === 'work-complete' && e.exit_code != null && e.exit_code !== 0,
  ).length;
  raw += dampen('worker-failure', Math.min(SIGNAL_CAP, failures * 0.02));
  for (const e of signals.workerLog) {
    if (e && recentEvent(e) && e.kind === 'work-complete' && e.exit_code != null && e.exit_code !== 0 && e.ref) {
      bump(parsePhaseFromRef(e.ref), 0.02);
    }
  }

  // 5. ERRORS-AND-ATTEMPTS — open entries are unfixed structural pain
  const errorsRecent = dampen('errors-and-attempts-recent', Math.min(SIGNAL_CAP, signals.errors.recent * 0.01));
  const errorsOpen = dampen('errors-and-attempts-open', Math.min(SIGNAL_CAP, signals.errors.openStatus * 0.03));
  raw += Math.min(SIGNAL_CAP, errorsRecent + errorsOpen);

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
      resolved_signals: resolvedSignatures.size,
      resolved_signal_list: [...resolvedSignatures],
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

  // Phase 136 — build resolver index from installed skills.
  // baseDir is the project root we walked up to; vendor/get-anything-done
  // lives there in the monorepo case. For per-project roots in a sibling
  // checkout the framework skills won't be found and only .claude/skills
  // applies — that's fine.
  const resolverIndex = options.resolverIndex
    || buildResolverIndex({ repoRoot: baseDir, projectRoot: baseDir });

  const agg = aggregatePressure(signals, { resolverIndex });
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
