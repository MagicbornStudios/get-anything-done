'use strict';
/**
 * lib/collisions/index.cjs — Phase 122 collision + regression observability.
 *
 * Provides:
 *   recordCollision(event)         — append to .planning/.collisions.jsonl
 *   listCollisions({ since, type, severity })  — read + parse + filter
 *   snapshotChecksums(filePaths, baseDir)      — sha256 per path, persisted to
 *                                                .planning/.collisions/checksums-by-task.json
 *   detectRegressionAfterStamp({ taskId, baseDir })  — compare current vs snapshot
 *   detectCycle({ handoffId, depth, baseDir })        — walk parent_handoff_id chain
 *
 * All I/O is synchronous, no npm deps (node:crypto / node:fs only).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLISIONS_FILE = '.planning/.collisions.jsonl';
const CHECKSUMS_FILE = '.planning/.collisions/checksums-by-task.json';
const HANDOFFS_DIR = '.planning/handoffs';
const DEDUP_WINDOW_MS = 60_000; // 1 minute

/** Valid collision types. */
const VALID_TYPES = [
  'double-claim',
  'race-on-mailbox',
  'regression-on-stamp',
  'handoff-cycle',
  'concurrent-edit',
];

/** Valid severities (low → critical). */
const SEVERITY_ORDER = ['low', 'medium', 'high', 'critical'];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function collisionsPath(baseDir) {
  return path.join(baseDir, COLLISIONS_FILE);
}

function checksumsPath(baseDir) {
  return path.join(baseDir, CHECKSUMS_FILE);
}

/**
 * Build a stable fingerprint for an event.
 * Deduplication key: type + source + one-minute bucket (truncate ts to minute).
 */
