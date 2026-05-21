'use strict';
/**
 * handoffs.cjs — per-file handoff queue helpers.
 *
 * Directory layout:
 *   <baseDir>/.planning/handoffs/{open,claimed,closed}/h-<timestamp>-<short>.md
 *
 * Lifecycle via fs.rename (atomic on same filesystem — no lock files).
 * Frontmatter format: leading `---\n`, `key: value\n` lines, trailing `---\n`.
 *
 * Exports:
 *   - HandoffError (named error class with stable codes)
 *   - parseFrontmatter(text)   → obj
 *   - stringifyFrontmatter(obj, body)  → full file text
 *   - listHandoffs({ baseDir, bucket, projectid, mineFirst, runtime, fsImpl })
 *   - readHandoff({ baseDir, id, fsImpl })
 *   - claimHandoff({ baseDir, id, agent, runtime, fsImpl })
 *   - completeHandoff({ baseDir, id, fsImpl })
 *   - unclaimHandoff({ baseDir, id, reason, by, fsImpl })
 *   - createHandoff({ baseDir, projectid, phase, taskId, priority, estimatedContext, body, createdBy, runtimePreference, runtimeFallbacks, runtimeRequired, noContextPack, fsImpl })
 *
 * Stable error codes:
 *   HANDOFF_NOT_FOUND   — file missing from all buckets
 *   ALREADY_CLAIMED     — claim attempted but file not in open/
 *   VALIDATION_FAILED   — required field missing or malformed
 *   HANDOFF_CLOSED      — unclaim attempted on a closed handoff
 *   WRITE_FAILED        — fs rename/write failure
 */

const fs = require('fs');
const path = require('path');

const BUCKETS = ['open', 'claimed', 'closed'];

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

class HandoffError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'HandoffError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Frontmatter helpers
// ---------------------------------------------------------------------------

/**
 * Parse YAML-ish frontmatter from a handoff file.
 * Returns { frontmatter: obj, body: string }.
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    // No frontmatter — treat everything as body
    return { frontmatter: {}, body: text };
  }
  const fmText = match[1];
  const body = match[2] || '';
  const frontmatter = {};
  for (const line of fmText.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val === 'null') {
      frontmatter[key] = null;
      continue;
    }
    if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
      try {
        frontmatter[key] = JSON.parse(val);
        continue;
      } catch {
        // Fall through to raw string if the value is not valid JSON.
      }
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

/**
 * Serialize frontmatter obj + body back to file text.
 */
function stringifyFrontmatter(obj, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    let serialized = v;
    if (serialized === null || serialized === undefined) serialized = 'null';
    else if (Array.isArray(serialized) || (typeof serialized === 'object' && serialized !== null)) serialized = JSON.stringify(serialized);
    lines.push(`${k}: ${serialized}`);
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + (body || '');
}

function normalizeEstimatedContext(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'mechanical') return 'prescribed';
  if (raw === 'reasoning') return 'exploratory';
  return raw;
}

