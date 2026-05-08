'use strict';
/**
 * lib/notifications/index.cjs — global notification substrate (phase 111-01).
 *
 * Storage: <planningDir>/notifications/active.jsonl (one JSON object per line).
 * Archive: <planningDir>/notifications/archive/<YYYY-MM-DD>.jsonl
 *
 * Record shape:
 *   {
 *     id:         string  — "not-<unix-ms>-<rand4>"
 *     ts:         string  — ISO timestamp when created
 *     severity:   "info" | "warn" | "error" | "critical"
 *     source:     string
 *     title:      string
 *     message:    string
 *     expires_at: string  — ISO timestamp (default: ts + 24h)
 *     actions?:   Array<{ label: string, command: string }>
 *     fingerprint?: string
 *     dismissed:  boolean
 *   }
 *
 * Immutability strategy for dismiss:
 *   Full rewrite of active.jsonl with dismissed:true on the target record.
 *   This is simple, correct, and the file stays compact (one active.jsonl,
 *   one archive per day). JSONL append is used only for creates.
 *
 * clearExpired is called automatically inside listActive() so callers
 * never observe stale expired entries unless they pass includeExpired.
 *
 * No external deps — zero-dep per standing policy.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Path helpers — find the .planning/notifications dir for a given repo root.
// ---------------------------------------------------------------------------

/**
 * Locate the repository root by walking up from cwd until .planning is found,
 * or accept an explicit override via GAD_REPO_ROOT env var.
 */
function findRepoRoot() {
  const override = process.env.GAD_REPO_ROOT;
  if (override) return override;
  let dir = process.cwd();
  for (let i = 0; i < 20; i++) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: use cwd and let callers handle missing dirs gracefully.
  return process.cwd();
}

function notificationsDir(baseDir) {
  return path.join(baseDir, '.planning', 'notifications');
}

function activeJsonlPath(baseDir) {
  return path.join(notificationsDir(baseDir), 'active.jsonl');
}

function archiveDir(baseDir) {
  return path.join(notificationsDir(baseDir), 'archive');
}

function archivePath(baseDir, dateStr) {
  return path.join(archiveDir(baseDir), `${dateStr}.jsonl`);
}

// ---------------------------------------------------------------------------
// Low-level JSONL helpers
// ---------------------------------------------------------------------------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readAllEntries(baseDir) {
  const p = activeJsonlPath(baseDir);
  if (!fs.existsSync(p)) return [];
  let lines;
  try { lines = fs.readFileSync(p, 'utf8').split('\n'); }
  catch { return []; }
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* malformed — skip */ }
  }
  return out;
}

function writeAllEntries(baseDir, entries) {
  const p = activeJsonlPath(baseDir);
  ensureDir(notificationsDir(baseDir));
  const content = entries.map(e => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '');
  fs.writeFileSync(p, content, 'utf8');
}

function appendEntry(baseDir, entry) {
  const p = activeJsonlPath(baseDir);
  ensureDir(notificationsDir(baseDir));
  fs.appendFileSync(p, JSON.stringify(entry) + '\n', 'utf8');
}

// ---------------------------------------------------------------------------
// ID + timestamp helpers
// ---------------------------------------------------------------------------

function rand4() {
  return Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
}