function buildFingerprint(event) {
  const tsBucket = event.ts
    ? String(event.ts).slice(0, 16)   // "2026-05-07T14:23" — minute granularity
    : '';
  const raw = `${event.type}|${event.source || ''}|${tsBucket}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Check whether a collision with the same fingerprint was logged within the
 * dedup window. Returns true if a dupe is found (caller should skip).
 */
function isDuplicate(baseDir, fingerprint) {
  const filePath = collisionsPath(baseDir);
  if (!fs.existsSync(filePath)) return false;

  const now = Date.now();
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (ev.fingerprint !== fingerprint) continue;
      const evTs = ev.ts ? new Date(ev.ts).getTime() : 0;
      if (now - evTs < DEDUP_WINDOW_MS) return true;
    } catch { /* malformed line — skip */ }
  }
  return false;
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a collision event.
 *
 * @param {object} event
 * @param {string} event.type       — one of VALID_TYPES
 * @param {string} [event.severity] — 'low'|'medium'|'high'|'critical' (default: 'medium')
 * @param {string} [event.source]   — agent / runtime that triggered
 * @param {object} [event.payload]  — arbitrary context
 * @param {string} [event.baseDir]  — repo root (if not set, inferred from cwd)
 *
 * Returns the event as written (with ts + fingerprint filled in).
 */
function recordCollision(event) {
  const baseDir = event.baseDir || process.cwd();
  const ts = new Date().toISOString();

  const normalized = {
    ts,
    type: VALID_TYPES.includes(event.type) ? event.type : 'concurrent-edit',
    severity: SEVERITY_ORDER.includes(event.severity) ? event.severity : 'medium',
    source: event.source || process.env.GAD_AGENT || 'unknown',
    payload: event.payload || {},
    fingerprint: '',
  };
  normalized.fingerprint = buildFingerprint(normalized);

  // Deduplicate within 1-minute window
  if (isDuplicate(baseDir, normalized.fingerprint)) {
    return normalized; // already logged, skip
  }

  const line = JSON.stringify(normalized) + '\n';
  const filePath = collisionsPath(baseDir);
  ensureDir(filePath);
  fs.appendFileSync(filePath, line, 'utf8');

  return normalized;
}

/**
 * List collision events, with optional filtering.
 *
 * @param {object} [opts]
 * @param {string} [opts.baseDir]
 * @param {string} [opts.since]    — ISO date string lower bound (inclusive)
 * @param {string} [opts.type]     — filter by type
 * @param {string} [opts.severity] — filter by minimum severity
 * @returns {Array<object>}
 */
function listCollisions({ baseDir, since, type, severity } = {}) {
  const dir = baseDir || process.cwd();
  const filePath = collisionsPath(dir);
  if (!fs.existsSync(filePath)) return [];

  const sinceTs = since ? new Date(since).getTime() : 0;
  const minSeverityIdx = severity ? SEVERITY_ORDER.indexOf(severity) : -1;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const results = [];

  for (const line of lines) {
    try {
      const ev = JSON.parse(line);

      // Apply dismissed filter — dismissed events carry dismissed=true
      if (ev.dismissed) continue;

      // since filter
      if (sinceTs > 0) {
        const evTs = ev.ts ? new Date(ev.ts).getTime() : 0;
        if (evTs < sinceTs) continue;
      }

      // type filter
      if (type && ev.type !== type) continue;

      // severity filter (minimum)
      if (minSeverityIdx >= 0) {
        const evSevIdx = SEVERITY_ORDER.indexOf(ev.severity);
        if (evSevIdx < minSeverityIdx) continue;
      }

      results.push(ev);
    } catch { /* skip malformed */ }
  }

  return results;
}

/**
 * Compute sha256 checksums for a list of file paths.
 * Paths that don't exist get checksum='MISSING'.
 * Persists the result under checksums-by-task.json if taskId is provided.
 *
 * @param {string[]} filePaths  — absolute or relative (resolved from baseDir)
 * @param {string}   baseDir    — repo root
 * @param {string}   [taskId]   — if provided, persists to checksums-by-task.json
 * @returns {{ [path]: string }}  map of path → sha256 hex
 */
function snapshotChecksums(filePaths, baseDir, taskId) {
  const result = {};

  for (const fp of filePaths) {
    const abs = path.isAbsolute(fp) ? fp : path.join(baseDir, fp);
    if (!fs.existsSync(abs)) {
      result[fp] = 'MISSING';
      continue;
    }
    try {
      const content = fs.readFileSync(abs);
      result[fp] = crypto.createHash('sha256').update(content).digest('hex');
    } catch {
      result[fp] = 'ERROR';
    }
  }

  if (taskId) {
    const csPath = checksumsPath(baseDir);
    ensureDir(csPath);
    let existing = {};
    if (fs.existsSync(csPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(csPath, 'utf8'));
      } catch { /* corrupt, start fresh */ }
    }
    existing[taskId] = { ts: new Date().toISOString(), checksums: result };
    fs.writeFileSync(csPath, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  }

  return result;
}

/**
 * Detect regressions for a completed task by comparing current file checksums
 * against the stored snapshot.
 *
 * @param {object} opts
 * @param {string} opts.taskId
 * @param {string} opts.baseDir
 * @returns {{ regressed: string[], snapshotTs: string|null, message: string }}
 */
function detectRegressionAfterStamp({ taskId, baseDir }) {
  const csPath = checksumsPath(baseDir);
  if (!fs.existsSync(csPath)) {
    return { regressed: [], snapshotTs: null, message: 'No checksum snapshot on file.' };
  }

  let stored;
  try {
    stored = JSON.parse(fs.readFileSync(csPath, 'utf8'));
  } catch {
    return { regressed: [], snapshotTs: null, message: 'Checksum file unreadable.' };
  }

  const entry = stored[taskId];
  if (!entry || !entry.checksums) {
    return { regressed: [], snapshotTs: null, message: `No snapshot for task ${taskId}.` };
  }

  const regressed = [];
  for (const [fp, storedHash] of Object.entries(entry.checksums)) {
    if (storedHash === 'MISSING' || storedHash === 'ERROR') continue;
    const abs = path.isAbsolute(fp) ? fp : path.join(baseDir, fp);
    let currentHash;
    if (!fs.existsSync(abs)) {
      currentHash = 'MISSING';
    } else {
      try {
        const content = fs.readFileSync(abs);
        currentHash = crypto.createHash('sha256').update(content).digest('hex');
      } catch {
        currentHash = 'ERROR';
      }
    }
    if (currentHash !== storedHash) {
      regressed.push(fp);
    }
  }

  return {
    regressed,
    snapshotTs: entry.ts || null,
    message: regressed.length === 0
      ? 'No regressions detected.'
      : `${regressed.length} file(s) changed since stamp: ${regressed.join(', ')}`,
  };
}

/**
 * Detect a cycle in the handoff parent chain.
 *
 * Walks parent_handoff_id fields in handoff frontmatter.
 * Returns { cycle: boolean, chain: string[], depth: number }.
 *
 * @param {object} opts
 * @param {string} opts.handoffId  — starting handoff id
 * @param {number} [opts.depth]    — max depth before declaring a cycle (default: 5)
 * @param {string} opts.baseDir    — repo root
 */
function detectCycle({ handoffId, depth = 5, baseDir }) {
  const visited = [];
  let current = handoffId;
  const maxDepth = Math.max(1, depth);

  // Parse frontmatter from a handoff file (search all buckets)
  function readFrontmatter(id) {
    const buckets = ['open', 'claimed', 'closed'];
    for (const bucket of buckets) {
      const fp = path.join(baseDir, HANDOFFS_DIR, bucket, `${id}.md`);
      if (!fs.existsSync(fp)) continue;
      try {
        const text = fs.readFileSync(fp, 'utf8');
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return {};
        const fm = {};
        for (const line of match[1].split(/\r?\n/)) {
          const colonIdx = line.indexOf(':');
          if (colonIdx === -1) continue;
          fm[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
        }
        return fm;
      } catch { return {}; }
    }
    return null; // not found
  }

  while (current) {
    if (visited.includes(current)) {
      return { cycle: true, chain: [...visited, current], depth: visited.length };
    }
    visited.push(current);

    if (visited.length > maxDepth) {
      return { cycle: true, chain: visited, depth: visited.length,
        message: `Depth limit ${maxDepth} exceeded — treating as cycle.` };
    }

    const fm = readFrontmatter(current);
    if (fm === null) {
      // handoff not found — end of chain
      break;
    }
    const parent = fm['parent_handoff_id'] || '';
    current = parent && parent !== 'null' ? parent : null;
  }

  return { cycle: false, chain: visited, depth: visited.length };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  recordCollision,
  listCollisions,
  snapshotChecksums,
  detectRegressionAfterStamp,
  detectCycle,
  VALID_TYPES,
  SEVERITY_ORDER,
};
