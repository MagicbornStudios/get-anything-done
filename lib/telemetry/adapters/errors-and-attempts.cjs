'use strict';
/**
 * Phase 145.5 (training-data-adapters-v2) — task GLOBAL-T-145.5-01.
 *
 * Adapter E: errors-and-attempts
 *
 * Source: <rootDir>/.planning/ERRORS-AND-ATTEMPTS.xml AND
 *         <rootDir>/vendor/get-anything-done/.planning/ERRORS-AND-ATTEMPTS.xml
 *
 * Each <entry id="..." [date="..."] [phase="..."] [status="..."]> block has
 * children: <summary>, <context>, <failure>, <rule>, <reference>+, optional
 * <resolution>. Map each entry → role=`meta`, content.kind=`error_lesson`.
 * These rows are explicit failure-mode capture (DPO-style "rejected→chosen"
 * pairs) — not training data per se, hence content_type=`meta`.
 *
 * Permissive line-regex parser (well-formed XML, small enough to process
 * naively). No XML parser dependency. No external requires beyond the
 * envelope module.
 *
 * Idempotent: id derived from `errors|<project>|<entry-id>` so re-export
 * yields the same envelope ids.
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
} = require('../envelope.cjs');

const RUNTIME = 'gad-cli';
const ROLE = 'meta';
const CONTENT_KIND = 'error_lesson';
const CONTENT_TYPE = 'meta';

// Sources to scan: [ { fsPath, project } ]. Adapter emits envelopes from
// each source independently (project differs).
const SOURCES = Object.freeze([
  { rel: '.planning/ERRORS-AND-ATTEMPTS.xml', project: 'global' },
  { rel: 'vendor/get-anything-done/.planning/ERRORS-AND-ATTEMPTS.xml', project: 'get-anything-done' },
]);

/**
 * Decode the most common XML entities. We do not need a full parser —
 * the source files are author-edited Markdown-in-XML; entity coverage is
 * limited to amp/lt/gt/quot/apos and numeric escapes.
 */
function decodeEntities(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&'); // last so we don't double-decode
}

/**
 * Strip a single CDATA wrapper if present, then decode entities and
 * trim. Preserves inner whitespace.
 */
function cleanText(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw;
  const cdata = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) s = cdata[1];
  return decodeEntities(s).trim();
}

/**
 * Pull the first child <tag>...</tag> body out of an entry block. Returns
 * '' if not found.
 */
function firstChild(entryBody, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = entryBody.match(re);
  return m ? cleanText(m[1]) : '';
}

/**
 * Pull all <tag>...</tag> bodies as an array of strings.
 */
function allChildren(entryBody, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(entryBody)) !== null) {
    const v = cleanText(m[1]);
    if (v) out.push(v);
  }
  return out;
}

/**
 * Parse attribute table from an entry's open tag. Permissive: handles
 * `key="value"` only (the canonical author convention).
 */
function parseAttrs(openTag) {
  const attrs = {};
  const re = /\b([A-Za-z_][A-Za-z0-9_-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(openTag)) !== null) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return attrs;
}

/**
 * Find an ISO-ish date inside a string. Accepts YYYY-MM-DD; returns ms
 * epoch or null.
 */
function parseDateMs(str) {
  if (typeof str !== 'string') return null;
  const m = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * Parse a handoff id ("h-2026-05-05T05-09-58-global-109") or task id
 * ("GLOBAL-T-145-01" / "44-13" / "05-08") out of a <reference> string.
 * Returns { task_id, handoff_id } — either may be null.
 */
function parseRefIds(references) {
  let taskId = null;
  let handoffId = null;
  for (const ref of references) {
    if (!handoffId) {
      const h = ref.match(/h-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9_-]+-\d+/);
      if (h) handoffId = h[0];
    }
    if (!taskId) {
      // task forms: GLOBAL-T-145-01, GAD-T-63-18, "task 05-08", "(44-13)"
      const t1 = ref.match(/\b([A-Z]+-T-\d+(?:-\d+)?)\b/);
      if (t1) taskId = t1[1];
      else {
        const t2 = ref.match(/\btask[s]?\s+([A-Z0-9]+(?:-\d+)+)\b/i);
        if (t2) taskId = t2[1];
      }
    }
    if (taskId && handoffId) break;
  }
  return { task_id: taskId, handoff_id: handoffId };
}

