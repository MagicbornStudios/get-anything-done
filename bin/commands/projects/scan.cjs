'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { defineCommand } = require('citty');

/**
 * Resolve the `--path` argument to an absolute directory path.
 * Supports ~ (home dir expansion) and relative paths anchored to cwd.
 */
function resolveScanRoot(input) {
  if (!input) return path.join(os.homedir(), 'Documents');
  if (input.startsWith('~')) {
    return path.join(os.homedir(), input.slice(1).replace(/^[/\\]/, ''));
  }
  if (path.isAbsolute(input)) return path.normalize(input);
  return path.resolve(process.cwd(), input);
}

/**
 * Walk `dir` up to `maxDepth` levels deep looking for directories that
 * contain a `.planning/` subdirectory (GAD project marker).
 *
 * Skips common noise dirs: node_modules, .git, dist, .next, __pycache__, etc.
 * Returns absolute paths of project roots (the parent of `.planning/`).
 *
 * @param {string} dir        Absolute path to start from.
 * @param {number} maxDepth   How many levels to descend (1 = children only).
 * @returns {string[]}
 */
function walkForGadProjects(dir, maxDepth) {
  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', '.next', 'build', '__pycache__',
    '.venv', 'venv', '.cargo', 'target', '.turbo', 'coverage',
    '.nyc_output', '.parcel-cache', 'out',
  ]);

  const found = [];

  function walk(current, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return; // permission denied or other I/O error — skip silently
    }

    // Does this directory itself contain `.planning/`?
    const hasPlanningDir = entries.some(
      (e) => e.isDirectory() && e.name === '.planning',
    );
    if (hasPlanningDir) {
      found.push(current);
      // Don't recurse inside a project root — nested projects would be
      // registered as their own roots only if they sit at a higher level
      // in the scan tree.  Walking into them adds duplicates.
      return;
    }

    // Recurse into subdirectories.
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(path.join(current, entry.name), depth + 1);
    }
  }

  walk(dir, 1);
  return found;
}

/**
 * Derive a config root id from a directory path.
 * Uses the directory basename, lower-cased, with spaces replaced by hyphens.
 * Falls back to the parent basename if dir is empty (shouldn't happen).
 */
function deriveId(absPath) {
  const base = path.basename(absPath) || path.basename(path.dirname(absPath));
  return base.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Compute the stored path for a new root relative to baseDir.
 * Mirrors the logic in add.cjs: prefer relative unless cross-drive.
 */
function computeStoredPath(absPath, baseDir) {
  const rel = path.relative(baseDir, absPath);
  const isCrossDrive = path.isAbsolute(rel);
  return isCrossDrive
    ? absPath.replace(/\\/g, '/')
    : (rel.replace(/\\/g, '/') || '.');
}

function createProjectsScanCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    normalizePath,
    writeRootsToToml,
  } = deps;

  return defineCommand({
    meta: {
      name: 'scan',
      description: 'Scan a directory for GAD projects and add new ones to gad-config.toml',
    },
    args: {
      path: {
        type: 'string',
        alias: 'p',
        description: 'Directory to scan (default: ~/Documents)',
        default: '',
      },
      depth: {
        type: 'string',
        alias: 'd',
        description: 'Max directory depth to walk (default: 2)',
        default: '2',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Print what would be added without modifying gad-config.toml',
        default: false,
      },
      json: {
        type: 'boolean',
        description: 'Output result as JSON',
        default: false,
      },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);

      const scanRoot = resolveScanRoot(args.path || '');
      const maxDepth = Math.max(1, Math.min(10, parseInt(args.depth, 10) || 2));
      const dryRun = args['dry-run'];
      const useJson = args.json;

      // Validate scan root
      if (!fs.existsSync(scanRoot)) {
        const msg = `gad projects scan: scan path does not exist: ${scanRoot}`;
        if (useJson) {
          process.stdout.write(JSON.stringify({ error: msg }) + '\n');
        } else {
          process.stderr.write(msg + '\n');
        }
        process.exitCode = 1;
        return;
      }

      // Walk for GAD project roots
      const discovered = walkForGadProjects(scanRoot, maxDepth);

      // Build a set of already-registered absolute paths for dedup
      const existingAbsPaths = new Set(
        config.roots.map((root) =>
          path.resolve(baseDir, root.path).replace(/\\/g, '/'),
        ),
      );

      // Also skip the scan root itself if it's the monorepo root
      const baseDirNorm = baseDir.replace(/\\/g, '/');

      const alreadyRoots = [];
      const newRoots = [];

      for (const absPath of discovered) {
        const absNorm = absPath.replace(/\\/g, '/');
        if (existingAbsPaths.has(absNorm) || absNorm === baseDirNorm) {
          const existingRoot = config.roots.find(
            (r) => path.resolve(baseDir, r.path).replace(/\\/g, '/') === absNorm,
          );
          alreadyRoots.push({
            id: existingRoot ? existingRoot.id : deriveId(absPath),
            path: existingRoot ? existingRoot.path : computeStoredPath(absPath, baseDir),
          });
        } else {
          const id = deriveId(absPath);
          const storedPath = computeStoredPath(absPath, baseDir);
          newRoots.push({ id, path: storedPath });
        }
      }

      // Apply changes unless dry-run
      if (!dryRun && newRoots.length > 0) {
        const updatedRoots = [
          ...config.roots,
          ...newRoots.map((r) => ({
            id: r.id,
            path: r.path,
            planningDir: '.planning',
            discover: false,
          })),
        ];
        writeRootsToToml(baseDir, updatedRoots, config, {
          gadConfig,
          resolveTomlPath: deps.resolveTomlPath,
        });
      }

      const result = {
        scanned: scanRoot,
        found: discovered.length,
        added: dryRun ? [] : newRoots,
        dryRun: dryRun ? newRoots : undefined,
        already: alreadyRoots,
      };

      if (useJson) {
        process.stdout.write(JSON.stringify(result) + '\n');
        return;
      }

      // Human-readable output
      if (newRoots.length === 0 && !dryRun) {
        console.log(`✓ Scan complete — ${discovered.length} GAD projects found, all already registered`);
      } else if (dryRun) {
        console.log(`Scan (dry-run): ${scanRoot} — depth ${maxDepth}\n`);
        console.log(`  Found ${discovered.length} GAD project(s) total`);
        console.log(`  ${newRoots.length} would be added:`);
        for (const r of newRoots) {
          console.log(`    + [${r.id}]  ${r.path}`);
        }
        if (alreadyRoots.length > 0) {
          console.log(`  ${alreadyRoots.length} already registered:`);
          for (const r of alreadyRoots) {
            console.log(`    ✓ [${r.id}]  ${r.path}`);
          }
        }
      } else {
        console.log(`✓ Scan complete — added ${newRoots.length} new project(s):`);
        for (const r of newRoots) {
          console.log(`    + [${r.id}]  ${r.path}`);
        }
        if (alreadyRoots.length > 0) {
          console.log(`  (${alreadyRoots.length} already registered, skipped)`);
        }
      }
    },
  });
}

module.exports = { createProjectsScanCommand };
