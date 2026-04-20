'use strict';

const { defineCommand } = require('citty');
const { fs, path } = require('./shared.cjs');

function createWorktreeNewCommand({ outputError }) {
  return defineCommand({
    meta: { name: 'new', description: 'Create a git worktree for eval or normal project work' },
    args: {
      path: { type: 'positional', description: 'Destination path for the worktree', required: true },
      branch: { type: 'string', description: 'Branch name to create/use (default: derived from path)', default: '' },
      base: { type: 'string', description: 'Base ref/branch to branch from (default: HEAD)', default: 'HEAD' },
      detach: { type: 'boolean', description: 'Create a detached worktree at the base ref', default: false },
    },
    run({ args }) {
      const targetPath = path.resolve(process.cwd(), args.path);
      if (fs.existsSync(targetPath)) {
        outputError(`Worktree path already exists: ${targetPath}`);
        return;
      }
      const branchName = args.detach ? '' : (args.branch || path.basename(targetPath).replace(/[^A-Za-z0-9._/-]+/g, '-'));
      const { execSync } = require('child_process');
      try {
        if (args.detach) execSync(`git worktree add --detach "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
        else execSync(`git worktree add -b "${branchName}" "${targetPath}" "${args.base}"`, { stdio: 'pipe' });
        console.log(`OK Worktree created: ${targetPath}`);
        if (branchName) console.log(`  Branch: ${branchName}`);
        console.log(`  Base:   ${args.base}`);
      } catch (e) {
        outputError(`Failed to create worktree: ${e.message}`);
      }
    },
  });
}

module.exports = { createWorktreeNewCommand };
