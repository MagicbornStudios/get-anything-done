'use strict';
/**
 * roadmap-reader.cjs — parse GAD ROADMAP.md into a structured phase list.
 * Also handles legacy RP ROADMAP.xml.
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, title: string, goal: string, status: 'done'|'active'|'planned', depends: string, description: string }} Phase
 * @typedef {{ name: string, kind: string }} DocFlowEntry
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

  // Prefer XML over MD — XML carries full field coverage (plans, depends, milestone, title)
  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'));
  }
  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'));
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
      goal: desc || titleRaw,
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
  const phaseRe = /<phase\b([^>]*)>([\s\S]*?)<\/phase>/g;
  let m;
  while ((m = phaseRe.exec(content)) !== null) {
    const attrs = m[1];
    const body  = m[2];
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const id = idMatch ? idMatch[1] : '';
    if (!id) continue;

    const goalMatch    = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const titleMatch   = body.match(/<title>([\s\S]*?)<\/title>/);
    const statusMatch  = body.match(/<status>([\s\S]*?)<\/status>/);
    const dependsMatch = body.match(/<depends>([\s\S]*?)<\/depends>/);
    const milestoneMatch = body.match(/<milestone>([\s\S]*?)<\/milestone>/);
    const plansMatch   = body.match(/<plans>([\s\S]*?)<\/plans>/);
    const requiresMatch = body.match(/<requirements>([\s\S]*?)<\/requirements>/);

    const goal      = goalMatch    ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const titleRaw  = titleMatch   ? titleMatch[1].trim() : '';
    const rawStatus = statusMatch  ? statusMatch[1].trim()  : 'planned';
    const depends   = dependsMatch ? dependsMatch[1].trim() : '';
    const milestone = milestoneMatch ? milestoneMatch[1].trim() : '';
    const plans     = plansMatch   ? plansMatch[1].trim() : '';
    const requirements = requiresMatch ? requiresMatch[1].trim() : '';
    const normalised = rawStatus.toLowerCase();
    const status = normalised === 'done' || normalised === 'closed' || normalised === 'complete' || normalised === 'completed' ? 'done'
                 : normalised === 'active' || normalised === 'in-progress' ? 'active'
                 : 'planned';

    const title = titleRaw || (goal.length > 60 ? goal.slice(0, 57) + '...' : goal);
    phases.push({
      id,
      title,
      goal,
      status,
      depends,
      milestone,
      plans,
      requirements,
      description: goal,
    });
  }
  return phases;
}

/**
 * Read the doc-flow section from ROADMAP.xml.
 * doc-flow lists named planning docs that agents should read for this project.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @returns {DocFlowEntry[]}
 */
function readDocFlow(root, baseDir) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'ROADMAP.xml');
  if (!fs.existsSync(xmlFile)) return [];
  const content = fs.readFileSync(xmlFile, 'utf8');

  // Extract the <doc-flow> block
  const dfMatch = content.match(/<doc-flow>([\s\S]*?)<\/doc-flow>/);
  if (!dfMatch) return [];

  const entries = [];
  const docRe = /<doc\b([^>]*)>([\s\S]*?)<\/doc>/g;
  let m;
  while ((m = docRe.exec(dfMatch[1])) !== null) {
    const nameMatch = m[1].match(/\bname="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : '';
    const description = m[2].trim().replace(/<[^>]+>/g, '').trim();
    if (name) entries.push({ name, description });
  }
  return entries;
}

module.exports = { readPhases, readDocFlow };
