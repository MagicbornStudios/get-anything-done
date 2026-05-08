'use strict';
/**
 * lib/archive-purge.cjs — Archive old log/trace shards + safe local purge.
 *
 * Tasks: GAD-T-75-18 (75-18)
 *
 * Finds stale shards across all planning roots:
 *   - .planning/.gad-log/<date>.jsonl
 *   - .planning/.trace-events*.jsonl (trace shards with date prefix)
 *   - datasets/<label>/<date>.jsonl
 *
 * Packages them into an uploadable batch using lib/datasets/remote-hf.cjs
 * or lib/datasets/remote-supabase.cjs, records the archive manifest at
 * .planning/.archive-manifest.jsonl.
 *
 * After archive is confirmed (>24h old in manifest), purge-archived deletes
 * the local copies.
 *
 * Public API:
 *   findOldShards(planningRoot, olderThanMs) → ShardFile[]
 *   buildArchiveBatch(shards) → { files: UploadFile[] }
 *   writeManifest(manifestPath, entries) → void
 *   readManifest(manifestPath) → ManifestEntry[]
 *   isConfirmed(entry, safetyWindowMs) → boolean
 *   purgeConfirmedEntries(manifestPath, safetyWindowMs, opts) → PurgeResult
 *   archiveOldShards(planningRoots, opts) → ArchiveResult
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

// ─── Date helpers ─────────────────────────────────────────────────────────────

const SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

function olderThanMs(filePath, thresholdMs) {
  try {
    const { mtimeMs } = fs.statSync(filePath);
    return Date.now() - mtimeMs > thresholdMs;
  } catch {
    return false;
  }
}

// ─── Shard discovery ─────────────────────────────────────────────────────────

/**
 * @typedef {{ filePath: string, label: string, project: string }} ShardFile
 */

/**
 * Find old shard files under a single planningRoot (absolute path to the
 * .planning/ directory of a project).
 *
 * @param {string} planningRoot — absolute path to .planning/ directory
 * @param {number} olderThanMsThreshold — age threshold in ms
 * @param {string} projectId — human-readable project id for labeling
 * @returns {ShardFile[]}
 */
function findOldShards(planningRoot, olderThanMsThreshold, projectId) {
  const shards = [];

  // 1. .gad-log/*.jsonl
  const gadLogDir = path.join(planningRoot, '.gad-log');
  if (fs.existsSync(gadLogDir)) {
    try {
      for (const name of fs.readdirSync(gadLogDir)) {
        if (!name.endsWith('.jsonl')) continue;
        const abs = path.join(gadLogDir, name);
        if (olderThanMs(abs, olderThanMsThreshold)) {
          shards.push({ filePath: abs, label: `${projectId}/gad-log`, project: projectId });
        }
      }
    } catch {}
  }

  // 2. .trace-events*.jsonl (with date-prefix naming convention)
  // Pattern: .trace-events-<date>.jsonl or .trace-events.jsonl (current, skip)
  try {
    for (const name of fs.readdirSync(planningRoot)) {
      if (!name.startsWith('.trace-events') || !name.endsWith('.jsonl')) continue;
      // Skip the live shard (.trace-events.jsonl without date suffix)
      if (name === '.trace-events.jsonl') continue;
      const abs = path.join(planningRoot, name);
      if (olderThanMs(abs, olderThanMsThreshold)) {
        shards.push({ filePath: abs, label: `${projectId}/trace-events`, project: projectId });
      }
    }
  } catch {}

  // 3. datasets/<label>/<date>.jsonl
  const datasetsDir = path.join(planningRoot, 'datasets');
  if (fs.existsSync(datasetsDir)) {
    try {
      for (const label of fs.readdirSync(datasetsDir)) {
        const labelDir = path.join(datasetsDir, label);
        if (!fs.statSync(labelDir).isDirectory()) continue;
        for (const name of fs.readdirSync(labelDir)) {
          if (!name.endsWith('.jsonl')) continue;
          const abs = path.join(labelDir, name);
          if (olderThanMs(abs, olderThanMsThreshold)) {
            shards.push({ filePath: abs, label: `${projectId}/datasets/${label}`, project: projectId });
          }
        }
      }
    } catch {}
  }

  return shards;
}

/**
 * Find old shards across multiple project roots.
 *
 * @param {Array<{ id: string, planningDir: string, absRootPath: string }>} roots
 * @param {number} olderThanMsThreshold
 * @returns {ShardFile[]}
 */
function findAllShards(roots, olderThanMsThreshold) {
  const all = [];
  for (const root of roots) {
    const planningRoot = path.join(root.absRootPath, root.planningDir || '.planning');
    if (!fs.existsSync(planningRoot)) continue;
    const shards = findOldShards(planningRoot, olderThanMsThreshold, root.id);
    all.push(...shards);
  }
  return all;
}

// ─── Upload batch ─────────────────────────────────────────────────────────────

/**
 * Build upload file list from shard array. Each entry maps filePath → label.
 * @param {ShardFile[]} shards
 * @returns {{ filePath: string, label: string }[]}
 */
function buildArchiveBatch(shards) {
  return shards.map((s) => ({ filePath: s.filePath, label: s.label }));
}

// ─── Manifest I/O ─────────────────────────────────────────────────────────────

/**
 * @typedef {{ filePath: string, label: string, project: string, archivedAt: string, storageKey: string, target: string }} ManifestEntry
 */

/**
 * Append entries to .archive-manifest.jsonl (NDJSON, append-only).
 * @param {string} manifestPath
 * @param {ManifestEntry[]} entries
 */
function writeManifest(manifestPath, entries) {
  const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  fs.appendFileSync(manifestPath, lines, 'utf8');
}

