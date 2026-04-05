'use strict';
/**
 * task-registry-reader.cjs — parse TASK-REGISTRY.xml into a task list.
 * Falls back to scanning STATE.md task tables if XML is absent.
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ id: string, goal: string, status: string, phase: string, keywords: string }} Task
 */

/**
 * Read tasks for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ status?: string, phase?: string }} [filter]
 * @returns {Task[]}
 */
function readTasks(root, baseDir, filter = {}) {
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'TASK-REGISTRY.xml');
  const mdFile  = path.join(baseDir, root.path, root.planningDir, 'STATE.md');

  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'), filter);
  }
  if (fs.existsSync(mdFile)) {
    return parseMd(fs.readFileSync(mdFile, 'utf8'), filter);
  }
  return [];
}

function parseXml(content, filter) {
  const tasks = [];
  const taskRe = /<task\s+id="([^"]+)"\s+agent-id="[^"]*"\s+status="([^"]+)">([\s\S]*?)<\/task>/g;
  let m;
  while ((m = taskRe.exec(content)) !== null) {
    const id     = m[1];
    const status = m[2].toLowerCase();
    const body   = m[3];

    if (filter.status && status !== filter.status.toLowerCase()) continue;

    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const kwMatch   = body.match(/<keywords>([\s\S]*?)<\/keywords>/);
    const depMatch  = body.match(/<depends>([\s\S]*?)<\/depends>/);

    const goal     = goalMatch ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const keywords = kwMatch   ? kwMatch[1].trim() : '';
    const depends  = depMatch  ? depMatch[1].trim() : '';

    // Derive phase from task id prefix (e.g. "02-01" → phase "02")
    const phase = id.split('-')[0] || '';
    if (filter.phase && phase !== filter.phase) continue;

    tasks.push({ id, goal, status, phase, keywords, depends });
  }
  return tasks;
}

function parseMd(content, filter) {
  const tasks = [];
  // Match markdown task table rows: | id | description | status |
  const lines = content.split('\n');
  let inTable = false;
  for (const line of lines) {
    if (/task|status/i.test(line) && line.includes('|')) { inTable = true; continue; }
    if (!inTable) continue;
    if (line.trim() === '' || line.includes('---')) { inTable = false; continue; }
    if (!line.trim().startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cols.length < 2) continue;
    const id     = cols[0];
    const goal   = cols[1] || '';
    const status = (cols[2] || 'planned').toLowerCase();
    if (filter.status && status !== filter.status) continue;
    tasks.push({ id, goal, status, phase: id.split('-')[0] || '', keywords: '', depends: '' });
  }
  return tasks;
}

module.exports = { readTasks };
