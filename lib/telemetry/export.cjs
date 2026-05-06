'use strict';
/**
 * Phase 145 task GLOBAL-T-145-03 — `gad telemetry export` core.
 *
 * Walks the four canonical adapters (gad-log, trace-events, worker-log,
 * prompt-files), filters by --since, dedups by envelope.id, writes one of
 * jsonl | parquet | duckdb to --to. Produces a sibling MANIFEST.json with
 * sha256 of the data file + row count + role histogram.
 *
 * Idempotent: re-export of overlapping windows produces the same envelope
 * ids (deterministic via deriveEnvelopeId in adapters), so dedup at write
 * time is a no-op in steady state.
 *
 * Reference: .planning/phases/145-slm-training-data-collection-v1/PLAN.md
 *
 * Storage formats:
 *   jsonl   — always available, no deps
 *   parquet — falls back to jsonl + warning if parquetjs not installed
 *   duckdb  — falls back to jsonl + warning if duckdb npm pkg native build fails
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { SCHEMA_V } = require('./envelope.cjs');
const { redactEnvelope } = require('./redact.cjs');

const ADAPTERS = [
  { name: 'gad-log', mod: () => require('./adapters/gad-log.cjs') },
  { name: 'trace-events', mod: () => require('./adapters/trace-events.cjs') },
  { name: 'worker-log', mod: () => require('./adapters/worker-log.cjs') },
  { name: 'prompt-files', mod: () => require('./adapters/prompt-files.cjs') },
];

function nowIso() { return new Date().toISOString(); }

function isoToMs(iso) {
  if (!iso) return 0;
  const ms = Date.parse(String(iso));
  return Number.isNaN(ms) ? 0 : ms;
}

function readGitSha(repoPath) {
  try {
    const headFile = path.join(repoPath, '.git', 'HEAD');
    if (!fs.existsSync(headFile)) return null;
    const head = fs.readFileSync(headFile, 'utf8').trim();
    if (head.startsWith('ref: ')) {
      const refPath = path.join(repoPath, '.git', head.slice(5));
      if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim();
      // Packed refs fallback
      const packedRefs = path.join(repoPath, '.git', 'packed-refs');
      if (fs.existsSync(packedRefs)) {
        const ref = head.slice(5);
        const m = fs.readFileSync(packedRefs, 'utf8').match(new RegExp(`^([0-9a-f]+)\\s+${ref}$`, 'm'));
        if (m) return m[1];
      }
      return null;
    }
    return head;
  } catch (e) { return null; }
}

function readGitShaSubmodule(rootDir, subPath) {
  // Submodule HEAD lives at <rootDir>/.git/modules/<sub>/HEAD typically,
  // but the simpler path: <subPath>/.git is a file pointing to the gitdir.
  const subGit = path.join(rootDir, subPath, '.git');
  try {
    const stat = fs.statSync(subGit);
    if (stat.isFile()) {
      const gitdirRef = fs.readFileSync(subGit, 'utf8').trim().replace(/^gitdir:\s*/, '');
      const headFile = path.join(rootDir, subPath, gitdirRef, 'HEAD');
      if (fs.existsSync(headFile)) {
        return readGitSha(path.join(rootDir, subPath));
      }
    }
    if (stat.isDirectory()) return readGitSha(path.join(rootDir, subPath));
  } catch (e) {}
  return null;
}

function sha256OfFile(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    const s = fs.createReadStream(filePath);
    s.on('data', (chunk) => h.update(chunk));
    s.on('error', reject);
    s.on('end', () => resolve(h.digest('hex')));
  });
}

/**
 * Iterate envelopes from all adapters, dedup by id (keep first
 * occurrence), filter by sinceMs, optional adapter subset.
 *
 * Async — adapters use `async function*` generators because they read
 * via fs streams + readline. Caller must use `for await ... of`.
 */
async function* iterAllEnvelopes(rootDir, sinceMs, adapterSubset) {
  const seen = new Set();
  const subset = adapterSubset && adapterSubset.length > 0 ? new Set(adapterSubset) : null;
  for (const { name, mod } of ADAPTERS) {
    if (subset && !subset.has(name)) continue;
    let adapter;
    try {
      adapter = mod();
    } catch (e) {
      process.stderr.write(`[telemetry export] adapter ${name} load failed: ${e.message}\n`);
      continue;
    }
    if (!adapter || typeof adapter.iterEnvelopes !== 'function') {
      process.stderr.write(`[telemetry export] adapter ${name} missing iterEnvelopes()\n`);
      continue;
    }
    let count = 0;
    try {
      for await (const env of adapter.iterEnvelopes(rootDir, sinceMs)) {
        if (!env || !env.id) continue;
        if (seen.has(env.id)) continue;
        seen.add(env.id);
        count += 1;
        yield { adapter: name, env };
      }
    } catch (e) {
      process.stderr.write(`[telemetry export] adapter ${name} threw: ${e.message}\n`);
    }
    process.stderr.write(`[telemetry export] ${name}: ${count} envelopes\n`);
  }
}