function makeId() {
  return `not-${Date.now()}-${rand4()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function dateStr(isoTs) {
  // Extract YYYY-MM-DD from an ISO timestamp.
  return (isoTs || nowIso()).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = new Set(['info', 'warn', 'error', 'critical']);

function validateSeverity(severity) {
  if (!VALID_SEVERITIES.has(severity)) {
    throw new Error(`Invalid severity "${severity}". Must be one of: ${[...VALID_SEVERITIES].join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// clearExpired — moves expired entries to archive/<YYYY-MM-DD>.jsonl.
// Called internally by listActive. Safe to call repeatedly (idempotent if
// nothing has expired).
// ---------------------------------------------------------------------------

function clearExpired(baseDir) {
  if (baseDir === undefined) baseDir = findRepoRoot();
  const entries = readAllEntries(baseDir);
  const now = Date.now();
  const surviving = [];
  const byDate = {};

  for (const entry of entries) {
    const expiresAt = entry.expires_at ? Date.parse(entry.expires_at) : Infinity;
    if (!Number.isNaN(expiresAt) && expiresAt <= now) {
      // Expired — move to archive.
      const d = dateStr(entry.expires_at || entry.ts);
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(entry);
    } else {
      surviving.push(entry);
    }
  }

  const archivedCount = entries.length - surviving.length;
  if (archivedCount > 0) {
    // Write surviving back to active.jsonl.
    writeAllEntries(baseDir, surviving);
    // Append to archive files.
    ensureDir(archiveDir(baseDir));
    for (const [d, expired] of Object.entries(byDate)) {
      const aPath = archivePath(baseDir, d);
      for (const e of expired) {
        fs.appendFileSync(aPath, JSON.stringify(e) + '\n', 'utf8');
      }
    }
  }

  return archivedCount;
}

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

/**
 * Create a new notification.
 *
 * @param {object} opts
 * @param {"info"|"warn"|"error"|"critical"} opts.severity
 * @param {string} opts.source
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.expires_at]    ISO timestamp; default = now + 24h
 * @param {Array}  [opts.actions]       [{label, command}]
 * @param {string} [opts.fingerprint]   Dedup key
 * @param {string} [opts._baseDir]      Override repo root (for tests)
 * @returns {{ id: string, created: boolean }}
 */
function createNotification(opts) {
  const {
    severity,
    source,
    title,
    message,
    expires_at,
    actions,
    fingerprint,
    _baseDir,
  } = opts || {};

  validateSeverity(severity);
  if (!source) throw new Error('source is required');
  if (!title) throw new Error('title is required');
  if (!message) throw new Error('message is required');

  const baseDir = _baseDir || findRepoRoot();

  // Fingerprint dedup — if a non-dismissed entry with the same fingerprint
  // exists in active.jsonl, return its id without creating a duplicate.
  if (fingerprint) {
    const existing = readAllEntries(baseDir).find(
      e => e.fingerprint === fingerprint && !e.dismissed
    );
    if (existing) {
      return { id: existing.id, created: false };
    }
  }

  const ts = nowIso();
  const defaultExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const entry = {
    id: makeId(),
    ts,
    severity,
    source: String(source),
    title: String(title),
    message: String(message),
    expires_at: expires_at || defaultExpiry,
    dismissed: false,
  };
  if (actions && Array.isArray(actions) && actions.length > 0) {
    entry.actions = actions;
  }
  if (fingerprint) {
    entry.fingerprint = String(fingerprint);
  }

  appendEntry(baseDir, entry);
  return { id: entry.id, created: true };
}

// ---------------------------------------------------------------------------
// listActive
// ---------------------------------------------------------------------------

/**
 * List notifications. Calls clearExpired first (cheap).
 *
 * @param {object} [opts]
 * @param {string} [opts.severity]         Filter by severity
 * @param {string} [opts.source]           Filter by source
 * @param {boolean} [opts.includeDismissed] Include dismissed entries
 * @param {boolean} [opts.includeExpired]  Skip the clearExpired call
 * @param {string} [opts._baseDir]         Override repo root
 * @returns {Array}
 */
function listActive(opts) {
  const {
    severity,
    source,
    includeDismissed = false,
    includeExpired = false,
    _baseDir,
  } = opts || {};

  const baseDir = _baseDir || findRepoRoot();

  // Move expired entries to archive unless caller wants them included.
  if (!includeExpired) {
    clearExpired(baseDir);
  }

  let entries = readAllEntries(baseDir);

  if (!includeDismissed) {
    entries = entries.filter(e => !e.dismissed);
  }
  if (!includeExpired) {
    const now = Date.now();
    entries = entries.filter(e => {
      const exp = e.expires_at ? Date.parse(e.expires_at) : Infinity;
      return Number.isNaN(exp) || exp > now;
    });
  }
  if (severity) {
    entries = entries.filter(e => e.severity === severity);
  }
  if (source) {
    entries = entries.filter(e => e.source === source);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// dismissNotification
// ---------------------------------------------------------------------------

/**
 * Mark a notification as dismissed. Rewrites active.jsonl.
 *
 * @param {string} id
 * @param {string} [_baseDir]
 * @returns {{ found: boolean }}
 */
function dismissNotification(id, _baseDir) {
  const baseDir = _baseDir || findRepoRoot();
  const entries = readAllEntries(baseDir);
  let found = false;
  const updated = entries.map(e => {
    if (e.id === id) {
      found = true;
      return { ...e, dismissed: true };
    }
    return e;
  });
  if (found) {
    writeAllEntries(baseDir, updated);
  }
  return { found };
}

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

/**
 * Return a compact summary for statusline consumers.
 *
 * @param {object} [opts]
 * @param {string} [opts._baseDir]
 * @returns {{ counts: object, mostRecentSeverity: string|null, total: number }}
 */
function summarize(opts) {
  const { _baseDir } = opts || {};
  const entries = listActive({ _baseDir });
  const counts = { info: 0, warn: 0, error: 0, critical: 0 };
  let mostRecentTs = null;
  let mostRecentSeverity = null;

  for (const e of entries) {
    if (counts[e.severity] !== undefined) {
      counts[e.severity]++;
    }
    if (!mostRecentTs || e.ts > mostRecentTs) {
      mostRecentTs = e.ts;
      mostRecentSeverity = e.severity;
    }
  }

  return {
    counts,
    mostRecentSeverity,
    total: entries.length,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  createNotification,
  listActive,
  dismissNotification,
  clearExpired,
  summarize,
  // Path helpers for consumers that need direct access.
  notificationsDir,
  activeJsonlPath,
  archiveDir,
  archivePath,
  findRepoRoot,
};
