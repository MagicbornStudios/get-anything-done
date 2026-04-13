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
  // Require whitespace after "task" so we don't match <task-registry> or similar
  const taskRe = /<task\s([^>]*)>([\s\S]*?)<\/task>/g;
  let m;
  while ((m = taskRe.exec(content)) !== null) {
    const attrs  = m[1];
    const body   = m[2];

    // Use lookbehind to avoid matching "id" inside "agent-id" or similar compound attrs
    const idMatch      = attrs.match(/(?<![a-z-])id="([^"]*)"/);
    const statusMatch  = attrs.match(/(?<![a-z-])status="([^"]*)"/);
    const agentIdMatch = attrs.match(/\bagent-id="([^"]*)"/);
    const agentRoleMatch = attrs.match(/\bagent-role="([^"]*)"/);
    const runtimeMatch = attrs.match(/\bruntime="([^"]*)"/);
    const modelProfileMatch = attrs.match(/\bmodel-profile="([^"]*)"/);
    const resolvedModelMatch = attrs.match(/\bresolved-model="([^"]*)"/);
    const claimedMatch = attrs.match(/\bclaimed="([^"]*)"/);
    const claimedAtMatch = attrs.match(/\bclaimed-at="([^"]*)"/);
    const leaseExpiresAtMatch = attrs.match(/\blease-expires-at="([^"]*)"/);
    const skillMatch   = attrs.match(/\bskill="([^"]*)"/);
    const typeMatch    = attrs.match(/\btype="([^"]*)"/);

    const id      = idMatch      ? idMatch[1]     : '';
    const status  = statusMatch  ? statusMatch[1].toLowerCase() : 'planned';
    const agentId = agentIdMatch ? agentIdMatch[1] : '';
    const agentRole = agentRoleMatch ? agentRoleMatch[1] : '';
    const runtime = runtimeMatch ? runtimeMatch[1] : '';
    const modelProfile = modelProfileMatch ? modelProfileMatch[1] : '';
    const resolvedModel = resolvedModelMatch ? resolvedModelMatch[1] : '';
    const claimed = claimedMatch ? claimedMatch[1].toLowerCase() === 'true' : false;
    const claimedAt = claimedAtMatch ? claimedAtMatch[1] : '';
    const leaseExpiresAt = leaseExpiresAtMatch ? leaseExpiresAtMatch[1] : '';
    const skill   = skillMatch   ? skillMatch[1]   : '';
    const type    = typeMatch    ? typeMatch[1]     : '';

    if (!id) continue;
    if (filter.status && status !== filter.status.toLowerCase()) continue;

    const goalMatch = body.match(/<goal>([\s\S]*?)<\/goal>/);
    const kwMatch   = body.match(/<keywords>([\s\S]*?)<\/keywords>/);
    const depMatch  = body.match(/<depends>([\s\S]*?)<\/depends>/);

    const goal     = goalMatch ? goalMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const keywords = kwMatch   ? kwMatch[1].trim() : '';
    const depends  = depMatch  ? depMatch[1].trim() : '';

    // Parse commands list
    const commands = [];
    const cmdBlockMatch = body.match(/<commands>([\s\S]*?)<\/commands>/);
    if (cmdBlockMatch) {
      const cmdRe = /<command>([\s\S]*?)<\/command>/g;
      let cm;
      while ((cm = cmdRe.exec(cmdBlockMatch[1])) !== null) {
        const cmd = cm[1].trim();
        if (cmd) commands.push(cmd);
      }
    }

    // Parse files list (optional — tracks files touched by this task)
    const files = [];
    const filesBlockMatch = body.match(/<files>([\s\S]*?)<\/files>/);
    if (filesBlockMatch) {
      const fileRe = /<file>([\s\S]*?)<\/file>/g;
      let fm;
      while ((fm = fileRe.exec(filesBlockMatch[1])) !== null) {
        const f = fm[1].trim();
        if (f) files.push(f);
      }
    }

    // Derive phase from task id prefix (e.g. "02-01" → phase "02")
    const phase = id.split('-')[0] || '';
    if (filter.phase && phase !== filter.phase) continue;

    tasks.push({
      id,
      agentId,
      agentRole,
      runtime,
      modelProfile,
      resolvedModel,
      claimed,
      claimedAt,
      leaseExpiresAt,
      skill,
      type,
      goal,
      status,
      phase,
      keywords,
      depends,
      commands,
      files,
    });
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
