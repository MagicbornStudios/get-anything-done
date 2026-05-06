'use strict';
/**
 * Phase 145.5 (training-data-adapters-v2) — task GLOBAL-T-145.5-03.
 *
 * Adapter G: handoffs
 *
 * Source: walks both
 *   <rootDir>/.planning/handoffs/{open,claimed,closed}/*.md
 *   <rootDir>/vendor/get-anything-done/.planning/handoffs/{open,claimed,closed}/*.md
 *
 * Each handoff is a markdown file with YAML-ish frontmatter (between
 * `---` fences) followed by the body. The body IS the task definition
 * as written when the handoff was created — clean PROMPT material.
 * Closed handoffs additionally carry completion evidence in the body
 * (commit shas, files modified) — clean RESPONSE material.
 *
 * Mapping:
 *   - role=`prompt`, content.kind=`handoff_prompt` (every handoff in any bucket)
 *   - role=`response`, content.kind=`handoff_closeout` (only for closed/)
 *     parent_id links closeout back to its prompt envelope.
 *
 * Self-contained — does NOT import from `lib/handoffs.cjs` so the
 * adapter stays loose-coupled to the handoff-CLI module's evolution.
 *
 * Reference: lib/telemetry/envelope.cjs (DO NOT MODIFY).
 */
const fs = require('fs');
const path = require('path');

const {
  validateEnvelope,
  deriveEnvelopeId,
  makeEnvelope,
  makeRunId,
  VALID_RUNTIMES,
} = require('../envelope.cjs');

const BUCKETS = ['open', 'claimed', 'closed'];

const HANDOFF_ROOTS = [
  path.join('.planning', 'handoffs'),
  path.join('vendor', 'get-anything-done', '.planning', 'handoffs'),
];

