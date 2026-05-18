'use strict';
/**
 * state-reader.cjs — parse GAD STATE.md into a structured object.
 *
 * Handles two patterns:
 *  1. GAD Markdown format (STATE.md) — native format
 *  2. Stub STATE.md pointing at XML (legacy RP) — returns minimal info from XML if parseable
 */

const fs = require('fs');
const path = require('path');

// Lazy-load to avoid circular dep if task-registry-reader ever imports state-reader
function loadTaskReader() {
  try { return require('./task-registry-reader.cjs'); } catch { return null; }
}

/**
 * @typedef {{ projectId: string, path: string, planningDir: string, currentPhase: string|null, milestone: string|null, status: string, openTasks: number, phasesComplete: number, phasesTotal: number, lastActivity: string|null }} ProjectState
 */

/**
 * Read state for a single root.
 * @param {{ id: string, path: string, planningDir: string }} root
 * @param {string} baseDir - repo root
 * @returns {ProjectState}
 */
function readState(root, baseDir) {
  const stateFile = path.join(baseDir, root.path, root.planningDir, 'STATE.md');
  const xmlFile = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');

  // Prefer XML when both exist — XML carries full field coverage
  const preferXml = fs.existsSync(xmlFile);
  let xmlRaw = null;
  let raw = null;
  if (preferXml) {
    xmlRaw = fs.readFileSync(xmlFile, 'utf8');
  } else if (fs.existsSync(stateFile)) {
    raw = fs.readFileSync(stateFile, 'utf8');
  }

  const base = {
    projectId: root.id,
    path: root.path,
    planningDir: root.planningDir,
    currentPhase: null,
    milestone: null,
    status: 'unknown',
    openTasks: 0,
    phasesComplete: 0,
    phasesTotal: 0,
    lastActivity: null,
    nextAction: null,
  };

  let result;
  if (xmlRaw) {
    result = parseXml(xmlRaw, base);
  } else if (raw) {
    result = parseMd(raw, base);
  } else {
    return base;
  }

  // Compute the display next action from live state first; fall back to any
  // legacy <next-action> tag only when no fresher computable source exists.
  result.nextAction = deriveNextAction(root, baseDir, result, xmlRaw, result.nextAction);

  // Cross-reference TASK-REGISTRY.xml for open task count when not already set
  if (result.openTasks === 0) {
    const taskReader = loadTaskReader();
    if (taskReader) {
      try {
        const inProgress = taskReader.readTasks(root, baseDir, { status: 'in-progress' });
        const planned = taskReader.readTasks(root, baseDir, { status: 'planned' });
        result.openTasks = inProgress.length + planned.length;
        // Last activity: derive from most recently completed task id (highest done id in current phase)
        if (!result.lastActivity && result.currentPhase) {
          // Prefer ISO date from <last-updated> tag in STATE.xml
          const xmlFile2 = path.join(baseDir, root.path, root.planningDir, 'STATE.xml');
          if (fs.existsSync(xmlFile2)) {
            const xmlRaw = fs.readFileSync(xmlFile2, 'utf8');
            const lu = xmlRaw.match(/<last-updated>([^<]+)<\/last-updated>/);
            if (lu) { result.lastActivity = lu[1].trim(); }
          }
          // Fallback: derive from done task count
          if (!result.lastActivity) {
            const done = taskReader.readTasks(root, baseDir, { status: 'done', phase: result.currentPhase });
            if (done.length > 0) {
              result.lastActivity = `${done.length} tasks done in phase ${result.currentPhase}`;
            }
          }
        }
      } catch { /* ignore */ }
    }
  }

  return result;
}

