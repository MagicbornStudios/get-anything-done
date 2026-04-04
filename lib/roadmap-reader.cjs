'use strict';
/**
 * roadmap-reader.cjs — parse GAD ROADMAP.md into a structured phase list.
 * Also handles legacy RP ROADMAP.xml.
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, title: string, status: 'done'|'active'|'planned', description: string }} Phase
 */

/**
 * Read phases for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir - repo root
 * @returns {Phase[]}
 */
function readPhases(root, baseDir) {
  const mdFile = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.md');
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');

  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'));
  }
  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'));
  }
  return [];
}

function parseMd(content) {
  const phases = [];

  // Match lines like: - [x] **Phase 1: Title** — description
  // or: - [ ] **Phase 2: Title**
  const lineRe = /^-\s+\[(x| )\]\s+\*\*([^*]+)\*\*(?:\s*[—–-]\s*(.+))?$/gm;
  let i = 0;
  let m;
  while ((m = lineRe.exec(content)) !== null) {
    const done = m[1] === 'x';
    const titleRaw = m[2].trim();
    const desc = (m[3] || '').trim();
    i++;
    phases.push({
      id: String(i),
      title: titleRaw,
      status: done ? 'done' : 'planned',
      description: desc,
    });
  }

  // If no checklist format found, try heading format: ## Phase N: Title
  if (phases.length === 0) {
    const headingRe = /^#{1,3}\s+(?:Phase\s+)?(\d+)[:\s]+(.+)$/gm;
    while ((m = headingRe.exec(content)) !== null) {
      phases.push({
        id: m[1],
        title: m[2].trim(),
        status: 'planned',
        description: '',
      });
    }
  }

  return phases;
}

function parseXml(content) {
  const phases = [];
  const phaseRe = /<phase id="([^"]+)">([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(content)) !== null) {
    const id = m[1];
    const body = m[2];
    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const statusMatch = body.match(/<status>([\s\S]*?)<\/status>/);
    const goal = goalMatch ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const status = statusMatch ? statusMatch[1].trim() : 'planned';
    phases.push({
      id,
      title: goal.length > 60 ? goal.slice(0, 57) + '...' : goal,
      status: status === 'done' ? 'done' : status === 'active' ? 'active' : 'planned',
      description: goal,
    });
  }
  return phases;
}

module.exports = { readPhases };
