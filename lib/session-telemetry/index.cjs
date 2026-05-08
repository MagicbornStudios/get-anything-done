'use strict';
/**
 * lib/session-telemetry/index.cjs — Phase 89 session telemetry substrate.
 *
 * Telemetry events are appended to:
 *   <projectRoot>/.planning/sessions/<sessionId>.telemetry.jsonl
 *
 * The file is gitignored (patterns already cover .planning/sessions/).
 * This module intentionally uses only Node.js built-ins (no citty, no gad
 * internals) so it can be required from any layer without circular deps.
 *
 * Exports:
 *   appendTelemetryEvent({ sessionId, runtime, kind, payload, ts? })
 *   tailSession({ sessionId, projectRoot?, follow })  → async iterator
 *   loadSessionStats({ projectRoot, since })          → JSON
 *   preserveSession({ sessionId, projectRoot?, outDir }) → copied path
 *
 * Event kinds (phase 89, extend in later phases):
 *   task-start | decomposition | step | tool-call | retry
 *   task-end   | rate-limit    | context-compact
 */

const fs = require('fs');
const path = require('path');

// ── constants ────────────────────────────────────────────────────────────────

const SCHEMA_VERSION = 1;
const VALID_KINDS = new Set([
  'task-start',
  'decomposition',
  'step',
  'tool-call',
  'retry',
  'task-end',
  'rate-limit',
  'context-compact',
]);
const TAIL_POLL_MS = 500;

// ── helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

/**
 * Walk up from cwd to find a dir containing .planning/. Returns null if not
 * found. Same algorithm as compute.cjs / claude-session-emit.cjs.
 */
function findProjectRoot(start) {
  let dir = path.resolve(start || process.cwd());
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function sessionsDir(projectRoot) {
  return path.join(projectRoot, '.planning', 'sessions');
}

function telemetryFile(projectRoot, sessionId) {
  return path.join(sessionsDir(projectRoot), `${sessionId}.telemetry.jsonl`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseSince(since) {
  if (!since) return null;
  // Accept "7d", "30d", or "YYYY-MM-DD"
  const daysMatch = String(since).match(/^(\d+)d$/i);
  if (daysMatch) {
    return Date.now() - Number(daysMatch[1]) * 86400_000;
  }
  const ts = Date.parse(since);
  return Number.isFinite(ts) ? ts : null;
}

function readJsonlFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

// ── appendTelemetryEvent ──────────────────────────────────────────────────────

/**
 * Append a single telemetry event to the session's .telemetry.jsonl file.
 *
 * @param {object} opts
 * @param {string}  opts.sessionId  — session identifier (e.g. "s-20260507-abcdef12")
 * @param {string}  opts.runtime    — producing runtime (e.g. "claude-code", "codex-cli")
 * @param {string}  opts.kind       — event kind (see VALID_KINDS)
 * @param {object}  opts.payload    — arbitrary JSON payload merged into the event
 * @param {string}  [opts.ts]       — ISO timestamp; defaults to now
 * @param {string}  [opts.projectRoot] — override project root resolution
 * @returns {object} the appended event record
 */
function appendTelemetryEvent({ sessionId, runtime, kind, payload = {}, ts, projectRoot }) {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error('appendTelemetryEvent: sessionId is required');
  }
  if (!runtime || typeof runtime !== 'string') {
    throw new Error('appendTelemetryEvent: runtime is required');
  }
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`appendTelemetryEvent: unknown kind "${kind}". Valid: ${[...VALID_KINDS].join(', ')}`);
  }

  const root = projectRoot || findProjectRoot();
  if (!root) {
    throw new Error('appendTelemetryEvent: cannot locate project root (no .planning/ found)');
  }

  const event = {
    ts: ts || nowIso(),
    schema_version: SCHEMA_VERSION,
    session_id: sessionId,
    runtime,
    kind,
    ...payload,
  };

  const file = telemetryFile(root, sessionId);
  ensureDir(path.dirname(file));
  fs.appendFileSync(file, JSON.stringify(event) + '\n', 'utf8');
  return event;
}

// ── tailSession ──────────────────────────────────────────────────────────────

/**
 * Async generator that yields telemetry events from a session file.
 *
 * @param {object} opts
 * @param {string}  opts.sessionId
 * @param {string}  [opts.projectRoot]
 * @param {boolean} [opts.follow=false] — when true, keep polling for new lines
 * @yields {object} parsed event records
 */
async function* tailSession({ sessionId, projectRoot, follow = false }) {
  const root = projectRoot || findProjectRoot();
  if (!root) return;

  const file = telemetryFile(root, sessionId);
  let offset = 0;

  function readNewLines() {
    if (!fs.existsSync(file)) return [];
    const buf = fs.readFileSync(file, 'utf8');
    const chunk = buf.slice(offset);
    offset = buf.length;
    return chunk.split(/\r?\n/).filter(Boolean).map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  }

  // Initial drain
  for (const event of readNewLines()) {
    yield event;
  }

  if (!follow) return;

  // Follow mode: poll every TAIL_POLL_MS
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, TAIL_POLL_MS));
    for (const event of readNewLines()) {
      yield event;
    }
  }
}

