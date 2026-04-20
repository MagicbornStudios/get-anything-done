'use strict';

const path = require('path');

function resolveProjectRoot(deps, args) {
  const baseDir = deps.findRepoRoot();
  const config = deps.gadConfig.load(baseDir);
  let roots = config.roots;
  const projectId = args.projectid || args.project;

  if (projectId) {
    roots = roots.filter((root) => root.id === projectId);
    if (roots.length === 0) {
      const ids = config.roots.map((root) => root.id);
      console.error(`\nProject not found: ${projectId}\n\nAvailable projects:\n`);
      for (const id of ids) console.error(`  ${id}`);
      console.error(`\nRerun with: --projectid ${ids[0]}`);
      process.exit(1);
    }
  }

  if (roots.length === 0) {
    deps.outputError('No projects configured. Run `gad projects sync` first.');
    return null;
  }

  const root = roots[0];
  return {
    baseDir,
    config,
    root,
    planDir: path.join(baseDir, root.path, root.planningDir),
  };
}

module.exports = { resolveProjectRoot };
