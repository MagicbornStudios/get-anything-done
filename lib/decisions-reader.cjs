'use strict';
/**
 * decisions-reader.cjs — parse DECISIONS.xml into structured decision objects.
 *
 * Schema per decision:
 *   id          string   — decision identifier (e.g. "gad-09", "02-01")
 *   title       string   — short title
 *   summary     string   — full summary text
 *   impact      string   — impact statement
 *   references  string[] — file paths listed in <references>
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, title: string, summary: string, impact: string, references: string[] }} Decision
 */

/**
 * Read decisions for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ id?: string }} [filter]
 * @returns {Decision[]}
 */
function readDecisions(root, baseDir, filter = {}) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'DECISIONS.xml');
  const mdFile  = path.join(baseDir, root.path, root.planningDir, 'DECISIONS.md');

  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'), filter);
  }
  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'), filter);
  }
  return [];
}

function parseXml(content, filter) {
  const decisions = [];
  const decisionRe = /<decision\b([^>]*)>([\s\S]*?)<\/decision>/g;
  let m;
  while ((m = decisionRe.exec(content)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;
    if (filter.id && id !== filter.id) continue;

    const titleMatch   = body.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = body.match(/<summary>([\s\S]*?)<\/summary>/);
    const impactMatch  = body.match(/<impact>([\s\S]*?)<\/impact>/);

    const title   = titleMatch   ? titleMatch[1].trim()   : '';
    const summary = summaryMatch ? summaryMatch[1].trim() : '';
    const impact  = impactMatch  ? impactMatch[1].trim()  : '';

    // Parse <references><file path="..."/></references>
    const references = [];
    const refsMatch = body.match(/<references>([\s\S]*?)<\/references>/);
    if (refsMatch) {
      const fileRe = /\bpath="([^"]*)"/g;
      let f;
      while ((f = fileRe.exec(refsMatch[1])) !== null) {
        if (f[1]) references.push(f[1]);
      }
    }

    decisions.push({ id, title, summary, impact, references });
  }
  return decisions;
}

function parseMd(content, filter) {
  // Parse Markdown format: ## id: title \n summary \n **Impact:** impact
  const decisions = [];
  const sections = content.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0].trim();
    const colonIdx = header.indexOf(':');
    const id    = colonIdx >= 0 ? header.slice(0, colonIdx).trim() : header;
    const title = colonIdx >= 0 ? header.slice(colonIdx + 1).trim() : '';
    if (!id) continue;
    if (filter.id && id !== filter.id) continue;

    const rest = lines.slice(1).join('\n');
    const impactMatch = rest.match(/\*\*[Ii]mpact[:\*]+\*?\s*([\s\S]*?)(?=\n\n|\n##|$)/);
    const impact  = impactMatch ? impactMatch[1].trim() : '';
    const summary = rest.replace(/\*\*[Ii]mpact[^*]*\*\*[^]*/m, '').trim();

    decisions.push({ id, title, summary, impact, references: [] });
  }
  return decisions;
}

module.exports = { readDecisions };
