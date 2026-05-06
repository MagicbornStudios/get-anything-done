'use strict';
/**
 * Phase 145 (slm-training-data-collection-v1) — task GLOBAL-T-145-01.
 *
 * Unified envelope schema for SLM training-relevant signals across all
 * runtimes (claude-code, codex-cli, gemini-cli, opencode, gad-cli).
 *
 * One envelope shape, six roles. Adapters in lib/telemetry/adapters/
 * lift each existing source (.gad-log, .trace-events.jsonl, worker
 * log.jsonl, worker prompt files, NEW Stop hook) into this shape.
 *
 * Storage: JSONL is the source-of-truth wire format. DuckDB is a
 * queryable mirror, rebuildable from JSONL at any time. Primary key
 * `id` is uuid v4 — re-export of the same source rows produces the
 * same ids (deterministic via deriveEnvelopeId) so INSERT OR IGNORE
 * is idempotent.
 *
 * Reference: .planning/phases/145-slm-training-data-collection-v1/PLAN.md
 */

const crypto = require('crypto');

const SCHEMA_V = 1;

const VALID_RUNTIMES = new Set([
  'claude-code',
  'codex-cli',
  'gemini-cli',
  'opencode',
  'gad-cli',
]);

const VALID_ROLES = new Set([
  'prompt',
  'reasoning',
  'tool_call',
  'tool_result',
  'response',
  'meta',
]);

const REQUIRED_FIELDS = ['id', 'ts', 'run_id', 'project', 'runtime', 'role', 'content', 'seq', 'schema_v'];
const OPTIONAL_FIELDS = ['task_id', 'handoff_id', 'model', 'parent_id', 'agent_id'];

function isIsoTimestamp(s) {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s.slice(0, 10);
}

function isUuidLike(s) {
  return typeof s === 'string' && /^[0-9a-f-]{32,40}$/.test(s);
}

/**
 * Validate an envelope object. Returns `{ ok: true }` if valid, else
 * `{ ok: false, errors: [string, ...] }`. Does NOT throw — adapters
 * use this to triage rows.
 */
function validateEnvelope(env) {
  const errors = [];
  if (env == null || typeof env !== 'object') {
    return { ok: false, errors: ['envelope must be an object'] };
  }
  for (const f of REQUIRED_FIELDS) {
    if (env[f] === undefined || env[f] === null) errors.push(`missing required field: ${f}`);
  }
  if (env.schema_v !== undefined && env.schema_v !== SCHEMA_V) {
    errors.push(`schema_v ${env.schema_v} != current ${SCHEMA_V}`);
  }
  if (env.ts !== undefined && !isIsoTimestamp(env.ts)) {
    errors.push(`ts must be ISO8601: got ${env.ts}`);
  }
  if (env.id !== undefined && !isUuidLike(env.id)) {
    errors.push(`id must be uuid-like: got ${env.id}`);
  }
  if (env.runtime !== undefined && !VALID_RUNTIMES.has(env.runtime)) {
    errors.push(`runtime not in ${[...VALID_RUNTIMES].join('|')}: got ${env.runtime}`);
  }
  if (env.role !== undefined && !VALID_ROLES.has(env.role)) {
    errors.push(`role not in ${[...VALID_ROLES].join('|')}: got ${env.role}`);
  }
  if (env.seq !== undefined && (!Number.isInteger(env.seq) || env.seq < 0)) {
    errors.push(`seq must be non-negative integer: got ${env.seq}`);
  }
  if (env.parent_id !== undefined && env.parent_id !== null && !isUuidLike(env.parent_id)) {
    errors.push(`parent_id must be uuid-like or null: got ${env.parent_id}`);
  }
  // Stray fields are allowed (for forward-compat) but logged via the
  // caller's discretion — don't reject.
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Derive a deterministic envelope id from a stable source key. Used by
 * adapters so the same source row always produces the same envelope id
 * across re-exports (idempotent ingest).
 *
 * key = `${source}|${stable_row_id}`. Source examples:
 *   "trace-events.jsonl|seq-21179"
 *   "worker-log|w1|2026-05-06T08:04:11.067Z"
 *   "prompt-file|w1|1777875475363"
 */
function deriveEnvelopeId(key) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('deriveEnvelopeId: key must be a non-empty string');
  }
  // SHA-1 truncated to 32 hex chars (uuid-like). Not cryptographic —
  // we only need stable fast hashing.
  const h = crypto.createHash('sha1').update(key).digest('hex').slice(0, 32);
  // Format as 8-4-4-4-12 uuid (deterministic, not v4).
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * Build a fresh envelope. All required fields must be in `fields`.
 * Adds schema_v, validates, returns a frozen object.
 */
function makeEnvelope(fields) {
  const env = {
    id: fields.id,
    ts: fields.ts,
    run_id: fields.run_id,
    project: fields.project,
    runtime: fields.runtime,
    role: fields.role,
    content: fields.content,
    seq: fields.seq,
    schema_v: SCHEMA_V,
    task_id: fields.task_id || null,
    handoff_id: fields.handoff_id || null,
    model: fields.model || null,
    parent_id: fields.parent_id || null,
    agent_id: fields.agent_id || null,
  };
  const v = validateEnvelope(env);
  if (!v.ok) {
    throw new Error(`makeEnvelope: invalid envelope: ${v.errors.join('; ')}`);
  }
  return Object.freeze(env);
}

/**
 * Synthetic run_id prefix per runtime so codex/claude/gemini/opencode
 * session ids never collide. Per phase 145 plan risk mitigation.
 */
function runIdPrefix(runtime) {
  switch (runtime) {
    case 'claude-code': return 'cc';
    case 'codex-cli':   return 'cx';
    case 'gemini-cli':  return 'gm';
    case 'opencode':    return 'oc';
    case 'gad-cli':     return 'gd';
    default:            return 'xx';
  }
}

function makeRunId(runtime, sessionOrWorkerId, ts) {
  const prefix = runIdPrefix(runtime);
  const tsPart = typeof ts === 'string' ? ts : new Date(ts || Date.now()).toISOString();
  const cleanSession = String(sessionOrWorkerId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return `${prefix}-${cleanSession}-${tsPart}`;
}

module.exports = {
  SCHEMA_V,
  VALID_RUNTIMES,
  VALID_ROLES,
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  runIdPrefix,
};
