'use strict';
/**
 * Phase 145 (slm-training-data-collection-v1) — task GLOBAL-T-145-02 (S1).
 * Phase 145.5 (training-data-adapters-v2) — task 145.5-05 glob extension.
 *
 * Adapter: lift `<rootDir>/.planning/.gad-log/<YYYY-MM-DD>*.jsonl` lines
 * into the unified telemetry envelope (lib/telemetry/envelope.cjs).
 *
 * Glob covers THREE file patterns the GAD CLI now writes:
 *   - <date>.jsonl              -> default CLI traffic (gad_cli_call)
 *   - <date>-skill-loads.jsonl  -> skill matcher decisions (skill_load)
 *   - <date>-routing.jsonl      -> routing-decision rows (routing_decision,
 *                                  GOLD signal — preserved verbatim)
 *
 * Each .gad-log line is one of:
 *   - gad CLI invocation: { ts, cmd, args, duration_ms, exit, summary, pid }
 *   - legacy tool_call:    { ts, type:"tool_call", tool, session_id,
 *                            input_summary, output_length, gad_command? }
 *   - skill-load row:     { ts, runtime, worker, handoff_id, slug,
 *                            projectid, match_reason, source, score }
 *   - routing-decision:    { ts, task, task_shape, chosen_runtime,
 *                            chosen_agent, chosen_model, reason[],
 *                            outcome, cost_estimate, latency_ms,
 *                            project_id, session_id }
 *
 * All shapes map to role=`meta` (CLI traffic; not direct LLM training
 * signal but high-value labels for routing/skill-load benchmarks).
 * Runtime is `gad-cli`.
 *
 * Streaming via fs.createReadStream + readline so multi-day logs do not
 * pin memory. Yields envelopes; invalid rows are logged to stderr and
 * skipped (per envelope contract: don't throw).
 *
 * Idempotent: id is derived from `gad-log|<filename>|<lineNum>` so the
 * same input always yields the same envelope id (re-export safe).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const {
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
} = require('../envelope.cjs');
const { deriveContentType } = require('../content-type.cjs');

const SOURCE_TAG = 'gad-log';
const RUNTIME = 'gad-cli';
const ROLE = 'meta';

/**
 * Extract the project id from a gad-log row's args (or inputs string).
 * Falls back to 'global'.
 *
 * Skill-load rows carry `projectid` directly; routing-decision rows
 * carry `project_id`. Honour both before falling back to arg parsing.
 */
function deriveProject(row) {
  if (typeof row.projectid === 'string' && row.projectid) return row.projectid;
  if (typeof row.project_id === 'string' && row.project_id) return row.project_id;
  const args = Array.isArray(row.args) ? row.args : null;
  if (args) {
    const i = args.indexOf('--projectid');
    if (i !== -1 && typeof args[i + 1] === 'string') {
      return args[i + 1];
    }
  }
  // Legacy lines: input_summary may contain `--projectid X`.
  const summary = typeof row.input_summary === 'string' ? row.input_summary : '';
  const m = summary.match(/--projectid\s+(\S+)/);
  if (m) return m[1];
  // gad_command may also carry it.
  const gc = typeof row.gad_command === 'string' ? row.gad_command : '';
  const m2 = gc.match(/--projectid\s+(\S+)/);
  if (m2) return m2[1];
  return 'global';
}

/**
 * Classify the file kind from its filename suffix. Returns one of:
 *   - 'gad_cli_call'      (default <date>.jsonl)
 *   - 'skill_load'        (<date>-skill-loads.jsonl)
 *   - 'routing_decision'  (<date>-routing.jsonl)
 *   - 'gad_log_other'     (any other <date>-*.jsonl, generic passthrough)
 */
function kindForFilename(fname) {
  // Strip leading YYYY-MM-DD then inspect suffix.
  const m = fname.match(/^\d{4}-\d{2}-\d{2}(.*)\.jsonl$/);
  if (!m) return 'gad_log_other';
  const suffix = m[1]; // '' | '-skill-loads' | '-routing' | etc.
  if (suffix === '') return 'gad_cli_call';
  if (suffix === '-skill-loads') return 'skill_load';
  if (suffix === '-routing') return 'routing_decision';
  return 'gad_log_other';
}

/**
 * Build the deterministic content payload (preserve all source fields,
 * stripping ones promoted to envelope-level). Adds `kind` discriminator
 * sourced from the file pattern. For skill-load + routing-decision rows
 * we wire EVERY field through verbatim (routing rows are GOLD signal).
 */
