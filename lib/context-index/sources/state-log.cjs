'use strict';
/**
 * sources/state-log.cjs — parse .planning/STATE.xml <state-log> entries
 */

const fs = require('node:fs');
const path = require('node:path');

function decodeXml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/**
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string|null} opts.since  ISO timestamp
 * @returns {Array<{id,text,source,ts,sessionId}>}
 */
function ingestStateLog(projectRoot, opts = {}) {
  const xmlPath = path.join(projectRoot, '.planning', 'STATE.xml');
  if (!fs.existsSync(xmlPath)) return [];

  const since = opts.since ? new Date(opts.since).getTime() : 0;
  let content;
  try { content = fs.readFileSync(xmlPath, 'utf8'); } catch { return []; }

  const records = [];
  const entryRe = /<entry\b([^>]*)>([\s\S]*?)<\/entry>/g;
  let m;
  let idx = 0;

  while ((m = entryRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const tsMatch = attrs.match(/\bts="([^"]*)"/);
    const ts = tsMatch ? tsMatch[1] : null;
    if (!ts) continue;
    if (new Date(ts).getTime() < since) continue;

    // Extract text content
    const textMatch = body.match(/<text>([\s\S]*?)<\/text>/);
    const tagsMatch = body.match(/<tags>([\s\S]*?)<\/tags>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);

    const textParts = [];
    if (textMatch) textParts.push(decodeXml(textMatch[1].trim()));
    else if (summaryMatch) textParts.push(decodeXml(summaryMatch[1].trim()));
    // fallback: use raw trimmed body
    if (!textParts.length) {
      const raw = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (raw) textParts.push(raw);
    }
    if (tagsMatch) textParts.push(`tags:${decodeXml(tagsMatch[1].trim())}`);

    const text = textParts.join(' | ');
    if (!text.trim()) continue;

    records.push({
      id: `state-log:${idx++}`,
      text,
      source: 'state-log',
      ts,
      sessionId: null,
    });
  }

  return records;
}

module.exports = { ingestStateLog };
