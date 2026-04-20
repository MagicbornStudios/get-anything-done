'use strict';

const { defineCommand } = require('citty');
const { createWorktreeNewCommand } = require('./worktree/new.cjs');
const { createWorktreeListCommand } = require('./worktree/list.cjs');
const { createWorktreeShowCommand } = require('./worktree/show.cjs');
const { createWorktreeCleanCommand } = require('./worktree/clean.cjs');
const { createWorktreePruneCommand } = require('./worktree/prune.cjs');

function createWorktreeCommand(deps) {
  return defineCommand({
    meta: { name: 'worktree', description: 'Manage git worktrees for eval agents and normal project work' },
    subCommands: {
      new: createWorktreeNewCommand(deps),
      list: createWorktreeListCommand(deps),
      show: createWorktreeShowCommand(deps),
      clean: createWorktreeCleanCommand(deps),
      prune: createWorktreePruneCommand(deps),
    },
  });
}

module.exports = { createWorktreeCommand };
module.exports.register = (ctx) => ({
  worktree: createWorktreeCommand(ctx.common),
});
