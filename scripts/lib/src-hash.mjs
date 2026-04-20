/**
 * src-hash.mjs — shared helper that computes the deterministic src_hash for
 * the GAD working tree.
 *
 * Imported by both scripts/build-stamp.mjs (build time) and
 * scripts/check-staleness.mjs (pre-commit hook).  Both must produce
 * byte-identical hashes for the same working tree state.
 *
 * Hash inputs: sorted {path, content} triples for bin/, lib/, scripts/,
 * package.json — skipping .generated / _manifest / node_modules / dist /
 * .git / tmp / .gad-try entries.  16-char SHA-256 prefix.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const HASH_TARGETS = ['bin', 'lib', 'scripts', 'package.json'];
const HASH_SKIP = new Set(['node_modules', 'dist', '.git', 'tmp', '.gad-try']);
const HASH_SKIP_FILE_PATTERNS = [/\.generated\.(js|cjs|mjs|ts)$/, /\._manifest\.cjs$/, /^_manifest\.cjs$/];

function shouldSkipFile(name) {
  return HASH_SKIP_FILE_PATTERNS.some((re) => re.test(name));
}

function walkFiles(target, absBase, out) {
  let stat;
  try { stat = statSync(absBase); } catch { return; }
  if (stat.isFile()) {
    if (shouldSkipFile(target.split(/[\\/]/).pop() || '')) return;
    out.push(target);
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(absBase)) {
    if (HASH_SKIP.has(entry)) continue;
    if (entry.startsWith('.')) continue;
    walkFiles(`${target}/${entry}`, join(absBase, entry), out);
  }
}

/**
 * Compute the deterministic src_hash for the given repo root.
 * @param {string} rootDir  Absolute path to the get-anything-done repo root.
 * @returns {string}        16-character lowercase hex SHA-256 prefix.
 */
export function computeSrcHash(rootDir) {
  const paths = [];
  for (const target of HASH_TARGETS) {
    walkFiles(target, join(rootDir, target), paths);
  }
  paths.sort();
  const hash = createHash('sha256');
  for (const rel of paths) {
    const content = readFileSync(join(rootDir, rel));
    hash.update(rel);
    hash.update('\0');
    hash.update(content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}
