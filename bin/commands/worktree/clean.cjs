'use strict';

const { defineCommand } = require('citty');
const { findWorktreeByPartial, path } = require('./shared.cjs');

function createWorktreeCleanCommand({ outputError }) {
  return defineCommand({
    meta: { name: 'clean', description: 'Remove a specific worktree (force)' },
    args: {
      id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true },
      force: { type: 'boolean', description: 'Skip confirmation', default: false },
    },
    run({ args }) {
      const matches = findWorktreeByPartial(args.id);
      if (matches.length === 0) { outputError(`No worktree found matching "${args.id}"`); return; }
      if (matches.length > 1) {
        console.log(`Multiple worktrees match "${args.id}":`);
        for (const match of matches) console.log(`  ${match.path}`);
        console.log('Be more specific.');
        return;
      }
      const worktree = matches[0];
      if (worktree.path === process.cwd() || worktree.path === path.resolve(__dirname, '..', '..', '..', '..')) {
        outputError(`Refusing to remove the main working directory: ${worktree.path}`);
        return;
      }
      const { execSync } = require('child_process');
      try {
        execSync(`git worktree remove --force "${worktree.path}"`, { stdio: 'pipe' });
        console.log(`OK Removed worktree: ${worktree.path}`);
        if (worktree.branch) {
          try {
            execSync(`git branch -D "${worktree.branch}"`, { stdio: 'pipe' });
            console.log(`OK Deleted branch: ${worktree.branch}`);
          } catch {}
        }
      } catch (e) {
        outputError(`Failed to remove worktree: ${e.message}`);
      }
    },
  });
}

module.exports = { createWorktreeCleanCommand };
