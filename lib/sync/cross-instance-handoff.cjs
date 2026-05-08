'use strict';
/**
 * lib/sync/cross-instance-handoff.cjs — Cross-instance handoff substrate (Phase 132).
 *
 * Enables pushing handoff files to a shared Supabase bucket so a polling agent
 * on the target instance can pick them up and write them to its local
 * .planning/handoffs/open/ directory.
 *
 * Bucket requirements:
 *   gad-cross-instance-handoffs   — Supabase Storage bucket (public or service-role access)
 *     Key format: <targetProjectId>/<handoffId>.md
 *
 * The flag wiring on `gad handoffs create --cross-instance` is a follow-on task
 * (noted in Phase 132 gaps). This module ships the push/poll substrate.
 *
 * Exports:
 *   pushCrossInstance({ targetProjectId, handoffId, body, supabase? })
 *     → { ok, key, error? }
 *   pollCrossInstance({ projectId, supabase? })
 *     → Array<{ key, id, body, targetProjectId }>
 */

const { getSupabaseClient } = require('../supabase-client.cjs');

const CROSS_INSTANCE_BUCKET = 'gad-cross-instance-handoffs';

// ---------------------------------------------------------------------------
// Internal: resolve client
// ---------------------------------------------------------------------------

function resolveClient(supabaseArg) {
  if (supabaseArg) return { client: supabaseArg, hasServiceRole: true };
  return getSupabaseClient();
}

// ---------------------------------------------------------------------------
// pushCrossInstance
// ---------------------------------------------------------------------------

/**
 * Push a handoff body to the cross-instance Supabase bucket so a remote
 * instance can discover and claim it.
 *
 * @param {object} params
 * @param {string}  params.targetProjectId — project id on the target instance (e.g. "global")
 * @param {string}  params.handoffId       — the handoff file id (e.g. "h-2026-05-07T12-00-00-global-132")
 * @param {string}  params.body            — full handoff file content (frontmatter + markdown body)
 * @param {object}  [params.supabase]      — optional pre-built Supabase client
 * @returns {Promise<{ ok: boolean, key: string, error?: string }>}
 */
async function pushCrossInstance({ targetProjectId, handoffId, body, supabase }) {
  if (!targetProjectId) throw new Error('pushCrossInstance: targetProjectId is required');
  if (!handoffId) throw new Error('pushCrossInstance: handoffId is required');
  if (typeof body !== 'string') throw new Error('pushCrossInstance: body must be a string');

  const storageKey = `${targetProjectId}/${handoffId}.md`;
  const content = Buffer.from(body, 'utf8');

  let clientObj;
  try {
    clientObj = resolveClient(supabase);
  } catch (e) {
    return { ok: false, key: storageKey, error: e.message };
  }
  const { client } = clientObj;

  const { error } = await client.storage
    .from(CROSS_INSTANCE_BUCKET)
    .upload(storageKey, content, {
      contentType: 'text/markdown',
      upsert: true,
    });

  if (error) {
    return { ok: false, key: storageKey, error: error.message };
  }

  return { ok: true, key: storageKey };
}

// ---------------------------------------------------------------------------
// pollCrossInstance
// ---------------------------------------------------------------------------

/**
 * List all pending cross-instance handoffs addressed to projectId.
 *
 * The polling agent (a follow-on task) calls this, then writes each returned
 * entry to its local .planning/handoffs/open/<id>.md and optionally deletes
 * the remote file.
 *
 * @param {object} params
 * @param {string}  params.projectId — project id of THIS instance (receives handoffs)
 * @param {object}  [params.supabase]
 * @returns {Promise<Array<{ key: string, id: string, body: string, targetProjectId: string }>>}
 */
async function pollCrossInstance({ projectId, supabase }) {
  if (!projectId) throw new Error('pollCrossInstance: projectId is required');

  let clientObj;
  try {
    clientObj = resolveClient(supabase);
  } catch (e) {
    throw new Error(`Cannot connect to Supabase: ${e.message}`);
  }
  const { client } = clientObj;

  // List objects under <projectId>/
  const { data: objects, error: listError } = await client.storage
    .from(CROSS_INSTANCE_BUCKET)
    .list(projectId, { limit: 200 });

  if (listError) {
    throw new Error(`pollCrossInstance list failed: ${listError.message}`);
  }

  if (!objects || objects.length === 0) {
    return [];
  }

  const results = [];
  for (const obj of objects) {
    const storageKey = `${projectId}/${obj.name}`;
    const { data: fileData, error: downloadError } = await client.storage
      .from(CROSS_INSTANCE_BUCKET)
      .download(storageKey);

    if (downloadError) {
      // Log and skip — don't crash the whole poll on one bad file
      console.error(`pollCrossInstance: failed to download ${storageKey}: ${downloadError.message}`);
      continue;
    }

    let body;
    try {
      body = await fileData.text();
    } catch (e) {
      console.error(`pollCrossInstance: failed to read ${storageKey}: ${e.message}`);
      continue;
    }

    const id = obj.name.replace(/\.md$/, '');
    results.push({
      key: storageKey,
      id,
      body,
      targetProjectId: projectId,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { pushCrossInstance, pollCrossInstance };
