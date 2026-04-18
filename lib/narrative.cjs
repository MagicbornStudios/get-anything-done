"use strict";

/**
 * gad narrative — entry into a GAD project's narrative folder.
 *
 * Narrative is an optional per-project tree containing books, in-world
 * documents, and souls (character personas). Not auto-read by coding
 * agents. Explicit entry via `gad narrative enter <projectid>` prints
 * the active soul and book table of contents.
 *
 * Layout (per GAD project):
 *   <project>/narrative/
 *     souls/<name>.md          — soul bodies
 *     books/                   — optional (may live adjacent if not migrated)
 *     in-world/                — optional
 *     narrative.toml           — activeSoul + sources + book order
 */

const fs = require("node:fs");
const path = require("node:path");

const { parsePlanningRoots } = require("./subagent-dispatch.cjs");

function monorepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, "gad-config.toml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readConfigRoots(repoRoot) {
  const cfgPath = path.join(repoRoot, "gad-config.toml");
  if (!fs.existsSync(cfgPath)) return [];
  return parsePlanningRoots(fs.readFileSync(cfgPath, "utf8"));
}

function resolveProjectRoot(repoRoot, projectId) {
  const roots = readConfigRoots(repoRoot);
  const match = roots.find((r) => r.id === projectId);
  if (!match) return null;
  return path.resolve(repoRoot, match.path);
}

function readNarrativeToml(narrativeDir) {
  const p = path.join(narrativeDir, "narrative.toml");
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, "utf8");
  const activeMatch = text.match(/^\s*activeSoul\s*=\s*"([^"]+)"/m);
  const activeSoul = activeMatch ? activeMatch[1] : null;

  const books = [];
  const bookBlockRe = /\[\[books\]\]([\s\S]*?)(?=\n\[|$)/g;
  let m;
  while ((m = bookBlockRe.exec(text)) !== null) {
    const body = m[1];
    const get = (k) => {
      const mm = body.match(new RegExp(`^\\s*${k}\\s*=\\s*"([^"]+)"`, "m"));
      return mm ? mm[1] : null;
    };
    const getNum = (k) => {
      const mm = body.match(new RegExp(`^\\s*${k}\\s*=\\s*(\\d+)`, "m"));
      return mm ? parseInt(mm[1], 10) : null;
    };
    const slug = get("slug");
    if (!slug) continue;
    books.push({
      slug,
      title: get("title") || slug,
      path: get("path") || `../books/${slug}`,
      order: getNum("order") ?? 999,
    });
  }
  books.sort((a, b) => a.order - b.order);

  return { activeSoul, books };
}

function listNarratives(repoRoot) {
  const roots = readConfigRoots(repoRoot);
  const out = [];
  for (const r of roots) {
    const narrativeDir = path.join(repoRoot, r.path, "narrative");
    if (!fs.existsSync(narrativeDir)) continue;
    const cfg = readNarrativeToml(narrativeDir) || { activeSoul: null, books: [] };
    out.push({
      projectId: r.id,
      narrativeDir,
      activeSoul: cfg.activeSoul,
      bookCount: cfg.books.length,
    });
  }
  return out;
}

function enterNarrative(repoRoot, projectId) {
  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  if (!projectRoot) {
    return { ok: false, reason: `project "${projectId}" not in gad-config.toml [[planning.roots]]` };
  }
  const narrativeDir = path.join(projectRoot, "narrative");
  if (!fs.existsSync(narrativeDir)) {
    return {
      ok: false,
      reason: `no narrative/ folder at ${path.relative(repoRoot, narrativeDir) || narrativeDir}`,
    };
  }
  const cfg = readNarrativeToml(narrativeDir);
  if (!cfg || !cfg.activeSoul) {
    return { ok: false, reason: `narrative.toml missing or has no activeSoul` };
  }

  const soulPath = path.join(narrativeDir, "souls", `${cfg.activeSoul}.md`);
  if (!fs.existsSync(soulPath)) {
    return { ok: false, reason: `active soul "${cfg.activeSoul}" not found at ${soulPath}` };
  }

  return {
    ok: true,
    projectId,
    narrativeDir,
    activeSoul: cfg.activeSoul,
    soulBody: fs.readFileSync(soulPath, "utf8"),
    books: cfg.books,
  };
}

module.exports = {
  monorepoRoot,
  listNarratives,
  enterNarrative,
  readNarrativeToml,
  resolveProjectRoot,
};
