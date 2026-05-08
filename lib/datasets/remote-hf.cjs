'use strict';
/**
 * lib/datasets/remote-hf.cjs — HuggingFace Hub Datasets upload helper.
 *
 * Uploads labeled dataset JSONL files to a HuggingFace Datasets repo via the
 * Hub commit API. Mirrors the structure of remote-supabase.cjs so adapters
 * are interchangeable behind `gad datasets push-remote --target hf-hub`.
 *
 * Decision: GLOBAL-D-312 (8-layer arch — layer 5 daemons feed layer 8 trace
 * capture; this is the egress path for trained-model-ready corpora).
 *
 * Env vars:
 *   HF_TOKEN              — HuggingFace API token with `write` scope
 *   HF_DATASETS_REPO      — Target dataset repo, e.g. "magicbornstudios/gad-traces"
 *
 * Storage layout in the repo:
 *   data/<label>/<filename>.jsonl    — e.g. data/tool-use/2026-05-08.jsonl
 *
 * Loadable via:
 *   from datasets import load_dataset
 *   ds = load_dataset("magicbornstudios/gad-traces", data_files="data/tool-use/*.jsonl")
 *
 * Uses node:https only (no new npm dependency). The HF Hub commit API takes
 * NDJSON-encoded operations; small JSONL files (<50MB) ship inline as base64;
 * LFS path is not implemented in v1 (will surface error if file too large).
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const HF_HOST = 'huggingface.co';
const LFS_THRESHOLD_BYTES = 10 * 1024 * 1024;  // 10MB — HF docs recommend LFS above this
const HARD_INLINE_LIMIT_BYTES = 45 * 1024 * 1024;  // 45MB — practical ceiling for inline base64

// ─── Credential resolution ────────────────────────────────────────────────────

function resolveCredentials() {
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
  const hfRepo = process.env.HF_DATASETS_REPO;

  if (!hfToken || !hfRepo) {
    throw new Error(
      'HuggingFace credentials missing — set HF_TOKEN + HF_DATASETS_REPO ' +
      'or use `gad ask byok` to capture them.\n' +
      '  HF_TOKEN          — token with "write" scope (https://huggingface.co/settings/tokens)\n' +
      '  HF_DATASETS_REPO  — target repo, e.g. "magicbornstudios/gad-traces"',
    );
  }
  return { hfToken, hfRepo };
}

/**
 * Soft probe: does the env have both required HF creds?
 * Used by `gad datasets curate --auto-push auto` to decide silently.
 */
function hasCredentials() {
  return Boolean((process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN) && process.env.HF_DATASETS_REPO);
}

// ─── HTTPS helper ─────────────────────────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, headers: res.headers, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── Repo existence check (best-effort) ───────────────────────────────────────

async function ensureRepoExists({ hfToken, hfRepo, log }) {
  // GET /api/datasets/<repo> — 200 means exists, 404 means create
  const opts = {
    hostname: HF_HOST,
    port: 443,
    path: `/api/datasets/${hfRepo}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${hfToken}` },
  };
  const { statusCode } = await httpsRequest(opts);
  if (statusCode >= 200 && statusCode < 300) return { existed: true };
  if (statusCode === 404) {
    log(`hf-hub: repo "${hfRepo}" not found — creating as private dataset repo`);
    const createBody = JSON.stringify({
      type: 'dataset',
      name: hfRepo.split('/').slice(-1)[0],
      organization: hfRepo.includes('/') ? hfRepo.split('/')[0] : undefined,
      private: true,
    });
    const createOpts = {
      hostname: HF_HOST,
      port: 443,
      path: '/api/repos/create',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createBody),
      },
    };
    const { statusCode: createStatus, body: createBody2 } = await httpsRequest(createOpts, createBody);
    if (createStatus >= 200 && createStatus < 300) {
      log(`hf-hub: created repo ${hfRepo}`);
      return { existed: false, created: true };
    }
    throw new Error(`hf-hub: failed to create repo ${hfRepo} status=${createStatus}: ${createBody2.slice(0, 300)}`);
  }
  if (statusCode === 401 || statusCode === 403) {
    throw new Error(`hf-hub: auth rejected for ${hfRepo} status=${statusCode} — check HF_TOKEN scope (needs "write")`);
  }
  // Any other status: warn but proceed; commit endpoint will surface the real error
  log(`hf-hub: repo check returned status=${statusCode}; proceeding with commit anyway`);
  return { existed: null };
}

// ─── Commit one batch via NDJSON ──────────────────────────────────────────────

/**
 * Build the NDJSON body for a HuggingFace commit operation.
 * Each line is one JSON object describing a header or file op.
 * Reference: https://huggingface.co/docs/hub/api#commit-api
 */
function buildCommitNdjson(summary, fileOps) {
  const lines = [];
  lines.push(JSON.stringify({ key: 'header', value: { summary, description: '' } }));
  for (const op of fileOps) {
    lines.push(JSON.stringify({
      key: 'file',
      value: {
        content: op.contentBase64,
        path: op.repoPath,
        encoding: 'base64',
      },
    }));
  }
  return lines.join('\n');
}

