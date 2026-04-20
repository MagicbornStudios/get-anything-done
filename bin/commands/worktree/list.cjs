'use strict';

const { defineCommand } = require('citty');
const { listDetailedWorktrees, path } = require('./shared.cjs');

function createWorktreeListCommand() {
  return defineCommand({
    meta: { name: 'list', description: 'List all git worktrees with status (eval + project worktrees, stale/orphan detection)' },
    args: {
      'agent-only': { type: 'boolean', description: 'Only show agent worktrees', default: false },
      json: { type: 'boolean', description: 'Output JSON', default: false },
    },
    run({ args }) {
      const filtered = args['agent-only']
        ? listDetailedWorktrees().filter((worktree) => worktree.isAgent)
        : listDetailedWorktrees();

      if (args.json) { console.log(JSON.stringify(filtered, null, 2)); return; }
      if (filtered.length === 0) { console.log('No worktrees found.'); return; }

      console.log('Git Worktrees\n');
      console.log('ID/BRANCH                            AGE   GAME  BUILD  PLAN  FLAGS           PATH');
      console.log(`${
        '-'.repeat(35)}  ${'-'.repeat(4)}  ${'-'.repeat(4)}  ${'-'.repeat(5)}  ${'-'.repeat(4)}  ${'-'.repeat(14)}  ${'-'.repeat(29)}`);
      for (const worktree of filtered) {
        const id = (worktree.branch || worktree.head || '').slice(0, 35).padEnd(35);
        const age = (worktree.age || '?').padEnd(4);
        const game = worktree.hasGame ? ' OK ' : ' - ';
        const build = worktree.hasBuild ? '  OK  ' : '  -  ';
        const plan = worktree.hasPlanning ? ' OK ' : ' - ';
        const flags = [
          worktree.isAgent ? 'agent' : null,
          worktree.isOrphaned ? 'orphan' : null,
          worktree.prunable ? 'prunable' : null,
          worktree.unregistered ? 'unregistered' : null,
        ].filter(Boolean).join(',');
        const relPath = path.relative(process.cwd(), worktree.path).replace(/\\/g, '/');
        console.log(`${id}  ${age}  ${game}  ${build}  ${plan}  ${(flags || '-').padEnd(13)}  ${relPath}`);
      }
      console.log(`\n${filtered.length} worktree(s)`);
      const agentCount = filtered.filter((worktree) => worktree.isAgent).length;
      if (!args['agent-only'] && agentCount > 0) console.log(`${agentCount} agent worktree(s) - use --agent-only to filter`);
    },
  });
}

module.exports = { createWorktreeListCommand };
