'use strict';
/**
 * lib/models/drift.cjs — data-drift detector (phase 248-08).
 *
 * Pure-classical comparison: scans per-project training corpus directories
 * (.planning/datasets, .planning/training-data, .planning/training-runs, plus
 * any operator-declared paths in training.corpus_paths), tallies aggregate
 * byte size, and compares against the last recorded baseline.
 *
 * Baseline lives at `.planning/models/drift-baseline.json`:
 *   {
 *     "<model-id>": {
 *       "baseline_bytes": number,
 *       "baseline_ts":    ISO timestamp,
 *       "last_check_ts":  ISO timestamp,
 *       "last_check_bytes": number,
 *       "last_drift_pct":   number
 *     },
 *     ...
 *   }
 *
 * Idempotent: re-scanning the same tree returns the same byte count.
 * No LLM call. No remote fetch.
 *
 * Exports:
 *   scanCorpusBytes(projectRoot, paths?) -> { bytes, files, scanned_paths }
 *   readBaseline(projectRoot) -> object
 *   writeBaseline(projectRoot, baseline) -> void
 *   checkDrift(projectRoot, modelId, opts?) -> {
 *     model_id, baseline_bytes, current_bytes, delta_bytes, drift_pct,
 *     threshold_pct, drift_exceeded, baseline_ts, ts, scanned_paths
 *   }
 *   recordBaseline(projectRoot, modelId, opts?) -> baseline-entry
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_THRESHOLD_PCT = 20;
const DRIFT_BASELINE_RELPATH = path.join('.planning', 'models', 'drift-baseline.json');

const DEFAULT_CORPUS_PATHS = [
  path.join('.planning', 'datasets'),
  path.join('.planning', 'training-data'),
  path.join('.planning', 'training-runs'),
];

function baselinePath(projectRoot) {
  return path.join(projectRoot, DRIFT_BASELINE_RELPATH);
}

function readBaseline(projectRoot) {
  const p = baselinePath(projectRoot);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return {};
  }
}

function writeBaseline(projectRoot, baseline) {
  const p = baselinePath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
}

function resolveSetting(key, fallback) {
  try {
    const { getSetting } = require('../settings-registry.cjs');
    const v = getSetting(key);
    return (v === undefined || v === null) ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function expandCorpusPaths(projectRoot, override) {
  const declared = Array.isArray(override) && override.length > 0
    ? override
    : (resolveSetting('training.corpus_paths', null) || DEFAULT_CORPUS_PATHS);
  return declared.map((rel) => path.isAbsolute(rel) ? rel : path.join(projectRoot, rel));
}

/**
 * Walk one directory recursively, summing file sizes. Skips symlink loops
 * via the seenInos set. Best-effort: stat errors are silently swallowed.
 */
function dirBytes(root, seenInos) {
  if (!fs.existsSync(root)) return { bytes: 0, files: 0 };
  const stack = [root];
  let bytes = 0;
  let files = 0;
  while (stack.length > 0) {
    const cur = stack.pop();
    let st;
    try { st = fs.lstatSync(cur); } catch (_) { continue; }
    if (st.isSymbolicLink()) continue;
    const key = `${st.dev}-${st.ino}`;
    if (seenInos.has(key)) continue;
    seenInos.add(key);
    if (st.isDirectory()) {
      let entries;
      try { entries = fs.readdirSync(cur); } catch (_) { continue; }
      for (const name of entries) stack.push(path.join(cur, name));
    } else if (st.isFile()) {
      bytes += st.size;
      files += 1;
    }
  }
  return { bytes, files };
}

/**
 * Scan corpus paths and total their bytes.
 * @param {string} projectRoot
 * @param {string[]} [overridePaths]
 * @returns {{bytes:number, files:number, scanned_paths: Array<{path,bytes,files,exists}>}}
 */