// ── loadSessionStats ─────────────────────────────────────────────────────────

/**
 * Aggregate telemetry across all sessions in .planning/sessions/.
 *
 * @param {object} opts
 * @param {string}  [opts.projectRoot]
 * @param {string}  [opts.since] — "7d", "30d", or "YYYY-MM-DD"
 * @returns {object} aggregated stats
 */
function loadSessionStats({ projectRoot, since } = {}) {
  const root = projectRoot || findProjectRoot();
  const sinceMs = parseSince(since);
  const dir = root ? sessionsDir(root) : null;

  const stats = {
    total_sessions: 0,
    events_per_runtime: {},
    decomposition_depth_histogram: {},
    retry_rate: 0,
    avg_tool_calls_per_task: 0,
    since: since || null,
    generated_at: nowIso(),
  };

  if (!dir || !fs.existsSync(dir)) return stats;

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.telemetry.jsonl'));
  } catch {
    return stats;
  }

  let totalTasks = 0;
  let totalTasksWithRetry = 0;
  let totalToolCalls = 0;
  // Per task-session, track tool calls to compute average
  const toolCallsPerTask = [];
  let currentTaskToolCalls = 0;
  let inTask = false;

  for (const fname of files) {
    const fpath = path.join(dir, fname);
    const events = readJsonlFile(fpath);
    if (events.length === 0) continue;

    // Filter by since
    const filtered = sinceMs
      ? events.filter((e) => {
          const t = Date.parse(e.ts);
          return Number.isFinite(t) && t >= sinceMs;
        })
      : events;

    if (filtered.length === 0) continue;

    stats.total_sessions += 1;

    for (const event of filtered) {
      const rt = event.runtime || 'unknown';

      // events-per-runtime
      stats.events_per_runtime[rt] = (stats.events_per_runtime[rt] || 0) + 1;

      switch (event.kind) {
        case 'task-start':
          totalTasks += 1;
          currentTaskToolCalls = 0;
          inTask = true;
          break;

        case 'task-end':
          if (inTask) {
            toolCallsPerTask.push(currentTaskToolCalls);
            inTask = false;
          }
          break;

        case 'tool-call':
          totalToolCalls += 1;
          if (inTask) currentTaskToolCalls += 1;
          break;

        case 'retry':
          totalTasksWithRetry += 1;
          break;

        case 'decomposition': {
          // payload may carry { depth: N } — histogram on depth value
          const depth = String(event.depth != null ? event.depth : (event.payload_depth != null ? event.payload_depth : 'unknown'));
          stats.decomposition_depth_histogram[depth] = (stats.decomposition_depth_histogram[depth] || 0) + 1;
          break;
        }

        default:
          break;
      }
    }

    // Close any open task at file boundary
    if (inTask) {
      toolCallsPerTask.push(currentTaskToolCalls);
      inTask = false;
    }
  }

  stats.retry_rate = totalTasks > 0
    ? Math.round((totalTasksWithRetry / totalTasks) * 1000) / 1000
    : 0;
  stats.avg_tool_calls_per_task = toolCallsPerTask.length > 0
    ? Math.round((toolCallsPerTask.reduce((a, b) => a + b, 0) / toolCallsPerTask.length) * 100) / 100
    : 0;

  return stats;
}

// ── preserveSession ──────────────────────────────────────────────────────────

/**
 * Copy a session's .telemetry.jsonl to outDir for dataset preservation.
 *
 * @param {object} opts
 * @param {string}  opts.sessionId
 * @param {string}  [opts.projectRoot]
 * @param {string}  opts.outDir — destination directory (created if absent)
 * @returns {string} destination path
 */
function preserveSession({ sessionId, projectRoot, outDir }) {
  if (!sessionId) throw new Error('preserveSession: sessionId is required');
  if (!outDir) throw new Error('preserveSession: outDir is required');

  const root = projectRoot || findProjectRoot();
  if (!root) throw new Error('preserveSession: cannot locate project root');

  const src = telemetryFile(root, sessionId);
  if (!fs.existsSync(src)) {
    throw new Error(`preserveSession: telemetry file not found: ${src}`);
  }

  ensureDir(outDir);
  const dest = path.join(outDir, `${sessionId}.jsonl`);
  fs.copyFileSync(src, dest);
  process.stderr.write(`[session-telemetry] preserved ${src} → ${dest}\n`);
  return dest;
}

// ── exports ──────────────────────────────────────────────────────────────────

module.exports = {
  appendTelemetryEvent,
  tailSession,
  loadSessionStats,
  preserveSession,
  // Exported for tests / adapters
  findProjectRoot,
  sessionsDir,
  telemetryFile,
  VALID_KINDS,
};
