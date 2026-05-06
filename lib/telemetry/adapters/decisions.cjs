'use strict';
/**
 * Phase 145.5 (training-data-adapters-v2) — task GLOBAL-T-145.5-02.
 *
 * Adapter F: decisions
 *
 * Source: <rootDir>/.planning/DECISIONS.xml AND
 *         <rootDir>/vendor/get-anything-done/.planning/DECISIONS.xml
 *
 * Each <decision id="..."> block has children: <title>, <summary>, and
 * either <body> (newer schema) or <impact> (older schema). Optional
 * attributes/children: at, author, supersedes, supersededBy, tags. Map
 * each row → role=`reasoning`, content.kind=`decision_rationale`. These
 * are first-class planning artifacts, hence content_type=`planning`.
 *
 * Permissive line-regex parser. No XML parser dependency. Self-contained
 * — does not require lib/decisions-reader.cjs (which is used elsewhere
 * for different consumer-facing read shapes).
 *
 * Soft cap of 8KB applied to the body field; when truncated, content
 * gains `truncated: true` and the body is sliced to 8192 bytes.
 *
 * Idempotent: id derived from `decision|<project>|<decision-id>` so
 * re-export yields the same envelope ids.
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
const ROLE = 'reasoning';
const CONTENT_KIND = 'decision_rationale';
const CONTENT_TYPE = 'planning';
const BODY_CAP_BYTES = 8 * 1024;

const SOURCES = Object.freeze([
  { rel: '.planning/DECISIONS.xml', project: 'global' },
  { rel: 'vendor/get-anything-done/.planning/DECISIONS.xml', project: 'get-anything-done' },
]);

/**
 * Decode the most common XML entities. Same coverage as the
 * errors-and-attempts adapter; kept inline so this module is
 * self-contained.
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
    .replace(/&amp;/g, '&');
}

function cleanText(raw) {
  if (typeof raw !== 'string') return '';
  let s = raw;
  const cdata = s.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  if (cdata) s = cdata[1];
  return decodeEntities(s).trim();
}

function firstChild(body, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  return m ? cleanText(m[1]) : '';
}

function allChildren(body, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    const v = cleanText(m[1]);
    if (v) out.push(v);
  }
  return out;
}

/**
 * Pull self-closing or empty-attribute children. Used for `<supersedes
 * id="..."/>` and `<tags>...</tags>` in the planned schema.
 */
function selfClosingAttrs(body, tag, attr) {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]*)"[^>]*/?>`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    out.push(decodeEntities(m[1]));
  }
  return out;
}

function parseAttrs(openTag) {
  const attrs = {};
  const re = /\b([A-Za-z_][A-Za-z0-9_-]*)="([^"]*)"/g;
  let m;
  while ((m = re.exec(openTag)) !== null) {
    attrs[m[1]] = decodeEntities(m[2]);
  }
  return attrs;
}

function parseDateMs(str) {
  if (typeof str !== 'string') return null;
  // Accept ISO8601 timestamps OR plain YYYY-MM-DD.
  const isoFull = str.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/);
  if (isoFull) {
    const t = Date.parse(isoFull[1]);
    if (Number.isFinite(t)) return t;
  }
  const m = str.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const t = Date.parse(`${m[1]}T00:00:00.000Z`);
  return Number.isFinite(t) ? t : null;
}

/**
 * Apply soft cap to the body text. Returns { body, truncated }.
 * Byte-length aware (UTF-8) so cap holds across non-ASCII content.
 */
function capBody(body) {
  if (typeof body !== 'string' || !body) return { body: '', truncated: false };
  const buf = Buffer.from(body, 'utf8');
  if (buf.length <= BODY_CAP_BYTES) return { body, truncated: false };
  // Slice on a code-point boundary. Decoding a partial buffer with the
  // utf8 decoder will replace any straddling sequence with U+FFFD —
  // acceptable for training-data text.
  const sliced = buf.subarray(0, BODY_CAP_BYTES).toString('utf8');
  return { body: sliced, truncated: true };
}

