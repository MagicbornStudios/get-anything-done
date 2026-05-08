'use strict';
/**
 * lib/orthogonality/index.cjs
 *
 * Orthogonality audit + cluster-based eval matrix helpers.
 * Phase 112, task 112-01.
 *
 * No external deps — built-ins only (fs, path).
 *
 * Exports:
 *   sampleClosedHandoffs({ roots, sinceIso })    -> handoff[]
 *   analyzeCombos(handoffs)                       -> frequencyTable[]
 *   clusterCombos(table, opts)                   -> cluster[]
 *   clusterEnumerate(clusters)                   -> combo[]
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// YAML-lite frontmatter parser
// Handles simple scalar key: value lines (no nested objects, no multiline).
// ---------------------------------------------------------------------------
function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const rawLine of m[1].split('\n')) {
    const line = rawLine.trim();
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k && !k.startsWith('#')) fm[k] = v;
  }
  return fm;
}

// ---------------------------------------------------------------------------
// ISO duration / date parse helper
// Accepts either a YYYY-MM-DD string or a NNd / NNw / NNh shorthand.
// Returns a Date (or null if unparseable).
// ---------------------------------------------------------------------------
function parseSinceArg(since) {
  if (!since) return null;
  // Relative: 7d, 30d, 2w, 24h
  const rel = since.match(/^(\d+)([dhw])$/);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2];
    const ms = unit === 'h' ? n * 3600000
      : unit === 'd' ? n * 86400000
      : n * 7 * 86400000;
    return new Date(Date.now() - ms);
  }
  // Absolute ISO date
  const d = new Date(since);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// sampleClosedHandoffs
//
// Walks each root's .planning/handoffs/closed/ (and optionally claimed/).
// Extracts frontmatter fields relevant to orthogonality.
//
// @param {object} opts
//   roots         string[]   - repo root paths to scan
//   sinceIso      string     - optional ISO date or relative (7d, 2w) cutoff
//   includeClaimed boolean   - if true, also scan claimed/ subdir (default false)
//
// @returns Array<{id, project, context, risk, time, surface, runtime, priority, ts}>
// ---------------------------------------------------------------------------
function sampleClosedHandoffs({ roots = [], sinceIso = null, includeClaimed = false } = {}) {
  const cutoff = parseSinceArg(sinceIso);
  const results = [];

  for (const root of roots) {
    if (!root) continue;

    const subdirs = ['closed'];
    if (includeClaimed) subdirs.push('claimed');

    for (const sub of subdirs) {
      const dir = path.join(root, '.planning', 'handoffs', sub);
      if (!fs.existsSync(dir)) continue;

      let files;
      try {
        files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
      } catch (_) {
        continue;
      }

      for (const f of files) {
        let content;
        try {
          content = fs.readFileSync(path.join(dir, f), 'utf8');
        } catch (_) {
          continue;
        }

        const fm = parseFrontmatter(content);

        // Timestamp filter
        if (cutoff) {
          const ts = fm.completed_at || fm.created_at || '';
          if (ts && ts !== 'null') {
            const d = new Date(ts);
            if (!isNaN(d.getTime()) && d < cutoff) continue;
          }
        }

        // Normalise context — some older handoffs use priority instead of
        // estimated_context (they share the same slot before schema v2).
        const context = (fm.estimated_context || '').toLowerCase() || null;
        const risk = (fm.risk || '').toLowerCase() || null;
        const time = (fm.time || '').toLowerCase() || null;
        const surface = (fm.surface || '').toLowerCase() || null;
        const runtime = (fm.runtime_preference || '').toLowerCase() || null;
        const priority = (fm.priority || '').toLowerCase() || null;
        const project = fm.projectid || 'unknown';
        const ts = fm.completed_at && fm.completed_at !== 'null'
          ? fm.completed_at
          : fm.created_at || null;

        results.push({
          id: f.replace(/\.md$/, ''),
          project,
          context,
          risk,
          time,
          surface,
          runtime,
          priority,
          ts,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// analyzeCombos
//
// Count occurrences of each (context, risk, time, surface) tuple.
// Returns array sorted by frequency descending.
//
// @param  {object[]} handoffs - from sampleClosedHandoffs
// @returns {Array<{context, risk, time, surface, count, runtimes}>}
// ---------------------------------------------------------------------------
function analyzeCombos(handoffs) {
  const table = new Map();

  for (const h of handoffs) {
    const key = [h.context || '?', h.risk || '?', h.time || '?', h.surface || '?'].join('|');
    if (!table.has(key)) {
      table.set(key, {
        context: h.context || '?',
        risk: h.risk || '?',
        time: h.time || '?',
        surface: h.surface || '?',
        count: 0,
        runtimes: new Set(),
      });
    }
    const entry = table.get(key);
    entry.count++;
    if (h.runtime) entry.runtimes.add(h.runtime);
  }

  return Array.from(table.values())
    .map((e) => ({ ...e, runtimes: [...e.runtimes] }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Known-dimension count for a combo entry.
// ---------------------------------------------------------------------------
const DIMS = ['context', 'risk', 'time', 'surface'];

function knownDimCount(combo) {
  return DIMS.filter((d) => combo[d] && combo[d] !== '?').length;
}

// ---------------------------------------------------------------------------
// Hamming distance over 4 categorical dimensions.
// Only compares dimensions that are KNOWN on BOTH sides.
// If fewer than 2 dims are known on both sides, distance = 4 (incomparable)
// so partial-schema combos never absorb fully-specified ones.
// ---------------------------------------------------------------------------
function hammingDist(a, b) {
  let dist = 0;
  let sharedKnown = 0;
  for (const d of DIMS) {
    if (!a[d] || a[d] === '?' || !b[d] || b[d] === '?') continue;
    sharedKnown++;
    if (a[d] !== b[d]) dist++;
  }
  if (sharedKnown < 2) return 4; // incomparable — too few known shared dims
  return dist;
}

// ---------------------------------------------------------------------------
// Derive a human-readable label for a cluster given its seed combo.
// Falls back to "cluster-N" when no rule matches.
// ---------------------------------------------------------------------------
const LABEL_RULES = [
  // Exact or near-exact matches on context dim
  { context: 'prescribed', risk: 'safe',  label: 'mechanical-fix' },
  { context: 'mechanical', risk: 'safe',  label: 'mechanical-fix' },
  { context: 'bounded',    risk: 'safe',  time: 'standard', label: 'bounded-impl' },
  { context: 'bounded',    risk: 'safe',  time: 'deep',     label: 'bounded-deep' },
  { context: 'bounded',    risk: 'destructive',              label: 'bounded-destructive' },
  { context: 'exploratory',risk: 'safe',  time: 'standard', label: 'exploratory-std' },
  { context: 'exploratory',risk: 'safe',  time: 'deep',     label: 'exploratory-deep' },
  { context: 'exploratory',risk: 'safe',  time: 'quick',    label: 'exploratory-quick' },
  { context: 'design',     risk: 'safe',                    label: 'design-deep' },
  { context: 'audit',      risk: 'safe',                    label: 'audit-standard' },
  { context: 'feature',    risk: 'safe',                    label: 'feature-impl' },
  { context: 'reasoning',  risk: 'safe',                    label: 'reasoning-std' },
  { context: 'light',                                        label: 'light-task' },
];

function deriveLabel(combo) {
  for (const rule of LABEL_RULES) {
    let match = true;
    for (const [k, v] of Object.entries(rule)) {
      if (k === 'label') continue;
      if (combo[k] !== '?' && combo[k] !== v) { match = false; break; }
    }
    if (match) return rule.label;
  }
  return null; // caller will assign cluster-N
}

// ---------------------------------------------------------------------------
// clusterCombos
//
// Greedy Hamming-distance clustering. Seeds = combos in frequency order.
// Each new combo merges into the nearest existing seed if dist ≤ threshold.
// A new cluster is created when no seed is close enough, until maxClusters.
//
// @param {object[]} table       - from analyzeCombos
// @param {object}   opts
//   minFreq     number   - minimum count to be a seed candidate (default 2)
//   maxClusters number   - hard cap on cluster count (default 10)
//   maxDist     number   - Hamming threshold to merge (default 1)
//
// @returns Array<{
//   id: string,         // cluster-N or derived label
//   label: string,
//   seed: object,       // representative combo (highest freq in cluster)
//   members: object[],  // all combos in cluster
//   totalCount: number,
//   runtimes: string[],
// }>
// ---------------------------------------------------------------------------
function clusterCombos(table, { minFreq = 2, maxClusters = 10, maxDist = 1 } = {}) {
  // Phase 1: build seeds from frequent combos
  const candidates = table.filter((e) => e.count >= minFreq);
  const lowFreq = table.filter((e) => e.count < minFreq);

  const clusters = [];

  function findNearestCluster(combo) {
    let best = null;
    let bestDist = Infinity;
    for (const cl of clusters) {
      const d = hammingDist(cl.seed, combo);
      if (d < bestDist) { bestDist = d; best = cl; }
    }
    return bestDist <= maxDist ? best : null;
  }

  for (const combo of candidates) {
    const nearest = findNearestCluster(combo);
    if (nearest) {
      nearest.members.push(combo);
      nearest.totalCount += combo.count;
      for (const r of combo.runtimes) nearest.runtimes.add(r);
    } else if (clusters.length < maxClusters) {
      clusters.push({
        _n: clusters.length + 1,
        seed: combo,
        members: [combo],
        totalCount: combo.count,
        runtimes: new Set(combo.runtimes),
      });
    } else {
      // Over cap — force-merge into nearest
      const nearest2 = clusters.reduce((a, b) =>
        hammingDist(a.seed, combo) <= hammingDist(b.seed, combo) ? a : b
      );
      nearest2.members.push(combo);
      nearest2.totalCount += combo.count;
      for (const r of combo.runtimes) nearest2.runtimes.add(r);
    }
  }

  // Phase 2: merge low-freq combos into nearest cluster
  for (const combo of lowFreq) {
    const nearest = findNearestCluster(combo);
    if (nearest) {
      nearest.members.push(combo);
      nearest.totalCount += combo.count;
      for (const r of combo.runtimes) nearest.runtimes.add(r);
    }
    // unclaimed low-freq combos: ignore (they're statistical noise)
  }

  // Finalise
  return clusters.map((cl) => {
    const label = deriveLabel(cl.seed) || `cluster-${cl._n}`;
    return {
      id: label,
      label,
      seed: cl.seed,
      members: cl.members,
      totalCount: cl.totalCount,
      runtimes: [...cl.runtimes].sort(),
    };
  }).sort((a, b) => b.totalCount - a.totalCount);
}

// ---------------------------------------------------------------------------
// clusterEnumerate
//
// Returns the representative (seed) combo for each cluster — the minimal set
// of test configurations for an eval matrix run.
//
// @param  {object[]} clusters - from clusterCombos
// @returns {Array<{id, context, risk, time, surface, runtimes, totalCount}>}
// ---------------------------------------------------------------------------
function clusterEnumerate(clusters) {
  return clusters.map((cl) => ({
    id: cl.id,
    label: cl.label,
    context: cl.seed.context,
    risk: cl.seed.risk,
    time: cl.seed.time,
    surface: cl.seed.surface,
    runtimes: cl.runtimes,
    memberCount: cl.members.length,
    totalCount: cl.totalCount,
  }));
}

module.exports = {
  sampleClosedHandoffs,
  analyzeCombos,
  clusterCombos,
  clusterEnumerate,
};
