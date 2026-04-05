'use strict';
/**
 * docs-map-reader.cjs — parse DOCS-MAP.xml into structured doc entries.
 *
 * Schema per doc entry:
 *   kind     string   — "feature" | "technical" | "reference" | etc.
 *   sink     string   — relative path to the MDX file in the docs sink
 *   skill    string   — skill that produced it (e.g. "gad:write-feature-doc")
 *   description string — what this doc covers
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ kind: string, sink: string, skill: string, description: string }} DocsMapEntry
 */

/**
 * Read DOCS-MAP.xml for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @returns {DocsMapEntry[]}
 */
function readDocsMap(root, baseDir) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'DOCS-MAP.xml');
  if (!fs.existsSync(xmlFile)) return [];
  return parseXml(fs.readFileSync(xmlFile, 'utf8'));
}

function parseXml(content) {
  const entries = [];
  const docRe = /<doc\s([^>]*)>([\s\S]*?)<\/doc>/g;
  let m;
  while ((m = docRe.exec(content)) !== null) {
    const attrs = m[1];
    const inner = m[2];

    const kind  = (attrs.match(/kind="([^"]*)"/)  || [])[1] || '';
    const sink  = (attrs.match(/sink="([^"]*)"/)  || [])[1] || '';
    const skill = (attrs.match(/skill="([^"]*)"/) || [])[1] || '';

    const descMatch = inner.match(/<description>([\s\S]*?)<\/description>/);
    const description = descMatch ? descMatch[1].trim() : '';

    entries.push({ kind, sink, skill, description });
  }
  return entries;
}

module.exports = { readDocsMap };
