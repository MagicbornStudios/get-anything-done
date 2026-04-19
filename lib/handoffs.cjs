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
 *   - createHandoff({ baseDir, projectid, phase, taskId, priority, estimatedContext, body, createdBy, runtimePreference, fsImpl })
 *
 * Stable error codes:
 *   HANDOFF_NOT_FOUND   — file missing from all buckets
 *   ALREADY_CLAIMED     — claim attempted but file not in open/
 *   VALIDATION_FAILED   — required field missing or malformed
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
    frontmatter[key] = val === 'null' ? null : val;
  }
  return { frontmatter, body };
}

/**
 * Serialize frontmatter obj + body back to file text.
 */
function stringifyFrontmatter(obj, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${k}: ${v === null || v === undefined ? 'null' : v}`);
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + (body || '');
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
      if (projectid && frontmatter.projectid !== projectid) continue;
      results.push({ id, bucket: b, filePath, frontmatter });
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
  return { frontmatter, body, bucket: location.bucket, filePath: location.filePath };
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
    throw new HandoffError('ALREADY_CLAIMED', `Handoff ${id} is in '${location.bucket}', not 'open'`);
  }

  const text = fsi.readFileSync(location.filePath);
  const { frontmatter, body } = parseFrontmatter(text);

  frontmatter.claimed_by = agent || runtime || 'unknown';
  frontmatter.claimed_at = new Date().toISOString();

  const newText = stringifyFrontmatter(frontmatter, body);
  const destDir = bucketDir(baseDir, 'claimed');
  const destPath = path.join(destDir, `${id}.md`);

  try {
    fsi.mkdirSync(destDir, { recursive: true });
    fsi.writeFileSync(location.filePath, newText);
    fsi.renameSync(location.filePath, destPath);
  } catch (e) {
    throw new HandoffError('WRITE_FAILED', `Failed to claim handoff ${id}: ${e.message}`, e);
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

  frontmatter.completed_at = new Date().toISOString();

  const newText = stringifyFrontmatter(frontmatter, body);
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
 * Create a new handoff in open/.
 */
function createHandoff({
  baseDir,
  projectid,
  phase,
  taskId,
  priority = 'normal',
  estimatedContext = 'mechanical',
  body,
  createdBy,
  runtimePreference,
  fsImpl,
} = {}) {
  if (!projectid) throw new HandoffError('VALIDATION_FAILED', 'projectid is required');
  if (!phase) throw new HandoffError('VALIDATION_FAILED', 'phase is required');
  if (!body) throw new HandoffError('VALIDATION_FAILED', 'body is required');

  const validPriorities = ['low', 'normal', 'high'];
  if (!validPriorities.includes(priority)) {
    throw new HandoffError('VALIDATION_FAILED', `priority must be one of: ${validPriorities.join(', ')}`);
  }
  const validContexts = ['mechanical', 'reasoning'];
  if (!validContexts.includes(estimatedContext)) {
    throw new HandoffError('VALIDATION_FAILED', `estimated_context must be one of: ${validContexts.join(', ')}`);
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
    estimated_context: estimatedContext,
  };
  if (runtimePreference) {
    frontmatter.runtime_preference = runtimePreference;
  }

  const text = stringifyFrontmatter(frontmatter, body);
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
  createHandoff,
  createSelfResumeHandoff,
  findSelfResumeHandoffs,
};
