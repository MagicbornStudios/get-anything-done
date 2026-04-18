'use strict';
/**
 * secrets-lifecycle.cjs — key lifecycle layer on top of lib/secrets-store.cjs.
 *
 * Normative spec: references/byok-design.md §9 (rotation + revocation).
 * Task: 60-05. Decision: gad-266 E (additive rotation, 7-day grace, 0-30).
 *
 * Responsibilities:
 *   - Wrap store.rotate / store.revoke with a richer audit log
 *     (eventId, eventType, actor, details) at .gad/secrets/<id>.audit.jsonl.
 *   - Grace-period purge: walk envelope, drop expired non-current versions,
 *     emit one `purge` audit event per purged version. (No re-encryption —
 *     AEAD slots remain untouched; we're deleting a JSON field per §9.2.)
 *   - Stream the audit log newest-first with since/limit filtering.
 *
 * Scope rules (task 60-05 contract):
 *   - Library-only. No CLI wiring here.
 *   - Does NOT modify secrets-store.cjs or envelope.cjs — pure wrapper.
 *   - Reads/writes the envelope file directly for purgeExpired (option B in
 *     the task spec) because store exposes rotate/revoke but no public
 *     "write envelope" helper. Re-encryption is NOT needed — each AEAD slot
 *     (nonce/ciphertext/tag) stays intact; purge only deletes a version
 *     entry from the plaintext JSON metadata.
 *
 * Fail-closed ordering (see tip security-fail-closed-ordering-01):
 *   - rotate/revoke: store op FIRST, audit append SECOND. If the store op
 *     throws, the audit log is never touched. If the audit append throws
 *     AFTER the store op succeeds, the caller sees an AuditWriteError but
 *     the store state is already committed — audit is at-least-once, not
 *     exactly-once. This is the correct trade-off: the canonical state is
 *     the envelope, the audit log is observability.
 *   - purge: the audit append happens per-version INSIDE the envelope
 *     mutation loop, but the envelope write happens once at the end. If
 *     audit append throws mid-loop, the envelope has NOT been rewritten
 *     yet — so a retry will re-purge the same versions cleanly.
 *
 * Audit log format (JSONL, one event per line):
 *   {"eventId":"<uuid>","eventType":"rotate|revoke|purge|bag-created",
 *    "projectId":"...","keyName":"...","ts":"<iso8601>","actor":"cli",
 *    "details":{...}}
 *
 * The store itself already writes legacy `{ts, event: 'envrotate', ...}`
 * rows to the same file (from task 60-02). The lifecycle layer writes
 * richer rows alongside them — readers must handle both shapes. auditLog()
 * returns both shapes unchanged; future schema normalization is a
 * separate concern.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const defaultStore = require('./secrets-store.cjs');
const envelope = require('./envelope.cjs');
const { SecretsStoreError } = require('./secrets-store-errors.cjs');

/**
 * Closed set of lifecycle event types. Frozen so callers cannot mutate.
 * Exhaustiveness asserted by tests.
 */
const LIFECYCLE_EVENT_TYPES = Object.freeze(['rotate', 'revoke', 'purge', 'bag-created']);

/**
 * AuditWriteError — thrown when the audit-log append fails AFTER the
 * primary store operation succeeded. `.cause` preserves the underlying
 * fs error for debugging. The caller's store state is already committed;
 * this error only signals that observability lost an event.
 *
 * Extends SecretsStoreError with a new code so the error family is
 * consistent, but does NOT add the code to the store's KNOWN_CODES set
 * (that set is scoped to the store and 60-02 is frozen).
 */