/**
 * Read all entries from .archive-manifest.jsonl.
 * @param {string} manifestPath
 * @returns {ManifestEntry[]}
 */
function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) return [];
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { entries.push(JSON.parse(trimmed)); } catch {}
  }
  return entries;
}

/**
 * Is an archive manifest entry past the safety window?
 * @param {ManifestEntry} entry
 * @param {number} [safetyWindowMs]
 * @returns {boolean}
 */
function isConfirmed(entry, safetyWindowMs = SAFETY_WINDOW_MS) {
  if (!entry.archivedAt) return false;
  const ts = new Date(entry.archivedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts >= safetyWindowMs;
}

// ─── Purge ────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ purged: string[], skipped: string[], errors: Array<{filePath:string, error:string}> }} PurgeResult
 */

/**
 * Purge local files that have passed the safety window.
 *
 * @param {string} manifestPath — path to .archive-manifest.jsonl
 * @param {number} [safetyWindowMs]
 * @param {{ dryRun?: boolean, log?: (msg:string) => void }} [opts]
 * @returns {PurgeResult}
 */
function purgeConfirmedEntries(manifestPath, safetyWindowMs = SAFETY_WINDOW_MS, opts = {}) {
  const { dryRun = false, log = () => {} } = opts;
  const entries = readManifest(manifestPath);
  const result = { purged: [], skipped: [], errors: [] };

  for (const entry of entries) {
    if (!entry.filePath) continue;
    if (!fs.existsSync(entry.filePath)) {
      log(`skip (already absent): ${entry.filePath}`);
      result.skipped.push(entry.filePath);
      continue;
    }
    if (!isConfirmed(entry, safetyWindowMs)) {
      log(`skip (safety window): ${entry.filePath} archived at ${entry.archivedAt}`);
      result.skipped.push(entry.filePath);
      continue;
    }
    if (dryRun) {
      log(`would purge: ${entry.filePath}`);
      result.purged.push(entry.filePath);
      continue;
    }
    try {
      fs.unlinkSync(entry.filePath);
      log(`purged: ${entry.filePath}`);
      result.purged.push(entry.filePath);
    } catch (e) {
      log(`error purging ${entry.filePath}: ${e.message}`);
      result.errors.push({ filePath: entry.filePath, error: e.message });
    }
  }

  return result;
}

// ─── Archive orchestrator ─────────────────────────────────────────────────────

/**
 * @typedef {{ shards: ShardFile[], uploaded: object[], skipped: object[], errors: object[], manifestEntries: ManifestEntry[] }} ArchiveResult
 */

/**
 * Full archive pass: find shards, upload to target, record manifest.
 *
 * @param {Array<{ id: string, absRootPath: string, planningDir?: string }>} roots
 * @param {{
 *   olderThanMs: number,
 *   target: 'hf-hub'|'supabase',
 *   dryRun?: boolean,
 *   manifestPath: string,
 *   log?: (msg: string) => void,
 *   _uploaderOverride?: object,  // test injection point
 * }} opts
 * @returns {Promise<ArchiveResult>}
 */
async function archiveOldShards(roots, opts) {
  const {
    olderThanMs: threshold,
    target,
    dryRun = false,
    manifestPath,
    log = () => {},
    _uploaderOverride = null,
  } = opts;

  const shards = findAllShards(roots, threshold);
  log(`Found ${shards.length} shard(s) older than threshold`);

  if (shards.length === 0) {
    return { shards: [], uploaded: [], skipped: [], errors: [], manifestEntries: [] };
  }

  if (dryRun) {
    log('Dry-run: listing shards that WOULD be archived:');
    for (const s of shards) log(`  [${s.project}] ${s.filePath}`);
    return { shards, uploaded: [], skipped: shards.map((s) => s.filePath), errors: [], manifestEntries: [] };
  }

  const files = buildArchiveBatch(shards);

  let uploadResult;
  if (_uploaderOverride) {
    // Test injection point: mock uploader
    uploadResult = await _uploaderOverride.upload({ files, target, log });
  } else if (target === 'hf-hub') {
    const { pushToHfHub } = require('./datasets/remote-hf.cjs');
    uploadResult = await pushToHfHub({
      files,
      commitSummary: `gad health archive-old-shards @ ${new Date().toISOString()}`,
      log,
    });
  } else if (target === 'supabase') {
    const { pushToSupabase } = require('./datasets/remote-supabase.cjs');
    uploadResult = await pushToSupabase({
      files,
      bucket: process.env.SUPABASE_ARCHIVE_BUCKET || 'gad-archive',
      log,
    });
  } else {
    throw new Error(`Unknown target: ${target}. Use hf-hub or supabase.`);
  }

  const { uploaded = [], skipped = [], errors = [] } = uploadResult;

  // Build manifest entries for successfully uploaded files
  const now = new Date().toISOString();
  const uploadedPaths = new Set(uploaded.map((u) => u.filePath || u.storageKey));

  const manifestEntries = [];
  for (const shard of shards) {
    const match = uploaded.find((u) => u.filePath === shard.filePath);
    if (!match) continue;
    manifestEntries.push({
      filePath: shard.filePath,
      label: shard.label,
      project: shard.project,
      archivedAt: now,
      storageKey: match.storageKey || match.repoPath || '',
      target,
    });
  }

  if (manifestEntries.length > 0) {
    writeManifest(manifestPath, manifestEntries);
    log(`Manifest updated: ${manifestEntries.length} entries → ${manifestPath}`);
  }

  return { shards, uploaded, skipped, errors, manifestEntries };
}

module.exports = {
  findOldShards,
  findAllShards,
  buildArchiveBatch,
  writeManifest,
  readManifest,
  isConfirmed,
  purgeConfirmedEntries,
  archiveOldShards,
  SAFETY_WINDOW_MS,
};
