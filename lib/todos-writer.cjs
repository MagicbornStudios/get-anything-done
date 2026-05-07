'use strict';
/**
 * todos-writer.cjs — create / list parked-todo markdown files in .planning/todos/.
 *
 * Filename format: YYYY-MM-DD-<slug>.md
 * Body format: YAML frontmatter + H1 title + source section + body.
 *
 * Frontmatter fields:
 *   owner: "operator" | "agent" | "any"  (default: "any")
 *   snoozed_until: ISO string | null
 *   done: boolean (default: false)
 *
 * Refuses to overwrite an existing file with the same date+slug.
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ slug: string, title: string, body: string, source?: string, date?: string, owner?: string }} NewTodo
 * @typedef {{ filename: string, slug: string, path: string, date: string, owner: string, snoozed_until: string|null, done: boolean, title: string, body: string }} Todo
 */

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
 * Parse YAML-like frontmatter from a markdown file.
 * Supports only simple key: value pairs (strings, booleans, null).
 * Returns { frontmatter, bodyText }.
 */
function parseFrontmatter(content) {
  const frontmatter = {};
  let bodyText = content;

  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return { frontmatter, bodyText };
  }

  const end = content.indexOf('\n---', 4);
  if (end === -1) return { frontmatter, bodyText };

  const fmBlock = content.slice(4, end);
  bodyText = content.slice(end + 4).replace(/^\r?\n/, '');

  for (const line of fmBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const raw = line.slice(colonIdx + 1).trim();
    if (raw === 'null' || raw === '') {
      frontmatter[key] = null;
    } else if (raw === 'true') {
      frontmatter[key] = true;
    } else if (raw === 'false') {
      frontmatter[key] = false;
    } else {
      // Strip surrounding quotes if present
      frontmatter[key] = raw.replace(/^["']|["']$/g, '');
    }
  }

  return { frontmatter, bodyText };
}

/**
 * Serialize a frontmatter object to YAML block.
 */
function serializeFrontmatter(fm) {
  const lines = [];
  for (const [k, v] of Object.entries(fm)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else {
      lines.push(`${k}: ${v}`);
    }
  }
  return `---\n${lines.join('\n')}\n---\n`;
}

/**
 * Extract H1 title from body text.
 */
function extractTitle(bodyText) {
  const m = bodyText.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/**
 * Read and parse a single todo file.
 *
 * @param {string} filePath
 * @param {string} filename
 * @returns {Todo}
 */
function readTodoFile(filePath, filename) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, bodyText } = parseFrontmatter(raw);

  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  return {
    filename,
    date: m ? m[1] : '',
    slug: m ? m[2] : filename.replace(/\.md$/, ''),
    path: filePath,
    owner: typeof frontmatter.owner === 'string' ? frontmatter.owner : 'any',
    snoozed_until: typeof frontmatter.snoozed_until === 'string' ? frontmatter.snoozed_until : null,
    done: frontmatter.done === true,
    title: extractTitle(bodyText),
    body: bodyText,
  };
}

/**
 * List todos for a root. Returns parsed Todo entries (excludes done/ subdir).
 *
 * @param {{ path: string, planningDir: string }} root
 * @param {string} baseDir
 * @returns {Todo[]}
 */
function listTodos(root, baseDir) {
  const dir = path.join(baseDir, root.path, root.planningDir, 'todos');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(f => readTodoFile(path.join(dir, f), f));
}

/**
 * Rewrite a todo file's frontmatter while preserving the body.
 *
 * @param {string} filePath
 * @param {Record<string, unknown>} patch  — merged into existing frontmatter
 */
function patchTodoFrontmatter(filePath, patch) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, bodyText } = parseFrontmatter(raw);
  const updated = Object.assign({}, frontmatter, patch);
  fs.writeFileSync(filePath, serializeFrontmatter(updated) + bodyText);
}

/**
 * Resolve a todo file path from a slug (searches by slug suffix in filename).
 *
 * @param {string} dir  — the todos directory
 * @param {string} slug
 * @returns {string|null}
 */
function resolveTodoPath(dir, slug) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const target = files.find(f => {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    return m && m[2] === slug;
  });
  return target ? path.join(dir, target) : null;
}

/**
 * Write a new todo file.
 *
 * @param {{ path: string, planningDir: string }} root
 * @param {string} baseDir
 * @param {NewTodo} t
 * @returns {{ filePath: string, filename: string }}
 */
function writeTodo(root, baseDir, t) {
  if (!t || !t.slug) throw new Error('todo slug is required');
  if (!t.title) throw new Error('todo title is required');
  if (!t.body) throw new Error('todo body is required');

  const slug = sanitizeSlug(t.slug);
  const date = t.date || todayIso();
  const filename = `${date}-${slug}.md`;
  const dir = path.join(baseDir, root.path, root.planningDir, 'todos');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) {
    throw new Error(`todo already exists: ${filename}`);
  }

  const owner = t.owner || 'any';
  const fm = serializeFrontmatter({ owner, snoozed_until: null });
  const sourceLine = t.source ? `**Source:** ${t.source}\n\n` : '';
  const content = `${fm}# ${t.title}\n\n${sourceLine}${t.body.trim()}\n`;
  fs.writeFileSync(filePath, content);

  return { filePath, filename };
}

module.exports = {
  writeTodo,
  listTodos,
  sanitizeSlug,
  readTodoFile,
  patchTodoFrontmatter,
  resolveTodoPath,
  serializeFrontmatter,
  parseFrontmatter,
};
