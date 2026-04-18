'use strict';
/**
 * skill-usage-stats.cjs — aggregate per-skill usage across all planning
 * projects in a gad-config.toml workspace.
 *
 * Data source: `skill=` attribute on <task status="done"> elements in
 * every TASK-REGISTRY.xml (per GAD-D-104 task-attribution contract).
 * Optional secondary source: `.planning/.trace-events.jsonl` — will pick
 * up `skill_invocation` events when the hook fleet starts emitting them
 * (currently unused, but the reader is ready).
 *
 * Contract: pure reader. Returns { bySkill, totalRuns, staleSkills,
 * unused, lastUsedBySkill } — no side effects.
 *
 * Consumed by:
 *   - `gad skill status <id>` — shows "runs: N, last: <date>"
 *   - `gad skill token-audit` — pairs usage with token cost to find
 *     "expensive never-used" shedding candidates
 *   - evolution-on-startup — input to shedding decisions
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse one TASK-REGISTRY.xml and accumulate skill-attribution counts.
 *
 * @param {string} xml
 * @returns {Array<{ skill: string, taskId: string, projectId?: string, date?: string }>}
 */
const SENTINEL_SKILL_VALUES = new Set(['default', 'none', '-', 'unknown']);

function extractTaskAttributions(xml, projectId = '', opts = {}) {
  const includeSentinels = !!opts.includeSentinels;
  const defaultDate = opts.date ? String(opts.date) : '';
  const out = [];
  const taskRe = /<task\s+([^>]*)>/g;
  let m;
  while ((m = taskRe.exec(xml)) !== null) {
    const attrs = m[1];
    const statusMatch = attrs.match(/\bstatus="([^"]*)"/);
    if (!statusMatch || statusMatch[1] !== 'done') continue;
    const skillMatch = attrs.match(/\bskill="([^"]*)"/);
    if (!skillMatch || !skillMatch[1]) continue;
    const idMatch = attrs.match(/\bid="([^"]*)"/);
    const taskId = idMatch ? idMatch[1] : '';
    const skills = skillMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const s of skills) {
      if (!includeSentinels && SENTINEL_SKILL_VALUES.has(s)) continue;
      out.push({ skill: s, taskId, projectId, date: defaultDate });
    }
  }
  return out;
}

/**
 * Walk a gad-config.toml's registered roots; aggregate attributions.
 *
 * @param {object} config gad-config with `roots` array
 * @param {string} baseDir repo root
 * @param {object} [ctx]
 * @returns {Array<{ skill, taskId, projectId }>}
 */
function collectAttributions(config, baseDir, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  const roots = Array.isArray(config.roots) ? config.roots : [];
  const all = [];
  for (const root of roots) {
    const xmlPath = path.join(baseDir, root.path, root.planningDir || '.planning', 'TASK-REGISTRY.xml');
    let xml;
    let xmlStat = null;
    try {
      xml = impl.readFileSync(xmlPath, 'utf8');
      xmlStat = impl.statSync ? impl.statSync(xmlPath) : null;
    } catch {
      continue;
    }
    all.push(...extractTaskAttributions(xml, root.id, {
      date: xmlStat && xmlStat.mtime ? xmlStat.mtime.toISOString() : '',
    }));
  }
  return all;
}

/**
 * Optional: trace-events.jsonl reader for `skill_invocation` events.
 * Currently the hook fleet emits only `tool_use` and `file_mutation`;
 * this function is idempotent no-op until skill_invocation starts
 * appearing (tracked against trace-analysis skill roadmap).
 */
function extractTraceInvocations(jsonlPath, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  const out = [];
  let raw;
  try { raw = impl.readFileSync(jsonlPath, 'utf8'); } catch { return out; }
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    if (!line.includes('skill_invocation')) continue;
    try {
      const evt = JSON.parse(line);
      if (evt.type === 'skill_invocation' && evt.skill) {
        out.push({ skill: evt.skill, ts: evt.ts, sessionId: evt.runtime?.session_id });
      }
    } catch { /* malformed line */ }
  }
  return out;
}

/**
 * Aggregate attributions + known-skill list into a usage report.
 *
 * @param {Array<{skill, taskId, projectId}>} attributions
 * @param {Array<string>} knownSkills — list of skill ids from `skills/*`
 * @returns {{ bySkill, unused, totalRuns, topByRuns }}
 */
function buildUsageReport(attributions, knownSkills = []) {
  const bySkill = new Map();
  for (const a of attributions) {
    const entry = bySkill.get(a.skill) || {
      skill: a.skill,
      runs: 0,
      projects: new Set(),
      tasks: [],
      lastUsedAt: '',
    };
    entry.runs += 1;
    if (a.projectId) entry.projects.add(a.projectId);
    if (a.taskId) entry.tasks.push(a.taskId);
    if (a.date && (!entry.lastUsedAt || a.date > entry.lastUsedAt)) {
      entry.lastUsedAt = a.date;
    }
    bySkill.set(a.skill, entry);
  }
  const known = new Set(knownSkills);
  const used = new Set(bySkill.keys());
  const unused = knownSkills.filter((s) => !used.has(s));
  const attributedButMissing = [...used].filter((s) => !known.has(s));
  const entries = [...bySkill.values()].map((e) => ({
    skill: e.skill,
    runs: e.runs,
    projects: [...e.projects],
    tasks: e.tasks.slice(0, 5),
    lastUsedAt: e.lastUsedAt || '',
  }));
  const topByRuns = [...entries].sort((a, b) => b.runs - a.runs).slice(0, 15);
  return {
    bySkill: entries,
    unused,
    attributedButMissing,
    totalRuns: attributions.length,
    uniqueSkillsUsed: bySkill.size,
    topByRuns,
  };
}

/**
 * Discover skill ids from a skills directory.
 */
function discoverSkillIds(skillsDir, ctx = {}) {
  const impl = ctx.fsImpl || fs;
  const out = [];
  const walk = (dir, crumbs) => {
    let entries;
    try { entries = impl.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, [...crumbs, e.name]);
      else if (e.isFile() && e.name === 'SKILL.md') {
        out.push(crumbs.length > 0 ? crumbs.join('/') : path.basename(path.dirname(full)));
      }
    }
  };
  walk(skillsDir, []);
  return out;
}

module.exports = {
  extractTaskAttributions,
  collectAttributions,
  extractTraceInvocations,
  buildUsageReport,
  discoverSkillIds,
  SENTINEL_SKILL_VALUES,
};
