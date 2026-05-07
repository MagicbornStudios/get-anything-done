'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

/**
 * Resolve the user-supplied path argument to an absolute filesystem path.
 *
 * Rules (Bug 1 fix — 2026-05-07):
 *   - Absolute paths (C:\… or /…) → use as-is.
 *   - Relative paths starting with ../ or ./ → resolve against baseDir.
 *   - Bare relative paths → resolve against baseDir (same as before).
 *
 * On Windows, path.isAbsolute handles both backslash (C:\foo) and
 * forward-slash (C:/foo) forms correctly.
 *
 * @param {string} input  The raw path argument from the CLI.
 * @param {string} baseDir  The monorepo root (from findRepoRoot).
 * @returns {{ absPath: string, storedPath: string }}
 *   absPath   — absolute path on disk for existence checks / mkdir.
 *   storedPath — value written into gad-config.toml [[planning.roots]] path key;
 *               absolute for external roots, relative for internal roots.
 */
function resolveAddPath(input, baseDir) {
  let absPath;
  if (path.isAbsolute(input)) {
    absPath = path.normalize(input);
  } else {
    absPath = path.resolve(baseDir, input);
  }

  // Determine whether the resolved path lives inside baseDir.
  // If so, store a relative path so the config is portable.
  // If not (sibling/external), store the absolute path.
  const relFromBase = path.relative(baseDir, absPath);
  const isInternal = !relFromBase.startsWith('..') && !path.isAbsolute(relFromBase);
  const storedPath = isInternal ? relFromBase.replace(/\\/g, '/') || '.' : absPath.replace(/\\/g, '/');

  return { absPath, storedPath };
}

function createProjectsAddCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    normalizePath,
    writeRootsToToml,
  } = deps;

  return defineCommand({
    meta: { name: 'add', description: 'Add a path as a planning root' },
    args: {
      path: { type: 'positional', description: 'Path to add', required: true },
      id: { type: 'string', description: 'Root ID (default: dirname)', default: '' },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const inputPath = args.path;

      const { absPath, storedPath } = resolveAddPath(inputPath, baseDir);
      const id = args.id || path.basename(absPath) || storedPath;

      // Check for existing registration by stored path OR resolved absolute path
      // (catches the case where ../slm_learning and C:/…/slm_learning refer to
      // the same directory under different representations).
      const existing = config.roots.find((root) => {
        if (normalizePath(root.path) === normalizePath(storedPath)) return true;
        if (normalizePath(root.path) === normalizePath(inputPath)) return true;
        // Compare resolved absolute paths
        const rootAbs = path.resolve(baseDir, root.path).replace(/\\/g, '/');
        return rootAbs === absPath.replace(/\\/g, '/');
      });
      if (existing) {
        console.log(`Already registered: [${existing.id}] → ${existing.path}`);
        return;
      }

      // Validate — don't silently create arbitrary external directories.
      if (!fs.existsSync(absPath)) {
        process.stderr.write(`gad projects add: path does not exist: ${absPath}\n`);
        process.exitCode = 1;
        return;
      }

      const planDir = path.join(absPath, '.planning');
      if (!fs.existsSync(planDir)) {
        fs.mkdirSync(planDir, { recursive: true });
        console.log(`Created: ${absPath}/.planning/`);
      }

      config.roots.push({ id, path: storedPath, planningDir: '.planning', discover: false });
      writeRootsToToml(baseDir, config.roots, config, { gadConfig, resolveTomlPath: deps.resolveTomlPath });
      console.log(`Added [${id}] → ${storedPath}/.planning/`);
    },
  });
}

module.exports = { createProjectsAddCommand, resolveAddPath };
