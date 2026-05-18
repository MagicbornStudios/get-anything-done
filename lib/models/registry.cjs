'use strict';
/**
 * lib/models/registry.cjs — read/write/upsert/archive for the model registry.
 *
 * Registry lives at <projectRoot>/.planning/models/registry.json
 * Schema: { models: ModelEntry[] }
 *
 * ModelEntry shape:
 *   id, kind (llm|mid|knn|intent), base, precision (fp16|q4_K_M|q5_K_M|int8),
 *   adapters[], created_at, promoted_at, archived_at,
 *   bench_results[{set, elo, ts}],
 *   dataset_volume_at_train_mb, level_at_train,
 *   last_train_at, last_bench_at, status (active|staging|archived)
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_RELPATH = path.join('.planning', 'models', 'registry.json');

function registryPath(projectRoot) {
  return path.join(projectRoot, REGISTRY_RELPATH);
}

function readRegistry(projectRoot) {
  const p = registryPath(projectRoot);
  if (!fs.existsSync(p)) return { models: [] };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return { models: [] };
  }
}

function writeRegistry(projectRoot, data) {
  const p = registryPath(projectRoot);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * List all models, optionally filtered by id or kind.
 */
function listModels(projectRoot, { id, kind } = {}) {
  const reg = readRegistry(projectRoot);
  let models = reg.models;
  if (id) models = models.filter((m) => m.id === id);
  if (kind) models = models.filter((m) => m.kind === kind);
  return models;
}

/**
 * Get one model by id. Returns null if not found.
 */
function getModel(projectRoot, id) {
  const reg = readRegistry(projectRoot);
  return reg.models.find((m) => m.id === id) || null;
}

/**
 * Upsert a model entry. Merges patch into existing record or inserts new.
 */
function upsertModel(projectRoot, id, patch) {
  const reg = readRegistry(projectRoot);
  const idx = reg.models.findIndex((m) => m.id === id);
  const now = new Date().toISOString();
  if (idx === -1) {
    reg.models.push({
      id,
      kind: 'llm',
      base: null,
      precision: 'q4_K_M',
      adapters: [],
      created_at: now,
      promoted_at: null,
      archived_at: null,
      bench_results: [],
      dataset_volume_at_train_mb: null,
      level_at_train: null,
      last_train_at: null,
      last_bench_at: null,
      status: 'staging',
      ...patch,
    });
  } else {
    reg.models[idx] = { ...reg.models[idx], ...patch };
  }
  writeRegistry(projectRoot, reg);
  return getModel(projectRoot, id);
}

/**
 * Archive a model: set archived_at, status='archived'.
 */
function archiveModel(projectRoot, id) {
  return upsertModel(projectRoot, id, {
    archived_at: new Date().toISOString(),
    status: 'archived',
  });
}

/**
 * Promote a model: set promoted_at, status='active'.
 * Demotes any previous active model of the same kind to 'staging'.
 */
function promoteModel(projectRoot, id) {
  const reg = readRegistry(projectRoot);
  const target = reg.models.find((m) => m.id === id);
  if (!target) throw new Error(`Model not found: ${id}`);
  const now = new Date().toISOString();
  // demote current active of same kind
  for (const m of reg.models) {
    if (m.kind === target.kind && m.status === 'active' && m.id !== id) {
      m.status = 'staging';
    }
  }
  const idx = reg.models.findIndex((m) => m.id === id);
  reg.models[idx] = { ...target, promoted_at: now, status: 'active' };
  writeRegistry(projectRoot, reg);
  return reg.models[idx];
}

/**
 * Append a bench result to a model's bench_results array.
 */
function recordBenchResult(projectRoot, id, { set, elo }) {
  const model = getModel(projectRoot, id);
  if (!model) throw new Error(`Model not found: ${id}`);
  const entry = { set, elo, ts: new Date().toISOString() };
  const bench_results = [...(model.bench_results || []), entry];
  return upsertModel(projectRoot, id, { bench_results, last_bench_at: entry.ts });
}

/**
 * Get current ELO for a model (latest bench result for a given set, or overall latest).
 */
function getCurrentElo(projectRoot, id, benchSet) {
  const model = getModel(projectRoot, id);
  if (!model || !model.bench_results || model.bench_results.length === 0) return null;
  const results = benchSet
    ? model.bench_results.filter((r) => r.set === benchSet)
    : model.bench_results;
  if (results.length === 0) return null;
  return results[results.length - 1].elo;
}

module.exports = {
  registryPath,
  readRegistry,
  writeRegistry,
  listModels,
  getModel,
  upsertModel,
  archiveModel,
  promoteModel,
  recordBenchResult,
  getCurrentElo,
};
