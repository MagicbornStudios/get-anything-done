'use strict';
/**
 * lib/cross-project-watcher.cjs — cross-project handoff notification watcher.
 *
 * Scans all planning roots listed in gad-config.toml for open handoffs whose
 * `to_agent` or `recipient` field matches an agent that is live in the
 * presence ledger. Maintains a seen-set at .planning/.cross-project-seen.json
 * to emit each new handoff only once.
 *
 * Primary export: tickOnce({ baseDir, config, fsImpl }) → { newHandoffs }
 *
 * newHandoffs item shape:
 *   {
 *     id:          string,
 *     from_project: string,
 *     recipient:   string,
 *     title:       string,      — first non-empty line of handoff body
 *     body_first:  string,      — same as title
 *     handoff_path: string,
 *     frontmatter: object,
 *   }
 *
 * GLOBAL-D-323 Phase D.
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultFs() {
  return {
    existsSync:    fs.existsSync.bind(fs),
    readdirSync:   fs.readdirSync.bind(fs),
    readFileSync:  (p) => fs.readFileSync(p, 'utf8'),
    writeFileSync: (p, d) => fs.writeFileSync(p, d, 'utf8'),
    mkdirSync:     (p, opts) => fs.mkdirSync(p, opts),
  };
}

/**
 * Parse simple key: value frontmatter from a handoff .md file.
 * Reuses the same format as lib/handoffs.cjs — minimal inline version
 * to keep this library zero-dep from the rest of the GAD codebase.
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
    const val = line.slice(colonIdx + 1).trim();
    if (val === 'null') { frontmatter[key] = null; continue; }
    if ((val.startsWith('[') && val.endsWith(']')) ||
        (val.startsWith('{') && val.endsWith('}'))) {
      try { frontmatter[key] = JSON.parse(val); continue; } catch {}
    }
    frontmatter[key] = val;
  }
  return { frontmatter, body };
}

function firstBodyLine(body) {
  for (const line of (body || '').split(/\r?\n/)) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Seen-set: .planning/.cross-project-seen.json
// { handoff_id: ISO-timestamp-first-seen }
// ---------------------------------------------------------------------------

function seenSetPath(baseDir) {
  return path.join(baseDir, '.planning', '.cross-project-seen.json');
}

function loadSeenSet(baseDir, fsi) {
  const p = seenSetPath(baseDir);
  if (!fsi.existsSync(p)) return {};
  try { return JSON.parse(fsi.readFileSync(p)); } catch { return {}; }
}

function saveSeenSet(baseDir, seen, fsi) {
  const p = seenSetPath(baseDir);
  try {
    fsi.mkdirSync(path.dirname(p), { recursive: true });
    fsi.writeFileSync(p, JSON.stringify(seen, null, 2));
  } catch (err) {
    process.stderr.write(`[cross-project-watcher] seen-set save failed: ${err.message}\n`);
  }
}

// ---------------------------------------------------------------------------
// Planning roots from config
// ---------------------------------------------------------------------------

/**
 * Resolve absolute paths for all planning roots.
 * Returns [{ id, absPath }].
 */
function resolvePlanningRoots(baseDir, config) {
  const roots = [];

  // Always include main root
  roots.push({ id: 'self', absPath: baseDir });

  if (!config || !Array.isArray(config.roots)) return roots;

  for (const root of config.roots) {
    if (!root || !root.path || !root.id) continue;
    const abs = path.isAbsolute(root.path)
      ? root.path
      : path.resolve(baseDir, root.path);
    // Skip duplicates
    if (roots.some((r) => r.absPath === abs)) continue;
    roots.push({ id: root.id, absPath: abs });
  }

  return roots;
}

// ---------------------------------------------------------------------------
// Load open handoffs from a planning root's open/ bucket
// ---------------------------------------------------------------------------

