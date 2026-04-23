'use strict';
/**
 * gad tasks — show, claim, release, add, update, promote, and inspect tasks.
 *
 * Subcommand behavior lives in bin/commands/tasks/*.cjs.
 */

const { defineCommand } = require('citty');
const { resolveProjectRootById, resolveSingleTaskRoot, runTasksListView } = require('./tasks/shared.cjs');
const { createTasksListCommand } = require('./tasks/list.cjs');
const { createTasksShowCommand } = require('./tasks/show.cjs');
const { createTasksClaimCommand } = require('./tasks/claim.cjs');
const { createTasksReleaseCommand } = require('./tasks/release.cjs');
const { createTasksActiveCommand } = require('./tasks/active.cjs');
const { createTasksAddCommand } = require('./tasks/add.cjs');
const { createTasksPromoteCommand } = require('./tasks/promote.cjs');
const { createTasksUpdateCommand } = require('./tasks/update.cjs');
const { createTasksMigrateCommand } = require('./tasks/migrate.cjs');
const { createTasksStampCommand } = require('./tasks/stamp.cjs');
const { createTasksAuditCommand } = require('./tasks/audit.cjs');

function createTasksCommand(deps) {
  const commandDeps = {
    ...deps,
    resolveProjectRootById,
    resolveSingleTaskRoot,
    runTasksListView,
  };

  return defineCommand({
    meta: { name: 'tasks', description: 'Show, claim, release, add, update, promote, and inspect tasks' },
    subCommands: {
      list: createTasksListCommand(commandDeps),
      show: createTasksShowCommand(commandDeps),
      claim: createTasksClaimCommand(commandDeps),
      release: createTasksReleaseCommand(commandDeps),
      active: createTasksActiveCommand(commandDeps),
      add: createTasksAddCommand(commandDeps),
      update: createTasksUpdateCommand(commandDeps),
      promote: createTasksPromoteCommand(commandDeps),
      migrate: createTasksMigrateCommand(commandDeps),
      stamp: createTasksStampCommand(commandDeps),
      audit: createTasksAuditCommand(commandDeps),
    },
  });
}

module.exports = { createTasksCommand };
module.exports.register = (ctx) => ({
  tasks: createTasksCommand(ctx.common),
});
