'use strict';

const { defineCommand } = require('citty');

function createProjectsIgnoreCommand(deps) {
  const { findRepoRoot, gadConfig, appendIgnoreToToml } = deps;

  return defineCommand({
    meta: { name: 'ignore', description: 'Add a gitignore-style ignore pattern' },
    args: {
      pattern: { type: 'positional', description: 'Glob pattern to ignore', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const pattern = args.pattern;

      if (config.ignore.includes(pattern)) {
        console.log(`Pattern already present: ${pattern}`);
        return;
      }

      config.ignore.push(pattern);
      appendIgnoreToToml(baseDir, pattern, { gadConfig, resolveTomlPath: deps.resolveTomlPath });
      console.log(`✓ Added ignore pattern: ${pattern}`);
    },
  });
}

module.exports = { createProjectsIgnoreCommand };
