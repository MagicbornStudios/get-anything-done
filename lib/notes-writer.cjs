'use strict';
/**
 * notes-writer.cjs — create a new ad-hoc note in .planning/notes/.
 *
 * Filename format: YYYY-MM-DD[-<agent>]-<slug>.md
 *
 * The optional <agent> slug is included when:
 *   - explicitly passed via the `agent` field, OR
 *   - the GAD_AGENT_NAME environment variable is set.
 *
 * This avoids same-date filename collisions across parallel agents
 * (a real problem — .planning/notes/ has 10 same-date files for
 * 2026-04-18, none of which can be told apart from the filename).
 *
 * Refuses to overwrite an existing file with the same date+agent+slug.
 */

const fs = require('fs');
const path = require('path');

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sanitizeSlug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * @param {{ path: string, planningDir: string }} root
 * @param {string} baseDir
 */
function listNotes(root, baseDir) {
  const dir = path.join(baseDir, root.path, root.planningDir, 'notes');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(f => ({ filename: f, path: path.join(dir, f) }));
}

/**
 * @param {{ path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {{ slug: string, title?: string, body?: string, source?: string, date?: string, agent?: string }} n
 * @returns {{ filePath: string, filename: string }}
 */
function writeNote(root, baseDir, n) {
  if (!n || !n.slug) throw new Error('note slug is required');

  const slug = sanitizeSlug(n.slug);
  const date = n.date || todayIso();
  const agentRaw = n.agent || process.env.GAD_AGENT_NAME || '';
  const agent = sanitizeSlug(agentRaw);
  const filename = agent
    ? `${date}-${agent}-${slug}.md`
    : `${date}-${slug}.md`;

  const dir = path.join(baseDir, root.path, root.planningDir, 'notes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    throw new Error(`note already exists: ${filename}`);
  }

  const titleLine = n.title ? `# ${n.title}\n\n` : '';
  const sourceLine = n.source ? `**Source:** ${n.source}\n\n` : '';
  const agentLine = agent ? `**Agent:** ${agentRaw}\n\n` : '';
  const body = (n.body || '').trim();
  const content = `${titleLine}${agentLine}${sourceLine}${body}${body ? '\n' : ''}`;
  fs.writeFileSync(filePath, content);

  return { filePath, filename };
}

/**
 * Extract the content under a `## Open questions` / `## Questions` /
 * `## Open questions for <scope>` heading in a note. Returns the lines
 * between that heading and the next `## ` (or EOF). Trimmed.
 *
 * Matches any heading starting with "Open questions" (case-insensitive,
 * optional trailing "for discussion" / "for operator" / etc.) or just
 * "Questions".
 */
function extractOpenQuestions(text) {
  const src = String(text || '');
  const re = /^##\s+(?:open\s+)?questions(?:\s+[^\n]*)?\s*$/im;
  const match = src.match(re);
  if (!match) return '';
  const startIdx = match.index + match[0].length;
  const rest = src.slice(startIdx);
  // Find next section boundary: another `## ` heading, or a horizontal rule
  // that separates major sections (line of only `---`). End of file otherwise.
  const nextHeading = rest.match(/\n##\s+[^\n]+/);
  const horizontalRule = rest.match(/\n---+\s*\n/);
  const candidates = [nextHeading, horizontalRule].filter(Boolean);
  if (candidates.length === 0) return rest.trim();
  const earliest = candidates.reduce((a, b) => (a.index < b.index ? a : b));
  return rest.slice(0, earliest.index).trim();
}

/**
 * Scan notes for open-question blocks. Returns [{ filename, questions }]
 * for notes that have them. Optionally filter by slug substring or
 * modification-time cutoff.
 */
function listNoteQuestions(root, baseDir, { sinceDate, slugFilter } = {}) {
  const fsMod = require('fs');
  const notes = listNotes(root, baseDir);
  const out = [];
  for (const n of notes) {
    if (slugFilter && !n.filename.toLowerCase().includes(String(slugFilter).toLowerCase())) continue;
    if (sinceDate) {
      const dateMatch = n.filename.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch && dateMatch[1] < sinceDate) continue;
    }
    let text;
    try { text = fsMod.readFileSync(n.path, 'utf8'); } catch { continue; }
    const questions = extractOpenQuestions(text);
    if (questions) {
      out.push({ filename: n.filename, path: n.path, questions });
    }
  }
  return out;
}

module.exports = { writeNote, listNotes, sanitizeSlug, extractOpenQuestions, listNoteQuestions };
