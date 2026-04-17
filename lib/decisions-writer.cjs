'use strict';
/**
 * decisions-writer.cjs — append a new <decision> block to DECISIONS.xml.
 *
 * Pattern: locate the closing </decisions> tag and insert the new block
 * immediately before it, preserving existing content exactly. XML text
 * content is entity-escaped.
 *
 * Refuses to add if the id collides with an existing decision.
 */

const fs = require('fs');
const path = require('path');
const { readDecisions } = require('./decisions-reader.cjs');

/**
 * @typedef {{ id: string, title: string, summary: string, impact?: string, date?: string, references?: string[] }} NewDecision
 */

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Append a decision to DECISIONS.xml for a given root.
 *
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {NewDecision} d
 * @returns {{ filePath: string, existed: boolean, count: number }}
 */
function writeDecision(root, baseDir, d) {
  if (!d || !d.id) throw new Error('decision id is required');
  if (!d.title) throw new Error('decision title is required');
  if (!d.summary) throw new Error('decision summary is required');

  const filePath = path.join(baseDir, root.path, root.planningDir, 'DECISIONS.xml');
  if (!fs.existsSync(filePath)) {
    throw new Error(`DECISIONS.xml not found at ${path.relative(baseDir, filePath)}`);
  }

  const existing = readDecisions(root, baseDir, { id: d.id });
  if (existing.length > 0) {
    throw new Error(`decision id "${d.id}" already exists`);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const idx = original.lastIndexOf('</decisions>');
  if (idx < 0) {
    throw new Error('no closing </decisions> tag in DECISIONS.xml');
  }

  const refsBlock = Array.isArray(d.references) && d.references.length > 0
    ? `    <references>\n${d.references.map(r => `      <file path="${escapeXml(r)}"/>`).join('\n')}\n    </references>\n`
    : '';
  const dateLine = d.date ? `    <date>${escapeXml(d.date)}</date>\n` : '';
  const impactBlock = d.impact
    ? `    <impact>${escapeXml(d.impact)}</impact>\n`
    : '';

  const block = [
    `  <decision id="${escapeXml(d.id)}">`,
    `    <title>${escapeXml(d.title)}</title>`,
    dateLine.replace(/\n$/, ''),
    `    <summary>${escapeXml(d.summary)}</summary>`,
    impactBlock.replace(/\n$/, ''),
    refsBlock.replace(/\n$/, ''),
    `  </decision>`,
  ].filter(Boolean).join('\n');

  const before = original.slice(0, idx).replace(/\s*$/, '');
  const after = original.slice(idx);
  const next = `${before}\n\n${block}\n\n${after}`;
  fs.writeFileSync(filePath, next);

  const after_count = readDecisions(root, baseDir).length;
  return { filePath, existed: false, count: after_count };
}

module.exports = { writeDecision };
