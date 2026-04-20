'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createProjectsSyncCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    crawlPlanningDirs,
    normalizePath,
    writeRootsToToml,
  } = deps;

  return defineCommand({
    meta: { name: 'sync', description: 'Crawl repo for .planning/ dirs and sync gad-config.toml roots' },
    args: {
      yes: { type: 'boolean', alias: 'y', description: 'Apply changes without prompting', default: false },
    },
    async run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const found = crawlPlanningDirs(baseDir, config.ignore || []);

      const existingPaths = new Set(config.roots.map((root) => normalizePath(root.path)));
      const newPaths = found.filter((projectPath) => !existingPaths.has(normalizePath(projectPath)));
      const missingPaths = config.roots.filter((root) => {
        const planDir = path.join(baseDir, root.path, root.planningDir);
        return !fs.existsSync(planDir);
      });

      if (newPaths.length === 0 && missingPaths.length === 0) {
        console.log(`✓ Projects up to date — ${config.roots.length} roots registered`);
        return;
      }

      console.log('\nProjects sync\n');
      for (const root of config.roots) {
        const missing = missingPaths.find((entry) => entry.id === root.id);
        console.log(`  ${missing ? '! MISSING ' : '✓ OK      '} [${root.id}]  ${root.path}`);
      }
      for (const projectPath of newPaths) {
        const id = path.basename(projectPath) || path.basename(path.dirname(projectPath));
        console.log(`  + NEW     [${id}]  ${projectPath}`);
      }
      if (missingPaths.length > 0) {
        console.log(`\n  ${missingPaths.length} registered root(s) no longer have a .planning/ dir.`);
      }
      console.log('');

      if (!args.yes) {
        console.log('Run with --yes to apply changes.');
        return;
      }

      const updatedRoots = config.roots.filter((root) => !missingPaths.find((entry) => entry.id === root.id));
      for (const projectPath of newPaths) {
        const id = path.basename(projectPath) || path.basename(path.dirname(projectPath));
        updatedRoots.push({ id, path: projectPath, planningDir: '.planning', discover: false });
      }

      writeRootsToToml(baseDir, updatedRoots, config, { gadConfig, resolveTomlPath: deps.resolveTomlPath });
      console.log(`✓ gad-config.toml updated — ${updatedRoots.length} roots registered`);
    },
  });
}

module.exports = { createProjectsSyncCommand };