function normalizeHandoffFrontmatter(frontmatter) {
  const normalized = { ...(frontmatter || {}) };
  normalized.estimated_context = normalizeEstimatedContext(normalized.estimated_context);
  normalized.risk = String(normalized.risk || 'safe').trim().toLowerCase() || 'safe';
  normalized.time = String(normalized.time || 'standard').trim().toLowerCase() || 'standard';
  normalized.surface = String(normalized.surface || 'local').trim().toLowerCase() || 'local';
  return normalized;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function defaultFs() {
  return {
    readdirSync: fs.readdirSync.bind(fs),
    readFileSync: (p) => fs.readFileSync(p, 'utf8'),
    writeFileSync: (p, d) => fs.writeFileSync(p, d, 'utf8'),
    renameSync: fs.renameSync.bind(fs),
    mkdirSync: fs.mkdirSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
  };
}

function handoffsDir(baseDir) {
  return path.join(baseDir, '.planning', 'handoffs');
}

function bucketDir(baseDir, bucket) {
  return path.join(handoffsDir(baseDir), bucket);
}

/** Find the bucket and full path for a given handoff id. Returns null if not found. */
function locateHandoff(baseDir, id, fsImpl) {
  for (const bucket of BUCKETS) {
    const filePath = path.join(bucketDir(baseDir, bucket), `${id}.md`);
    if (fsImpl.existsSync(filePath)) {
      return { bucket, filePath };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List handoffs.
 * @param {object} opts
 * @param {string} opts.baseDir  — path containing .planning/
 * @param {string} [opts.bucket='open']  — 'open'|'claimed'|'closed'|'all'
 * @param {string} [opts.projectid]  — filter by projectid frontmatter
 * @param {boolean} [opts.mineFirst]  — sort claimed_by === agent to top
 * @param {string} [opts.runtime]  — for mineFirst comparison
 * @param {object} [opts.fsImpl]  — injectable fs
 * @returns {Array<{id, bucket, filePath, frontmatter}>}
 */
function listHandoffs({ baseDir, bucket = 'open', projectid, mineFirst, runtime, fsImpl } = {}) {
  const fsi = fsImpl || defaultFs();
  const bucketsToScan = bucket === 'all' ? BUCKETS : [bucket];
  const results = [];

  for (const b of bucketsToScan) {
    const dir = bucketDir(baseDir, b);
    let files;
    try {
      files = fsi.readdirSync(dir);
    } catch {
      continue; // directory may not exist yet
    }
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(dir, file);
      const id = file.replace(/\.md$/, '');
      let text;
      try {
        text = fsi.readFileSync(filePath);
      } catch {
        continue;
      }
      const { frontmatter } = parseFrontmatter(text);
      const normalizedFrontmatter = normalizeHandoffFrontmatter(frontmatter);
      if (projectid && normalizedFrontmatter.projectid !== projectid) continue;
      results.push({ id, bucket: b, filePath, frontmatter: normalizedFrontmatter });
    }
  }

  if (mineFirst && runtime) {
    results.sort((a, b) => {
      const aIsMe = a.frontmatter.runtime_preference === runtime || a.frontmatter.claimed_by === runtime;
      const bIsMe = b.frontmatter.runtime_preference === runtime || b.frontmatter.claimed_by === runtime;
      if (aIsMe && !bIsMe) return -1;
      if (!aIsMe && bIsMe) return 1;
      return 0;
    });
  }

  return results;
}

function countHandoffs({ baseDir, bucket = 'open', projectid, runtime, fsImpl } = {}) {
  return listHandoffs({
    baseDir,
    bucket,
    projectid,
    runtime,
    mineFirst: false,
    fsImpl,
  }).length;
}

/**
 * Read a single handoff by id (searches all buckets).
 * Throws HandoffError(HANDOFF_NOT_FOUND) if missing.
 */
function readHandoff({ baseDir, id, fsImpl } = {}) {
  const fsi = fsImpl || defaultFs();
  const location = locateHandoff(baseDir, id, fsi);
  if (!location) {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff not found: ${id}`);
  }
  const text = fsi.readFileSync(location.filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  return {
    frontmatter: normalizeHandoffFrontmatter(frontmatter),
    body,
    bucket: location.bucket,
    filePath: location.filePath,
  };
}

/**
 * Claim a handoff: moves open/ → claimed/, rewrites frontmatter.
 * Throws ALREADY_CLAIMED if not in open/.
 * Throws HANDOFF_NOT_FOUND if missing entirely.
 */
function claimHandoff({ baseDir, id, agent, runtime, fsImpl } = {}) {
  const fsi = fsImpl || defaultFs();
  const location = locateHandoff(baseDir, id, fsi);
  if (!location) {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff not found: ${id}`);
  }
  if (location.bucket !== 'open') {
    // Phase 122: log double-claim collision before re-throwing. Non-fatal to
    // the error path — the original rejection still propagates.
    try {
      const { recordCollision } = require('./collisions/index.cjs');
      recordCollision({
        type: 'double-claim',
        severity: 'high',
        source: agent || runtime || process.env.GAD_AGENT || 'unknown',
        payload: { handoffId: id, currentBucket: location.bucket, claimedBy: agent || runtime },
        baseDir,
      });
    } catch (_colErr) {
      // collision log failure is never fatal
      try { process.stderr.write(`[handoffs] collision-log failed (non-fatal): ${_colErr.message}\n`); } catch {}
    }
    throw new HandoffError('ALREADY_CLAIMED', `Handoff ${id} is in '${location.bucket}', not 'open'`);
  }

  const text = fsi.readFileSync(location.filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  const normalized = normalizeHandoffFrontmatter(frontmatter);

  normalized.claimed_by = agent || runtime || 'unknown';
  normalized.claimed_at = new Date().toISOString();

  const newText = stringifyFrontmatter(normalized, body);
  const destDir = bucketDir(baseDir, 'claimed');
  const destPath = path.join(destDir, `${id}.md`);

  try {
    fsi.mkdirSync(destDir, { recursive: true });
    fsi.writeFileSync(location.filePath, newText);
    fsi.renameSync(location.filePath, destPath);
  } catch (e) {
    throw new HandoffError('WRITE_FAILED', `Failed to claim handoff ${id}: ${e.message}`, e);
  }

  // Phase 140: append a row to <baseDir>/.planning/.gad-log/<date>-routing.jsonl.
  // Without callers, the writer at lib/routing/decision-log.cjs has zero data
  // and slm-learning cannot train a router. Operator directive 2026-05-07.
  // Failure is non-fatal — claim already succeeded, never block the agent
  // because telemetry tripped. Use real fs (fsImpl is for in-memory tests).
  try {
    const { logHandoffClaim } = require('./routing/decision-log.cjs');
    logHandoffClaim(baseDir, {
      handoffId: id,
      body,
      runtime,
      agent,
      projectId: normalized.projectid,
      sessionId: '',
      frontmatter: normalized,
    });
  } catch (e) {
    // stderr only — never throw past the claim boundary
    try { process.stderr.write(`[handoffs] routing-log failed (non-fatal): ${e.message}\n`); } catch {}
  }

  return destPath;
}

/**
 * Complete a handoff: moves claimed/ → closed/, sets completed_at.
 * Throws HANDOFF_NOT_FOUND if not in claimed/.
 */
function completeHandoff({ baseDir, id, fsImpl } = {}) {
  const fsi = fsImpl || defaultFs();
  const location = locateHandoff(baseDir, id, fsi);
  if (!location) {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff not found: ${id}`);
  }
  if (location.bucket !== 'claimed') {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff ${id} is in '${location.bucket}', not 'claimed'`);
  }

  const text = fsi.readFileSync(location.filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  const normalized = normalizeHandoffFrontmatter(frontmatter);

  normalized.completed_at = new Date().toISOString();

  const newText = stringifyFrontmatter(normalized, body);
  const destDir = bucketDir(baseDir, 'closed');
  const destPath = path.join(destDir, `${id}.md`);

  try {
    fsi.mkdirSync(destDir, { recursive: true });
    fsi.writeFileSync(location.filePath, newText);
    fsi.renameSync(location.filePath, destPath);
  } catch (e) {
    throw new HandoffError('WRITE_FAILED', `Failed to complete handoff ${id}: ${e.message}`, e);
  }

  return destPath;
}

/**
 * Unclaim a handoff: moves claimed/ → open/, clears claimed_by/claimed_at,
 * and appends an audit entry in unclaim_history.
 */
function unclaimHandoff({ baseDir, id, reason = '', by = '', fsImpl } = {}) {
  const fsi = fsImpl || defaultFs();
  const location = locateHandoff(baseDir, id, fsi);
  if (!location) {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff not found: ${id}`);
  }
  if (location.bucket === 'closed') {
    throw new HandoffError('HANDOFF_CLOSED', `Handoff ${id} is already closed and cannot be unclaimed`);
  }
  if (location.bucket !== 'claimed') {
    throw new HandoffError('HANDOFF_NOT_FOUND', `Handoff ${id} is in '${location.bucket}', not 'claimed'`);
  }

  const text = fsi.readFileSync(location.filePath);
  const { frontmatter, body } = parseFrontmatter(text);
  const normalized = normalizeHandoffFrontmatter(frontmatter);
  const unclaimHistory = Array.isArray(normalized.unclaim_history) ? normalized.unclaim_history.slice() : [];
  unclaimHistory.push({
    at: new Date().toISOString(),
    reason: reason || '',
    by: by || '',
  });

  normalized.claimed_by = '';
  normalized.claimed_at = '';
  normalized.unclaim_history = unclaimHistory;

  const newText = stringifyFrontmatter(normalized, body);
  const destDir = bucketDir(baseDir, 'open');
  const destPath = path.join(destDir, `${id}.md`);

  try {
    fsi.mkdirSync(destDir, { recursive: true });
    fsi.writeFileSync(location.filePath, newText);
    fsi.renameSync(location.filePath, destPath);
  } catch (e) {
    throw new HandoffError('WRITE_FAILED', `Failed to unclaim handoff ${id}: ${e.message}`, e);
  }

  return destPath;
}

// ---------------------------------------------------------------------------
// Context-pack injection helpers (GLOBAL-D-464 / task 284-03)
// ---------------------------------------------------------------------------

/**
 * Sentinel string: if the handoff body already contains a context pack
 * section we do NOT append another one (idempotency guard).
 */
const CONTEXT_PACK_SENTINEL = '## Context pack';

/**
 * Try to extract CIDs referenced in a body string.
 * Looks for patterns like `cid="foo.bar"` or `data-cid="foo.bar"`.
 * Returns an array of unique cid strings (may be empty).
 */
function extractCidsFromBody(body) {
  if (!body) return [];
  const re = /(?:data-cid|cid)=["']([^"']+)["']/g;
  const found = new Set();
  let m;
  while ((m = re.exec(body)) !== null) found.add(m[1]);
  return [...found];
}

/**
 * Attempt to build and append a context pack section to a body string.
 *
 * - Idempotent: returns original body if CONTEXT_PACK_SENTINEL already present.
 * - Resilient: returns original body (+ stderr warn) on any error.
 *
 * @param {string} body
 * @param {{ taskId?: string, cids?: string[], repoRoot: string }} opts
 * @returns {string}
 */
function appendContextPack(body, { taskId, cids, repoRoot }) {
  // Idempotency guard
  if (body && body.includes(CONTEXT_PACK_SENTINEL)) return body;

  let contextPackText = '';
  try {
    const { buildContextPack } = require('./context-pack/index.cjs');

    const packParts = [];

    // Build pack for task if available
    if (taskId && String(taskId).trim()) {
      try {
        const pack = buildContextPack({ taskId: String(taskId).trim(), repoRoot });
        if (pack && pack.trim()) packParts.push(pack.trim());
      } catch (e) {
        try { process.stderr.write(`[handoffs] context-pack task build failed (non-fatal): ${e.message}\n`); } catch {}
      }
    }

    // Build packs for any cids found in the body
    const allCids = cids || extractCidsFromBody(body);
    for (const cid of allCids.slice(0, 3)) { // cap at 3 cids to keep body size reasonable
      try {
        const pack = buildContextPack({ cid, repoRoot });
        if (pack && pack.trim()) packParts.push(pack.trim());
      } catch (e) {
        try { process.stderr.write(`[handoffs] context-pack cid build failed for "${cid}" (non-fatal): ${e.message}\n`); } catch {}
      }
    }

    if (packParts.length > 0) {
      contextPackText = '\n\n' + packParts.join('\n\n---\n\n');
    }
  } catch (e) {
    // buildContextPack module not available or threw — non-fatal
    try { process.stderr.write(`[handoffs] context-pack injection failed (non-fatal): ${e.message}\n`); } catch {}
    return body;
  }

  if (!contextPackText) return body;
  return (body || '') + contextPackText;
}

/**
 * Create a new handoff in open/.
 */
function createHandoff({
  baseDir,
  projectid,
  phase,
  taskId,
  priority = 'normal',
  estimatedContext = 'prescribed',
  body,
  createdBy,
  runtimePreference,
  runtimeFallbacks,
  runtimeRequired,
  toAgent,
  risk = 'safe',
  time = 'standard',
  surface = 'local',
  noContextPack = false,
  fsImpl,
} = {}) {
  if (!projectid) throw new HandoffError('VALIDATION_FAILED', 'projectid is required');
  if (!phase) throw new HandoffError('VALIDATION_FAILED', 'phase is required');
  if (!body) throw new HandoffError('VALIDATION_FAILED', 'body is required');

  // Warn if body is overly long; encourage referencing external docs.
  if (body && body.length > 2000) {
    console.warn(`Warning: handoff body is ${body.length} characters. Consider using references instead of verbose inline content.`);
  }

  const normalizedContext = normalizeEstimatedContext(estimatedContext);

  const validPriorities = ['low', 'normal', 'high'];
  if (!validPriorities.includes(priority)) {
    throw new HandoffError('VALIDATION_FAILED', `priority must be one of: ${validPriorities.join(', ')}`);
  }
  const validContexts = ['prescribed', 'bounded', 'exploratory', 'design', 'audit', 'decision'];
  if (!validContexts.includes(normalizedContext)) {
    throw new HandoffError('VALIDATION_FAILED', `estimated_context must be one of: ${validContexts.join(', ')}`);
  }

  const normalizedRisk = String(risk || 'safe').trim().toLowerCase();
  const validRisks = ['safe', 'destructive', 'irreversible'];
  if (!validRisks.includes(normalizedRisk)) {
    throw new HandoffError('VALIDATION_FAILED', `risk must be one of: ${validRisks.join(', ')}`);
  }
  const normalizedTime = String(time || 'standard').trim().toLowerCase();
  const validTimes = ['quick', 'standard', 'deep'];
  if (!validTimes.includes(normalizedTime)) {
    throw new HandoffError('VALIDATION_FAILED', `time must be one of: ${validTimes.join(', ')}`);
  }
  const normalizedSurface = String(surface || 'local').trim().toLowerCase();
  const validSurfaces = ['local', 'api-bound', 'human-loop'];
  if (!validSurfaces.includes(normalizedSurface)) {
    throw new HandoffError('VALIDATION_FAILED', `surface must be one of: ${validSurfaces.join(', ')}`);
  }

  const fsi = fsImpl || defaultFs();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Short slug from projectid + phase
  const shortSlug = `${projectid}-${String(phase).replace(/\./g, '-')}`;
  const id = `h-${timestamp}-${shortSlug}`;

  const frontmatter = {
    id,
    projectid,
    phase: String(phase),
    task_id: taskId || null,
    created_at: new Date().toISOString(),
    created_by: createdBy || 'unknown',
    claimed_by: null,
    claimed_at: null,
    completed_at: null,
    priority,
    estimated_context: normalizedContext,
    risk: normalizedRisk,
    time: normalizedTime,
    surface: normalizedSurface,
  };
  if (runtimePreference) {
    frontmatter.runtime_preference = runtimePreference;
  }
  if (Array.isArray(runtimeFallbacks) && runtimeFallbacks.length > 0) {
    frontmatter.runtime_fallbacks = runtimeFallbacks;
  }
  if (runtimeRequired === true) {
    frontmatter.runtime_required = true;
  }
  if (toAgent && String(toAgent).trim()) {
    // Phase C (GLOBAL-D-323): direct-to-agent routing.
    // The handoff appears in both the recipient project snapshot AND the
    // named agent's session-open notice. agentSlug format: <name>-<projectid>
    // (e.g. "gilgamesh-monorepo", "dr-stein-slm-learning").
    frontmatter.to_agent = String(toAgent).trim();
  }

  // Context-pack auto-injection (GLOBAL-D-464 / task 284-03).
  // Default ON; opt out with noContextPack=true or when repoRoot is unavailable.
  let enrichedBody = body;
  if (!noContextPack) {
    const repoRoot = baseDir; // baseDir IS the repo root for standard invocations
    enrichedBody = appendContextPack(body, { taskId, repoRoot });
  }

  const text = stringifyFrontmatter(frontmatter, enrichedBody);
  const openDir = bucketDir(baseDir, 'open');
  const filePath = path.join(openDir, `${id}.md`);

  try {
    fsi.mkdirSync(openDir, { recursive: true });
    fsi.writeFileSync(filePath, text);
  } catch (e) {
    throw new HandoffError('WRITE_FAILED', `Failed to write handoff: ${e.message}`, e);
  }

  return { id, filePath };
}

// ---------------------------------------------------------------------------
// Self-resume — handoffs as same-agent context-break recovery (2026-04-19)
// ---------------------------------------------------------------------------
//
// Operator decision (unified task/handoff/phase model): handoffs become
// primarily SELF-RESUME — "I was working on task X, here's where I
// stopped." Same agent picks it up next session (or any runtime can
// claim if runtime_preference is 'any'). Cross-lane remains secondary.
//
// Schema additions (in the body, parsed back by resume):
//   ## Resume context
//   - task_id: <id>
//   - phase: <id>
//   - last_commit: <sha or null>
//   - stopped_at: <iso-ts>
//   - what's done: <lines>
//   - what's left: <lines>
//   - blockers: <lines or none>
//
// Frontmatter extension:
//   type: self-resume
//   resume_task: <task_id>
//   resume_phase: <phase>

/**
 * Create a self-resume handoff. Thin wrapper over createHandoff with a
 * structured body template + type frontmatter flag.
 */
function createSelfResumeHandoff({
  baseDir,
  projectid,
  phase,
  taskId,
  createdBy,
  runtimePreference,
  lastCommit,
  whatDone,
  whatLeft,
  blockers,
  fsImpl,
} = {}) {
  if (!projectid) throw new HandoffError('VALIDATION_FAILED', 'projectid is required');
  if (!phase) throw new HandoffError('VALIDATION_FAILED', 'phase is required');
  if (!taskId) throw new HandoffError('VALIDATION_FAILED', 'taskId is required for self-resume handoffs');

  const body = [
    '## Resume context',
    '',
    `- **task_id:** \`${taskId}\``,
    `- **phase:** \`${phase}\``,
    `- **last_commit:** ${lastCommit ? `\`${lastCommit}\`` : '(none — uncommitted work at pause)'}`,
    `- **stopped_at:** ${new Date().toISOString()}`,
    '',
    '### What\'s done',
    whatDone && whatDone.trim() ? whatDone.trim() : '(not specified)',
    '',
    '### What\'s left',
    whatLeft && whatLeft.trim() ? whatLeft.trim() : '(not specified)',
    '',
    '### Blockers',
    blockers && blockers.trim() ? blockers.trim() : '(none)',
    '',
    '---',
    '',
    'Resume: `gad handoffs claim-next --runtime <agent>` or `node scripts/handoffs-pause-resume.cjs resume --task-id ' + taskId + '`',
  ].join('\n');

  const result = createHandoff({
    baseDir,
    projectid,
    phase,
    taskId,
    priority: 'normal',
    estimatedContext: 'reasoning',
    body,
    createdBy: createdBy || 'unknown',
    runtimePreference,
    fsImpl,
  });

  // Post-write: augment frontmatter with self-resume type + resume_task
  // (these aren't in createHandoff's schema and adding parameters there
  // would churn the signature; rewriting in place is cheap).
  try {
    const fsi = fsImpl || defaultFs();
    const text = fsi.readFileSync(result.filePath);
    const { frontmatter, body: existingBody } = parseFrontmatter(text);
    frontmatter.type = 'self-resume';
    frontmatter.resume_task = taskId;
    frontmatter.resume_phase = String(phase);
    const newText = stringifyFrontmatter(frontmatter, existingBody);
    fsi.writeFileSync(result.filePath, newText);
  } catch (e) {
    // Non-fatal — body has the schema; frontmatter aug is convenience
  }

  return result;
}

/**
 * Find self-resume handoffs. If taskId given, filter to that task.
 * If agent given, filter to handoffs this agent created (self-resume
 * = same agent comes back).
 */
function findSelfResumeHandoffs({
  baseDir,
  projectid,
  taskId,
  agent,
  bucket = 'open',
  fsImpl,
} = {}) {
  const all = listHandoffs({ baseDir, bucket, projectid, fsImpl });
  return all.filter((h) => {
    const fm = h.frontmatter || {};
    if (fm.type !== 'self-resume') return false;
    if (taskId && fm.resume_task !== taskId && fm.task_id !== taskId) return false;
    if (agent && fm.created_by !== agent) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  HandoffError,
  parseFrontmatter,
  stringifyFrontmatter,
  listHandoffs,
  countHandoffs,
  readHandoff,
  claimHandoff,
  completeHandoff,
  unclaimHandoff,
  createHandoff,
  createSelfResumeHandoff,
  findSelfResumeHandoffs,
  // Exported for testing
  appendContextPack,
  extractCidsFromBody,
  CONTEXT_PACK_SENTINEL,
};
