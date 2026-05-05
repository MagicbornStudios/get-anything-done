'use strict';
/**
 * lib/skills/resolver-index.cjs — phase 136. Build a Map<pattern, slug[]>
 * from installed skills' SKILL.md frontmatter `solves_pressure_source`.
 *
 * Read-only scan. Skills with no field contribute nothing (zero behaviour
 * change for the existing skill catalog). Operator opts in per-skill by
 * adding the frontmatter field.
 *
 * Sources scanned (in order — earlier roots win on slug collision):
 *   1. <repoRoot>/vendor/get-anything-done/skills/<slug>/SKILL.md
 *      (framework-wide skills — apply to every project)
 *   2. <projectRoot>/.claude/skills/<slug>/SKILL.md
 *      (project-local — only apply to that project)
 *
 * Returned map uses lowercase trimmed pattern strings as keys. Values are
 * arrays of skill slugs that declared the pattern (so caller can compute
 * resolverCount per signal).
 */

const fs = require('fs');
const path = require('path');

function parseFrontmatter(raw) {
  const match = String(raw || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      fm[key] = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else if (val) {
      fm[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return fm;
}

function extractPatterns(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  return String(value).split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
}

function scanRoot(rootDir, map) {
  if (!rootDir || !fs.existsSync(rootDir)) return;
  let entries;
  try { entries = fs.readdirSync(rootDir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(rootDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    let raw;
    try { raw = fs.readFileSync(skillFile, 'utf8'); } catch { continue; }
    const fm = parseFrontmatter(raw);
    const patterns = extractPatterns(fm.solves_pressure_source);
    for (const pat of patterns) {
      if (!map.has(pat)) map.set(pat, []);
      const slugs = map.get(pat);
      if (!slugs.includes(entry.name)) slugs.push(entry.name);
    }
  }
}

/**
 * Build the resolver index.
 * @param {object} opts
 * @param {string} [opts.repoRoot] — monorepo root containing vendor/.
 * @param {string} [opts.projectRoot] — per-project root (for .claude/skills).
 * @returns {Map<string, string[]>}
 */
function buildResolverIndex(opts = {}) {
  const map = new Map();
  if (opts.repoRoot) {
    scanRoot(path.join(opts.repoRoot, 'vendor', 'get-anything-done', 'skills'), map);
  }
  if (opts.projectRoot) {
    scanRoot(path.join(opts.projectRoot, '.claude', 'skills'), map);
  }
  return map;
}

/**
 * For a given signal signature, count how many resolver patterns match
 * (substring match on either direction so `phase-115-repeated-work`
 * matches both an exact `phase-115-repeated-work` declaration and a
 * broader `repeated-work` declaration). Returns slug list for diagnostics.
 */
function resolversFor(index, signature) {
  if (!index || !signature) return [];
  const sig = String(signature).toLowerCase();
  const slugs = new Set();
  for (const [pat, list] of index) {
    if (sig === pat || sig.includes(pat) || pat.includes(sig)) {
      for (const slug of list) slugs.add(slug);
    }
  }
  return [...slugs];
}

module.exports = { buildResolverIndex, resolversFor, parseFrontmatter, extractPatterns };
