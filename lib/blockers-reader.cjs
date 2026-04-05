'use strict';
/**
 * blockers-reader.cjs — parse BLOCKERS.xml into structured blocker objects.
 *
 * Schema:
 *   <blocker id="..." status="open|resolved|wont-fix">
 *     <title>...</title>
 *     <summary>...</summary>
 *     <task-ref>task-id</task-ref>  (optional)
 *   </blocker>
 *
 * Parsed fields:
 *   id       string   — blocker id (e.g. "BLK-demo-seed-001")
 *   status   string   — "open" | "resolved" | "wont-fix"
 *   title    string
 *   summary  string
 *   taskRef  string   — related task id (if any)
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, status: string, title: string, summary: string, taskRef: string }} Blocker
 */

/**
 * Read blockers for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ status?: string }} [filter]
 * @returns {Blocker[]}
 */
function readBlockers(root, baseDir, filter = {}) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'BLOCKERS.xml');
  if (!fs.existsSync(xmlFile)) return [];
  return parseXml(fs.readFileSync(xmlFile, 'utf8'), filter);
}

function parseXml(content, filter) {
  const blockers = [];
  const blockerRe = /<blocker\s([^>]*)>([\s\S]*?)<\/blocker>/g;
  let m;
  while ((m = blockerRe.exec(content)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const idMatch     = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);

    const id     = idMatch     ? idMatch[1]     : '';
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'open';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;

    const titleMatch   = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const taskRefMatch = body.match(/<task-ref>([\s\S]*?)<\/task-ref>/);

    const title   = titleMatch   ? titleMatch[1].trim()   : '';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const taskRef = taskRefMatch ? taskRefMatch[1].trim() : '';

    blockers.push({ id, status, title, summary, taskRef });
  }
  return blockers;
}

module.exports = { readBlockers };
