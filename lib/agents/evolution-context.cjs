'use strict';
/**
 * lib/agents/evolution-context.cjs — Context preloader for gad-evolution-analyzer.
 *
 * Collects and bundles the canonical context sources the evolution agent needs
 * before reasoning: candidates directory, proto-skills state, ERRORS-AND-ATTEMPTS,
 * selection-pressure snapshot, and state-log tail.
 *
 * Phase 107-05 / 107-06.
 */

const fs = require('fs');
const path = require('path');

function tryRead(filepath, fallback = '') {
  try { return fs.readFileSync(filepath, 'utf8'); } catch { return fallback; }
}

function tryReadDir(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; }
}

/**
 * Build the context bundle for a given project root.
 *
 * @param {object} opts
 * @param {string} opts.projectRoot     — absolute path to project root
 * @param {string} [opts.projectid]     — project id for scoping
 * @returns {{ body: string, stats: object }}
 */
function buildEvolutionContext({ projectRoot, projectid = 'global' } = {}) {
  const planningDir = path.join(projectRoot, '.planning');
  const candidatesDir = path.join(planningDir, 'candidates');
  const protoSkillsDir = path.join(planningDir, 'proto-skills');
  const handoffsOpenDir = path.join(planningDir, 'handoffs', 'open');
  const stateXmlPath = path.join(planningDir, 'STATE.xml');
  const errorsAttemptsPath = path.join(planningDir, 'ERRORS-AND-ATTEMPTS.xml');

  const sections = [];
  const stats = { candidates: 0, protoSkills: 0, errorsOpen: 0, stateLogEntries: 0 };

  // 1. Evolution state overview
  const candidates = tryReadDir(candidatesDir);
  const protoSkills = tryReadDir(protoSkillsDir);
  stats.candidates = candidates.length;
  stats.protoSkills = protoSkills.length;

  sections.push(`## Evolution State (${projectid})`);
  sections.push('');
  sections.push(`Candidates: ${candidates.length}`);
  sections.push(`Proto-skills: ${protoSkills.length}`);
  if (candidates.length > 0) {
    sections.push('');
    sections.push('### Candidates');
    for (const c of candidates) sections.push(`  - ${c}`);
  }
  if (protoSkills.length > 0) {
    sections.push('');
    sections.push('### Proto-skills');
    for (const p of protoSkills) {
      const hasSkill = fs.existsSync(path.join(protoSkillsDir, p, 'SKILL.md'));
      const hasProvenance = fs.existsSync(path.join(protoSkillsDir, p, 'PROVENANCE.md'));
      sections.push(`  - ${p}  ${hasSkill ? '[SKILL.md]' : ''}${hasProvenance ? ' [PROVENANCE.md]' : ''}`);
    }
  }

  // 2. ERRORS-AND-ATTEMPTS — recent entries
  const eaXml = tryRead(errorsAttemptsPath);
  if (eaXml) {
    const openMatches = [...eaXml.matchAll(/status="open"/g)];
    stats.errorsOpen = openMatches.length;
    // Extract summary: count by category
    const categories = new Map();
    for (const m of eaXml.matchAll(/category="([^"]+)"/g)) {
      categories.set(m[1], (categories.get(m[1]) || 0) + 1);
    }
    sections.push('');
    sections.push(`## ERRORS-AND-ATTEMPTS (${stats.errorsOpen} open)`);
    if (categories.size > 0) {
      sections.push('Categories:');
      for (const [cat, count] of categories) {
        sections.push(`  - ${cat}: ${count}`);
      }
    }
    // Include last 5 open entries
    const entries = [...eaXml.matchAll(/<entry\s[^>]*date="([^"]+)"[^>]*category="([^"]*)"[^>]*status="open"[^>]*>([\s\S]*?)<\/entry>/g)];
    if (entries.length > 0) {
      sections.push('');
      sections.push('Recent open entries:');
      for (const e of entries.slice(-5)) {
        sections.push(`  - [${e[1]}] ${e[2]}: ${e[3].replace(/\s+/g, ' ').trim().slice(0, 120)}`);
      }
    }
  }

  // 3. STATE.xml — current phase, next-action, level
  const stateXml = tryRead(stateXmlPath);
  if (stateXml) {
    const phaseMatch = stateXml.match(/<phase[^>]*>/);
    const nextActionMatch = stateXml.match(/<next-action>([^<]*)<\/next-action>/);
    const levelMatch = stateXml.match(/<level\s[^>]*\/?>/);
    sections.push('');
    sections.push('## STATE');
    if (phaseMatch) sections.push(`  Phase: ${phaseMatch[0]}`);
    if (nextActionMatch) sections.push(`  Next action: ${nextActionMatch[1]}`);
    if (levelMatch) sections.push(`  Level: ${levelMatch[0]}`);

    // State log — last 5 entries
    const logEntries = [...stateXml.matchAll(/<entry[^>]*>([^<]*)<\/entry>/g)];
    stats.stateLogEntries = logEntries.length;
    if (logEntries.length > 0) {
      sections.push('');
      sections.push('State log (tail):');
      for (const e of logEntries.slice(-5)) {
        sections.push(`  - ${e[1].trim()}`);
      }
    }
  }

  // 4. Open handoffs count as pressure signal
  const openHandoffs = tryReadDir(handoffsOpenDir);
  sections.push('');
  sections.push(`## Pressure Signals`);
  sections.push(`Open handoffs: ${openHandoffs.length}`);

  const body = sections.join('\n');

  return { body, stats };
}

/**
 * Build a compact one-line statusline string.
 * Format: "evo: <score> [<bar>]"
 */
function buildCompactStatusline(score) {
  const s = typeof score === 'number' ? Math.max(0, Math.min(1, score)) : 0;
  const filled = Math.round(s * 5);
  const empty = 5 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = (s * 100).toFixed(0);
  return `evo: ${pct}% [${bar}]`;
}

module.exports = {
  buildEvolutionContext,
  buildCompactStatusline,
};
