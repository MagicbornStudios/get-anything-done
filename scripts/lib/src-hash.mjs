/**
 * src-hash.mjs — shared helper that computes the deterministic src_hash for
 * the GAD working tree.
 *
 * Imported by scripts/build-stamp.mjs at build time. Manual rebuild checks use
 * the same deterministic input set.
 *
 * Hash inputs: sorted {path, content} triples for bin/, lib/, scripts/,
 * package.json — skipping .generated / _manifest / node_modules / dist /
 * .git / tmp / .gad-try entries.  16-char SHA-256 prefix.
 *
 * Monorepo extension (task 66-07): when running from inside a monorepo that
 * has packages/gad-tui/package.json at <monoRoot>/packages/gad-tui/package.json
 * (monoRoot = two directories above rootDir), also hashes:
 *   packages/gad-tui/src/**\/*.{ts,tsx}
 *   packages/gad-tui/package.json
 * Guard: silently skipped if the path does not exist (vendor-only installs).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const HASH_TARGETS = ['bin', 'lib', 'scripts', 'package.json'];
const HASH_SKIP = new Set(['node_modules', 'dist', '.git', 'tmp', '.gad-try']);
const HASH_SKIP_FILE_PATTERNS = [/\.generated\.(js|cjs|mjs|ts)$/, /\._manifest\.cjs$/, /^_manifest\.cjs$/];

/** Extensions included when walking the gad-tui src tree. */
const TUI_SRC_EXTS = new Set(['.ts', '.tsx']);

function shouldSkipFile(name) {
  return HASH_SKIP_FILE_PATTERNS.some((re) => re.test(name));
}

function walkFiles(target, absBase, out, extFilter) {
  let stat;
  try { stat = statSync(absBase); } catch { return; }
  if (stat.isFile()) {
    if (shouldSkipFile(target.split(/[\\/]/).pop() || '')) return;
    if (extFilter) {
      const dot = target.lastIndexOf('.');
      if (dot === -1 || !extFilter.has(target.slice(dot))) return;
    }
    out.push(target);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(absBase)) {
    if (HASH_SKIP.has(entry)) continue;
    if (entry.startsWith('.')) continue;
    walkFiles(`${target}/${entry}`, join(absBase, entry), out, extFilter);
  }
}

/**
 * Compute the deterministic src_hash for the given repo root.
 * @param {string} rootDir  Absolute path to the get-anything-done repo root.
 * @returns {string}        16-character lowercase hex SHA-256 prefix.
 */
export function computeSrcHash(rootDir) {
  const paths = [];

  // Core GAD targets: bin/, lib/, scripts/, package.json.
  for (const target of HASH_TARGETS) {
    walkFiles(target, join(rootDir, target), paths, null);
  }

  // Monorepo extension: include gad-tui sources when present (task 66-07).
  // rootDir = vendor/get-anything-done → monoRoot = custom_portfolio/ (two up).
  const monoRoot = resolve(rootDir, '..', '..');
  const tuiPkgJson = join(monoRoot, 'packages', 'gad-tui', 'package.json');
  if (existsSync(tuiPkgJson)) {
    // Hash packages/gad-tui/package.json (stable relative key from monoRoot).
    const tuiPkgRel = 'packages/gad-tui/package.json';
    paths.push(`__mono__/${tuiPkgRel}`);

    // Hash packages/gad-tui/src/**/*.{ts,tsx}.
    const tuiSrcAbs = join(monoRoot, 'packages', 'gad-tui', 'src');
    const tuiSrcPaths = [];
    walkFiles('packages/gad-tui/src', tuiSrcAbs, tuiSrcPaths, TUI_SRC_EXTS);
    for (const p of tuiSrcPaths) {
      paths.push(`__mono__/${p}`);
    }
  }

  paths.sort();

  const hash = createHash('sha256');
  for (const rel of paths) {
    // Strip the __mono__ sentinel to get the real filesystem path.
    let absPath;
    if (rel.startsWith('__mono__/')) {
      absPath = join(monoRoot, rel.slice('__mono__/'.length));
    } else {
      absPath = join(rootDir, rel);
    }
    const content = readFileSync(absPath);
    hash.update(rel);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}