async function commitBatch({ hfToken, hfRepo, fileOps, summary, log }) {
  const ndjson = buildCommitNdjson(summary, fileOps);
  const body = Buffer.from(ndjson, 'utf8');

  const opts = {
    hostname: HF_HOST,
    port: 443,
    path: `/api/datasets/${hfRepo}/commit/main`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/x-ndjson',
      'Content-Length': body.length,
    },
  };

  const { statusCode, body: respBody } = await httpsRequest(opts, body);
  if (statusCode >= 200 && statusCode < 300) {
    log(`hf-hub: commit ok (${fileOps.length} files, ${body.length} bytes total)`);
    return { ok: true };
  }
  log(`hf-hub: commit failed status=${statusCode}: ${respBody.slice(0, 300)}`);
  return { ok: false, statusCode, body: respBody };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload dataset files to a HuggingFace Datasets repo.
 *
 * @param {object} params
 * @param {{ filePath: string, label: string }[]} params.files
 * @param {string} [params.repo]           - Override env HF_DATASETS_REPO
 * @param {string} [params.token]          - Override env HF_TOKEN
 * @param {string} [params.commitSummary]  - Defaults to "gad datasets push-remote @ <ts>"
 * @param {(msg: string) => void} params.log
 *
 * @returns {Promise<{ uploaded: object[], skipped: object[], errors: object[] }>}
 */
async function pushToHfHub({ files, repo, token, commitSummary, log }) {
  const creds = (() => {
    if (repo && token) return { hfRepo: repo, hfToken: token };
    const env = resolveCredentials();
    return { hfRepo: repo || env.hfRepo, hfToken: token || env.hfToken };
  })();

  const results = { uploaded: [], skipped: [], errors: [] };

  if (!files || files.length === 0) {
    log('hf-hub: no files to upload');
    return results;
  }

  // Build per-file ops, base64-encoded inline (LFS path TODO)
  const fileOps = [];
  for (const f of files) {
    let content;
    try {
      content = fs.readFileSync(f.filePath);
    } catch (e) {
      log(`hf-hub: cannot read ${f.filePath}: ${e.message}`);
      results.errors.push({ filePath: f.filePath, label: f.label, error: e.message });
      continue;
    }
    if (content.length > HARD_INLINE_LIMIT_BYTES) {
      log(`hf-hub: skip ${f.filePath} — ${content.length} bytes exceeds inline limit ${HARD_INLINE_LIMIT_BYTES}; LFS upload not yet implemented`);
      results.errors.push({ filePath: f.filePath, label: f.label, error: 'file too large for inline upload (LFS not implemented)' });
      continue;
    }
    if (content.length > LFS_THRESHOLD_BYTES) {
      log(`hf-hub: WARN ${f.filePath} is ${content.length} bytes — consider LFS in future (uploading inline anyway)`);
    }
    const repoPath = `data/${f.label}/${path.basename(f.filePath)}`;
    fileOps.push({
      filePath: f.filePath,
      label: f.label,
      repoPath,
      contentBase64: content.toString('base64'),
      bytes: content.length,
    });
  }

  if (fileOps.length === 0) {
    log('hf-hub: no eligible files to commit');
    return results;
  }

  log(`hf-hub: pushing ${fileOps.length} file(s) to "${creds.hfRepo}"`);

  // Best-effort repo existence check / auto-create
  try {
    await ensureRepoExists({ hfToken: creds.hfToken, hfRepo: creds.hfRepo, log });
  } catch (e) {
    log(`hf-hub: ${e.message}`);
    for (const op of fileOps) {
      results.errors.push({ filePath: op.filePath, label: op.label, error: e.message });
    }
    return results;
  }

  const summary = commitSummary || `gad datasets push-remote @ ${new Date().toISOString()}`;

  // Single commit batches multiple files. If batch fails, fall back to per-file
  // commits so a single bad file doesn't block the rest.
  const batchResult = await commitBatch({
    hfToken: creds.hfToken,
    hfRepo: creds.hfRepo,
    fileOps,
    summary,
    log,
  });

  if (batchResult.ok) {
    for (const op of fileOps) {
      results.uploaded.push({ filePath: op.filePath, label: op.label, storageKey: op.repoPath, bytes: op.bytes });
    }
    return results;
  }

  log(`hf-hub: batch commit failed; retrying per-file`);
  for (const op of fileOps) {
    const single = await commitBatch({
      hfToken: creds.hfToken,
      hfRepo: creds.hfRepo,
      fileOps: [op],
      summary: `${summary} (single-file retry: ${op.repoPath})`,
      log,
    });
    if (single.ok) {
      results.uploaded.push({ filePath: op.filePath, label: op.label, storageKey: op.repoPath, bytes: op.bytes });
    } else {
      results.errors.push({
        filePath: op.filePath,
        label: op.label,
        storageKey: op.repoPath,
        error: `HTTP ${single.statusCode}: ${(single.body || '').slice(0, 300)}`,
      });
    }
  }

  return results;
}

module.exports = { pushToHfHub, hasCredentials };
