#!/usr/bin/env node
/**
 * install-hooks.mjs — copy scripts/hooks/* into .git/hooks/ and make them
 * executable.  Run automatically via the "prepare" npm script so any
 * developer who runs `npm install` gets the hooks wired up.
 *
 * Idempotent: running twice with unchanged hook source is a no-op (same
 * content, same permissions).
 *
 * Supports submodule layouts: walks up from __dirname to find the .git dir
 * (which may be a gitlink file pointing to the real hooks directory).
 */

import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const HOOKS_SRC = join(__dirname, 'hooks');

/**
 * Resolve the real .git/hooks directory, following gitlink files used in
 * submodules (e.g. ".git" = "gitdir: ../../.git/modules/vendor/...").
 */
function resolveGitHooksDir(startDir) {
  let dir = resolve(startDir);
  for (let i = 0; i < 20; i++) {
    const gitPath = join(dir, '.git');
    try {
      const stat = statSync(gitPath);
      if (stat.isDirectory()) {
        return join(gitPath, 'hooks');
      }
      if (stat.isFile()) {
        // Submodule gitlink — read the pointer.
        const content = readFileSync(gitPath, 'utf8').trim();
        const match = content.match(/^gitdir:\s*(.+)$/);
        if (match) {
          const realGit = resolve(dir, match[1].trim());
          return join(realGit, 'hooks');
        }
      }
    } catch { /* no .git here, keep walking */ }
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

function main() {
  const hooksDir = resolveGitHooksDir(REPO_ROOT);
  if (!hooksDir) {
    console.warn('[install-hooks] Could not locate .git/hooks — skipping hook installation.');
    process.exit(0);
  }

  // Ensure hooks directory exists (it usually does, but just in case).
  mkdirSync(hooksDir, { recursive: true });

  const hookFiles = [
    { src: join(HOOKS_SRC, 'pre-commit.sh'), dest: join(hooksDir, 'pre-commit') },
  ];

  let installed = 0;
  for (const { src, dest } of hookFiles) {
    let srcContent;
    try {
      srcContent = readFileSync(src, 'utf8');
    } catch {
      console.warn(`[install-hooks] Source not found: ${src} — skipping.`);
      continue;
    }

    // Check if dest already has identical content (idempotent).
    let destContent = null;
    try { destContent = readFileSync(dest, 'utf8'); } catch { /* new file */ }

    if (destContent === srcContent) {
      console.log(`[install-hooks] ${dest.split(/[\\/]/).pop()} already up to date.`);
    } else {
      copyFileSync(src, dest);
      console.log(`[install-hooks] Installed ${dest.split(/[\\/]/).pop()} → ${dest}`);
      installed++;
    }

    // Make executable on POSIX (no-op on Windows but harmless).
    if (process.platform !== 'win32') {
      try {
        execFileSync('chmod', ['+x', dest], { stdio: 'ignore' });
      } catch { /* chmod unavailable */ }
    }
  }

  if (installed > 0) {
    console.log(`[install-hooks] ${installed} hook(s) installed.`);
  }
}

main();
