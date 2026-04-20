'use strict';

const { defineCommand } = require('citty');
const { findWorktreeByPartial, worktreeInfo } = require('./shared.cjs');

function createWorktreeShowCommand({ outputError }) {
  return defineCommand({
    meta: { name: 'show', description: 'Show details of a specific worktree' },
    args: { id: { type: 'positional', description: 'Worktree id, branch name, or path fragment', required: true } },
    run({ args }) {
      const matches = findWorktreeByPartial(args.id);
      if (matches.length === 0) { outputError(`No worktree found matching "${args.id}"`); return; }
      if (matches.length > 1) {
        console.log(`Multiple worktrees match "${args.id}":`);
        for (const match of matches) console.log(`  ${match.path}`);
        return;
      }
      const worktree = worktreeInfo(matches[0]);
      console.log('Worktree details\n');
      console.log(`  Path:       ${worktree.path}`);
      console.log(`  Branch:     ${worktree.branch || '(detached)'}`);
      console.log(`  HEAD:       ${worktree.head || '?'}`);
      console.log(`  Age:        ${worktree.age || '?'}`);
      console.log(`  Is agent:   ${worktree.isAgent ? 'yes' : 'no'}`);
      console.log(`  Exists:     ${worktree.exists ? 'yes' : 'no'}`);
      console.log(`  Orphaned:   ${worktree.isOrphaned ? 'yes' : 'no'}`);
      console.log(`  Prunable:   ${worktree.prunable ? `yes${worktree.prunableReason ? ` (${worktree.prunableReason})` : ''}` : 'no'}`);
      console.log(`  Has game/:  ${worktree.hasGame ? 'yes' : 'no'}`);
      console.log(`  Has build:  ${worktree.hasBuild ? 'yes' : 'no'}`);
      console.log(`  Has .planning/: ${worktree.hasPlanning ? 'yes' : 'no'}`);
      try {
        const { execSync } = require('child_process');
        const status = execSync(`git -C "${worktree.path}" status --short`, { encoding: 'utf8' }).trim();
        const commits = execSync(`git -C "${worktree.path}" log --oneline -5`, { encoding: 'utf8' }).trim();
        console.log('\n  Recent commits:');
        for (const line of commits.split('\n')) console.log(`    ${line}`);
        if (status) {
          console.log('\n  Uncommitted changes (first 10 lines):');
          for (const line of status.split('\n').slice(0, 10)) console.log(`    ${line}`);
        } else {
          console.log('\n  Working tree: clean');
        }
      } catch {}
    },
  });
}

module.exports = { createWorktreeShowCommand };
