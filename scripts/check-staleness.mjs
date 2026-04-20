#!/usr/bin/env node
/**
 * check-staleness.mjs — compare working-tree src_hash against the hash
 * embedded in the installed gad.exe.
 *
 * Exit codes:
 *   0  — src IS stale (installed hash ≠ working-tree hash) → rebuild needed
 *   1  — src is FRESH (hashes match) → skip rebuild
 *   2  — gad.exe not found or cannot parse version JSON → treat as stale
 *
 * Prints one human-readable line to stdout explaining the result.
 *
 * Used exclusively by scripts/hooks/pre-commit.sh.
 */

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeSrcHash } from './lib/src-hash.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Resolve the installed gad.exe path based on platform. */
function installedExePath() {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    if (!local) return null;
    return join(local, 'Programs', 'gad', 'bin', 'gad.exe');
  }
  // macOS / Linux: check common locations
  const candidates = [
    '/usr/local/bin/gad',
    join(process.env.HOME || '', '.local', 'bin', 'gad'),
  ];
  for (const p of candidates) {
    try {
      statSync(p);
      return p;
    } catch { /* continue */ }
  }
  return null;
}

/** Read the src_hash embedded in the installed exe via `gad version --json`. */
function installedSrcHash(exePath) {
  try {
    const out = execFileSync(exePath, ['version', '--json'], {
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString('utf8').trim();
    const stamp = JSON.parse(out);
    return stamp.src_hash || null;
  } catch {
    return null;
  }
}

function main() {
  const workingHash = computeSrcHash(ROOT);

  const exePath = installedExePath();
  if (!exePath) {
    console.log(`gad.exe not found — treating as stale (working-tree hash=${workingHash})`);
    process.exit(0);
  }

  const installedHash = installedSrcHash(exePath);
  if (!installedHash) {
    console.log(`cannot read src_hash from installed gad (${exePath}) — treating as stale (working-tree hash=${workingHash})`);
    process.exit(0); // treat as stale → trigger rebuild
  }

  if (workingHash !== installedHash) {
    console.log(`src_hash differs (installed=${installedHash}, working-tree=${workingHash}) — rebuild required`);
    process.exit(0); // stale
  }

  console.log(`src_hash matches installed gad (${installedHash}) — skipping rebuild`);
  process.exit(1); // fresh
}

try {
  main();
} catch (err) {
  console.error(`check-staleness error: ${err.message}`);
  process.exit(0); // fail open → treat as stale so hook triggers rebuild
}
