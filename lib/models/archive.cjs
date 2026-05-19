'use strict';
/**
 * lib/models/archive.cjs — HF archive policy (phase 248-10).
 *
 * Wraps lib/retraining/archiver.cjs with a policy layer for the
 * `hf-archive-tick` desk-hook. Identifies models that are:
 *   - status != 'archived' (already archived → skip)
 *   - idle for more than the configured threshold (default 30 days)
 *     where "idle" = max(last_train_at, last_bench_at, promoted_at, created_at)
 *
 * After the archiver succeeds, the model's registry status flips to
 * 'archived' and a manifest entry is written to
 *   .planning/models/archive-manifest.json
 * for rehydrate auditing.
 *
 * Pure policy decision — does NOT call HF directly. That belongs to the
 * archiver. Pure policy = unit-testable without HF token.
 *
 * Exports:
 *   IDLE_THRESHOLD_DAYS — default 30
 *   ARCHIVE_MANIFEST_RELPATH
 *   modelIdleDays(model, now?) -> number | null
 *   isStale(model, opts?) -> boolean
 *   selectArchiveCandidates(projectRoot, opts?) -> ModelEntry[]
 *   readArchiveManifest(projectRoot) -> ManifestEntry[]
 *   appendArchiveManifest(projectRoot, entry) -> void
 *   archivePolicy(projectRoot, opts?) -> { archived:[], skipped:[], errors:[] }
 */

const fs = require('fs');
const path = require('path');

const IDLE_THRESHOLD_DAYS = 30;
const ARCHIVE_MANIFEST_RELPATH = path.join('.planning', 'models', 'archive-manifest.json');

function resolveSetting(key, fallback) {
  try {
    const { getSetting } = require('../settings-registry.cjs');
    const v = getSetting(key);
    return (v === undefined || v === null) ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

/**
 * Compute idle days for a model. Returns null when no timestamps available.
 * "Idle" is max(last_train_at, last_bench_at, promoted_at, created_at)
 * — whichever is most recent represents the last touch of the model.
 */
function modelIdleDays(model, nowMs) {
  if (!model) return null;
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const stamps = [
    model.last_train_at,
    model.last_bench_at,
    model.promoted_at,
    model.created_at,
  ].filter(Boolean);
  if (stamps.length === 0) return null;
  let latest = 0;
  for (const s of stamps) {
    const t = Date.parse(s);
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (latest <= 0) return null;
  return Math.floor((now - latest) / (24 * 60 * 60 * 1000));
}

/**
 * Should this model be archived per the policy?
 * Active models are excluded by default (operator must demote first).
 */
function isStale(model, opts = {}) {
  if (!model) return false;
  const status = model.status || 'staging';
  if (status === 'archived') return false;
  if (status === 'active' && !opts.includeActive) return false;
  const threshold = (typeof opts.idleDays === 'number')
    ? opts.idleDays
    : resolveSetting('training.archive_idle_days', IDLE_THRESHOLD_DAYS);
  const idle = modelIdleDays(model, opts.nowMs);
  if (idle == null) return false;
  return idle >= threshold;
}

function selectArchiveCandidates(projectRoot, opts = {}) {
  const registry = opts._registry || require('./registry.cjs');
  const all = registry.listModels(projectRoot);
  return all.filter((m) => isStale(m, opts));
}

function archiveManifestPath(projectRoot) {
  return path.join(projectRoot, ARCHIVE_MANIFEST_RELPATH);
}

function readArchiveManifest(projectRoot) {
  const p = archiveManifestPath(projectRoot);
  if (!fs.existsSync(p)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function appendArchiveManifest(projectRoot, entry) {
  const p = archiveManifestPath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const existing = readArchiveManifest(projectRoot);
  existing.push(entry);
  fs.writeFileSync(p, JSON.stringify(existing, null, 2) + '\n', 'utf8');
}

/**
 * Run the archive policy: list candidates, archive each via the archiver lib,
 * write manifest entries, flip registry status to 'archived'.
 *
 * @param {string} projectRoot
 * @param {object} [opts]
 * @param {number} [opts.idleDays]    threshold override
 * @param {boolean} [opts.dryRun]     don't touch HF / registry / manifest
 * @param {boolean} [opts.includeActive]  include active models in candidates
 * @param {string}  [opts.tokenEnv]   env var for HF token (default HF_TOKEN)
 * @param {boolean} [opts.forceLocal] skip HF; archive locally only
 * @param {string}  [opts.repo]       HF repo override
 * @param {object}  [opts._registry]  injected registry (test seam)
 * @param {object}  [opts._archiver]  injected archiver (test seam)
 * @returns {{archived: ManifestEntry[], skipped: SkipEntry[], errors: ErrEntry[]}}
 */
function archivePolicy(projectRoot, opts = {}) {
  const registry = opts._registry || require('./registry.cjs');
  const archiver = opts._archiver || require('../retraining/archiver.cjs');
  const candidates = selectArchiveCandidates(projectRoot, opts);

  const archived = [];
  const skipped = [];
  const errors = [];

  for (const model of candidates) {
    const idle = modelIdleDays(model, opts.nowMs);

    if (opts.dryRun) {
      skipped.push({
        id: model.id,
        kind: model.kind,
        idle_days: idle,
        reason: 'dry-run',
      });
      continue;
    }

    let result;
    try {
      result = archiver.archiveModel(projectRoot, model.id, {
        tokenEnv: opts.tokenEnv,
        forceLocal: !!opts.forceLocal,
        repo: opts.repo,
      });
    } catch (err) {
      // CLI_MISSING / NO_TOKEN / NO_REPO → fall back to local archive (best
      // effort) to ensure idle models DO get a manifest entry.
      const recoverable = new Set(['CLI_MISSING', 'NO_TOKEN', 'NO_REPO', 'NO_ARTIFACT', 'CLI_FAILED']);
      if (recoverable.has(err.code)) {
        try {
          result = archiver.archiveModel(projectRoot, model.id, { forceLocal: true });
        } catch (err2) {
          errors.push({ id: model.id, code: err2.code || 'ARCHIVE_FAILED', error: String(err2?.message ?? err2) });
          continue;
        }
      } else {
        errors.push({ id: model.id, code: err.code || 'ARCHIVE_FAILED', error: String(err?.message ?? err) });
        continue;
      }
    }

    // Flip registry status to 'archived'.
    let registryEntry;
    try {
      registryEntry = registry.archiveModel(projectRoot, model.id);
    } catch (err) {
      errors.push({ id: model.id, code: 'REGISTRY_UPDATE_FAILED', error: String(err?.message ?? err) });
    }

    const manifestEntry = {
      id: model.id,
      kind: model.kind,
      idle_days: idle,
      archived_at: (registryEntry && registryEntry.archived_at) || new Date().toISOString(),
      mode: result.mode,
      repo: result.repo || null,
      repoUrl: result.repoUrl || null,
      pathInRepo: result.pathInRepo || null,
      archiveDir: result.archiveDir || null,
      commitSha: result.commitSha || null,
    };
    appendArchiveManifest(projectRoot, manifestEntry);
    archived.push(manifestEntry);
  }

  return { archived, skipped, errors };
}

module.exports = {
  IDLE_THRESHOLD_DAYS,
  ARCHIVE_MANIFEST_RELPATH,
  modelIdleDays,
  isStale,
  selectArchiveCandidates,
  archiveManifestPath,
  readArchiveManifest,
  appendArchiveManifest,
  archivePolicy,
};