class AuditWriteError extends SecretsStoreError {
  constructor(message, cause) {
    super('AUDIT_WRITE_FAILED', message);
    this.name = 'AuditWriteError';
    if (cause !== undefined) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Default helpers (injected via createSecretsLifecycle overrides)
// ---------------------------------------------------------------------------

function defaultNow() { return new Date(); }

function defaultUuid() {
  // Node 14.17+ has crypto.randomUUID. Avoid adding deps per task contract.
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback for older runtimes: 16 random bytes, v4-shaped.
  const b = crypto.randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function defaultAuditPath(store, projectId) {
  return store.auditPath(projectId);
}

function defaultEnvelopePath(store, projectId) {
  return store.envelopePath(projectId);
}

/**
 * Default appendAuditLog: one fsync'd append per call. Returns the
 * eventId on success; throws an AuditWriteError (with cause) on failure.
 * fsOverride lets tests swap the fs module for a failing stub.
 */
function makeDefaultAppendAuditLog(store, fsImpl) {
  return function appendAuditLog(event) {
    const p = defaultAuditPath(store, event.projectId);
    const line = JSON.stringify(event) + '\n';
    try {
      fsImpl.mkdirSync(path.dirname(p), { recursive: true });
      fsImpl.appendFileSync(p, line, { mode: 0o600 });
    } catch (e) {
      throw new AuditWriteError(
        `could not append audit event to ${p}: ${e.message}`,
        e,
      );
    }
    return event.eventId;
  };
}

/**
 * Default readAuditLog: tolerant JSONL reader. Returns an array of parsed
 * events in file order (oldest-first on disk). Skips malformed lines
 * silently — the audit log is observability, not a source of truth, and
 * a partially-written last line (concurrent appender) should not poison
 * the whole read.
 */
function makeDefaultReadAuditLog(store, fsImpl) {
  return function readAuditLog(projectId) {
    const p = defaultAuditPath(store, projectId);
    if (!fsImpl.existsSync(p)) return [];
    const raw = fsImpl.readFileSync(p, 'utf8');
    const out = [];
    for (const line of String(raw).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed));
      } catch (_) {
        // Tolerate torn writes / malformed lines. Continue.
      }
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// Envelope direct read/write (option B from the task spec)
// ---------------------------------------------------------------------------

function readEnvelopeDirect(store, projectId, fsImpl) {
  const p = defaultEnvelopePath(store, projectId);
  if (!fsImpl.existsSync(p)) return null;
  const raw = fsImpl.readFileSync(p, 'utf8');
  return envelope.parseEnvelope(raw);
}

/**
 * Atomic envelope write: serialize to tmp, rename over target.
 * Per security-fail-closed-ordering-01 — a crash mid-write leaves the
 * previous envelope intact rather than producing a half-written file.
 */
function writeEnvelopeDirect(store, projectId, env, fsImpl) {
  const p = defaultEnvelopePath(store, projectId);
  const dir = path.dirname(p);
  fsImpl.mkdirSync(dir, { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}`;
  fsImpl.writeFileSync(tmp, envelope.serializeEnvelope(env), { mode: 0o600 });
  try {
    fsImpl.renameSync(tmp, p);
  } catch (e) {
    // Clean up tmp if rename failed (Windows sometimes needs an unlink
    // before rename-over-existing; retry that way).
    try {
      if (fsImpl.existsSync(p)) fsImpl.unlinkSync(p);
      fsImpl.renameSync(tmp, p);
    } catch (e2) {
      try { fsImpl.unlinkSync(tmp); } catch (_) { /* ignore */ }
      throw e2;
    }
  }
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Build a lifecycle wrapper bound to a specific store + overrides.
 *
 * Most callers use the default instance exported as `secretsLifecycle`.
 * The factory exists so tests (and future CLI wiring) can inject:
 *   - `store`: alternate store impl or mock.
 *   - `now`: frozen clock for deterministic tests.
 *   - `uuid`: deterministic eventId generator for tests.
 *   - `readAuditLog` / `appendAuditLog`: swap the persistence layer
 *     (e.g. in-memory for unit tests, or an fs-failing stub for fail-closed
 *     tests).
 *   - `fsOverride`: swap the `fs` module wholesale (env + audit reads/writes).
 *
 * Returns `{ rotate, revoke, purgeExpired, auditLog }`.
 */
function createSecretsLifecycle(opts = {}) {
  const store = opts.store || defaultStore;
  const now = typeof opts.now === 'function' ? opts.now : defaultNow;
  const uuid = typeof opts.uuid === 'function' ? opts.uuid : defaultUuid;
  const fsImpl = opts.fsOverride || fs;
  const appendAuditLog = typeof opts.appendAuditLog === 'function'
    ? opts.appendAuditLog
    : makeDefaultAppendAuditLog(store, fsImpl);
  const readAuditLog = typeof opts.readAuditLog === 'function'
    ? opts.readAuditLog
    : makeDefaultReadAuditLog(store, fsImpl);
  const actor = typeof opts.actor === 'string' ? opts.actor : 'cli';

  function buildEvent(eventType, projectId, keyName, details) {
    return {
      eventId: uuid(),
      eventType,
      projectId,
      keyName,
      ts: now().toISOString(),
      actor,
      details: details || {},
    };
  }

  /**
   * Wraps store.rotate with a richer audit event. Store op runs first; if
   * it throws, audit is untouched. If audit append throws after a
   * successful rotate, the rotate is NOT rolled back — caller sees an
   * AuditWriteError and the envelope is committed.
   *
   * @returns {Promise<{oldVersion:number, newVersion:number, auditEventId:string}>}
   */
  async function rotate({ projectId, keyName, newValue, graceDays = 7, passphrase, forcePassphrase, reason = null }) {
    const result = await store.rotate({ projectId, keyName, newValue, graceDays, passphrase, forcePassphrase });
    const event = buildEvent('rotate', projectId, keyName, {
      oldVersion: result.oldVersion,
      newVersion: result.newVersion,
      graceDays,
      reason,
    });
    appendAuditLog(event);
    return { oldVersion: result.oldVersion, newVersion: result.newVersion, auditEventId: event.eventId };
  }

  /**
   * Wraps store.revoke. Snapshots the removed version list BEFORE the
   * revoke (store.revoke removes versions from the envelope), then runs
   * the store op, then audit-appends. Same fail-closed ordering as
   * rotate. `removedVersions` comes from a direct envelope read — if the
   * envelope can't be read (missing, corrupt) we fall back to a short
   * snapshot (the store will surface the real error).
   *
   * @returns {Promise<{auditEventId:string, removedVersions:number[]}>}
   */
  async function revoke({ projectId, keyName, version, passphrase, forcePassphrase, reason = null }) {
    // Snapshot the version list BEFORE revoke. This is observability only —
    // if we can't read it (envelope missing/corrupt), still attempt the
    // store op; the store will surface the real error.
    let snapshotVersions = [];
    try {
      const pre = readEnvelopeDirect(store, projectId, fsImpl);
      if (pre && pre.keys && pre.keys[keyName] && pre.keys[keyName].versions) {
        if (version === undefined) {
          snapshotVersions = Object.keys(pre.keys[keyName].versions).map(Number).sort((a, b) => a - b);
        } else {
          snapshotVersions = [Number(version)];
        }
      }
    } catch (_) {
      // Best-effort — leave snapshot empty.
    }

    await store.revoke({ projectId, keyName, version, passphrase, forcePassphrase });

    const event = buildEvent('revoke', projectId, keyName, {
      removedVersions: snapshotVersions,
      version: version === undefined ? null : Number(version),
      reason,
    });
    appendAuditLog(event);
    return { auditEventId: event.eventId, removedVersions: snapshotVersions };
  }

  /**
   * Grace-period purge per §9.2. Walks all keys, all non-current versions;
   * for any version whose retiresAt <= asOf, removes that version from the
   * envelope. Appends one `purge` audit event per purged version. The
   * current version is ALWAYS preserved even if retiresAt is unexpectedly
   * in the past (guard — currentVersion.retiresAt should always be null
   * per §9.1 invariants, but we defend against malformed envelopes).
   *
   * @returns {Promise<{purgedCount:number, byKey:Object<string,number[]>}>}
   */
  async function purgeExpired({ projectId, asOf }) {
    const cutoff = asOf instanceof Date ? asOf : (asOf ? new Date(asOf) : now());
    const env = readEnvelopeDirect(store, projectId, fsImpl);
    if (!env) return { purgedCount: 0, byKey: {} };

    const byKey = {};
    let purgedCount = 0;
    const auditEvents = [];

    for (const [keyName, entry] of Object.entries(env.keys || {})) {
      const versions = entry && entry.versions ? entry.versions : {};
      const currentVersion = entry && entry.currentVersion;
      const toPurge = [];
      for (const [vStr, ver] of Object.entries(versions)) {
        const vNum = Number(vStr);
        // GUARD: never purge the current version, regardless of retiresAt.
        if (vNum === currentVersion) continue;
        if (!ver || !ver.retiresAt) continue;
        const retiresAtMs = new Date(ver.retiresAt).getTime();
        if (Number.isNaN(retiresAtMs)) continue;
        if (retiresAtMs <= cutoff.getTime()) {
          toPurge.push({ version: vNum, retiredAt: ver.retiresAt });
        }
      }
      if (toPurge.length === 0) continue;
      for (const p of toPurge) {
        delete versions[String(p.version)];
        byKey[keyName] = byKey[keyName] || [];
        byKey[keyName].push(p.version);
        auditEvents.push(buildEvent('purge', projectId, keyName, {
          version: p.version,
          retiredAt: p.retiredAt,
          gracePeriodExpired: true,
        }));
        purgedCount += 1;
      }
    }

    if (purgedCount === 0) return { purgedCount: 0, byKey: {} };

    // Write envelope FIRST (canonical state), audit events AFTER. If audit
    // append throws, the purge is still committed; next invocation's purge
    // will be a no-op on these versions (they're already gone) — no double
    // audit risk.
    writeEnvelopeDirect(store, projectId, env, fsImpl);

    for (const e of auditEvents) {
      appendAuditLog(e);
    }

    return { purgedCount, byKey };
  }

  /**
   * Read-only counterpart to `purgeExpired`. Computes the set of versions
   * that would be purged at `asOf` WITHOUT writing the envelope and
   * WITHOUT appending audit events. Returns the same `{purgedCount, byKey}`
   * shape as `purgeExpired` so callers can present a diff. Safe to call
   * when the envelope does not exist (returns a zero result).
   *
   * @returns {Promise<{purgedCount:number, byKey:Object<string,number[]>}>}
   */
  async function previewPurge({ projectId, asOf }) {
    const cutoff = asOf instanceof Date ? asOf : (asOf ? new Date(asOf) : now());
    const env = readEnvelopeDirect(store, projectId, fsImpl);
    if (!env) return { purgedCount: 0, byKey: {} };
    const byKey = {};
    let purgedCount = 0;
    for (const [keyName, entry] of Object.entries(env.keys || {})) {
      const versions = entry && entry.versions ? entry.versions : {};
      const currentVersion = entry && entry.currentVersion;
      for (const [vStr, ver] of Object.entries(versions)) {
        const vNum = Number(vStr);
        if (vNum === currentVersion) continue;
        if (!ver || !ver.retiresAt) continue;
        const retiresAtMs = new Date(ver.retiresAt).getTime();
        if (Number.isNaN(retiresAtMs)) continue;
        if (retiresAtMs <= cutoff.getTime()) {
          byKey[keyName] = byKey[keyName] || [];
          byKey[keyName].push(vNum);
          purgedCount += 1;
        }
      }
    }
    return { purgedCount, byKey };
  }

  /**
   * Stream the audit log, newest-first, with optional `since` (ISO8601 or
   * Date — events with ts >= since included) and `limit` (max events
   * returned; null for unbounded).
   *
   * Concurrent-write safety: if another process appends while we're
   * reading, we see the lines that existed at read time. Malformed /
   * half-written trailing lines are silently skipped (tolerant parse).
   *
   * @returns {Promise<{events:object[], nextCursor:(string|null)}>}
   */
  async function auditLog({ projectId, since = null, limit = null }) {
    const all = readAuditLog(projectId);
    let filtered = all;
    if (since) {
      const sinceMs = since instanceof Date ? since.getTime() : new Date(since).getTime();
      if (!Number.isNaN(sinceMs)) {
        filtered = all.filter((e) => {
          if (!e || !e.ts) return false;
          const ms = new Date(e.ts).getTime();
          return !Number.isNaN(ms) && ms >= sinceMs;
        });
      }
    }
    // Newest-first. Stable sort via reverse (preserve intra-ts order).
    const newestFirst = filtered.slice().reverse();
    const bounded = typeof limit === 'number' && limit > 0 ? newestFirst.slice(0, limit) : newestFirst;
    // Cursor is the ts of the oldest event returned — callers can pass it
    // back as `since` for paging. Null if we returned everything.
    const nextCursor = bounded.length > 0 && typeof limit === 'number' && limit > 0 && newestFirst.length > bounded.length
      ? bounded[bounded.length - 1].ts
      : null;
    return { events: bounded, nextCursor };
  }

  return { rotate, revoke, purgeExpired, previewPurge, auditLog };
}

/** Default instance bound to the real store. */
const secretsLifecycle = createSecretsLifecycle();

module.exports = {
  createSecretsLifecycle,
  secretsLifecycle,
  LIFECYCLE_EVENT_TYPES,
  AuditWriteError,
};
