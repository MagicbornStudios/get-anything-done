'use strict';

const { defineCommand } = require('citty');

function createProjectsListCommand(deps) {
  const { findRepoRoot, gadConfig, readState, output, listProjects } = deps;

  return defineCommand({
    meta: { name: 'list', description: 'List all registered projects' },
    run() {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      listProjects(baseDir, config, readState, output);
    },
  });
}

function createProjectsLsCommand(deps) {
  const { findRepoRoot, gadConfig, readState, output, listProjects } = deps;

  return defineCommand({
    meta: { name: 'ls', description: 'List all registered projects (alias for: projects list)' },
    run() {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      listProjects(baseDir, config, readState, output);
    },
  });
}

module.exports = { createProjectsListCommand, createProjectsLsCommand };
