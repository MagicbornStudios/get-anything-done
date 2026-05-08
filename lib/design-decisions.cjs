'use strict';
/**
 * lib/design-decisions.cjs — reader/writer for .planning/design-decisions/*.md
 *
 * Schema per entry (frontmatter fields):
 *   id          string   — e.g. "dd-001"
 *   title       string   — short human title
 *   problem     string   — what went wrong / what was the challenge
 *   reasoning   string   — why this fix was chosen; what failed before
 *   fix         string   — what was actually changed
 *   principle   string   — the durable rule extracted from this incident
 *   refs        string[] — related IDs, file paths, commit hashes
 *   status      string   — "live" | "superseded" | "archived"
 *   supersedes  string   — id of the dd this one supersedes (optional)
 *   superseded_by string — id of the dd that supersedes this one (optional)
 *   supersede_reason string — why this was superseded (optional)
 *   archive_reason   string — why this was archived (optional)
 *   created_at  string   — ISO timestamp
 */

const fs   = require('node:fs');
const path = require('node:path');

const DD_DIR = 'design-decisions';

// ─── Frontmatter parser (reused from handoffs.cjs pattern) ───────────────────

/**
 * Parse YAML-ish frontmatter from a .md file.
 * Handles:
 *   key: plain string
 *   key: ["a","b","c"]      ← JSON array (refs)
 *   key: null
 * Returns { frontmatter: obj, body: string }.
 */
function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: text };

  const fmText = match[1];
  const body   = match[2] || '';
  const frontmatter = {};

  for (const line of fmText.split(/\r?\n/)) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    if (!key) continue;
    const val = line.slice(colonIdx + 1).trim();
    if (val === 'null' || val === '') {
      frontmatter[key] = val === 'null' ? null : '';
      continue;
    }
    if ((val.startsWith('[') && val.endsWith(']')) ||
        (val.startsWith('{') && val.endsWith('}'))) {
      try { frontmatter[key] = JSON.parse(val); continue; } catch (_) {}
    }
    // Strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      frontmatter[key] = val.slice(1, -1);
      continue;
    }
    frontmatter[key] = val;
  }

  return { frontmatter, body };
}

/**
 * Serialize frontmatter obj + body back to .md text.
 */
function stringifyFrontmatter(obj, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (Array.isArray(v)) {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    } else {
      // Quote values that contain colons to avoid parse ambiguity
      const s = String(v);
      const needsQuotes = s.includes(':') || s.startsWith('"') || s.startsWith("'");
      lines.push(`${k}: ${needsQuotes ? `"${s.replace(/"/g, '\\"')}"` : s}`);
    }
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n') + (body || '');
}

// ─── Resolve design-decisions directory ──────────────────────────────────────

/**
 * Return the absolute path to .planning/design-decisions/ for a given
 * planning root directory.  Does NOT create the directory.
 */
function designDecisionsDir(planningDir) {
  return path.join(planningDir, DD_DIR);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Read all design-decision entries from a planning directory.
 * Returns DesignDecision[] sorted by id.
 *
 * @param {string} planningDir  — absolute path to .planning/
 * @param {{ id?: string, status?: string }} [filter]
 * @returns {DesignDecision[]}
 */
function readDesignDecisions(planningDir, filter = {}) {
  const dir = designDecisionsDir(planningDir);
  if (!fs.existsSync(dir)) return [];

  let files;
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  } catch (_) {
    return [];
  }

  const results = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    let text;
    try { text = fs.readFileSync(filePath, 'utf8'); } catch (_) { continue; }

    const { frontmatter, body } = parseFrontmatter(text);
    if (!frontmatter.id) continue;

    if (filter.id && frontmatter.id !== filter.id) continue;
    if (filter.status && frontmatter.status !== filter.status) continue;

    results.push({
      id:              String(frontmatter.id || ''),
      title:           String(frontmatter.title || ''),
      problem:         String(frontmatter.problem || ''),
      reasoning:       String(frontmatter.reasoning || ''),
      fix:             String(frontmatter.fix || ''),
      principle:       String(frontmatter.principle || ''),
      refs:            Array.isArray(frontmatter.refs) ? frontmatter.refs : [],
      status:          String(frontmatter.status || 'live'),
      supersedes:      frontmatter.supersedes ? String(frontmatter.supersedes) : undefined,
      superseded_by:   frontmatter.superseded_by ? String(frontmatter.superseded_by) : undefined,
      supersede_reason: frontmatter.supersede_reason ? String(frontmatter.supersede_reason) : undefined,
      archive_reason:  frontmatter.archive_reason ? String(frontmatter.archive_reason) : undefined,
      created_at:      String(frontmatter.created_at || ''),
      body:            body.trim(),
      _file:           filePath,
    });
  }

  results.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return results;
}

