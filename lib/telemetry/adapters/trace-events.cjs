'use strict';
/**
 * Phase 145 (slm-training-data-collection-v1) — task GLOBAL-T-145-02 (S2).
 *
 * Adapter: lift `<rootDir>/.planning/.trace-events.jsonl` lines into
 * unified telemetry envelopes (lib/telemetry/envelope.cjs).
 *
 * Source line shapes (from lib/trace-schema.cjs):
 *   - { type: 'tool_use', ts, seq, runtime:{id,source,model,session_id},
 *       agent:{agent_id,...}, tool, inputs, outputs, outputs_truncated,
 *       duration_ms, success, scope? }
 *     -> emits TWO envelopes: tool_call (parent) + tool_result (child).
 *
 *   - { type: 'assistant_response', ts, seq, runtime, agent, content:{text} }
 *     -> emits one envelope, role=`response`. (NEW from Stop hook,
 *     T-145-04.)
 *
 *   - { type: 'assistant_reasoning', ts, seq, runtime, agent, content:{text} }
 *     -> emits one envelope, role=`reasoning`.
 *
 *   - All other types (skill_invocation, subagent_spawn, file_mutation)
 *     are NOT this adapter's scope per the user's task spec — they are
 *     filtered out (no envelope emitted, no stderr noise).
 *
 * Streaming via fs.createReadStream + readline. Idempotent — id derived
 * from `trace-events|seq-<seq>|<call|result|response|reasoning>` so
 * re-export yields identical envelopes.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  VALID_RUNTIMES,
} = require('../envelope.cjs');

const SOURCE_TAG = 'trace-events';

/**
 * Best-effort project derivation for trace-events rows. The trace
 * schema does not currently include a `--projectid` flag in the event
 * itself; T-145-02 spec says "derive from agent or scope; default
 * 'global'". `scope` is preserved on tool_use rows (e.g.
 * `scope: 'gad-framework'`).
 */
function deriveProject(row) {
  if (typeof row.project === 'string' && row.project) return row.project;
  if (row.agent && typeof row.agent.project === 'string') return row.agent.project;
  if (typeof row.scope === 'string' && row.scope) return row.scope;
  return 'global';
}

function isValidRuntime(id) {
  return typeof id === 'string' && VALID_RUNTIMES.has(id);
}

function buildBaseFields(row) {
  const runtimeId = row.runtime && row.runtime.id;
  const sessionId = (row.runtime && row.runtime.session_id) || null;
  return {
    runtime: runtimeId,
    run_id: makeRunId(runtimeId, sessionId, row.ts),
    model: (row.runtime && row.runtime.model) || null,
    agent_id: (row.agent && row.agent.agent_id) || null,
    project: deriveProject(row),
    ts: row.ts,
  };
}

/**
 * Map one parsed trace-events row into 0..2 envelopes. Returns array
 * of `{ ok, envelope?, reason? }` results, never throws.
 *
 * `seq` may be a fractional number (e.g. 21603.2) for sub-events; we
 * derive a stable lexical key for the id but coerce the envelope's
 * integer `seq` field to floor(seq) to satisfy validateEnvelope.
 */
function rowToEnvelopes(row) {
  if (!row || typeof row !== 'object') return [{ ok: false, reason: 'not an object' }];
  if (typeof row.ts !== 'string') return [{ ok: false, reason: 'missing ts' }];
  if (typeof row.seq !== 'number') return [{ ok: false, reason: 'missing seq' }];
  if (!row.type || typeof row.type !== 'string') return [{ ok: false, reason: 'missing type' }];

  const runtimeId = row.runtime && row.runtime.id;
  if (!isValidRuntime(runtimeId)) {
    return [{ ok: false, reason: `runtime not in valid set: ${runtimeId}` }];
  }

  const base = buildBaseFields(row);
  const seqInt = Math.max(0, Math.floor(row.seq));
  // Use raw seq for id key so 21603 and 21603.2 don't collide.
  const seqKey = String(row.seq);

  if (row.type === 'tool_use') {
    const callContent = {
      tool: row.tool,
      inputs: row.inputs == null ? null : row.inputs,
    };
    if (row.scope !== undefined) callContent.scope = row.scope;

    const resultContent = {
      tool: row.tool,
      outputs: row.outputs == null ? null : row.outputs,
      success: Boolean(row.success),
      duration_ms: row.duration_ms == null ? null : row.duration_ms,
      outputs_truncated: Boolean(row.outputs_truncated),
    };
    if (row.scope !== undefined) resultContent.scope = row.scope;

    const callId = deriveEnvelopeId(`${SOURCE_TAG}|seq-${seqKey}|call`);
    const resultId = deriveEnvelopeId(`${SOURCE_TAG}|seq-${seqKey}|result`);

    const callEnv = {
      ...base,
      id: callId,
      role: 'tool_call',
      content: callContent,
      seq: seqInt,
      parent_id: null,
    };
    const resultEnv = {
      ...base,
      id: resultId,
      role: 'tool_result',
      content: resultContent,
      seq: seqInt,
      parent_id: callId,
    };
    return [tryMake(callEnv), tryMake(resultEnv)];
  }

  if (row.type === 'assistant_response' || row.type === 'assistant_reasoning') {
    const role = row.type === 'assistant_response' ? 'response' : 'reasoning';
    const text = row.content && typeof row.content.text === 'string' ? row.content.text : '';
    const tag = role === 'response' ? 'response' : 'reasoning';
    const id = deriveEnvelopeId(`${SOURCE_TAG}|seq-${seqKey}|${tag}`);
    const content = { text };
    if (row.content && row.content.transcript_path) {
      content.transcript_path = row.content.transcript_path;
    }
    const env = {
      ...base,
      id,
      role,
      content,
      seq: seqInt,
    };
    return [tryMake(env)];
  }

  // Other event types (skill_invocation, subagent_spawn, file_mutation)
  // are intentionally not emitted by this adapter (per task scope).
  return [];
}

function tryMake(fields) {
  try {
    return { ok: true, envelope: makeEnvelope(fields) };
  } catch (err) {
    return { ok: false, reason: `makeEnvelope failed: ${err.message}` };
  }
}

/**
 * Async generator yielding envelopes from
 * <rootDir>/.planning/.trace-events.jsonl. Rows older than sinceMs are
 * skipped.
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  const fpath = path.join(rootDir, '.planning', '.trace-events.jsonl');
  if (!fs.existsSync(fpath)) return;

  const stream = fs.createReadStream(fpath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNum = 0;
  for await (const raw of rl) {
    lineNum += 1;
    const line = raw.trim();
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (err) {
      process.stderr.write(`trace-events adapter: line ${lineNum} unparseable: ${err.message}\n`);
      continue;
    }
    if (sinceMs > 0 && typeof row.ts === 'string') {
      const t = Date.parse(row.ts);
      if (Number.isFinite(t) && t < sinceMs) continue;
    }
    const results = rowToEnvelopes(row);
    for (const r of results) {
      if (!r.ok) {
        process.stderr.write(`trace-events adapter: line ${lineNum} skipped: ${r.reason}\n`);
        continue;
      }
      const v = validateEnvelope(r.envelope);
      if (!v.ok) {
        process.stderr.write(`trace-events adapter: line ${lineNum} invalid envelope: ${v.errors.join('; ')}\n`);
        continue;
      }
      yield r.envelope;
    }
  }
}

module.exports = {
  iterEnvelopes,
  _internals: { rowToEnvelopes, deriveProject, buildBaseFields, SOURCE_TAG },
};
