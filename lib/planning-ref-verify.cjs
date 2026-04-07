'use strict';

/**
 * Verify `<file path="…">` and `<reference>…</reference>` in planning XML against disk.
 * Paths like `src/…` resolve relative to the project root that owns the `.planning/` file.
 *
 * @module planning-ref-verify
 */

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.claude',
  '.tmp',
  '.cursor',
  '.vscode',
  'worktrees',
]);

/** @type {Set<string>} */
const KNOWN_ALLOWLIST = new Set([
  'vendor/get-anything-done/evals/portfolio-bare/template/',
  'vendor/image-gen-mcp',
]);

/**
 * @param {string} repoRoot
 * @param {string} xmlFileAbs
 * @param {string} raw
 */
function allowlistedMissing(repoRoot, xmlFileAbs, raw) {
  const relXml = path.relative(repoRoot, xmlFileAbs).replace(/\\/g, '/');
  if (
    relXml.startsWith('vendor/get-anything-done/') &&
    (raw === '.planning/planning-config.toml' || raw === '.planning/AGENTS.md')
  ) {
    return true;
  }
  return false;
}

/** @param {string} dirName */
function shouldSkipDir(dirName) {
  return SKIP_DIRS.has(dirName);
}

/**
 * @param {string} dir
 * @param {string[]} acc
 * @param {string} rel
 */
function walkXmlUnderPlanning(dir, acc, rel = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const r = rel ? `${rel}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldSkipDir(ent.name)) continue;
      walkXmlUnderPlanning(full, acc, r);
    } else if (ent.name.endsWith('.xml') && r.includes('.planning')) {
      if (r.includes(`${path.sep}templates${path.sep}`) || r.includes('/templates/')) {
        continue;
      }
      acc.push(full);
    }
  }
}

/** @param {string} repoRoot @param {string} xmlFileAbs */
function planningProjectRoot(repoRoot, xmlFileAbs) {
  const rel = path.relative(repoRoot, xmlFileAbs);
  const parts = rel.split(path.sep);
  const idx = parts.indexOf('.planning');
  if (idx <= 0) {
    return repoRoot;
  }
  return path.join(repoRoot, ...parts.slice(0, idx));
}

/** @param {string} p */
function isVerifiablePath(p) {
  if (!p || p.length < 2) return false;
  if (/[\s(]/.test(p)) return false;
  if (p.startsWith('http://') || p.startsWith('https://')) return false;
  if (p.includes('*')) return false;
  if (p.startsWith('.claude/')) return false;
  if (p === 'path/to/file' || p.startsWith('path/to/')) return false;
  if (p === 'packages/kaplay-demo/src/ui/organisms.ts') return false;
  return true;
}

/** @param {string} content */
function extractPathsFromXml(content) {
  const paths = new Set();
  const fileAttr = /<file\s+path="([^"]+)"/g;
  let m;
  while ((m = fileAttr.exec(content))) {
    paths.add(m[1].trim());
  }
  const refTag = /<reference>([^<]+)<\/reference>/g;
  while ((m = refTag.exec(content))) {
    paths.add(m[1].trim());
  }
  return [...paths];
}

/**
 * @param {string} repoRoot
 * @param {string} xmlFileAbs
 * @param {string} raw
 */
function resolveRefToAbsolute(repoRoot, xmlFileAbs, raw) {
  const rawPosix = raw.replace(/\\/g, '/');
  const projectRoot = planningProjectRoot(repoRoot, xmlFileAbs);

  if (rawPosix.startsWith('.planning/')) {
    return path.join(projectRoot, ...rawPosix.split('/'));
  }

  if (
    rawPosix.startsWith('apps/') ||
    rawPosix.startsWith('vendor/') ||
    rawPosix.startsWith('documentation/')
  ) {
    return path.join(repoRoot, ...rawPosix.split('/'));
  }

  if (rawPosix.startsWith('packages/')) {
    return path.join(repoRoot, ...rawPosix.split('/'));
  }

  if (
    rawPosix.startsWith('src/') ||
    rawPosix.startsWith('tests/') ||
    rawPosix.startsWith('scripts/') ||
    rawPosix.startsWith('.codex/') ||
    rawPosix.startsWith('next.config') ||
    rawPosix === 'playwright.config.ts' ||
    rawPosix.startsWith('playwright.')
  ) {
    return path.join(projectRoot, ...rawPosix.split('/'));
  }

  return path.join(repoRoot, ...rawPosix.split('/'));
}

/** @param {string} abs */
function pathExistsAbs(abs) {
  try {
    const st = fs.statSync(abs);
    const isDirHint = abs.endsWith(path.sep) || abs.endsWith('/');
    if (isDirHint) {
      return st.isDirectory();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, xmlFileCount: number, missing: Array<{ file: string, path: string }> }}
 */
function verifyPlanningXmlRefs(repoRoot) {
  const xmlFiles = [];
  walkXmlUnderPlanning(repoRoot, xmlFiles);

  /** @type {Array<{ file: string, path: string }>} */
  const missing = [];

  for (const xmlFile of xmlFiles) {
    const content = fs.readFileSync(xmlFile, 'utf8');
    const refs = extractPathsFromXml(content);
    for (const p of refs) {
      if (!isVerifiablePath(p)) continue;
      const posix = p.replace(/\\/g, '/');
      if (KNOWN_ALLOWLIST.has(posix)) continue;
      if (allowlistedMissing(repoRoot, xmlFile, p)) continue;

      const abs = resolveRefToAbsolute(repoRoot, xmlFile, p);
      if (!pathExistsAbs(abs)) {
        missing.push({
          file: path.relative(repoRoot, xmlFile),
          path: p,
        });
      }
    }
  }

  return {
    ok: missing.length === 0,
    xmlFileCount: xmlFiles.length,
    missing,
  };
}

/**
 * Collect all planning XML paths (same walk as verify).
 * @param {string} repoRoot
 * @returns {string[]}
 */
function listPlanningXmlFiles(repoRoot) {
  const xmlFiles = [];
  walkXmlUnderPlanning(repoRoot, xmlFiles);
  return xmlFiles;
}

/**
 * Replace `from` with `to` in path-like attributes and reference text (string replace, not regex).
 * @param {string} repoRoot
 * @param {string} fromPosix
 * @param {string} toPosix
 * @param {{ dryRun: boolean }}
 * @returns {{ changedFiles: string[], replacements: number }}
 */
function migratePathStringsInPlanningXml(repoRoot, fromPosix, toPosix, { dryRun }) {
  if (!fromPosix || fromPosix === toPosix) {
    return { changedFiles: [], replacements: 0 };
  }
  const xmlFiles = listPlanningXmlFiles(repoRoot);
  const changedFiles = [];
  let replacements = 0;

  for (const abs of xmlFiles) {
    let content = fs.readFileSync(abs, 'utf8');
    const before = content;
    // Order: longer matches first if we ever add overlapping rules
    content = content.split(fromPosix).join(toPosix);
    if (content !== before) {
      const n = (before.split(fromPosix).length - 1);
      replacements += n;
      changedFiles.push(path.relative(repoRoot, abs));
      if (!dryRun) {
        fs.writeFileSync(abs, content, 'utf8');
      }
    }
  }

  return { changedFiles, replacements };
}

module.exports = {
  verifyPlanningXmlRefs,
  listPlanningXmlFiles,
  migratePathStringsInPlanningXml,
  extractPathsFromXml,
  resolveRefToAbsolute,
  planningProjectRoot,
};
