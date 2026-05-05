'use strict';
/**
 * lib/skills/relevance-match.cjs — match relevant skills to a handoff so
 * `gad snapshot --handoff <id>` can inline their bodies as orientation
 * text for ANY runtime (codex/gemini/opencode read AGENTS.md + stdin and
 * have no native skill-registry concept).
 *
 * Inputs:
 *   - handoffFrontmatter: { runtime_preference, phase, task_id, projectid, ... }
 *   - handoffBody:        the markdown body of the handoff
 *   - skillRoots:         list of dirs to scan, in priority order
 *                         (e.g. .planning/proto-skills/, .claude/skills/, vendor/.../skills/)
 *   - phaseTitle:         optional phase title resolved from ROADMAP.xml
 *   - taskGoal:           optional task goal resolved from .planning/tasks/<id>.json
 *   - clauseMandatorySlugs: standing UI triplets + any always-load slugs
 *
 * Output:
 *   Array<{ slug, dir, skillFile, frontmatter, body, raw, source, match_reason }>
 *
 * Matching rules (in order — highest score wins, ties broken by source priority):
 *   1. Mandatory slugs (CLAUDE.md standing UI triplets) — auto-included for
 *      handoffs whose phase title or body mentions UI surfaces (.tsx, .css,
 *      components, app/, page.tsx).
 *   2. Skill frontmatter `runtime` field overlap with handoff
 *      `runtime_preference` ⇒ +3 points.
 *   3. Skill name token overlap with handoff phase title / task goal /
 *      first 400 chars of body ⇒ +2 per token.
 *   4. Skill description token overlap ⇒ +1 per token.
 *
 * No external deps — only fs + path. parseFrontmatter is local and tiny so
 * this module stays loadable from snapshot without dragging skill-linter.
 */

const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with',
  'by', 'is', 'are', 'be', 'this', 'that', 'it', 'as', 'at', 'from',
  'use', 'when', 'how', 'what', 'why', 'which', 'skill', 'skills',
  'gad', 'task', 'phase', 'handoff', 'runtime', 'cli', 'project',
]);

const UI_TRIGGER_PATTERNS = [
  /\.(tsx|css)\b/i,
  /\bcomponents?\b/i,
  /\bapp\/(?:.*\/)?page\.tsx\b/i,
  /\b(ui|frontend|design|layout|styling)\b/i,
];

const DEFAULT_UI_MANDATORY = [
  'frontend-design',
  'web-design-guidelines',
  'gad-visual-context-system',
];

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !STOPWORDS.has(tok));
}

