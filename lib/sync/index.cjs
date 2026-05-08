'use strict';
/**
 * lib/sync/index.cjs — Cross-repo planning data engine (Phase 132).
 *
 * Reads, fingerprints, and applies the canonical planning data payload for a
 * single project root. Designed to be backend-agnostic: callers pair this
 * with supabase-backend.cjs (or any future transport) to push/pull.
 *
 * Payload shape:
 *   {
 *     projectId: string,
 *     collectedAt: ISO string,
 *     decisions: Decision[],
 *     state_log: StateLogEntry[],
 *     handoffs: { open: Handoff[], claimed: Handoff[], closed: Handoff[] },
 *     gad_log: GadLogEntry[],
 *   }
 *
 * Exports:
 *   collectPlanningData({ projectRoot, planningDir })  → payload
 *   applyPlanningData({ projectRoot, planningDir, payload, mode })
 *   syncFingerprint(payload) → sha256 hex string
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return null;
  }
}

function safeReadDir(dirPath) {
  try {
    return fs.readdirSync(dirPath);
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// DECISIONS.xml parser — returns array of decision objects
// ---------------------------------------------------------------------------

function parseDecisionsXml(content) {
  if (!content) return [];
  const decisions = [];
  const re = /<decision\b([^>]*)>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;
    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const impactMatch = body.match(/<impact>([\s\S]*?)<\/impact>/);
    decisions.push({
      id,
      title: titleMatch ? titleMatch[1].trim() : '',
      summary: summaryMatch ? summaryMatch[1].trim() : '',
      impact: impactMatch ? impactMatch[1].trim() : '',
    });
  }
  return decisions;
}

// ---------------------------------------------------------------------------
// STATE.xml state-log parser — returns array of entry objects
// ---------------------------------------------------------------------------

function parseStateLog(content) {
  if (!content) return [];
  const entries = [];
  const re = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const attrs = m[1];
    const text = m[2].trim();
    const agentMatch = attrs.match(/\bagent="([^"]*)"/);
    const atMatch = attrs.match(/\bat="([^"]*)"/);
    const tagsMatch = attrs.match(/\btags="([^"]*)"/);
    entries.push({
      agent: agentMatch ? agentMatch[1] : '',
      at: atMatch ? atMatch[1] : '',
      tags: tagsMatch ? tagsMatch[1] : '',
      message: text,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Handoffs — reads all files from a single bucket dir
// ---------------------------------------------------------------------------

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };
  const fmText = match[1];
  const body = match[2] || '';
  const frontmatter = {};
  for (const line of fmText.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val === 'null') { frontmatter[key] = null; continue; }
    if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
      try { frontmatter[key] = JSON.parse(val); continue; } catch (_) {}
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

function readHandoffBucket(bucketDir) {
  const files = safeReadDir(bucketDir).filter((f) => f.endsWith('.md'));
  return files.map((file) => {
    const raw = safeReadFile(path.join(bucketDir, file)) || '';
    const { frontmatter, body } = parseFrontmatter(raw);
    return { id: file.replace(/\.md$/, ''), file, frontmatter, body };
  });
}

// ---------------------------------------------------------------------------
// GAD log — reads JSONL files from .gad-log/
// ---------------------------------------------------------------------------

function readGadLog(gadLogDir) {
  const files = safeReadDir(gadLogDir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort();
  const entries = [];
  for (const file of files) {
    const raw = safeReadFile(path.join(gadLogDir, file)) || '';
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        entries.push(JSON.parse(trimmed));
      } catch (_) {
        // Skip malformed lines
      }
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Public: collectPlanningData
// ---------------------------------------------------------------------------

/**
 * Gather all planning data for a project root into a single payload object.
 *
 * @param {object} params
 * @param {string} params.projectRoot  — absolute path to the project root
 *                                       (the directory that contains planningDir)
 * @param {string} [params.planningDir] — relative name of the planning dir (default: '.planning')
 * @param {string} [params.projectId]   — project id label embedded in the payload
 * @returns {object} payload
 */