function scanCorpusBytes(projectRoot, overridePaths) {
  const paths = expandCorpusPaths(projectRoot, overridePaths);
  const seenInos = new Set();
  const scanned = [];
  let totalBytes = 0;
  let totalFiles = 0;
  for (const p of paths) {
    const exists = fs.existsSync(p);
    if (!exists) {
      scanned.push({ path: p, bytes: 0, files: 0, exists: false });
      continue;
    }
    const { bytes, files } = dirBytes(p, seenInos);
    scanned.push({ path: p, bytes, files, exists: true });
    totalBytes += bytes;
    totalFiles += files;
  }
  return { bytes: totalBytes, files: totalFiles, scanned_paths: scanned };
}

/**
 * Compare current corpus size to a model's baseline.
 *
 * @param {string} projectRoot
 * @param {string} modelId
 * @param {object} [opts]
 * @param {number} [opts.thresholdPct=20] - drift threshold as percentage
 * @param {string[]} [opts.corpusPaths]   - override corpus paths
 * @returns drift-check result
 */
function checkDrift(projectRoot, modelId, opts = {}) {
  const threshold = (typeof opts.thresholdPct === 'number')
    ? opts.thresholdPct
    : resolveSetting('training.drift_threshold_pct', DEFAULT_THRESHOLD_PCT);

  const scan = scanCorpusBytes(projectRoot, opts.corpusPaths);
  const baseline = readBaseline(projectRoot);
  const entry = baseline[modelId];
  const ts = new Date().toISOString();

  if (!entry || typeof entry.baseline_bytes !== 'number' || entry.baseline_bytes <= 0) {
    return {
      model_id: modelId,
      baseline_bytes: null,
      current_bytes: scan.bytes,
      delta_bytes: null,
      drift_pct: null,
      threshold_pct: threshold,
      drift_exceeded: false,
      no_baseline: true,
      baseline_ts: null,
      ts,
      scanned_paths: scan.scanned_paths,
    };
  }

  const delta = scan.bytes - entry.baseline_bytes;
  const driftPct = (delta / entry.baseline_bytes) * 100;
  const exceeded = driftPct >= threshold;

  return {
    model_id: modelId,
    baseline_bytes: entry.baseline_bytes,
    current_bytes: scan.bytes,
    delta_bytes: delta,
    drift_pct: Number(driftPct.toFixed(2)),
    threshold_pct: threshold,
    drift_exceeded: exceeded,
    no_baseline: false,
    baseline_ts: entry.baseline_ts || null,
    ts,
    scanned_paths: scan.scanned_paths,
  };
}

/**
 * Record a fresh baseline for a model. Typically called by the trainer at
 * train-complete time (so future scans measure drift since this train).
 */
function recordBaseline(projectRoot, modelId, opts = {}) {
  const scan = scanCorpusBytes(projectRoot, opts.corpusPaths);
  const ts = new Date().toISOString();
  const baseline = readBaseline(projectRoot);
  baseline[modelId] = {
    baseline_bytes: scan.bytes,
    baseline_ts: ts,
    last_check_ts: ts,
    last_check_bytes: scan.bytes,
    last_drift_pct: 0,
  };
  writeBaseline(projectRoot, baseline);
  return baseline[modelId];
}

/**
 * Persist the most-recent check result into the baseline file (last_check_*
 * fields). Does NOT reset baseline_bytes — that's recordBaseline's job.
 */
function persistCheck(projectRoot, result) {
  const baseline = readBaseline(projectRoot);
  const prev = baseline[result.model_id] || {};
  baseline[result.model_id] = {
    ...prev,
    last_check_ts: result.ts,
    last_check_bytes: result.current_bytes,
    last_drift_pct: result.drift_pct == null ? 0 : result.drift_pct,
  };
  writeBaseline(projectRoot, baseline);
  return baseline[result.model_id];
}

module.exports = {
  DEFAULT_THRESHOLD_PCT,
  DEFAULT_CORPUS_PATHS,
  baselinePath,
  readBaseline,
  writeBaseline,
  scanCorpusBytes,
  checkDrift,
  recordBaseline,
  persistCheck,
};
