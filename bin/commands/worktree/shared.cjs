'use strict';

const path = require('path');
const fs = require('fs');
const {
  listAllWorktrees,
  worktreeInfo,
  findWorktreeByPartial,
} = require('../../../lib/worktree-helpers.cjs');

function listDetailedWorktrees() {
  return listAllWorktrees().map(worktreeInfo);
}

module.exports = {
  findWorktreeByPartial,
  fs,
  listDetailedWorktrees,
  path,
  worktreeInfo,
};
