'use strict';
/**
 * lib/telemetry/model-rollup.cjs — shared model-keyed rollup helpers.
 *
 * Consumed by:
 *   - bin/commands/telemetry.cjs  (gad telemetry models)
 *   - lib/snapshot-health-rollup.cjs  (HEALTH MODELS line in gad snapshot)
 *
 * Decision GLOBAL-D-317.  Single source of truth — do NOT duplicate inline.
 */

const fs = require('fs');
const path = require('path');

// ── SLM-learning integration ──────────────────────────────────────────────

function loadSlmRegistry(slmModelsDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(slmModelsDir, 'REGISTRY.json'), 'utf8'));
  } catch {
    return null;
  }
}

function loadDeltaGraph(slmModelsDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(slmModelsDir, 'DELTA_GRAPH.json'), 'utf8'));
  } catch {
    return null;
  }
}

function resolveSlmModelsDir(repoRoot) {
  // Walk upward from repoRoot trying sibling slm_learning at each level.
  // Also check conventional path from monorepo parent (../slm_learning from monorepo).
  const candidates = [
    path.resolve(repoRoot, '..', 'slm_learning', 'models'),
    path.resolve(repoRoot, '..', '..', 'slm_learning', 'models'),
    path.resolve(repoRoot, '..', '..', '..', 'slm_learning', 'models'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

// Build a flat map of model_id -> { lane, version, deltaId, recipe, status }
// from the REGISTRY lanes + DELTA_GRAPH deltas.
function buildSlmIndex(registry, deltaGraph) {
  const index = new Map();
  if (!registry || !registry.lanes) return index;

  const deltaById = new Map();
  if (deltaGraph && deltaGraph.deltas) {
    for (const [modelId, delta] of Object.entries(deltaGraph.deltas)) {
      deltaById.set(modelId, delta);
      if (delta.delta_id) deltaById.set(delta.delta_id, delta);
    }
  }

  for (const [lane, laneData] of Object.entries(registry.lanes)) {
    const processModel = (modelId, status) => {
      if (!modelId) return;
      const delta = deltaById.get(modelId) || null;
      const recipe = delta ? delta.training_method || null : null;
      const dataset = delta ? (delta.dataset || null) : null;
      index.set(modelId, {
        lane,
        status,
        version: delta ? (delta.delta_id || null) : null,
        recipe,
        dataset,
        base: delta ? (delta.base || null) : null,
        compute_target: delta ? (delta.compute_target || null) : null,
      });
    };

    if (laneData.canonical) processModel(laneData.canonical, 'canonical');
    for (const entry of laneData.staging || []) {
      processModel(typeof entry === 'string' ? entry : entry.id, 'staging');
    }
    for (const entry of laneData.candidates || []) {
      processModel(typeof entry === 'string' ? entry : entry.id, 'candidate');
    }
  }
  return index;
}

// ── Core rollup ───────────────────────────────────────────────────────────

function classifyModelSource(modelId, slmIndex) {
  if (!modelId || modelId === '(unknown-model)') return 'unknown';
  if (slmIndex.has(modelId)) return 'local-slm';
  const lower = modelId.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) return 'cloud';
  if (lower.includes('gpt') || lower.includes('openai') || lower.includes('o1') || lower.includes('o3') || lower.includes('o4')) return 'cloud';
  if (lower.includes('gemini') || lower.includes('google')) return 'cloud';
  if (lower.includes('qwen') || lower.includes('scrubster') || lower.includes('dr-stein')) return 'local-slm';
  if (lower.includes('llama') || lower.includes('mistral') || lower.includes('phi')) return 'local-slm';
  return 'unknown';
}

function percentile(sortedArray, p) {
  if (sortedArray.length === 0) return null;
  const idx = Math.ceil(p * sortedArray.length) - 1;
  return sortedArray[Math.max(0, idx)];
}

function relativeTime(tsString) {
  if (!tsString) return 'never';
  const ms = Date.parse(String(tsString));
  if (Number.isNaN(ms)) return 'never';
  const diff = Date.now() - ms;
  if (diff < 0) return 'future';
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

function buildModelRollup(records, windowMs, slmIndex) {
  // group by (model_id, runtime) — unknown model gets synthetic bucket per runtime
  const buckets = new Map();
  const cutoff = Date.now() - windowMs;

  for (const record of records) {
    const tsMs = toMs(record.ts);
    if (tsMs != null && tsMs < cutoff) continue;

    const rawModel = record.model ? String(record.model).trim() : null;
    const modelId = rawModel || '(unknown-model)';
    const runtime = record.runtime || 'unknown';
    const key = `${modelId}|||${runtime}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        model: modelId,
        runtime,
        calls: 0,
        latencies: [],
        lastSeenTs: null,
        source: classifyModelSource(modelId, slmIndex),
        slmMeta: slmIndex.get(modelId) || null,
      });
    }

    const b = buckets.get(key);
    b.calls += 1;
    if (Number.isFinite(record.duration_ms)) b.latencies.push(record.duration_ms);
    if (record.ts && (!b.lastSeenTs || (toMs(record.ts) || 0) > (toMs(b.lastSeenTs) || 0))) {
      b.lastSeenTs = record.ts;
    }
  }

  return Array.from(buckets.values()).map((b) => {
    const sortedLat = b.latencies.slice().sort((a, c) => a - c);
    const p50 = percentile(sortedLat, 0.5);
    const slm = b.slmMeta;
    return {
      model: b.model,
      source: b.source,
      version: slm ? (slm.version || null) : null,
      calls: b.calls,
      p50_ms: p50 != null ? Math.round(p50) : null,
      last_seen: b.lastSeenTs,
      runtime: b.runtime,
      recipe: slm ? (slm.recipe || null) : null,
      lane: slm ? (slm.lane || null) : null,
      status: slm ? (slm.status || null) : null,
    };
  });
}

// Merge in slm-learning models that have 0 calls (so they always appear).
function mergeSlmZeroRows(rows, slmIndex) {
  const seenModels = new Set(rows.map((r) => r.model));
  const extra = [];
  for (const [modelId, meta] of slmIndex.entries()) {
    if (seenModels.has(modelId)) continue;
    extra.push({
      model: modelId,
      source: 'local-slm',
      version: meta.version || null,
      calls: 0,
      p50_ms: null,
      last_seen: null,
      runtime: 'unknown',
      recipe: meta.recipe || null,
      lane: meta.lane || null,
      status: meta.status || null,
    });
  }
  return [...rows, ...extra];
}

// ── Lightweight gad-log reader for snapshot (time-boxed, no session/trace) ──

/**
 * Read minimal telemetry records from .planning/.gad-log/ only.
 * Scans the most-recent shards first and stops once all shards within
 * windowMs are covered.  Designed to complete in <200ms on local FS.
 *
 * Returns an array of { ts, runtime, model, duration_ms } objects — just
 * enough for buildModelRollup.
 */
function collectGadLogRecordsForSnapshot(baseDir, windowMs) {
  const dir = path.join(baseDir, '.planning', '.gad-log');
  if (!fs.existsSync(dir)) return [];

  const cutoffMs = Date.now() - windowMs;
  const files = fs.readdirSync(dir)
    .filter((n) => n.endsWith('.jsonl'))
    .sort()      // YYYY-MM-DD order — newest is last
    .reverse();

  const records = [];
  for (const name of files) {
    // Bail early if the shard date (from filename) is older than the window.
    // Filenames are typically "YYYY-MM-DD.jsonl" — parse the date portion.
    const dateMatch = name.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      const shardDayEnd = Date.parse(dateMatch[1] + 'T23:59:59Z');
      if (Number.isFinite(shardDayEnd) && shardDayEnd < cutoffMs) break;
    }

    const filePath = path.join(dir, name);
    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry || (entry.type !== 'tool_call' && !entry.cmd)) continue;

      const tsMs = toMs(entry.ts);
      if (tsMs != null && tsMs < cutoffMs) continue;

      records.push({
        ts: entry.ts || null,
        runtime: (entry.runtime && entry.runtime.id) || null,
        model: (entry.runtime && entry.runtime.model) || null,
        duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      });
    }
  }

  return records;
}

// ── Snapshot helper: top-N summary line ──────────────────────────────────

/**
 * Format a p50_ms value as a human-readable latency string.
 * e.g. 653 -> "653ms", 31000 -> "31s"
 */
function fmtLatency(ms) {
  if (ms == null) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${Math.round(ms / 1000)}s`;
}

/**
 * Build a compact MODELS line for the snapshot HEALTH section.
 *
 * Reads from .planning/.gad-log/ only (time-boxed to <200ms).
 * If no data within the window, returns null (caller omits the line).
 *
 * @param {string}  baseDir  - repo root (contains .planning/)
 * @param {number}  windowMs - time window in ms (default 1h = 3600000)
 * @param {number}  topN     - how many models to show (default 3)
 * @returns {string|null}    - formatted line or null if no data
 */
function buildSnapshotModelsLine(baseDir, windowMs = 60 * 60 * 1000, topN = 3) {
  let records;
  try {
    records = collectGadLogRecordsForSnapshot(baseDir, windowMs);
  } catch {
    return null;
  }

  if (!records || records.length === 0) return null;

  const rows = buildModelRollup(records, windowMs, new Map());

  // Sort: calls desc, then model asc
  rows.sort((a, b) => b.calls - a.calls || a.model.localeCompare(b.model));

  // Only keep rows with actual calls
  const active = rows.filter((r) => r.calls > 0).slice(0, topN);
  if (active.length === 0) return null;

  const parts = active.map((r) => {
    const label = r.runtime && r.runtime !== 'unknown' ? r.runtime : r.model;
    const lat = fmtLatency(r.p50_ms);
    return lat ? `${label}=${r.calls} (${lat} p50)` : `${label}=${r.calls}`;
  });

  return `Models:     ${parts.join('  ')}`;
}

module.exports = {
  loadSlmRegistry,
  loadDeltaGraph,
  resolveSlmModelsDir,
  buildSlmIndex,
  buildModelRollup,
  mergeSlmZeroRows,
  classifyModelSource,
  percentile,
  relativeTime,
  toMs,
  fmtLatency,
  collectGadLogRecordsForSnapshot,
  buildSnapshotModelsLine,
};
