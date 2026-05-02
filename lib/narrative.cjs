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

const gadConfig = require("../bin/gad-config.cjs");

function monorepoRoot(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    if (gadConfig.resolveTomlPath(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readRawConfig(repoRoot) {
  const cfgPath = gadConfig.resolveTomlPath(repoRoot);
  if (!cfgPath) return null;
  const raw = fs.readFileSync(cfgPath, "utf8");
  return { path: cfgPath, raw, parsed: gadConfig.parseToml(raw) };
}

function readPlanningRoots(repoRoot) {
  return gadConfig.load(repoRoot).roots || [];
}

function readNarrativeRoots(repoRoot) {
  const config = readRawConfig(repoRoot);
  const entries = (((config || {}).parsed || {}).narrative || {}).roots || [];
  return Array.isArray(entries) ? entries.filter((entry) => entry && entry.enabled !== false) : [];
}

function collectNarrativeEntries(repoRoot) {
  const explicit = [];
  const seenNarrativeDirs = new Set();

  for (const root of readNarrativeRoots(repoRoot)) {
    const rootPath = root.path || ".";
    const narrativeSubdir = root.narrativeDir || root.narrative_dir || "narrative";
    const projectRoot = path.resolve(repoRoot, rootPath);
    const narrativeDir = path.resolve(projectRoot, narrativeSubdir);
    explicit.push({
      projectId: root.id || root.projectId || root.project || path.basename(projectRoot),
      projectRoot,
      narrativeDir,
    });
    seenNarrativeDirs.add(path.resolve(narrativeDir));
  }

  const fallback = [];
  for (const root of readPlanningRoots(repoRoot)) {
    const projectRoot = path.resolve(repoRoot, root.path || ".");
    const narrativeDir = path.join(projectRoot, "narrative");
    if (seenNarrativeDirs.has(path.resolve(narrativeDir))) continue;
    fallback.push({
      projectId: root.id,
      projectRoot,
      narrativeDir,
    });
  }

  return explicit.concat(fallback);
}

function resolveProjectRoot(repoRoot, projectId) {
  const match = collectNarrativeEntries(repoRoot).find((entry) => entry.projectId === projectId);
  return match ? match.projectRoot : null;
}

function resolveNarrativeDir(repoRoot, projectId) {
  const match = collectNarrativeEntries(repoRoot).find((entry) => entry.projectId === projectId);
  return match ? match.narrativeDir : null;
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
  const out = [];
  for (const entry of collectNarrativeEntries(repoRoot)) {
    const narrativeDir = entry.narrativeDir;
    if (!fs.existsSync(narrativeDir)) continue;
    const cfg = readNarrativeToml(narrativeDir) || { activeSoul: null, books: [] };
    out.push({
      projectId: entry.projectId,
      narrativeDir,
      activeSoul: cfg.activeSoul,
      bookCount: cfg.books.length,
    });
  }
  return out;
}

function enterNarrative(repoRoot, projectId) {
  const projectRoot = resolveProjectRoot(repoRoot, projectId);
  const narrativeDir = resolveNarrativeDir(repoRoot, projectId);
  if (!projectRoot || !narrativeDir) {
    return { ok: false, reason: `project "${projectId}" not registered in narrative or planning roots` };
  }
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
  collectNarrativeEntries,
  monorepoRoot,
  listNarratives,
  enterNarrative,
  readNarrativeToml,
  resolveProjectRoot,
};