function loadOpenHandoffs(planningRoot, rootId, fsi) {
  const openDir = path.join(planningRoot, '.planning', 'handoffs', 'open');
  if (!fsi.existsSync(openDir)) return [];
  let files;
  try { files = fsi.readdirSync(openDir); } catch { return []; }

  const results = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const filePath = path.join(openDir, file);
    let text;
    try { text = fsi.readFileSync(filePath); } catch { continue; }
    const { frontmatter, body } = parseFrontmatter(text);
    const id = file.replace(/\.md$/, '');
    results.push({
      id,
      from_project: frontmatter.projectid || rootId,
      recipient:    frontmatter.to_agent || frontmatter.recipient || '',
      frontmatter,
      body,
      body_first:   firstBodyLine(body),
      handoff_path: filePath,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Presence: load live agents from main .planning/.presence/
// ---------------------------------------------------------------------------

const LIVE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

function loadLiveAgentSlugs(baseDir, fsi) {
  const presDir = path.join(baseDir, '.planning', '.presence');
  if (!fsi.existsSync(presDir)) return new Set();
  let files;
  try { files = fsi.readdirSync(presDir); } catch { return new Set(); }

  const now = Date.now();
  const live = new Set();
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    let record;
    try {
      record = JSON.parse(fsi.readFileSync(path.join(presDir, file)));
    } catch { continue; }
    if (!record) continue;
    const hb  = record.last_heartbeat ? new Date(record.last_heartbeat).getTime() : 0;
    const age = now - hb;
    if (age <= LIVE_THRESHOLD_MS) {
      live.add(record.agent_slug);
      // Also add projectid as an alias for recipient matching
      if (record.projectid) live.add(record.projectid);
    }
  }
  return live;
}

// ---------------------------------------------------------------------------
// tickOnce — pure function, injectable fs
// ---------------------------------------------------------------------------

/**
 * Run one watcher tick. Returns new handoffs found this tick.
 *
 * @param {object} opts
 * @param {string}  opts.baseDir   — repo root with .planning/
 * @param {object} [opts.config]   — parsed gad-config (for planning roots)
 * @param {object} [opts.fsImpl]   — injectable fs (for tests)
 * @param {boolean}[opts.matchAll] — if true, treat all open handoffs as
 *                                    matching (ignore presence filter);
 *                                    useful for `gad cross-project list`
 * @returns {{ newHandoffs: Array, seenCount: number }}
 */
function tickOnce({ baseDir, config, fsImpl, matchAll = false } = {}) {
  const fsi    = fsImpl || defaultFs();
  const seen   = loadSeenSet(baseDir, fsi);
  const liveAgents = matchAll ? null : loadLiveAgentSlugs(baseDir, fsi);
  const roots  = resolvePlanningRoots(baseDir, config);

  const newHandoffs = [];

  for (const { id: rootId, absPath } of roots) {
    const handoffs = loadOpenHandoffs(absPath, rootId, fsi);
    for (const h of handoffs) {
      if (seen[h.id]) continue; // already notified

      // Recipient check: if matchAll skip filter; else must match a live agent
      if (!matchAll) {
        const recipient = (h.recipient || '').toLowerCase();
        if (!recipient) continue; // no explicit recipient — skip

        // Check if recipient matches any live agent slug or projectid
        let matched = false;
        for (const slug of liveAgents) {
          if (recipient.includes(slug.toLowerCase()) ||
              slug.toLowerCase().includes(recipient)) {
            matched = true;
            break;
          }
        }
        if (!matched) continue;
      }

      newHandoffs.push(h);
    }
  }

  // Update seen-set
  if (newHandoffs.length > 0) {
    const now = new Date().toISOString();
    for (const h of newHandoffs) {
      seen[h.id] = now;
    }
    saveSeenSet(baseDir, seen, fsi);
  }

  return { newHandoffs, seenCount: Object.keys(seen).length };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  tickOnce,
  seenSetPath,
  loadSeenSet,
  saveSeenSet,
  parseFrontmatter,
  firstBodyLine,
  resolvePlanningRoots,
  loadOpenHandoffs,
  loadLiveAgentSlugs,
};
