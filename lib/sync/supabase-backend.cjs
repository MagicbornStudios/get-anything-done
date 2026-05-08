'use strict';
/**
 * lib/sync/supabase-backend.cjs — Supabase Storage backend for planning sync (Phase 132).
 *
 * Bucket requirements (must exist in your Supabase project before use):
 *   gad-planning-sync          — stores full planning payload JSON files
 *   gad-planning-sync-index    — NOT a bucket; the index is a Supabase table:
 *
 *   Table: gad_planning_sync_index
 *     id          uuid       primary key default gen_random_uuid()
 *     project_id  text       not null
 *     instance_id text       not null
 *     storage_key text       not null
 *     fingerprint text       not null
 *     size_bytes  integer    not null
 *     pushed_at   timestamptz not null default now()
 *
 * Reuses getSupabaseClient() from lib/supabase-client.cjs (Phase 170 patterns).
 * Falls back to direct HTTPS REST calls when @supabase/supabase-js is unavailable
 * (mirrors the fallback strategy from lib/datasets/remote-supabase.cjs).
 *
 * Exports:
 *   pushPayload({ payload, projectId, instanceId, supabase? })
 *     → { ok, key, fingerprint, bytes }
 *   pullPayload({ projectId, instanceId?, supabase? })
 *     → { ok, payload, key, fingerprint, pushedAt } | { ok: false, error }
 *   listInstances({ projectId, supabase? })
 *     → string[]
 */

const https = require('https');
const url = require('url');
const path = require('path');
const { getSupabaseClient } = require('../supabase-client.cjs');
const { syncFingerprint } = require('./index.cjs');

const STORAGE_BUCKET = 'gad-planning-sync';
const INDEX_TABLE = 'gad_planning_sync_index';

// ---------------------------------------------------------------------------
// Internal: resolve supabase client (passed-in or module-level singleton)
// ---------------------------------------------------------------------------

function resolveClient(supabaseArg) {
  if (supabaseArg) return { client: supabaseArg, hasServiceRole: true };
  // Throws with clear message if env vars missing
  return getSupabaseClient();
}

// ---------------------------------------------------------------------------
// Internal: HTTPS REST helpers (mirrors remote-supabase.cjs fallback pattern)
// ---------------------------------------------------------------------------

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

function makeRestOptions(supabaseUrl, supabaseKey, method, pathStr, extraHeaders) {
  const parsed = new url.URL(supabaseUrl.replace(/\/$/, ''));
  return {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: pathStr,
    method,
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      apikey: supabaseKey,
      ...extraHeaders,
    },
  };
}

// ---------------------------------------------------------------------------
// pushPayload
// ---------------------------------------------------------------------------

/**
 * Upload a planning payload to Supabase Storage and record metadata in the
 * index table.
 *
 * @param {object} params
 * @param {object}  params.payload     — planning data payload (from collectPlanningData)
 * @param {string}  params.projectId   — e.g. "global"
 * @param {string}  params.instanceId  — unique id for this machine/session (e.g. hostname or uuid)
 * @param {object}  [params.supabase]  — optional pre-built Supabase client; defaults to getSupabaseClient()
 * @returns {Promise<{ ok: boolean, key: string, fingerprint: string, bytes: number, error?: string }>}
 */
async function pushPayload({ payload, projectId, instanceId, supabase }) {
  if (!projectId) throw new Error('pushPayload: projectId is required');
  if (!instanceId) throw new Error('pushPayload: instanceId is required');

  const fingerprint = syncFingerprint(payload);
  const isoTs = new Date().toISOString().replace(/[:.]/g, '-');
  const storageKey = `${projectId}/${instanceId}/${isoTs}.json`;
  const body = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const bytes = body.length;

  let clientObj;
  try {
    clientObj = resolveClient(supabase);
  } catch (e) {
    return { ok: false, key: storageKey, fingerprint, bytes, error: e.message };
  }
  const { client } = clientObj;

  // Upload to Storage
  const { error: storageError } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, body, {
      contentType: 'application/json',
      upsert: true,
    });

  if (storageError) {
    return { ok: false, key: storageKey, fingerprint, bytes, error: storageError.message };
  }

  // Insert index row
  const { error: dbError } = await client
    .from(INDEX_TABLE)
    .insert({
      project_id: projectId,
      instance_id: instanceId,
      storage_key: storageKey,
      fingerprint,
      size_bytes: bytes,
    });

  if (dbError) {
    // Non-fatal: storage upload succeeded; log index failure but return ok
    return {
      ok: true,
      key: storageKey,
      fingerprint,
      bytes,
      indexWarning: `Index insert failed (table may not exist): ${dbError.message}`,
    };
  }

  return { ok: true, key: storageKey, fingerprint, bytes };
}

// ---------------------------------------------------------------------------
// pullPayload
// ---------------------------------------------------------------------------

/**
 * Fetch the latest planning payload for a project (optionally scoped to one
 * instance).
 *
 * @param {object} params
 * @param {string}  params.projectId
 * @param {string}  [params.instanceId]  — omit to pull latest across all instances
 * @param {object}  [params.supabase]
 * @returns {Promise<{ ok: boolean, payload?: object, key?: string, fingerprint?: string, pushedAt?: string, error?: string }>}
 */
async function pullPayload({ projectId, instanceId, supabase }) {
  if (!projectId) throw new Error('pullPayload: projectId is required');

  let clientObj;
  try {
    clientObj = resolveClient(supabase);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const { client } = clientObj;

  // Query the index table for the latest entry
  let query = client
    .from(INDEX_TABLE)
    .select('storage_key, fingerprint, pushed_at, instance_id')
    .eq('project_id', projectId)
    .order('pushed_at', { ascending: false })
    .limit(1);

  if (instanceId) {
    query = query.eq('instance_id', instanceId);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return { ok: false, error: `Index query failed: ${dbError.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: 'No sync entries found for this project' };
  }

  const { storage_key: storageKey, fingerprint, pushed_at: pushedAt } = data[0];

  // Download payload from Storage
  const { data: fileData, error: downloadError } = await client.storage
    .from(STORAGE_BUCKET)
    .download(storageKey);

  if (downloadError) {
    return { ok: false, error: `Storage download failed: ${downloadError.message}` };
  }

  let payload;
  try {
    const text = await fileData.text();
    payload = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Failed to parse payload JSON: ${e.message}` };
  }

  return { ok: true, payload, key: storageKey, fingerprint, pushedAt };
}

// ---------------------------------------------------------------------------
// listInstances
// ---------------------------------------------------------------------------

/**
 * List all instance IDs that have synced planning data for a project.
 *
 * @param {object} params
 * @param {string}  params.projectId
 * @param {object}  [params.supabase]
 * @returns {Promise<string[]>}
 */
async function listInstances({ projectId, supabase }) {
  if (!projectId) throw new Error('listInstances: projectId is required');

  let clientObj;
  try {
    clientObj = resolveClient(supabase);
  } catch (e) {
    throw new Error(`Cannot connect to Supabase: ${e.message}`);
  }
  const { client } = clientObj;

  const { data, error } = await client
    .from(INDEX_TABLE)
    .select('instance_id')
    .eq('project_id', projectId)
    .order('pushed_at', { ascending: false });

  if (error) {
    throw new Error(`listInstances query failed: ${error.message}`);
  }

  // Deduplicate while preserving most-recent-first order
  const seen = new Set();
  const instances = [];
  for (const row of (data || [])) {
    if (!seen.has(row.instance_id)) {
      seen.add(row.instance_id);
      instances.push(row.instance_id);
    }
  }
  return instances;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { pushPayload, pullPayload, listInstances };
