'use strict';
/**
 * requirements-reader.cjs — parse REQUIREMENTS.xml into structured doc references.
 *
 * REQUIREMENTS.xml is a stub/index file. It lists canonical doc paths by kind.
 * It does NOT contain the requirements prose itself — it points to where that prose lives.
 *
 * Schema per entry:
 *   kind        string  — doc kind (e.g. "canonical-requirements", "cross-cutting-queue")
 *   docPath     string  — path to the actual doc
 *   description string  — short description of what the doc contains
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ kind: string, docPath: string, description: string }} RequirementRef
 */

/**
 * Read requirement refs for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @returns {RequirementRef[]}
 */
function readRequirements(root, baseDir) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'REQUIREMENTS.xml');
  const mdFile  = path.join(baseDir, root.path, root.planningDir, 'REQUIREMENTS.md');

  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'));
  }
  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'));
  }
  return [];
}

function parseXml(content) {
  const refs = [];
  // Handles both <planning-references> and <requirements> root elements
  const docRe = /<doc\b([^>]*)>([\s\S]*?)<\/doc>/g;
  let m;
  while ((m = docRe.exec(content)) !== null) {
    const attrs = m[1];
    const body  = m[2];

    const kindMatch = attrs.match(/\bkind="([^"]*)"/);
    // Fall back to using the path filename as kind if no kind attr
    const kind = kindMatch ? kindMatch[1] : '';

    const pathMatch = body.match(/<path>([\s\S]*?)<\/path>/);
    const docPath = pathMatch ? pathMatch[1].trim() : '';

    // <content> may be CDATA or plain text
    const contentMatch = body.match(/<content[^>]*>([\s\S]*?)<\/content>/);
    const rawContent = contentMatch ? contentMatch[1] : '';
    const description = rawContent
      .replace(/<!\[CDATA\[/, '').replace(/\]\]>/, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .split('\n').map(l => l.trim()).filter(Boolean).join(' ');

    // If no kind attr, derive from path basename
    const resolvedKind = kind || (docPath ? docPath.split('/').pop().replace(/\.[^.]+$/, '') : 'doc');
    refs.push({ kind: resolvedKind, docPath, description });
  }
  return refs;
}

function parseMd(content) {
  // Parse Markdown: each ## heading is a requirement section
  const refs = [];
  const sections = content.split(/^##\s+/m).slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const kind  = lines[0].trim().toLowerCase().replace(/\s+/g, '-');
    const body  = lines.slice(1).join('\n').trim();
    refs.push({ kind, docPath: '', description: body.slice(0, 200) });
  }
  return refs;
}

module.exports = { readRequirements };
