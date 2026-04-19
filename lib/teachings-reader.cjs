'use strict';
/**
 * teachings-reader.cjs — read-only access to the teachings/ directory.
 *
 * Surfaces daily tips from `vendor/get-anything-done/teachings/` without
 * invoking any paid model. Consumers: `gad tip` CLI, snapshot footer,
 * future site data pipeline.
 *
 * Contract: deterministic in, deterministic out. No network. No LLM.
 */

const fs = require('fs');
const path = require('path');

const BUNDLED_GAD_DIR = path.resolve(__dirname, '..');
const BUNDLED_TEACHINGS_DIR = path.join(BUNDLED_GAD_DIR, 'teachings');

/**
 * Resolve the teachings/ directory to operate on.
 *
 * Preference order (first hit wins):
 *   1. $GAD_TEACHINGS_DIR env override (testing / explicit control).
 *   2. Walking up from cwd, looking for a teachings/ dir directly on a
 *      gad-config.toml / .planning/config.json repo root, OR a
 *      vendor/get-anything-done/teachings/ sibling on such a root.
 *   3. The bundled runtime's teachings/ (if present).
 *
 * Rationale: when the installed `gad` binary runs from a user repo, it
 * should read+write the user's teachings tree, not its own read-only
 * runtime bundle. The bundled location still works for source checkouts
 * (__dirname lands next to teachings/ inside vendor/get-anything-done/).
 */