function parseMd(content, base) {
  const result = { ...base };

  // ## Current Position or ## Phase: N of M
  const phaseMatch = content.match(/##\s+(?:Current Position.*?)?[Pp]hase[:\s]+([^\n]+)/m);
  if (phaseMatch) result.currentPhase = phaseMatch[1].trim();

  // Phase: N / M
  const phaseNofM = content.match(/[Pp]hase[:\s]+(\d+)\s*[/of]+\s*(\d+)/m);
  if (phaseNofM) {
    result.phasesComplete = parseInt(phaseNofM[1], 10);
    result.phasesTotal = parseInt(phaseNofM[2], 10);
  }

  // Milestone: M1 or ## Milestone N
  const milestoneMatch = content.match(/[Mm]ilestone[:\s]+([^\n]+)/m);
  if (milestoneMatch) result.milestone = milestoneMatch[1].trim().split(/\s+/)[0];

  // Status: active / complete / paused
  const statusMatch = content.match(/[Ss]tatus[:\s]+([^\n]+)/m);
  if (statusMatch) result.status = statusMatch[1].trim().toLowerCase();

  // Open tasks: count [ ] entries
  const openTasks = (content.match(/- \[ \]/g) || []).length;
  result.openTasks = openTasks;

  // Last activity from heading or date field
  const dateMatch = content.match(/(?:last[- ]activity|updated)[:\s]+(\d{4}-\d{2}-\d{2})/im);
  if (dateMatch) result.lastActivity = dateMatch[1];

  // Next action: parse ## Next action section
  const nextActionMatch = content.match(/##\s+Next action\s*\n([\s\S]*?)(?=\n##|\n?$)/i);
  if (nextActionMatch) result.nextAction = nextActionMatch[1].trim();

  // Level — not present in markdown format; default (migrated)
  result.level = { value: 1, xp: 0, xpToNext: 100, loadedSkills: 0 };
  result._levelMigrated = true;

  return result;
}

function parseXml(content, base) {
  const result = { ...base };

  const currentPhase = content.match(/<current-phase[^>]*>([^<]+)<\/current-phase>/);
  if (currentPhase) result.currentPhase = currentPhase[1].trim();

  const currentPlan = content.match(/<current-plan[^>]*>([^<]+)<\/current-plan>/);
  if (currentPlan) result.milestone = currentPlan[1].trim();

  const milestone = content.match(/<milestone[^>]*>([^<]+)<\/milestone>/);
  if (milestone) result.milestone = milestone[1].trim();

  const status = content.match(/<status[^>]*>([^<]+)<\/status>/);
  if (status) result.status = status[1].trim().toLowerCase();

  // Count in-progress tasks from task-registry embedded or adjacent
  const taskMatches = content.match(/status="in-progress"/g);
  if (taskMatches) result.openTasks = taskMatches.length;

  // Last activity: prefer <last-updated> ISO tag, then updated attribute
  const lastUpdated = content.match(/<last-updated>([^<]+)<\/last-updated>/);
  if (lastUpdated) { result.lastActivity = lastUpdated[1].trim(); }
  else {
    const dateMatch = content.match(/updated="(\d{4}-\d{2}-\d{2})"/);
    if (dateMatch) result.lastActivity = dateMatch[1];
  }

  // Next action — full text, no truncation
  const nextAction = content.match(/<next-action[^>]*>([\s\S]*?)<\/next-action>/);
  if (nextAction && nextAction[1].trim()) {
    result.nextAction = nextAction[1].trim();
  }

  // Level element — project evolution level (phase 126)
  // Defaults: value=1, xp=0, xp_to_next=100, loaded_skills=0
  const levelMatch = content.match(/<level\s+value="(\d+)"\s+xp="(\d+(?:\.\d+)?)"\s+xp_to_next="(\d+(?:\.\d+)?)"\s+loaded_skills="(\d+)"\/?>/);
  if (levelMatch) {
    result.level = {
      value: parseInt(levelMatch[1], 10),
      xp: parseInt(levelMatch[2], 10),
      xpToNext: parseInt(levelMatch[3], 10),
      loadedSkills: parseInt(levelMatch[4], 10),
    };
  } else {
    // Migration: STATE.xml has no <level> — default in on first read
    result.level = { value: 1, xp: 0, xpToNext: 100, loadedSkills: 0 };
    result._levelMigrated = true;
  }

  return result;
}

/**
 * Derive next action from computable state when missing or explicitly empty.
 * 1. Latest <state-log> entry tagged with currentPhase
 * 2. Lowest-numbered 'planned' task in currentPhase
 * 3. Phase goal from ROADMAP.xml
 */
function deriveNextAction(root, baseDir, result, xmlContent, legacyNextAction = null) {
  const currentPhase = result.currentPhase;
  if (!currentPhase) return legacyNextAction;

  // 1. Latest state-log entry tagged with active phase
  if (xmlContent) {
    const logMatch = xmlContent.match(/<state-log>([\s\S]*?)<\/state-log>/);
    if (logMatch) {
      const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/g;
      let em;
      while ((em = entryRe.exec(logMatch[1])) !== null) {
        const attrs = em[1];
        const tagsMatch = attrs.match(/tags="([^"]*)"/);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
        if (tags.includes(currentPhase)) {
          return em[2].trim();
        }
      }
    }
  }

  // 2. Fallback: lowest-numbered planned task in active phase
  const taskReader = loadTaskReader();
  if (taskReader) {
    try {
      const planned = taskReader.readTasks(root, baseDir, { status: 'planned', phase: currentPhase });
      if (planned.length > 0) {
        // Sort by ID to find lowest-numbered
        planned.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        return `Next: ${planned[0].id} — ${planned[0].goal}`;
      }
    } catch { /* ignore */ }
  }

  // 3. Fallback: active phase goal
  try {
    const roadmapReader = require('./roadmap-reader.cjs');
    const phases = roadmapReader.readPhases(root, baseDir);
    const phase = phases.find(p => String(p.id) === String(currentPhase));
    if (phase && phase.goal) {
      return `Phase ${currentPhase} goal: ${phase.goal}`;
    }
  } catch { /* ignore */ }

  return legacyNextAction;
}

module.exports = { readState };