/**
 * Iterate entry blocks from XML text. Yields { openTag, body, openIndex }
 * objects. Robust to whitespace/attribute variations.
 */
function* iterEntries(xml) {
  const re = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    yield { openTag: m[1], body: m[2] };
  }
}

/**
 * Build a single envelope from a parsed entry. Returns { ok: true, envelope }
 * on success, { ok: false, reason } otherwise. Throws nothing.
 */
function buildEnvelope({ openTag, body, project, fileMtimeMs, seq }) {
  const attrs = parseAttrs(openTag);
  const id = attrs.id;
  if (!id) return { ok: false, reason: 'entry missing id attribute' };

  const summary = firstChild(body, 'summary');
  const context = firstChild(body, 'context');
  const failure = firstChild(body, 'failure');
  const rule = firstChild(body, 'rule');
  const resolution = firstChild(body, 'resolution');
  const references = allChildren(body, 'reference');

  // ts: prefer date attribute, then context "YYYY-MM-DD", then file mtime.
  let tsMs = parseDateMs(attrs.date) || parseDateMs(context) || parseDateMs(summary);
  if (!tsMs) tsMs = fileMtimeMs;
  const ts = new Date(tsMs).toISOString();

  const { task_id, handoff_id } = parseRefIds(references);

  const content = {
    kind: CONTENT_KIND,
    id,
    summary,
    context,
    failure,
    rule,
    reference: references,
    project,
  };
  if (resolution) content.resolution = resolution;
  if (attrs.date) content.date = attrs.date;
  if (attrs.phase) content.phase = attrs.phase;
  if (attrs.status) content.status = attrs.status;
  if (attrs.task) content.task = attrs.task;

  const envelopeId = deriveEnvelopeId(`errors|${project}|${id}`);
  const runId = makeRunId(RUNTIME, `errors-${project}`, ts);

  let env;
  try {
    env = makeEnvelope({
      id: envelopeId,
      ts,
      run_id: runId,
      project,
      runtime: RUNTIME,
      role: ROLE,
      content,
      seq,
      task_id,
      handoff_id,
      model: null,
      content_type: CONTENT_TYPE,
    });
  } catch (e) {
    return { ok: false, reason: `makeEnvelope failed: ${e.message}` };
  }
  return { ok: true, envelope: env };
}

/**
 * Async generator yielding envelopes from every ERRORS-AND-ATTEMPTS.xml
 * source under rootDir. Entries with ts < sinceMs are skipped.
 *
 * @param {string} rootDir — repo root (paths in SOURCES are relative to this)
 * @param {number} sinceMs — epoch ms; rows with ts < sinceMs are skipped
 */
async function* iterEnvelopes(rootDir, sinceMs = 0) {
  for (const src of SOURCES) {
    const fsPath = path.join(rootDir, src.rel);
    let xml;
    let mtimeMs;
    try {
      xml = fs.readFileSync(fsPath, 'utf8');
      mtimeMs = fs.statSync(fsPath).mtimeMs;
    } catch (e) {
      if (e && e.code === 'ENOENT') continue;
      process.stderr.write(`[errors-and-attempts] read failed ${fsPath}: ${e.message}\n`);
      continue;
    }

    let seq = 0;
    for (const ent of iterEntries(xml)) {
      const result = buildEnvelope({
        openTag: ent.openTag,
        body: ent.body,
        project: src.project,
        fileMtimeMs: mtimeMs,
        seq,
      });
      seq += 1;
      if (!result.ok) {
        process.stderr.write(`[errors-and-attempts] ${src.rel} entry ${seq - 1} skipped: ${result.reason}\n`);
        continue;
      }
      const env = result.envelope;
      if (sinceMs > 0) {
        const t = Date.parse(env.ts);
        if (Number.isFinite(t) && t < sinceMs) continue;
      }
      const v = validateEnvelope(env);
      if (!v.ok) {
        process.stderr.write(`[errors-and-attempts] ${src.rel} ${env.content.id} invalid envelope: ${v.errors.join('; ')}\n`);
        continue;
      }
      yield env;
    }
  }
}

module.exports = {
  iterEnvelopes,
  _internal: {
    SOURCES,
    decodeEntities,
    cleanText,
    firstChild,
    allChildren,
    parseAttrs,
    parseDateMs,
    parseRefIds,
    iterEntries,
    buildEnvelope,
  },
};
