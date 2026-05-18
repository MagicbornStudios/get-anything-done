'use strict';
/**
 * sources/gad-log.cjs — parse .planning/.gad-log/*.jsonl into events
 *
 * Each line: {ts, type, tool, session_id, input_summary, output_length, gad_command?}
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * @param {string} projectRoot
 * @param {object} opts
 * @param {string|null} opts.since  ISO timestamp; skip entries before this
 * @returns {Array<{id,text,source,ts,sessionId}>}
 */
function ingestGadLog(projectRoot, opts = {}) {
  const logDir = path.join(projectRoot, '.planning', '.gad-log');
  if (!fs.existsSync(logDir)) return [];

  const since = opts.since ? new Date(opts.since).getTime() : 0;
  const records = [];

  const files = fs.readdirSync(logDir)
    .filter(f => f.endsWith('.jsonl'))
    .sort();

  for (const file of files) {
    const filePath = path.join(logDir, file);
    let raw;
    try { raw = fs.readFileSync(filePath, 'utf8'); } catch { continue; }

    const lines = raw.split('\n').filter(l => l.trim());
    for (const line of lines) {
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (!entry.ts) continue;

      const ts = new Date(entry.ts).getTime();
      if (ts < since) continue;

      // Build text representation
      const parts = [];
      if (entry.type) parts.push(`type:${entry.type}`);
      if (entry.tool) parts.push(`tool:${entry.tool}`);
      if (entry.gad_command) parts.push(`cmd:${entry.gad_command}`);
      if (entry.input_summary) parts.push(entry.input_summary.slice(0, 500));

      const text = parts.join(' | ');
      if (!text.trim()) continue;

      const id = `gad-log:${file}:${records.length}`;
      records.push({
        id,
        text,
        source: 'gad-log',
        ts: entry.ts,
        sessionId: entry.session_id || null,
      });
    }
  }

  return records;
}

module.exports = { ingestGadLog };
