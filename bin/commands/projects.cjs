'use strict';
/**
 * `gad projects …` and `gad workspace …` (deprecated alias) command family,
 * plus `gad ls` shortcut.
 *
 * Subcommands now live under `bin/commands/projects/` with a thin assembler
 * here. Shared TOML/scaffold/audit helpers stay local to that command family.
 */

const { defineCommand } = require('citty');
const {
  appendIgnoreToToml,
  computeCanonicalShape,
  crawlPlanningDirs,
  INIT_XML_FILES,
  INIT_XML_TEMPLATES,
  listProjects,
  normalizePath,
  REQUIRED_FILES_BY_FORMAT,
  RECOMMENDED_FILES,
  writeRootsToToml,
} = require('./projects/shared.cjs');
const { createProjectsListCommand, createProjectsLsCommand } = require('./projects/list.cjs');
const { createProjectsSyncCommand } = require('./projects/sync.cjs');
const { createProjectsAddCommand } = require('./projects/add.cjs');
const { createProjectsIgnoreCommand } = require('./projects/ignore.cjs');
const { createProjectsInitCommand } = require('./projects/init.cjs');
const { createProjectsAuditCommand } = require('./projects/audit.cjs');
const { createProjectsCreateCommand } = require('./projects/create.cjs');
const { createProjectsEditCommand } = require('./projects/edit.cjs');
const { createProjectsArchiveCommand } = require('./projects/archive.cjs');

function createProjectsCommands(deps) {
  const commandDeps = {
    ...deps,
    appendIgnoreToToml,
    computeCanonicalShape,
    crawlPlanningDirs,
    INIT_XML_FILES,
    INIT_XML_TEMPLATES,
    listProjects,
    normalizePath,
    REQUIRED_FILES_BY_FORMAT,
    RECOMMENDED_FILES,
    writeRootsToToml,
  };

  const projectsList = createProjectsListCommand(commandDeps);
  const lsCmd = createProjectsLsCommand(commandDeps);
  const projectsSync = createProjectsSyncCommand(commandDeps);
  const projectsAdd = createProjectsAddCommand(commandDeps);
  const projectsIgnore = createProjectsIgnoreCommand(commandDeps);
  const projectsInit = createProjectsInitCommand(commandDeps);
  const projectsAudit = createProjectsAuditCommand(commandDeps);
  const projectsCreate = createProjectsCreateCommand(commandDeps);
  const projectsEdit = createProjectsEditCommand(commandDeps);
  const projectsArchive = createProjectsArchiveCommand(commandDeps);

  const projectsCmd = defineCommand({
    meta: { name: 'projects', description: 'Manage projects — list, sync roots, create, edit, archive' },
    subCommands: {
      list: projectsList,
      init: projectsInit,
      audit: projectsAudit,
      create: projectsCreate,
      edit: projectsEdit,
      archive: projectsArchive,
      sync: projectsSync,
      add: projectsAdd,
      ignore: projectsIgnore,
    },
  });

  const workspaceCmd = defineCommand({
    meta: { name: 'workspace', description: '[DEPRECATED] Use `gad projects <subcommand>` instead' },
    subCommands: {
      show: projectsList,
      sync: projectsSync,
      add: projectsAdd,
      ignore: projectsIgnore,
    },
    run() {
      console.warn('DEPRECATED: `gad workspace` is deprecated. Use `gad projects <subcommand>` instead.');
    },
  });

  return { projectsCmd, workspaceCmd, lsCmd };
}

module.exports = { createProjectsCommands };
module.exports.register = (ctx) => {
  const { lsCmd, workspaceCmd, projectsCmd } = createProjectsCommands(ctx.common);
  return { ls: lsCmd, workspace: workspaceCmd, projects: projectsCmd };
};
