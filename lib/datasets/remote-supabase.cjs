'use strict';
/**
 * lib/datasets/remote-supabase.cjs — Supabase Storage upload helper (Phase 170).
 *
 * Uploads labeled dataset JSONL files to a Supabase Storage bucket.
 *
 * Env vars:
 *   SUPABASE_URL             — Project URL (e.g. https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY — Service role key (NOT anon key; needed for storage writes)
 *
 * If @supabase/supabase-js is absent, falls back to direct REST via node:https.
 * If env vars are absent, errors with a clear actionable message.
 *
 * Storage key format: <label>/<filename>  (e.g. tool-use/2026-05-07.jsonl)
 */

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const url = require('node:url');

// ─── Supabase client resolution ───────────────────────────────────────────────

/**
 * Attempt to load @supabase/supabase-js. Returns the createClient fn or null.
 * The package lives in vendor/get-anything-done/node_modules/@supabase/supabase-js.
 */
function tryLoadSupabaseJs() {
  try {
    // Resolve relative to this file so it finds submodule node_modules
    const modPath = require.resolve('@supabase/supabase-js', { paths: [__dirname] });
    return require(modPath).createClient;
  } catch (_) {
    return null;
  }
}

// ─── Credential resolution ────────────────────────────────────────────────────

function resolveCredentials() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase credentials missing — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ' +
      'or use `gad ask byok` to capture them.\n' +
      '  SUPABASE_URL             — your project URL (https://xxx.supabase.co)\n' +
      '  SUPABASE_SERVICE_ROLE_KEY — service role key (not the anon key)',
    );
  }
  return { supabaseUrl, supabaseKey };
}

// ─── Upload via @supabase/supabase-js ────────────────────────────────────────

async function uploadViaClient(createClient, { files, bucket, supabaseUrl, supabaseKey, log }) {
  const client = createClient(supabaseUrl, supabaseKey);
  const results = { uploaded: [], skipped: [], errors: [] };

  for (const { filePath, storageKey } of files) {
    let content;
    try {
      content = fs.readFileSync(filePath);
    } catch (e) {
      log(`supabase: cannot read ${filePath}: ${e.message}`);
      results.errors.push({ filePath, storageKey, error: e.message });
      continue;
    }

    const { error } = await client.storage
      .from(bucket)
      .upload(storageKey, content, {
        contentType: 'application/jsonlines',
        upsert: true,
      });

    if (error) {
      log(`supabase: upload failed for ${storageKey}: ${error.message}`);
      results.errors.push({ filePath, storageKey, error: error.message });
    } else {
      log(`supabase: uploaded ${storageKey} (${content.length} bytes)`);
      results.uploaded.push({ filePath, storageKey, bytes: content.length });
    }
  }

  return results;
}

// ─── Upload via direct REST (fallback) ────────────────────────────────────────

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, body: buf.toString('utf8') });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadViaRest({ files, bucket, supabaseUrl, supabaseKey, log }) {
  const results = { uploaded: [], skipped: [], errors: [] };
  const base = supabaseUrl.replace(/\/$/, '');

  for (const { filePath, storageKey } of files) {
    let content;
    try {
      content = fs.readFileSync(filePath);
    } catch (e) {
      log(`supabase-rest: cannot read ${filePath}: ${e.message}`);
      results.errors.push({ filePath, storageKey, error: e.message });
      continue;
    }

    // Supabase Storage REST: PUT /storage/v1/object/<bucket>/<key>
    const endpoint = `/storage/v1/object/${bucket}/${storageKey}`;
    const parsed = new url.URL(base);

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: endpoint,
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/jsonlines',
        'Content-Length': content.length,
        'x-upsert': 'true',
      },
    };

    try {
      const { statusCode, body } = await httpsRequest(options, content);
      if (statusCode >= 200 && statusCode < 300) {
        log(`supabase-rest: uploaded ${storageKey} (${content.length} bytes) status=${statusCode}`);
        results.uploaded.push({ filePath, storageKey, bytes: content.length });
      } else {
        log(`supabase-rest: upload failed for ${storageKey} status=${statusCode}: ${body.slice(0, 200)}`);
        results.errors.push({ filePath, storageKey, error: `HTTP ${statusCode}: ${body.slice(0, 200)}` });
      }
    } catch (e) {
      log(`supabase-rest: network error for ${storageKey}: ${e.message}`);
      results.errors.push({ filePath, storageKey, error: e.message });
    }
  }

  return results;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload dataset files to a Supabase Storage bucket.
 *
 * @param {object} params
 * @param {{ filePath: string, label: string }[]} params.files
 *   - filePath: absolute path to the JSONL file
 *   - label: the classification label (used as the storage path prefix)
 * @param {string} params.bucket   - Storage bucket name
 * @param {(msg: string) => void} params.log
 * @param {string} [params.supabaseUrl]  - Override env SUPABASE_URL
 * @param {string} [params.supabaseKey]  - Override env SUPABASE_SERVICE_ROLE_KEY
 *
 * @returns {Promise<{ uploaded: object[], skipped: object[], errors: object[] }>}
 */
async function pushToSupabase({ files, bucket, log, supabaseUrl, supabaseKey }) {
  // Resolve credentials (params override env vars)
  const creds = (() => {
    if (supabaseUrl && supabaseKey) return { supabaseUrl, supabaseKey };
    return resolveCredentials(); // throws if missing
  })();

  if (!files || files.length === 0) {
    log('supabase: no files to upload');
    return { uploaded: [], skipped: [], errors: [] };
  }

  // Build storage key list
  const fileList = files.map((f) => ({
    filePath: f.filePath,
    storageKey: `${f.label}/${path.basename(f.filePath)}`,
  }));

  log(`supabase: uploading ${fileList.length} file(s) to bucket="${bucket}"`);

  // Try supabase-js first; fall back to direct REST
  const createClient = tryLoadSupabaseJs();
  if (createClient) {
    log('supabase: using @supabase/supabase-js client');
    return uploadViaClient(createClient, { files: fileList, bucket, log, ...creds });
  }

  log('supabase: @supabase/supabase-js not found — falling back to direct REST');
  return uploadViaRest({ files: fileList, bucket, log, ...creds });
}

module.exports = { pushToSupabase };
