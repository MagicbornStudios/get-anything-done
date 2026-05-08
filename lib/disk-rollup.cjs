'use strict';
/**
 * lib/disk-rollup.cjs — Cross-project disk size rollup.
 *
 * Tasks: GAD-T-75-17 (75-17)
 *
 * Walks all planning.roots from gad-config.toml plus known sibling
 * directories (slm_learning/runs, data, models) and returns a per-project
 * size breakdown table.
 *
 * Public API:
 *   rollupAllProjects(repoRoot, opts) → ProjectRow[]
 *   formatRollupTable(rows) → string
 */

const fs   = require('node:fs');
const path = require('node:path');

// ─── Size walker ─────────────────────────────────────────────────────────────

/**
 * Sum the bytes in a directory tree, bounded by entry count and wall time.
 * Symlinks are never followed. Returns { bytes, truncated }.
 *
 * @param {string} dir
 * @param {{ maxEntries?: number, deadlineMs?: number }} [opts]
 */
function dirSizeBounded(dir, opts = {}) {
  const maxEntries = opts.maxEntries || 100000;
  const deadlineMs = opts.deadlineMs || 8000;
  const start = Date.now();
  let bytes = 0;
  let entries = 0;
  let truncated = false;
  const stack = [dir];
  while (stack.length) {
    if (entries >= maxEntries || Date.now() - start > deadlineMs) {
      truncated = true;
      break;
    }
    const cur = stack.pop();
    let children;
    try { children = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const child of children) {
      entries++;
      if (entries >= maxEntries || Date.now() - start > deadlineMs) { truncated = true; break; }
      const full = path.join(cur, child.name);
      try {
        if (child.isSymbolicLink()) continue;
        if (child.isDirectory()) stack.push(full);
        else if (child.isFile()) bytes += fs.statSync(full).size;
      } catch {}
    }
  }
  return { bytes, truncated };
}

// ─── MB helpers ──────────────────────────────────────────────────────────────

function toMb(bytes) {
  return Math.round(bytes / (1024 * 1024) * 10) / 10;
}

function formatMb(mb, truncated) {
  if (mb == null) return '-';
  return `${mb}${truncated ? '+' : ''}`;
}

// ─── SLM-learning column layout ──────────────────────────────────────────────
// slm_learning has runs/, data/, models/ as separate measured sub-trees.
// Other projects: just .planning/

const SLM_SUBTREES = ['runs', 'data', 'models'];

// ─── Core rollup ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, planningMb: number|null, datasetsMb: number|null, runsMb: number|null, modelsMb: number|null, totalMb: number, truncated: boolean, notes: string }} ProjectRow
 */

/**
 * Walk all planning roots and return per-project size rows.
 *
 * @param {string} repoRoot — absolute path to monorepo root
 * @param {{ deadlineMs?: number, gadConfig?: object }} [opts]
 * @returns {ProjectRow[]}
 */
function rollupAllProjects(repoRoot, opts = {}) {
  const deadlineMs = opts.deadlineMs || 8000;
  const rows = [];

  // Load config to enumerate planning.roots
  let roots = [];
  try {
    const gadConfig = opts.gadConfig || require('../bin/gad-config.cjs');
    const cfg = gadConfig.load(repoRoot);
    roots = cfg.roots || [];
  } catch {}

  // Measure a dir (or return null if absent)
  function measure(absDir) {
    if (!fs.existsSync(absDir)) return { mb: null, truncated: false };
    const { bytes, truncated } = dirSizeBounded(absDir, { deadlineMs });
    return { mb: toMb(bytes), truncated };
  }

  // Process planning roots from config
  for (const root of roots) {
    const rootAbs = path.isAbsolute(root.path)
      ? root.path
      : path.resolve(repoRoot, root.path);

    const planningDir = root.planningDir || '.planning';

    if (root.id === 'slm-learning') {
      // Handled separately below
      continue;
    }

    const { mb: planningMb, truncated: pt } = measure(path.join(rootAbs, planningDir));
    const totalMb = planningMb || 0;
    const notes = totalMb >= 1024 ? '>1 GB — review' : '';
    rows.push({
      id: root.id,
      planningMb,
      datasetsMb: null,
      runsMb: null,
      modelsMb: null,
      totalMb,
      truncated: pt,
      notes,
    });
  }

  // Always probe slm_learning as a sibling, even if not in config roots
  const slmCandidatePaths = [
    path.resolve(repoRoot, '..', 'slm_learning'),
    path.resolve(repoRoot, '..', 'slm-learning'),
  ];
  const slmRoot = slmCandidatePaths.find((p) => fs.existsSync(p)) || null;
  if (slmRoot) {
    const { mb: planningMb, truncated: pt0 } = measure(path.join(slmRoot, '.planning'));
    const { mb: runsMb,     truncated: pt1 } = measure(path.join(slmRoot, 'runs'));
    const { mb: datasetsMb, truncated: pt2 } = measure(path.join(slmRoot, 'data'));
    const { mb: modelsMb,   truncated: pt3 } = measure(path.join(slmRoot, 'models'));
    const totalMb = (planningMb || 0) + (runsMb || 0) + (datasetsMb || 0) + (modelsMb || 0);
    const truncated = pt0 || pt1 || pt2 || pt3;
    const notes = totalMb >= 1024 ? '>1 GB — review' : '';
    rows.push({
      id: 'slm-learning',
      planningMb,
      datasetsMb,
      runsMb,
      modelsMb,
      totalMb,
      truncated,
      notes,
    });
  }

  rows.sort((a, b) => b.totalMb - a.totalMb);
  return rows;
}

// ─── Table renderer ───────────────────────────────────────────────────────────

/**
 * Render rows as a human-readable table string.
 * @param {ProjectRow[]} rows
 * @returns {string}
 */
function formatRollupTable(rows) {
  const cols = ['PROJECT', '.PLANNING_MB', 'DATASETS_MB', 'RUNS_MB', 'MODELS_MB', 'TOTAL_MB', 'NOTES'];
  const colWidths = cols.map((c) => c.length);

  const dataRows = rows.map((r) => [
    r.id,
    formatMb(r.planningMb, false),
    formatMb(r.datasetsMb, false),
    formatMb(r.runsMb, false),
    formatMb(r.modelsMb, false),
    `${r.totalMb}${r.truncated ? '+' : ''}`,
    r.notes || '',
  ]);

  for (const row of dataRows) {
    for (let i = 0; i < cols.length; i++) {
      if (row[i].length > colWidths[i]) colWidths[i] = row[i].length;
    }
  }

  const sep = colWidths.map((w) => '-'.repeat(w)).join('  ');
  const header = cols.map((c, i) => c.padEnd(colWidths[i])).join('  ');
  const lines = [header, sep];
  for (const row of dataRows) {
    lines.push(row.map((cell, i) => cell.padEnd(colWidths[i])).join('  '));
  }
  return lines.join('\n');
}

module.exports = { rollupAllProjects, formatRollupTable, dirSizeBounded, toMb };
