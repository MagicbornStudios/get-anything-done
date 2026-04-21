'use strict';
/**
 * blockers-reader.cjs — parse blocker records into structured blocker objects.
 *
 * Supported sources:
 *   1. BLOCKERS.xml legacy records
 *   2. ERRORS-AND-ATTEMPTS.xml current <entry status="open" blocks="..."> records
 */

const fs = require('fs');
const path = require('path');
const { parseErrorsXml } = require('./errors-reader.cjs');

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
  const blockers = [];
  const seen = new Set();

  const blockersXmlFile = path.join(baseDir, root.path, root.planningDir, 'BLOCKERS.xml');
  if (fs.existsSync(blockersXmlFile)) {
    for (const blocker of parseBlockersXml(fs.readFileSync(blockersXmlFile, 'utf8'), filter)) {
      if (seen.has(blocker.id)) continue;
      seen.add(blocker.id);
      blockers.push(blocker);
    }
  }

  const errorsXmlFile = path.join(baseDir, root.path, root.planningDir, 'ERRORS-AND-ATTEMPTS.xml');
  if (fs.existsSync(errorsXmlFile)) {
    const entries = parseErrorsXml(fs.readFileSync(errorsXmlFile, 'utf8'));
    for (const entry of entries) {
      const isBlocker = entry.status === 'open' || Boolean(entry.blocks);
      if (!isBlocker) continue;

      const blocker = {
        id: entry.id,
        status: entry.status || 'open',
        title: entry.summary || entry.title || entry.id,
        summary: entry.cause || entry.symptom || entry.summary || '',
        taskRef: entry.blocks || entry.task || '',
      };

      if (filter.status && blocker.status !== filter.status.toLowerCase()) continue;
      if (seen.has(blocker.id)) continue;
      seen.add(blocker.id);
      blockers.push(blocker);
    }
  }

  return blockers;
}

function parseBlockersXml(content, filter = {}) {
  const blockers = [];
  const blockerRe = /<blocker\s([^>]*)>([\s\S]*?)<\/blocker>/g;
  let m;
  while ((m = blockerRe.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2];

    const idMatch = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);

    const id = idMatch ? idMatch[1] : '';
    const status = statusMatch ? statusMatch[1].toLowerCase() : 'open';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;

    const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const taskRefMatch = body.match(/<task-ref>([\s\S]*?)<\/task-ref>/);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const taskRef = taskRefMatch ? taskRefMatch[1].trim() : '';

    blockers.push({ id, status, title, summary, taskRef });
  }
  return blockers;
}

module.exports = { readBlockers };
