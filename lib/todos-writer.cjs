'use strict';
/**
 * todos-writer.cjs — create a new parked-todo markdown file in .planning/todos/.
 *
 * Filename format: YYYY-MM-DD-<slug>.md
 * Body format: frontmatter-less markdown with H1 title + source section + body.
 *
 * Refuses to overwrite an existing file with the same date+slug.
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {{ slug: string, title: string, body: string, source?: string, date?: string }} NewTodo
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
 * List todos for a root. Returns {filename, slug, path} entries.
 *
 * @param {{ path: string, planningDir: string }} root
 * @param {string} baseDir
 * @returns {Array<{ filename: string, slug: string, path: string, date: string }>}
 */
function listTodos(root, baseDir) {
  const dir = path.join(baseDir, root.path, root.planningDir, 'todos');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(f => {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    return {
      filename: f,
      date: m ? m[1] : '',
      slug: m ? m[2] : f.replace(/\.md$/, ''),
      path: path.join(dir, f),
    };
  });
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

  const sourceLine = t.source ? `**Source:** ${t.source}\n\n` : '';
  const content = `# ${t.title}\n\n${sourceLine}${t.body.trim()}\n`;
  fs.writeFileSync(filePath, content);

  return { filePath, filename };
}

module.exports = { writeTodo, listTodos, sanitizeSlug };