function resolveTeachingsDir() {
  const envOverride = process.env.GAD_TEACHINGS_DIR;
  if (envOverride && fs.existsSync(envOverride)) return envOverride;

  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const hasConfig =
      fs.existsSync(path.join(dir, 'gad-config.toml')) ||
      fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
      fs.existsSync(path.join(dir, 'planning-config.toml'));
    if (hasConfig) {
      const vendorTeachings = path.join(dir, 'vendor', 'get-anything-done', 'teachings');
      if (fs.existsSync(vendorTeachings)) return vendorTeachings;
      const directTeachings = path.join(dir, 'teachings');
      if (fs.existsSync(directTeachings)) return directTeachings;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  if (fs.existsSync(BUNDLED_TEACHINGS_DIR)) return BUNDLED_TEACHINGS_DIR;

  return BUNDLED_TEACHINGS_DIR;
}

const TEACHINGS_DIR = resolveTeachingsDir();
const INDEX_PATH = path.join(TEACHINGS_DIR, 'index.json');

/**
 * @typedef {{
 *   id: string,
 *   title: string,
 *   category: string,
 *   difficulty: 'intro'|'intermediate'|'advanced',
 *   tags: string[],
 *   source: 'static'|'generated',
 *   date: string,
 *   path: string
 * }} TipMeta
 */

function readIndex() {
  if (!fs.existsSync(INDEX_PATH)) return { schemaVersion: 1, tips: [] };
  try {
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch (e) {
    return { schemaVersion: 1, tips: [], _readError: e.message };
  }
}

/** All tips. */
function listAll() {
  return readIndex().tips || [];
}

/** Categories ordered by tip count descending. */
function listCategories() {
  const counts = new Map();
  for (const t of listAll()) {
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));
}

/**
 * Pick today's tip deterministically from date.
 * Prefers a generated tip dated today; falls back to deterministic rotation
 * through the static set using a date hash as the seed.
 *
 * opts.categories (optional): string[] — restrict rotation pool to these
 * category slugs. If provided and non-empty, any tip whose category is not
 * in the list is ignored. No-op if null/empty.
 */
function pickToday(date, opts) {
  const d = date || isoDate();
  const tips = listAll();
  if (tips.length === 0) return null;

  const categories =
    opts && Array.isArray(opts.categories) && opts.categories.length > 0
      ? opts.categories
      : null;
  const inScope = t => !categories || categories.includes(t.category);

  // 1. Exact date match on any generated tip (still honors category scope)
  const todayGenerated = tips.find(t => t.source === 'generated' && t.date === d && inScope(t));
  if (todayGenerated) return todayGenerated;

  // 2. Deterministic rotation through in-scope static set
  const staticTips = tips.filter(t => t.source === 'static' && inScope(t));
  if (staticTips.length === 0) {
    // Fall back to full static set so the user sees SOMETHING rather than
    // silent empty output when their filter excludes every tip.
    const allStatic = tips.filter(t => t.source === 'static');
    if (allStatic.length === 0) return tips[0];
    const seed = dateSeed(d);
    return allStatic[seed % allStatic.length];
  }
  const seed = dateSeed(d);
  const idx = seed % staticTips.length;
  return staticTips[idx];
}

/** Random tip. opts.categories optional — same semantics as pickToday. */
function pickRandom(opts) {
  const tips = listAll();
  if (tips.length === 0) return null;
  const categories =
    opts && Array.isArray(opts.categories) && opts.categories.length > 0
      ? opts.categories
      : null;
  const pool = categories ? tips.filter(t => categories.includes(t.category)) : tips;
  if (pool.length === 0) return tips[Math.floor(Math.random() * tips.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Substring search on title + tags + category. Case-insensitive. */
function search(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return listAll().filter(t =>
    (t.title || '').toLowerCase().includes(q) ||
    (t.category || '').toLowerCase().includes(q) ||
    (t.tags || []).some(tag => String(tag).toLowerCase().includes(q))
  );
}

/** Filter by category. */
function filterByCategory(category) {
  return listAll().filter(t => t.category === category);
}

/** Read full markdown body by tip meta (without frontmatter stripping). */
function readBody(meta) {
  if (!meta || !meta.path) return '';
  const abs = path.join(TEACHINGS_DIR, meta.path);
  if (!fs.existsSync(abs)) return '';
  return fs.readFileSync(abs, 'utf8');
}

/** Strip the YAML frontmatter from a markdown body. */
function stripFrontmatter(body) {
  const m = String(body || '').match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return m ? m[1].trimStart() : body;
}

/** Reindex: scan teachings/{static,generated} and rewrite index.json. */
function reindex() {
  const tips = [];
  scanDir(path.join(TEACHINGS_DIR, 'static'), 'static', tips);
  scanDir(path.join(TEACHINGS_DIR, 'generated'), 'generated', tips);
  const index = { schemaVersion: 2, tips };
  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2) + '\n');
  return tips.length;
}

function scanDir(dir, source, out) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scanDir(full, source, out);
    else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md') {
      const rel = path.relative(TEACHINGS_DIR, full).replace(/\\/g, '/');
      const body = fs.readFileSync(full, 'utf8');
      const fm = parseFrontmatter(body);
      if (!fm) continue;
      out.push({
        id: fm.id || '',
        title: fm.title || '',
        category: fm.category || 'uncategorized',
        difficulty: fm.difficulty || 'intro',
        tags: Array.isArray(fm.tags) ? fm.tags : parseList(fm.tags),
        source,
        date: fm.date || '',
        path: rel,
        implementation: Array.isArray(fm.implementation) ? fm.implementation : parseList(fm.implementation),
        decisions: Array.isArray(fm.decisions) ? fm.decisions : parseList(fm.decisions),
        phases: Array.isArray(fm.phases) ? fm.phases : parseList(fm.phases),
        related: Array.isArray(fm.related) ? fm.related : parseList(fm.related),
      });
    }
  }
}

function parseFrontmatter(body) {
  const m = body.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      out[key] = val.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
    } else {
      out[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

function parseList(s) {
  if (!s) return [];
  if (Array.isArray(s)) return s;
  return String(s).split(',').map(x => x.trim()).filter(Boolean);
}

function isoDate(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateSeed(dateStr) {
  let h = 0;
  for (const c of String(dateStr)) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

module.exports = {
  TEACHINGS_DIR,
  listAll,
  listCategories,
  pickToday,
  pickRandom,
  search,
  filterByCategory,
  readBody,
  stripFrontmatter,
  reindex,
  isoDate,
};
