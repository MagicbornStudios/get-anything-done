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

  let raw = null;
  if (fs.existsSync(stateFile)) {
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
  };

  if (raw) {
    return parseMd(raw, base);
  }

  // Fallback: try XML (legacy RP format)
  if (fs.existsSync(xmlFile)) {
    return parseXml(fs.readFileSync(xmlFile, 'utf8'), base);
  }

  return base;
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

  return result;
}

function parseXml(content, base) {
  const result = { ...base };

  const currentPhase = content.match(/<current-phase[^>]*>([^<]+)<\/current-phase>/);
  if (currentPhase) result.currentPhase = currentPhase[1].trim();

  const milestone = content.match(/<milestone[^>]*>([^<]+)<\/milestone>/);
  if (milestone) result.milestone = milestone[1].trim();

  const status = content.match(/<status[^>]*>([^<]+)<\/status>/);
  if (status) result.status = status[1].trim().toLowerCase();

  return result;
}

module.exports = { readState };