function collectPlanningData({ projectRoot, planningDir = '.planning', projectId = '' }) {
  const pDir = path.join(projectRoot, planningDir);

  // Decisions
  const decisionsXml = safeReadFile(path.join(pDir, 'DECISIONS.xml'));
  const decisions = parseDecisionsXml(decisionsXml);

  // State log from STATE.xml
  const stateXml = safeReadFile(path.join(pDir, 'STATE.xml'));
  const state_log = parseStateLog(stateXml);

  // Handoffs
  const handoffsDir = path.join(pDir, 'handoffs');
  const handoffs = {
    open: readHandoffBucket(path.join(handoffsDir, 'open')),
    claimed: readHandoffBucket(path.join(handoffsDir, 'claimed')),
    closed: readHandoffBucket(path.join(handoffsDir, 'closed')),
  };

  // GAD log
  const gadLogDir = path.join(pDir, '.gad-log');
  const gad_log = readGadLog(gadLogDir);

  return {
    projectId,
    collectedAt: new Date().toISOString(),
    decisions,
    state_log,
    handoffs,
    gad_log,
  };
}

// ---------------------------------------------------------------------------
// Public: applyPlanningData
// ---------------------------------------------------------------------------

/**
 * Apply (write back) a payload to disk.
 *
 * mode "overwrite" — replaces on-disk data with payload data.
 * mode "merge"     — deep-merges: payload items added only when they don't
 *                    already exist on disk (by id for decisions; by id for
 *                    handoffs; state_log entries prepended if not already
 *                    present; gad_log entries appended by ts if not present).
 *
 * NOTE: This is a best-effort writer. It does NOT fully recreate XML schemas
 * from scratch — it patches existing files where possible. Projects without
 * the expected XML files will have them bootstrapped as minimal shells.
 *
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string} [params.planningDir]
 * @param {object} params.payload
 * @param {'merge'|'overwrite'} [params.mode]
 */
