'use strict';
/**
 * lib/provenance — code-edit provenance pipeline.
 *
 * Phase 153: every agent edit traceable to model+runtime+handoff+task+phase,
 * with quality labels (good/churn/in-progress) derived from git survival
 * + edit frequency. Output feeds slm_learning's SFT corpus.
 *
 * Entry point: gad provenance build|show|export|stats
 *
 * Decisions: GLOBAL-D-300 (storage), 301 (cadence), 302 (heuristic),
 *            303 (no extra snapshots), 304 (dual sink), 305 (internal only).
 */

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_HEURISTIC = {
  good_survival_pct: 80,
  good_untouched_days: 7,
  churn_edits_per_hour: 5,
  churn_survival_pct: 30,
  in_progress_recent_hours: 24,
};

function provenanceDir(planningDir) {
  return path.join(planningDir, '.provenance');
}

function provenanceFilePath(planningDir, dateStr) {
  return path.join(provenanceDir(planningDir), `${dateStr}.jsonl`);
}

function ensureProvenanceDir(planningDir) {
  const dir = provenanceDir(planningDir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function ymd(date) {
  const d = (date instanceof Date) ? date : new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateRange({ since, until }) {
  const now = new Date();
  const untilDate = until ? new Date(until) : now;
  const sinceDate = since ? new Date(since) : new Date(untilDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { sinceDate, untilDate };
}

/**
 * Stream-read a JSONL file line by line, yielding parsed objects.
 * Skips blank lines and JSON errors. Synchronous, suitable for files
 * a few MB in size — for larger files use a streaming parser.
 */
function* readJsonl(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      yield JSON.parse(trimmed);
    } catch (err) {
      // skip malformed line
    }
  }
}

function appendJsonl(filePath, objects) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const lines = objects.map((o) => JSON.stringify(o)).join('\n') + (objects.length ? '\n' : '');
  fs.appendFileSync(filePath, lines, 'utf8');
}

function writeJsonl(filePath, objects) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = objects.map((o) => JSON.stringify(o)).join('\n') + (objects.length ? '\n' : '');
  fs.writeFileSync(filePath, content, 'utf8');
}

function loadHeuristic(config) {
  const provenance = (config && config.provenance) || {};
  return { ...DEFAULT_HEURISTIC, ...provenance };
}

module.exports = {
  DEFAULT_HEURISTIC,
  provenanceDir,
  provenanceFilePath,
  ensureProvenanceDir,
  ymd,
  parseDateRange,
  readJsonl,
  appendJsonl,
  writeJsonl,
  loadHeuristic,
};