function buildContent(row, kind) {
  const content = { kind };
  if (kind === 'skill_load') {
    for (const k of ['runtime', 'worker', 'handoff_id', 'slug', 'projectid', 'match_reason', 'source', 'score']) {
      if (row[k] !== undefined) content[k] = row[k];
    }
    return content;
  }
  if (kind === 'routing_decision') {
    // Preserve verbatim — every field is training-relevant.
    for (const k of [
      'task', 'task_shape', 'chosen_runtime', 'chosen_agent', 'chosen_model',
      'reason', 'outcome', 'cost_estimate', 'latency_ms', 'project_id', 'session_id',
    ]) {
      if (row[k] !== undefined) content[k] = row[k];
    }
    return content;
  }
  // Default + 'gad_log_other' shapes: legacy CLI / tool_call fields.
  for (const k of [
    'cmd', 'args', 'duration_ms', 'exit', 'summary', 'pid',
    'type', 'tool', 'input_summary', 'output_length', 'gad_command',
  ]) {
    if (row[k] !== undefined) content[k] = row[k];
  }
  return content;
}

/**
 * Convert one parsed gad-log row + its file context into an envelope,
 * or null if the row is unusable. Throws nothing.
 */
function rowToEnvelope({ row, filename, lineNum }) {
  if (!row || typeof row !== 'object') return { ok: false, reason: 'not an object' };
  if (typeof row.ts !== 'string') return { ok: false, reason: 'missing ts' };

  const kind = kindForFilename(filename);
  // Skill-load rows have no session_id/pid — use worker fallback for run_id.
  const sessionOrPid = row.session_id
    || (row.pid != null ? `pid-${row.pid}` : null)
    || row.worker
    || 'unknown';
  const id = deriveEnvelopeId(`${SOURCE_TAG}|${filename}|${lineNum}`);
  const content = buildContent(row, kind);
  const env = {
    id,
    ts: row.ts,
    run_id: makeRunId(RUNTIME, sessionOrPid, row.ts),
    project: deriveProject(row),
    runtime: RUNTIME,
    role: ROLE,
    content,
    seq: lineNum,
    // gad-log lines are CLI traffic — derive from any path-like args,
    // fall back to 'meta' (the dominant case for snapshot/state/etc).
    content_type: deriveContentType({ content }),
  };

  try {
    return { ok: true, envelope: makeEnvelope(env) };
  } catch (err) {
    return { ok: false, reason: `makeEnvelope failed: ${err.message}` };
  }
}

/**
 * Async generator yielding envelopes from every .gad-log/*.jsonl under
 * rootDir. Lines older than sinceMs are skipped.
 *
 * @param {string} rootDir — repo root (file lives at <rootDir>/.planning/.gad-log/)
 * @param {number} sinceMs — epoch ms; rows with ts < sinceMs are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  const dir = path.join(rootDir, '.planning', '.gad-log');
  let files;
  try {
    // Phase 145.5-05: glob `<date>*.jsonl` (was `<date>.jsonl`) so we
    // pick up `<date>-skill-loads.jsonl` and `<date>-routing.jsonl`
    // alongside the default daily file. Match anything starting with
    // YYYY-MM-DD and ending with .jsonl.
    files = fs
      .readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}.*\.jsonl$/.test(f))
      .sort();
  } catch (err) {
    if (err && err.code === 'ENOENT') return;
    throw err;
  }

  for (const fname of files) {
    const fpath = path.join(dir, fname);
    let stream;
    try {
      stream = fs.createReadStream(fpath, { encoding: 'utf8' });
    } catch (err) {
      process.stderr.write(`gad-log adapter: cannot open ${fpath}: ${err.message}\n`);
      continue;
    }
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
        process.stderr.write(`gad-log adapter: ${fname}:${lineNum} unparseable: ${err.message}\n`);
        continue;
      }
      // sinceMs cutoff
      if (sinceMs > 0 && typeof row.ts === 'string') {
        const t = Date.parse(row.ts);
        if (Number.isFinite(t) && t < sinceMs) continue;
      }
      const result = rowToEnvelope({ row, filename: fname, lineNum });
      if (!result.ok) {
        process.stderr.write(`gad-log adapter: ${fname}:${lineNum} skipped: ${result.reason}\n`);
        continue;
      }
      const v = validateEnvelope(result.envelope);
      if (!v.ok) {
        process.stderr.write(`gad-log adapter: ${fname}:${lineNum} invalid envelope: ${v.errors.join('; ')}\n`);
        continue;
      }
      yield result.envelope;
    }
  }
}

module.exports = {
  iterEnvelopes,
  // exposed for testing only
  _internals: {
    rowToEnvelope, deriveProject, buildContent, kindForFilename,
    SOURCE_TAG, RUNTIME, ROLE,
  },
};
