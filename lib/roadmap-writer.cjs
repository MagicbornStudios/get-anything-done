'use strict';
/**
 * roadmap-writer.cjs — append a new <phase> block to ROADMAP.xml.
 *
 * Pattern: locate the closing </roadmap> tag and insert the new block
 * immediately before it. Refuses to add if the phase id collides with an
 * existing phase.
 */

const fs = require('fs');
const path = require('path');
const { readPhases } = require('./roadmap-reader.cjs');

/**
 * @typedef {{ id: string, title: string, goal: string, status?: string, depends?: string, milestone?: string }} NewPhase
 */

function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Append a phase to ROADMAP.xml for a given root.
 *
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {NewPhase} p
 * @returns {{ filePath: string, count: number }}
 */
function writePhase(root, baseDir, p) {
  if (!p || !p.id) throw new Error('phase id is required');
  if (!p.title) throw new Error('phase title is required');
  if (!p.goal) throw new Error('phase goal is required');

  const filePath = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');
  if (!fs.existsSync(filePath)) {
    throw new Error(`ROADMAP.xml not found at ${path.relative(baseDir, filePath)}`);
  }

  const existing = readPhases(root, baseDir);
  if (existing.some(ep => String(ep.id) === String(p.id))) {
    throw new Error(`phase id "${p.id}" already exists`);
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const idx = original.lastIndexOf('</roadmap>');
  if (idx < 0) {
    throw new Error('no closing </roadmap> tag in ROADMAP.xml');
  }

  const status = p.status || 'planned';
  const depends = p.depends == null ? '' : String(p.depends);
  const milestoneBlock = p.milestone ? `    <milestone>${escapeXml(p.milestone)}</milestone>\n` : '';

  const block = [
    `  <phase id="${escapeXml(p.id)}">`,
    `    <title>${escapeXml(p.title)}</title>`,
    `    <goal>${escapeXml(p.goal)}</goal>`,
    `    <status>${escapeXml(status)}</status>`,
    `    <depends>${escapeXml(depends)}</depends>`,
    milestoneBlock.replace(/\n$/, ''),
    `  </phase>`,
  ].filter(Boolean).join('\n');

  const before = original.slice(0, idx).replace(/\s*$/, '');
  const after = original.slice(idx);
  const next = `${before}\n\n${block}\n\n${after}`;
  fs.writeFileSync(filePath, next);

  const after_count = readPhases(root, baseDir).length;
  return { filePath, count: after_count };
}

module.exports = { writePhase };
