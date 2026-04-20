'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

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
      const addPath = args.path;
      const id = args.id || path.basename(addPath) || addPath;

      const existing = config.roots.find((root) => normalizePath(root.path) === normalizePath(addPath));
      if (existing) {
        console.log(`Already registered: [${existing.id}] → ${existing.path}`);
        return;
      }

      const absPath = path.join(baseDir, addPath);
      if (!fs.existsSync(absPath)) {
        fs.mkdirSync(absPath, { recursive: true });
        console.log(`Created directory: ${addPath}`);
      }

      const planDir = path.join(absPath, '.planning');
      if (!fs.existsSync(planDir)) {
        fs.mkdirSync(planDir, { recursive: true });
        console.log(`Created: ${addPath}/.planning/`);
      }

      config.roots.push({ id, path: addPath, planningDir: '.planning', discover: false });
      writeRootsToToml(baseDir, config.roots, config, { gadConfig, resolveTomlPath: deps.resolveTomlPath });
      console.log(`✓ Added [${id}] → ${addPath}/.planning/`);
    },
  });
}

module.exports = { createProjectsAddCommand };