function* iterDecisions(xml) {
  const re = /<decision\b([^>]*)>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    yield { openTag: m[1], body: m[2] };
  }
}

function buildEnvelope({ openTag, body, project, fileMtimeMs, seq }) {
  const attrs = parseAttrs(openTag);
  const id = attrs.id;
  if (!id) return { ok: false, reason: 'decision missing id attribute' };

  const title = firstChild(body, 'title');
  const summary = firstChild(body, 'summary');
  // Prefer explicit <body>; fall back to <impact> (older schema) so this
  // adapter works against both today's monorepo files and any future
  // schema migration.
  let rawBody = firstChild(body, 'body');
  if (!rawBody) rawBody = firstChild(body, 'impact');

  // Author / at: support both attribute and child element forms.
  const at = attrs.at || firstChild(body, 'at');
  const author = attrs.author || firstChild(body, 'author');

  // Supersedes: <supersedes id="..."/> (planned) or <supersedes>id</supersedes>.
  let supersedes = selfClosingAttrs(body, 'supersedes', 'id');
  if (supersedes.length === 0) supersedes = allChildren(body, 'supersedes');

  let supersededBy = selfClosingAttrs(body, 'superseded-by', 'id');
  if (supersededBy.length === 0) supersededBy = allChildren(body, 'superseded-by');

  // Tags: <tags>a, b, c</tags> OR <tag>a</tag><tag>b</tag>.
  let tags = allChildren(body, 'tag');
  if (tags.length === 0) {
    const tagsRaw = firstChild(body, 'tags');
    if (tagsRaw) tags = tagsRaw.split(/[,\s]+/).filter(Boolean);
  }

  // ts: prefer at, then file mtime.
  const tsMs = parseDateMs(at) || fileMtimeMs;
  const ts = new Date(tsMs).toISOString();

  const { body: cappedBody, truncated } = capBody(rawBody);
  const content = {
    kind: CONTENT_KIND,
    id,
    title,
    summary,
    body: cappedBody,
    at: at || null,
    supersedes,
    supersededBy,
    tags,
    author: author || null,
    project,
  };
  if (truncated) content.truncated = true;

  const envelopeId = deriveEnvelopeId(`decision|${project}|${id}`);
  const runId = makeRunId(RUNTIME, `decisions-${project}`, ts);

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
      task_id: null,
      handoff_id: null,
      model: null,
      content_type: CONTENT_TYPE,
    });
  } catch (e) {
    return { ok: false, reason: `makeEnvelope failed: ${e.message}` };
  }
  return { ok: true, envelope: env };
}

/**
 * Async generator yielding envelopes from every DECISIONS.xml source
 * under rootDir. Rows with ts < sinceMs are skipped.
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
      process.stderr.write(`[decisions] read failed ${fsPath}: ${e.message}\n`);
      continue;
    }

    let seq = 0;
    for (const ent of iterDecisions(xml)) {
      const result = buildEnvelope({
        openTag: ent.openTag,
        body: ent.body,
        project: src.project,
        fileMtimeMs: mtimeMs,
        seq,
      });
      seq += 1;
      if (!result.ok) {
        process.stderr.write(`[decisions] ${src.rel} entry ${seq - 1} skipped: ${result.reason}\n`);
        continue;
      }
      const env = result.envelope;
      if (sinceMs > 0) {
        const t = Date.parse(env.ts);
        if (Number.isFinite(t) && t < sinceMs) continue;
      }
      const v = validateEnvelope(env);
      if (!v.ok) {
        process.stderr.write(`[decisions] ${src.rel} ${env.content.id} invalid envelope: ${v.errors.join('; ')}\n`);
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
    BODY_CAP_BYTES,
    decodeEntities,
    cleanText,
    firstChild,
    allChildren,
    selfClosingAttrs,
    parseAttrs,
    parseDateMs,
    capBody,
    iterDecisions,
    buildEnvelope,
  },
};