/**
 * Read a single design-decision entry by id.
 * Returns null if not found.
 */
function readDesignDecision(planningDir, id) {
  const all = readDesignDecisions(planningDir, { id });
  return all[0] || null;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Write a new design-decision entry.
 * @param {string} planningDir
 * @param {object} entry — must include id, title, problem, reasoning, fix, principle
 */
function writeDesignDecision(planningDir, entry) {
  const dir = designDecisionsDir(planningDir);
  fs.mkdirSync(dir, { recursive: true });

  const id = String(entry.id || '').trim();
  if (!id) throw new Error('writeDesignDecision: entry.id is required');

  // Sanitize id for filename: only alphanumerics and hyphens
  const safePart = id.replace(/[^a-zA-Z0-9-]/g, '-');
  // Build slug from title for readability
  const titleSlug = String(entry.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  const filename = titleSlug ? `${safePart}-${titleSlug}.md` : `${safePart}.md`;
  const filePath = path.join(dir, filename);

  const frontmatter = {
    id,
    title:     entry.title     || '',
    problem:   entry.problem   || '',
    reasoning: entry.reasoning || '',
    fix:       entry.fix       || '',
    principle: entry.principle || '',
    refs:      Array.isArray(entry.refs) ? entry.refs : [],
    status:    entry.status    || 'live',
    created_at: entry.created_at || new Date().toISOString(),
  };
  if (entry.supersedes)      frontmatter.supersedes       = entry.supersedes;
  if (entry.superseded_by)   frontmatter.superseded_by    = entry.superseded_by;
  if (entry.supersede_reason) frontmatter.supersede_reason = entry.supersede_reason;
  if (entry.archive_reason)  frontmatter.archive_reason   = entry.archive_reason;

  const body = entry.body ? `\n${entry.body}` : '';
  const content = stringifyFrontmatter(frontmatter, body);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Update an existing design-decision entry by id.
 * Patches only the provided fields; preserves body.
 * @param {string} planningDir
 * @param {string} id
 * @param {object} patch
 */
function updateDesignDecision(planningDir, id, patch) {
  const existing = readDesignDecision(planningDir, id);
  if (!existing) throw new Error(`updateDesignDecision: no entry with id="${id}"`);

  const filePath = existing._file;
  const text = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(text);

  const updated = { ...frontmatter, ...patch };
  const content = stringifyFrontmatter(updated, body);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

/**
 * Mark an entry as superseded.
 * @param {string} planningDir
 * @param {string} oldId       — the entry being superseded
 * @param {string} newId       — the entry that supersedes it
 * @param {string} reason
 */
function supersede(planningDir, oldId, newId, reason) {
  return updateDesignDecision(planningDir, oldId, {
    status:          'superseded',
    superseded_by:   newId,
    supersede_reason: reason || '',
  });
}

/**
 * Mark an entry as archived.
 */
function archive(planningDir, id, reason) {
  return updateDesignDecision(planningDir, id, {
    status:         'archived',
    archive_reason: reason || '',
  });
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  readDesignDecisions,
  readDesignDecision,
  writeDesignDecision,
  updateDesignDecision,
  supersede,
  archive,
  designDecisionsDir,
  parseFrontmatter,
  stringifyFrontmatter,
};
