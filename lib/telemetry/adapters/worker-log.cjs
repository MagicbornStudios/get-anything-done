'use strict';
/**
 * Phase 145 (slm-training-data-collection-v1) — task GLOBAL-T-145-02.
 *
 * Adapter C: worker-log
 *
 * Source: <rootDir>/.planning/team/workers/w*\/log.jsonl
 *
 * Lifts each interesting line of a worker's JSONL log into one of the
 * six unified envelope roles (prompt/reasoning/response/meta).
 *
 * Streams line-by-line — does not load entire log files into memory.
 * Deterministic: same input lines → same envelope ids (via
 * deriveEnvelopeId on a stable per-row key).
 *
 * Reference: lib/telemetry/envelope.cjs (DO NOT MODIFY).
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
const { deriveContentType } = require('../content-type.cjs');

/**
 * Best-effort runtime guess by worker id when status.json is unreadable.
 * The framework happens to assign these defaults in profiles/all-runtimes.json,
 * but this is fallback only — status.json wins.
 */
const RUNTIME_GUESS = Object.freeze({
  w1: 'codex-cli',
  w2: 'gemini-cli',
  w3: 'opencode',
  w4: 'opencode',
  w5: 'opencode',
  w6: 'claude-code',
});

function guessRuntime(workerId) {
  return RUNTIME_GUESS[workerId] || 'gad-cli';
}

function readStatusRuntime(rootDir, workerId, cache) {
  if (cache.has(workerId)) return cache.get(workerId);
  const statusPath = path.join(rootDir, '.planning', 'team', 'workers', workerId, 'status.json');
  let runtime = guessRuntime(workerId);
  try {
    const txt = fs.readFileSync(statusPath, 'utf8');
    const j = JSON.parse(txt);
    if (j && typeof j.runtime === 'string' && VALID_RUNTIMES.has(j.runtime)) {
      runtime = j.runtime;
    }
  } catch (_) {
    // fall through to guess
  }
  cache.set(workerId, runtime);
  return runtime;
}