function applyPlanningData({ projectRoot, planningDir = '.planning', payload, mode = 'merge' }) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('applyPlanningData: payload must be an object');
  }
  if (!['merge', 'overwrite'].includes(mode)) {
    throw new Error(`applyPlanningData: mode must be "merge" or "overwrite", got "${mode}"`);
  }

  const pDir = path.join(projectRoot, planningDir);

  // Ensure planning dir exists
  if (!fs.existsSync(pDir)) {
    fs.mkdirSync(pDir, { recursive: true });
  }

  const applied = { decisions: 0, state_log: 0, handoffs: 0, gad_log: 0 };

  // --- Decisions ---
  if (Array.isArray(payload.decisions)) {
    const decisionsPath = path.join(pDir, 'DECISIONS.xml');
    if (mode === 'overwrite') {
      const xml = buildDecisionsXml(payload.decisions);
      fs.writeFileSync(decisionsPath, xml, 'utf8');
      applied.decisions = payload.decisions.length;
    } else {
      // merge: only insert decisions not already on disk
      const existing = parseDecisionsXml(safeReadFile(decisionsPath) || '');
      const existingIds = new Set(existing.map((d) => d.id));
      const toAdd = payload.decisions.filter((d) => !existingIds.has(d.id));
      if (toAdd.length > 0) {
        let xml = safeReadFile(decisionsPath) || '<decisions>\n</decisions>';
        // Insert before closing tag
        const closing = '</decisions>';
        const inject = toAdd.map(decisionToXml).join('\n');
        xml = xml.includes(closing)
          ? xml.replace(closing, inject + '\n' + closing)
          : xml + '\n' + inject;
        fs.writeFileSync(decisionsPath, xml, 'utf8');
        applied.decisions = toAdd.length;
      }
    }
  }

  // --- State log ---
  if (Array.isArray(payload.state_log) && payload.state_log.length > 0) {
    const statePath = path.join(pDir, 'STATE.xml');
    if (fs.existsSync(statePath)) {
      let xml = fs.readFileSync(statePath, 'utf8');
      const existingLog = parseStateLog(xml);
      const existingKeys = new Set(existingLog.map((e) => `${e.at}::${e.agent}`));

      const entriesToAdd = mode === 'overwrite'
        ? payload.state_log
        : payload.state_log.filter((e) => !existingKeys.has(`${e.at}::${e.agent}`));

      for (const entry of entriesToAdd) {
        const escape = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const escAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
        const tagsAttr = entry.tags ? ` tags="${escAttr(entry.tags)}"` : '';
        const entryXml = `    <entry agent="${escAttr(entry.agent)}" at="${escAttr(entry.at)}"${tagsAttr}>${escape(entry.message)}</entry>\n`;
        if (/<state-log>/.test(xml)) {
          xml = xml.replace(/<state-log>\s*\n/, (m) => m + entryXml);
        } else {
          xml = xml.replace(/<\/state>/, `  <state-log>\n${entryXml}  </state-log>\n</state>`);
        }
        applied.state_log++;
      }
      fs.writeFileSync(statePath, xml, 'utf8');
    }
    // If STATE.xml doesn't exist, skip — we don't create it from scratch here
    // (that would require full schema knowledge; callers wanting bootstrap should
    //  use gad projects init first).
  }

  // --- Handoffs ---
  if (payload.handoffs && typeof payload.handoffs === 'object') {
    const handoffsDir = path.join(pDir, 'handoffs');
    for (const bucket of ['open', 'claimed', 'closed']) {
      const bucketDir = path.join(handoffsDir, bucket);
      const items = payload.handoffs[bucket];
      if (!Array.isArray(items)) continue;
      if (!fs.existsSync(bucketDir)) {
        fs.mkdirSync(bucketDir, { recursive: true });
      }
      for (const item of items) {
        const targetFile = path.join(bucketDir, `${item.id}.md`);
        if (mode === 'overwrite' || !fs.existsSync(targetFile)) {
          const lines = ['---'];
          for (const [k, v] of Object.entries(item.frontmatter || {})) {
            const val = v === null || v === undefined ? 'null'
              : (Array.isArray(v) || typeof v === 'object') ? JSON.stringify(v)
              : String(v);
            lines.push(`${k}: ${val}`);
          }
          lines.push('---');
          lines.push('');
          const content = lines.join('\n') + (item.body || '');
          fs.writeFileSync(targetFile, content, 'utf8');
          applied.handoffs++;
        }
      }
    }
  }

  // --- GAD log ---
  if (Array.isArray(payload.gad_log) && payload.gad_log.length > 0) {
    const gadLogDir = path.join(pDir, '.gad-log');
    if (!fs.existsSync(gadLogDir)) {
      fs.mkdirSync(gadLogDir, { recursive: true });
    }
    // Group entries by date (from their ts field if present)
    const byDate = new Map();
    for (const entry of payload.gad_log) {
      const ts = entry.ts || entry.timestamp || entry.at || '';
      const date = ts ? ts.slice(0, 10) : 'unknown';
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(entry);
    }
    for (const [date, entries] of byDate) {
      const logFile = path.join(gadLogDir, `${date}.jsonl`);
      if (mode === 'merge' && fs.existsSync(logFile)) {
        // Read existing entries and deduplicate by ts+cmd combo
        const existing = (safeReadFile(logFile) || '').split('\n')
          .filter((l) => l.trim())
          .map((l) => { try { return JSON.parse(l); } catch { return null; } })
          .filter(Boolean);
        const existingKeys = new Set(existing.map((e) => `${e.ts || ''}::${e.cmd || e.command || ''}`));
        const toAdd = entries.filter((e) => !existingKeys.has(`${e.ts || ''}::${e.cmd || e.command || ''}`));
        if (toAdd.length > 0) {
          const lines = toAdd.map((e) => JSON.stringify(e)).join('\n') + '\n';
          fs.appendFileSync(logFile, lines, 'utf8');
          applied.gad_log += toAdd.length;
        }
      } else {
        const lines = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
        fs.writeFileSync(logFile, lines, 'utf8');
        applied.gad_log += entries.length;
      }
    }
  }

  return applied;
}

// ---------------------------------------------------------------------------
// XML builders (used by applyPlanningData overwrite path)
// ---------------------------------------------------------------------------

function decisionToXml(d) {
  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return [
    `  <decision id="${escAttr(d.id)}">`,
    `    <title>${esc(d.title)}</title>`,
    `    <summary>${esc(d.summary)}</summary>`,
    `    <impact>${esc(d.impact)}</impact>`,
    `  </decision>`,
  ].join('\n');
}

function buildDecisionsXml(decisions) {
  const inner = decisions.map(decisionToXml).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<decisions>\n${inner}\n</decisions>\n`;
}

// ---------------------------------------------------------------------------
// Public: syncFingerprint
// ---------------------------------------------------------------------------

/**
 * Compute a SHA-256 hash over the canonical JSON of the payload.
 * Timestamps are excluded to produce a stable content hash.
 *
 * @param {object} payload
 * @returns {string} hex sha256
 */
function syncFingerprint(payload) {
  // Exclude collectedAt from the hash so identical content produces the same fingerprint
  const { collectedAt: _excluded, ...rest } = payload;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { collectPlanningData, applyPlanningData, syncFingerprint };