// ---------------------------------------------------------------------------
// Frontmatter parser — minimal flat key:value, written inline so this
// adapter is self-contained. Multi-line block values (YAML lists) are
// parsed only as a raw key with empty string value; the keys we care
// about (id, projectid, phase, task_id, runtime_preference, claimed_by,
// claimed_at, completed_at, created_at) are all flat in real handoffs.
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null; // Skip files with no frontmatter open
  const fmText = match[1];
  const body = match[2] || '';
  const frontmatter = {};
  for (const line of fmText.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;
    let val = line.slice(colonIdx + 1).trim();
    if (val === 'null' || val === '') {
      frontmatter[key] = val === '' ? '' : null;
      continue;
    }
    // Try JSON for arrays/objects (e.g. unclaim_history)
    if ((val.startsWith('[') && val.endsWith(']')) ||
        (val.startsWith('{') && val.endsWith('}'))) {
      try {
        frontmatter[key] = JSON.parse(val);
        continue;
      } catch {
        // Fall through to raw string.
      }
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

// ---------------------------------------------------------------------------
// Runtime normalization — frontmatter `runtime_preference` is sometimes
// a short alias ('codex', 'gemini') instead of the canonical envelope
// runtime ('codex-cli', 'gemini-cli'). Map and validate.
// ---------------------------------------------------------------------------

const RUNTIME_ALIASES = Object.freeze({
  codex: 'codex-cli',
  gemini: 'gemini-cli',
  claude: 'claude-code',
  // these are already canonical:
  'codex-cli': 'codex-cli',
  'gemini-cli': 'gemini-cli',
  'claude-code': 'claude-code',
  opencode: 'opencode',
  'gad-cli': 'gad-cli',
});

function normalizeRuntime(raw) {
  if (!raw || typeof raw !== 'string') return 'gad-cli';
  const aliased = RUNTIME_ALIASES[raw.trim().toLowerCase()];
  if (aliased && VALID_RUNTIMES.has(aliased)) return aliased;
  return 'gad-cli';
}

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

function listHandoffFiles(rootDir) {
  /** @type {Array<{filePath: string, bucket: string}>} */
  const out = [];
  for (const handoffRoot of HANDOFF_ROOTS) {
    for (const bucket of BUCKETS) {
      const dir = path.join(rootDir, handoffRoot, bucket);
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        if (!ent.name.endsWith('.md')) continue;
        out.push({ filePath: path.join(dir, ent.name), bucket });
      }
    }
  }
  // Deterministic order so envelope yield order is stable.
  out.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return out;
}

function pickTimestamp(frontmatter, fallbackMs, field) {
  const raw = frontmatter && frontmatter[field];
  if (raw && typeof raw === 'string') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(fallbackMs || Date.now()).toISOString();
}

function tsToMs(iso) {
  const d = new Date(iso);
  const ms = d.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

// ---------------------------------------------------------------------------
// Envelope generator
// ---------------------------------------------------------------------------

/**
 * Yield handoff envelopes — one prompt per handoff, plus one response
 * per handoff in `closed/`.
 *
 * @param {string} rootDir   monorepo root (the dir containing .planning/)
 * @param {number} sinceMs   epoch ms; envelopes with ts < this are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  for (const { filePath, bucket } of listHandoffFiles(rootDir)) {
    let st;
    try {
      st = fs.statSync(filePath);
    } catch (e) {
      process.stderr.write(`[handoffs] stat failed ${filePath}: ${e.message}\n`);
      continue;
    }

    let text;
    try {
      text = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      process.stderr.write(`[handoffs] read failed ${filePath}: ${e.message}\n`);
      continue;
    }

    const parsed = parseFrontmatter(text);
    if (!parsed) {
      // Skip files that don't have `---` frontmatter open
      continue;
    }
    const { frontmatter, body } = parsed;

    const handoffId = frontmatter.id;
    if (!handoffId || typeof handoffId !== 'string') {
      process.stderr.write(`[handoffs] missing id ${filePath}\n`);
      continue;
    }
    const projectid = (frontmatter.projectid && String(frontmatter.projectid).trim()) || 'global';
    const runtime = normalizeRuntime(frontmatter.runtime_preference);
    const taskId = frontmatter.task_id && frontmatter.task_id !== 'null' ? String(frontmatter.task_id) : null;
    const claimedBy = frontmatter.claimed_by && frontmatter.claimed_by !== 'null' && frontmatter.claimed_by !== ''
      ? String(frontmatter.claimed_by)
      : null;

    // ---- PROMPT envelope ----
    const promptTs = pickTimestamp(frontmatter, st.mtimeMs, 'created_at');
    const promptMs = tsToMs(promptTs);
    const promptId = deriveEnvelopeId(`handoff|${projectid}|${handoffId}|prompt`);

    if (!sinceMs || promptMs >= sinceMs) {
      const promptRunId = makeRunId(runtime, handoffId, promptTs);
      const promptContent = {
        text: body,
        kind: 'handoff_prompt',
        bucket,
      };
      try {
        const env = makeEnvelope({
          id: promptId,
          ts: promptTs,
          run_id: promptRunId,
          project: projectid,
          runtime,
          role: 'prompt',
          content: promptContent,
          seq: 1,
          task_id: taskId,
          handoff_id: handoffId,
          model: null,
          parent_id: null,
          agent_id: claimedBy,
          content_type: 'planning',
        });
        const v = validateEnvelope(env);
        if (!v.ok) {
          process.stderr.write(`[handoffs] invalid prompt envelope ${handoffId}: ${v.errors.join('; ')}\n`);
        } else {
          yield env;
        }
      } catch (e) {
        process.stderr.write(`[handoffs] makeEnvelope (prompt) failed ${handoffId}: ${e.message}\n`);
      }
    }

    // ---- RESPONSE envelope (closed bucket only) ----
    if (bucket !== 'closed') continue;

    const closeTs = pickTimestamp(
      frontmatter,
      st.mtimeMs,
      frontmatter.completed_at ? 'completed_at' : 'claimed_at',
    );
    const closeMs = tsToMs(closeTs);
    if (sinceMs && closeMs < sinceMs) continue;

    const responseId = deriveEnvelopeId(`handoff|${projectid}|${handoffId}|closeout`);
    const responseRunId = makeRunId(runtime, handoffId, closeTs);
    const responseContent = {
      text: body,
      kind: 'handoff_closeout',
      bucket,
    };
    try {
      const env = makeEnvelope({
        id: responseId,
        ts: closeTs,
        run_id: responseRunId,
        project: projectid,
        runtime,
        role: 'response',
        content: responseContent,
        seq: 2,
        task_id: taskId,
        handoff_id: handoffId,
        model: null,
        parent_id: promptId,
        agent_id: claimedBy,
        content_type: 'planning',
      });
      const v = validateEnvelope(env);
      if (!v.ok) {
        process.stderr.write(`[handoffs] invalid response envelope ${handoffId}: ${v.errors.join('; ')}\n`);
      } else {
        yield env;
      }
    } catch (e) {
      process.stderr.write(`[handoffs] makeEnvelope (response) failed ${handoffId}: ${e.message}\n`);
    }
  }
}

module.exports = {
  iterEnvelopes,
  _internal: {
    parseFrontmatter,
    normalizeRuntime,
    listHandoffFiles,
    HANDOFF_ROOTS,
    BUCKETS,
  },
};