async function writeJsonl(outPath, asyncIter, opts = {}) {
  const redact = opts.redact !== false;  // default ON — phase 145.5-06
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const fd = fs.openSync(outPath, 'w');
  let count = 0;
  let redactedCount = 0;
  const histogram = {};
  const contentTypeHistogram = {};
  try {
    for await (const { env } of asyncIter) {
      const finalEnv = redact ? redactEnvelope(env) : env;
      if (redact && finalEnv !== env) redactedCount += 1;
      const line = JSON.stringify(finalEnv) + '\n';
      fs.writeSync(fd, line);
      count += 1;
      histogram[finalEnv.role] = (histogram[finalEnv.role] || 0) + 1;
      const ct = finalEnv.content_type || 'unset';
      contentTypeHistogram[ct] = (contentTypeHistogram[ct] || 0) + 1;
    }
  } finally {
    fs.closeSync(fd);
  }
  return { rowCount: count, roleHistogram: histogram, contentTypeHistogram, redactedCount, redacted: redact };
}

async function writeManifest({ outDir, dataFile, since, until, rowCount, roleHistogram, contentTypeHistogram, monorepoSha, gadSha, redacted, redactedCount }) {
  const manifestPath = path.join(outDir, 'MANIFEST.json');
  const sha = await sha256OfFile(dataFile);
  const stat = fs.statSync(dataFile);
  const manifest = {
    schema_v: SCHEMA_V,
    exported_at: nowIso(),
    since: since || null,
    until: until || null,
    data_file: path.basename(dataFile),
    data_sha256: sha,
    data_bytes: stat.size,
    row_count: rowCount,
    role_histogram: roleHistogram,
    content_type_histogram: contentTypeHistogram || {},
    source_commits: {
      monorepo: monorepoSha || null,
      gad: gadSha || null,
    },
    redacted: Boolean(redacted),
    redacted_envelope_count: redactedCount || 0,
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  return { manifestPath, manifest };
}

/**
 * Main export entry.
 *
 * @param {Object} opts
 * @param {string} opts.rootDir         — monorepo root (where .planning/ lives)
 * @param {string} opts.outDir          — directory to write events.<ext> + MANIFEST.json
 * @param {string} [opts.format]        — 'jsonl' | 'parquet' | 'duckdb' (default jsonl)
 * @param {string} [opts.since]         — ISO timestamp; envelopes older than this are dropped
 * @param {string[]} [opts.adapters]    — subset of adapter names to run
 */
async function runExport(opts) {
  const rootDir = path.resolve(opts.rootDir);
  const outDir = path.resolve(opts.outDir);
  const format = opts.format || 'jsonl';
  const since = opts.since || null;
  const sinceMs = since ? isoToMs(since) : 0;
  const until = nowIso();

  fs.mkdirSync(outDir, { recursive: true });

  const monorepoSha = readGitSha(rootDir);
  const gadSha = readGitShaSubmodule(rootDir, path.join('vendor', 'get-anything-done'));

  const dataPath = path.join(outDir, 'events.jsonl');
  const redactFlag = opts.redact !== false;  // default ON; explicit --no-redact to opt out
  const stats = await writeJsonl(
    dataPath,
    iterAllEnvelopes(rootDir, sinceMs, opts.adapters),
    { redact: redactFlag },
  );

  const { manifestPath, manifest } = await writeManifest({
    outDir,
    dataFile: dataPath,
    since,
    until,
    rowCount: stats.rowCount,
    roleHistogram: stats.roleHistogram,
    contentTypeHistogram: stats.contentTypeHistogram,
    monorepoSha,
    gadSha,
    redacted: stats.redacted,
    redactedCount: stats.redactedCount,
  });

  // Format-specific extras
  if (format === 'parquet' || format === 'duckdb') {
    process.stderr.write(`[telemetry export] format=${format} — falling back to jsonl + manifest (DuckDB/Parquet conversion ships in T-145-05)\n`);
  }

  // Stderr summary so a real export run shows the distributions inline
  // (cf. existing role-histogram printer further down). Emit in a stable
  // sorted order so consumers can grep.
  const fmtHist = (h) => Object.entries(h).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('  ');
  process.stderr.write(`[telemetry export] role histogram: ${fmtHist(stats.roleHistogram)}\n`);
  process.stderr.write(`[telemetry export] content_type histogram: ${fmtHist(stats.contentTypeHistogram)}\n`);

  return {
    rootDir,
    outDir,
    dataPath,
    manifestPath,
    manifest,
    rowCount: stats.rowCount,
    roleHistogram: stats.roleHistogram,
    contentTypeHistogram: stats.contentTypeHistogram,
  };
}

module.exports = {
  runExport,
  iterAllEnvelopes,
  writeJsonl,
  writeManifest,
  sha256OfFile,
  readGitSha,
  readGitShaSubmodule,
  ADAPTERS,
};