function parseSkillFrontmatter(raw) {
  const match = String(raw || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: String(raw || '') };
  const fmText = match[1];
  const body = match[2] || '';
  const frontmatter = {};
  let currentKey = null;
  for (const line of fmText.split(/\r?\n/)) {
    if (/^\s+/.test(line) && currentKey) {
      // continuation (yaml folded)
      frontmatter[currentKey] = `${frontmatter[currentKey] || ''} ${line.trim()}`.trim();
      continue;
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    currentKey = key;
    if (val.startsWith('[') && val.endsWith(']')) {
      frontmatter[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (val === '>-' || val === '>' || val === '|') {
      frontmatter[key] = '';
    } else {
      frontmatter[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { frontmatter, body };
}

function readSkillRecord(dir, skillFile, source) {
  let raw = '';
  try { raw = fs.readFileSync(skillFile, 'utf8'); } catch { return null; }
  const { frontmatter, body } = parseSkillFrontmatter(raw);
  const slug = path.basename(dir);
  return {
    slug,
    dir,
    skillFile,
    raw,
    body,
    frontmatter,
    source,
  };
}

function scanSkillRoot(rootDir, source) {
  if (!rootDir || !fs.existsSync(rootDir)) return [];
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const dir = path.join(rootDir, entry.name);
    const skillFile = path.join(dir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const record = readSkillRecord(dir, skillFile, source);
    if (record) out.push(record);
  }
  return out;
}

function collectAllSkills(skillRoots) {
  const seen = new Map();
  for (const { dir, source } of skillRoots) {
    for (const record of scanSkillRoot(dir, source)) {
      // First write wins (priority order respected). Track later sources
      // as "alt" for diagnostic purposes.
      if (!seen.has(record.slug)) seen.set(record.slug, record);
    }
  }
  return [...seen.values()];
}

function normalizeRuntimeValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  return String(value).split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function isUiHandoff(handoffBody, phaseTitle, taskGoal) {
  const probe = `${phaseTitle || ''}\n${taskGoal || ''}\n${(handoffBody || '').slice(0, 800)}`;
  return UI_TRIGGER_PATTERNS.some((re) => re.test(probe));
}

function scoreSkill(record, ctx) {
  const { handoffRuntime, queryTokens, descTokens } = ctx;
  let score = 0;
  const reasons = [];

  const skillRuntimes = normalizeRuntimeValues(record.frontmatter.runtime);
  if (handoffRuntime && skillRuntimes.length > 0 && skillRuntimes.includes(handoffRuntime)) {
    score += 3;
    reasons.push(`runtime=${handoffRuntime}`);
  }

  const nameTokens = tokenize(`${record.slug} ${record.frontmatter.name || ''}`);
  const nameOverlap = nameTokens.filter((tok) => queryTokens.has(tok));
  if (nameOverlap.length > 0) {
    score += 2 * nameOverlap.length;
    reasons.push(`name-match:${nameOverlap.slice(0, 3).join(',')}`);
  }

  const descSkillTokens = tokenize(record.frontmatter.description || '');
  const descOverlap = descSkillTokens.filter((tok) => descTokens.has(tok));
  if (descOverlap.length > 0) {
    score += descOverlap.length;
    reasons.push(`desc-match:${descOverlap.slice(0, 3).join(',')}`);
  }

  return { score, reason: reasons.join('; ') };
}

/**
 * Match relevant skills against a handoff context.
 *
 * @param {object} opts
 * @param {object} opts.handoffFrontmatter  — parsed frontmatter
 * @param {string} opts.handoffBody         — full handoff body text
 * @param {string} [opts.phaseTitle]        — optional title of the phase
 * @param {string} [opts.taskGoal]          — optional task goal
 * @param {Array<{dir, source}>} opts.skillRoots — ordered scan roots
 * @param {Array<string>} [opts.mandatorySlugs] — UI triplets etc.
 * @param {number} [opts.limit=8]           — cap matched-skill count
 * @returns {Array<{slug, dir, skillFile, frontmatter, body, raw, source, score, match_reason}>}
 */
function matchRelevantSkills({
  handoffFrontmatter = {},
  handoffBody = '',
  phaseTitle = '',
  taskGoal = '',
  skillRoots = [],
  mandatorySlugs = DEFAULT_UI_MANDATORY,
  limit = 8,
} = {}) {
  const all = collectAllSkills(skillRoots);
  if (all.length === 0) return [];

  const handoffRuntime = String(handoffFrontmatter.runtime_preference || '').toLowerCase().trim();
  const queryText = `${phaseTitle} ${taskGoal} ${(handoffBody || '').slice(0, 800)}`;
  const queryTokens = new Set(tokenize(queryText));
  const descTokens = new Set(tokenize(`${queryText} ${handoffFrontmatter.task_id || ''}`));

  const wantsUi = isUiHandoff(handoffBody, phaseTitle, taskGoal);
  const mandatorySet = new Set(wantsUi ? mandatorySlugs : []);

  const scored = [];
  for (const record of all) {
    if (mandatorySet.has(record.slug)) {
      scored.push({ ...record, score: 100, match_reason: 'mandatory:ui-triplet' });
      continue;
    }
    const { score, reason } = scoreSkill(record, { handoffRuntime, queryTokens, descTokens });
    if (score <= 0) continue;
    scored.push({ ...record, score, match_reason: reason });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.slug.localeCompare(b.slug);
  });

  return scored.slice(0, limit);
}

/**
 * Default skill-root resolution given a repoRoot + project baseDir. Order:
 *   1. <baseDir>/.planning/proto-skills/   (project-local proto-skills)
 *   2. <baseDir>/.claude/skills/           (project-local installed claude skills)
 *   3. <repoRoot>/skills/                  (canonical framework skills)
 */
function defaultSkillRoots({ repoRoot, baseDir }) {
  const roots = [];
  if (baseDir) {
    roots.push({ dir: path.join(baseDir, '.planning', 'proto-skills'), source: 'proto-skill' });
    roots.push({ dir: path.join(baseDir, '.claude', 'skills'), source: 'claude-skill' });
  }
  if (repoRoot) {
    roots.push({ dir: path.join(repoRoot, 'skills'), source: 'framework-skill' });
  }
  return roots;
}

module.exports = {
  matchRelevantSkills,
  defaultSkillRoots,
  parseSkillFrontmatter,
  scanSkillRoot,
  isUiHandoff,
  tokenize,
  DEFAULT_UI_MANDATORY,
};
