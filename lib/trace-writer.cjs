/**
 * GAD-TRACE.log writer.
 *
 * Format (append-only, one event per line):
 *   [ISO-timestamp] EVENT_TYPE  target  detail
 *
 * Event types:
 *   SKILL_CALL, FILE_EDIT, TASK_CREATE, TASK_UPDATE, STATE_UPDATE,
 *   DOC_DRIFT, PHASE_COMPLETE, SPRINT_COMPLETE, ERROR, RUN_START, RUN_END
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STANDARD_ARTIFACTS = new Set([
  'STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md', 'PROJECT.md',
  'KICKOFF.md', 'PLAN.md', 'UAT.md', 'VALIDATION.md', 'AGENTS.md',
  'SUMMARY.md', 'SCORE.md', 'GAD-TRACE.log', 'RUN.md', 'gad.json',
]);

/**
 * @param {string} logPath  Absolute path to GAD-TRACE.log
 * @param {string} eventType
 * @param {string} target
 * @param {string} [detail]
 */
function appendTrace(logPath, eventType, target, detail = '') {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${eventType.padEnd(16)} ${target}  ${detail}\n`;
  fs.appendFileSync(logPath, line, 'utf8');
}

/**
 * Parse all events from a GAD-TRACE.log file.
 * Returns array of { ts, eventType, target, detail }.
 */
function parseTrace(logPath) {
  if (!fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  return lines.map(line => {
    const m = line.match(/^\[([^\]]+)\]\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) return null;
    return { ts: m[1], eventType: m[2].trim(), target: m[3].trim(), detail: m[4].trim() };
  }).filter(Boolean);
}

/**
 * Detect doc drift: files in a run directory that are outside the standard artifact set.
 * Returns array of { file, reason }.
 */
function detectDocDrift(runDir) {
  if (!fs.existsSync(runDir)) return [];
  const files = fs.readdirSync(runDir);
  const drifted = [];
  for (const f of files) {
    const base = path.basename(f);
    if (!STANDARD_ARTIFACTS.has(base)) {
      drifted.push({ file: f, reason: 'outside_standard_artifacts' });
    }
  }
  return drifted;
}

/**
 * Summarize events from a trace.
 * Returns counts per event type.
 */
function summarizeTrace(events) {
  const counts = {};
  for (const e of events) {
    counts[e.eventType] = (counts[e.eventType] || 0) + 1;
  }
  return counts;
}

module.exports = { appendTrace, parseTrace, detectDocDrift, summarizeTrace, STANDARD_ARTIFACTS };
