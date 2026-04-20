'use strict';

const { defineCommand } = require('citty');
const { fs, listDetailedWorktrees, path } = require('./shared.cjs');

function createWorktreePruneCommand({ listAllEvalProjects, outputError }) {
  return defineCommand({
    meta: { name: 'prune', description: 'Prune stale agent worktrees older than a threshold' },
    args: {
      'older-than': { type: 'string', description: 'Age threshold (e.g. 1d, 12h, 3d) - default 3d', default: '3d' },
      'agent-only': { type: 'boolean', description: 'Only prune agent worktrees (default true)', default: true },
      'dry-run': { type: 'boolean', description: 'Show what would be removed without removing', default: false },
      'preserved-only': { type: 'boolean', description: 'Only prune worktrees whose evals have been preserved', default: true },
    },
    run({ args }) {
      const match = args['older-than'].match(/^(\d+)([hdm])$/);
      if (!match) { outputError(`Invalid --older-than: ${args['older-than']}. Use e.g. 12h, 3d, 60m`); return; }
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const thresholdMs = unit === 'h' ? value * 3600e3 : unit === 'm' ? value * 60e3 : value * 86400e3;

      const candidates = listDetailedWorktrees().filter((worktree) => {
        if (args['agent-only'] && !worktree.isAgent) return false;
        return worktree.ageMs >= thresholdMs;
      });
      if (candidates.length === 0) { console.log(`No worktrees older than ${args['older-than']}.`); return; }

      let allEvalProjects = [];
      try { allEvalProjects = listAllEvalProjects(); } catch {}
      for (const { projectDir } of allEvalProjects) {
        try {
          fs.readdirSync(projectDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name));
        } catch {}
      }

      console.log(`Prune candidates (older than ${args['older-than']}):\n`);
      const willRemove = [];
      for (const worktree of candidates) {
        console.log(`  ${worktree.age.padEnd(5)}  ${path.relative(process.cwd(), worktree.path).replace(/\\/g, '/')}  ${worktree.branch || ''}`);
        willRemove.push(worktree);
      }
      console.log(`\n${willRemove.length} worktree(s) would be removed.`);
      if (args['dry-run']) { console.log('Dry run - nothing removed. Re-run without --dry-run to proceed.'); return; }

      const { execSync } = require('child_process');
      let removed = 0;
      for (const worktree of willRemove) {
        try {
          if (worktree.unregistered) {
            fs.rmSync(worktree.path, { recursive: true, force: true });
          } else {
            execSync(`git worktree remove --force "${worktree.path}"`, { stdio: 'pipe' });
            if (worktree.branch) {
              try { execSync(`git branch -D "${worktree.branch}"`, { stdio: 'pipe' }); } catch {}
            }
          }
          removed++;
        } catch (e) {
          console.log(`  x Failed to remove ${worktree.path}: ${e.message}`);
        }
      }
      console.log(`\nOK Removed ${removed}/${willRemove.length} worktree(s)`);
    },
  });
}

module.exports = { createWorktreePruneCommand };