function listWorkerDirs(rootDir) {
  const teamWorkers = path.join(rootDir, '.planning', 'team', 'workers');
  let entries;
  try {
    entries = fs.readdirSync(teamWorkers, { withFileTypes: true });
  } catch (_) {
    return [];
  }
  return entries
    .filter((d) => d.isDirectory() && /^w\d+$/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function isIsoLike(s) {
  if (typeof s !== 'string') return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function safeIso(s) {
  if (typeof s !== 'string') return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

const MODEL_RE = /^model:\s*(.+)$/m;

function extractModel(text) {
  if (typeof text !== 'string') return null;
  const m = text.match(MODEL_RE);
  return m ? m[1].trim() : null;
}

/**
 * Lazy line iterator over a JSONL file. Yields parsed objects, skips
 * unparseable lines (logged to stderr).
 */
async function* iterJsonlLines(filePath) {
  let stream;
  try {
    stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  } catch (e) {
    process.stderr.write(`[worker-log] open failed ${filePath}: ${e.message}\n`);
    return;
  }
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNum = 0;
  for await (const raw of rl) {
    lineNum += 1;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch (e) {
      process.stderr.write(`[worker-log] parse fail ${path.basename(filePath)}:${lineNum}: ${e.message}\n`);
      continue;
    }
    yield { row, lineNum };
  }
}

function classifyKind(kind) {
  if (kind === 'subproc-stdin') return { role: 'prompt' };
  if (kind === 'subproc-stderr') return { role: 'reasoning' };
  if (kind === 'subproc-stdout') return { role: 'response' };
  if (
    kind === 'work-start' ||
    kind === 'runtime-account-rotated' ||
    kind === 'rate-limit-detected-midstream' ||
    kind === 'claim-error' ||
    kind === 'runtime-rate-limit-on-call' ||
    kind === 'handoff-unclaimed' ||
    kind === 'work-complete'
  ) {
    return { role: 'meta' };
  }
  // explicit ignores
  if (kind === 'work-skip-empty-body' || kind === 'heartbeat' || kind === 'worker-start') {
    return null;
  }
  return null;
}

/**
 * Yield envelopes from every worker's log.jsonl under rootDir.
 *
 * @param {string} rootDir   monorepo root (the dir containing .planning/)
 * @param {number} sinceMs   epoch ms; rows with ts < this are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  const sinceIso = sinceMs ? new Date(sinceMs).toISOString() : null;
  const runtimeCache = new Map();

  for (const workerId of listWorkerDirs(rootDir)) {
    const logPath = path.join(rootDir, '.planning', 'team', 'workers', workerId, 'log.jsonl');
    if (!fs.existsSync(logPath)) continue;
    const runtime = readStatusRuntime(rootDir, workerId, runtimeCache);

    // Per-worker run state. A run begins at each work-start.
    let currentRunId = null;
    let currentHandoff = null;
    let currentRunStartTs = null;
    let currentModel = null;

    for await (const { row, lineNum } of iterJsonlLines(logPath)) {
      const tsIso = safeIso(row && row.ts);
      if (!tsIso) continue;
      if (sinceIso && tsIso < sinceIso) continue;

      const kind = row.kind;
      const cls = classifyKind(kind);
      if (!cls) continue;

      // Track run boundaries and model parsing on every relevant row.
      if (kind === 'work-start') {
        currentHandoff = typeof row.ref === 'string' ? row.ref : null;
        currentRunStartTs = tsIso;
        currentRunId = makeRunId(runtime, workerId, currentRunStartTs);
        currentModel = null;
      }
      // If we somehow see events before any work-start, synthesize a
      // run id pinned to the first event's ts so envelopes are still
      // groupable (rare, but prevents drops).
      if (!currentRunId) {
        currentRunStartTs = tsIso;
        currentRunId = makeRunId(runtime, workerId, currentRunStartTs);
      }

      // Sniff model banner from stderr text.
      if (kind === 'subproc-stderr' && currentModel == null) {
        const m = extractModel(row.data);
        if (m) currentModel = m;
      }

      // Build content per role.
      let content;
      if (cls.role === 'prompt') {
        content = {
          text: typeof row.data === 'string' ? row.data : '',
          prompt_file: row.prompt_file || null,
        };
      } else if (cls.role === 'reasoning' || cls.role === 'response') {
        content = { text: typeof row.data === 'string' ? row.data : '' };
      } else {
        // meta
        const { ts, worker_id, kind: _k, ...rest } = row;
        content = { kind, ...rest };
      }

      // Stable per-row key for deterministic id generation.
      const key = `worker-log|${workerId}|${lineNum}`;
      const id = deriveEnvelopeId(key);

      // Worker-log envelopes are usually planning-coupled (the worker
      // is consuming a handoff prompt or emitting result around it). If
      // no path-based signal in content, default planning when the run
      // has a handoff_id, else 'meta'.
      const inferred = deriveContentType({ content });
      const contentType = inferred !== 'meta' ? inferred : (currentHandoff ? 'planning' : 'meta');

      let env;
      try {
        env = makeEnvelope({
          id,
          ts: tsIso,
          run_id: currentRunId,
          project: 'global',
          runtime,
          role: cls.role,
          content,
          seq: lineNum,
          task_id: null,
          handoff_id: currentHandoff,
          model: currentModel,
          agent_id: workerId,
          content_type: contentType,
        });
      } catch (e) {
        process.stderr.write(`[worker-log] makeEnvelope failed ${workerId}:${lineNum}: ${e.message}\n`);
        continue;
      }

      const v = validateEnvelope(env);
      if (!v.ok) {
        process.stderr.write(`[worker-log] invalid envelope ${workerId}:${lineNum}: ${v.errors.join('; ')}\n`);
        continue;
      }
      yield env;
    }
  }
}

module.exports = {
  iterEnvelopes,
  // exported for testing
  _internal: {
    classifyKind,
    extractModel,
    listWorkerDirs,
    readStatusRuntime,
  },
};
