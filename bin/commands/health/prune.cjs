'use strict';

const { defineCommand } = require('citty');
const { fs, listWorktreesInfo, path } = require('./shared.cjs');

function createHealthPruneCommand({ outputError }) {
  return defineCommand({
    meta: { name: 'prune', description: 'Prune stale state safely (worktrees today; caches via `gad health caches --remove`). 63-health-cli.' },
    args: {
      worktrees: { type: 'boolean', description: 'Prune stale agent worktrees (registered + on-disk leftovers)', default: false },
      'older-than': { type: 'string', description: 'Age threshold (e.g. 12h, 3d) - default 3d', default: '3d' },
      'dry-run': { type: 'boolean', description: 'Show what would be removed without removing', default: false },
      json: { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
    },
    run({ args }) {
      if (!args.worktrees) {
        console.log('Specify what to prune. Currently supported: --worktrees');
        console.log('Caches use `gad health caches --remove`.');
        return;
      }
      const match = String(args['older-than']).match(/^(\d+)([hdm])$/);
      if (!match) { outputError(`Invalid --older-than: ${args['older-than']}. Use e.g. 12h, 3d, 60m`); return; }
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const thresholdMs = unit === 'h' ? value * 3600e3 : unit === 'm' ? value * 60e3 : value * 86400e3;
      const candidates = listWorktreesInfo().filter((worktree) => worktree.isAgent && worktree.ageMs >= thresholdMs);

      if (args.json) {
        console.log(JSON.stringify({
          thresholdMs,
          candidates: candidates.map((candidate) => ({
            path: candidate.path,
            age: candidate.age,
            ageMs: candidate.ageMs,
            unregistered: Boolean(candidate.unregistered),
            orphan: Boolean(candidate.isOrphaned),
            prunable: Boolean(candidate.prunable),
            branch: candidate.branch || null,
          })),
          dryRun: Boolean(args['dry-run']),
        }, null, 2));
        if (args['dry-run']) return;
      } else {
        if (candidates.length === 0) { console.log(`No agent worktrees older than ${args['older-than']}.`); return; }
        console.log(`Agent worktree prune candidates (older than ${args['older-than']}):\n`);
        console.log('  AGE    FLAGS           PATH');
        console.log(`  ${'-'.repeat(5)}  ${'-'.repeat(14)}  ${'-'.repeat(42)}`);
        for (const candidate of candidates) {
          const flags = [
            candidate.unregistered ? 'unregistered' : null,
            candidate.isOrphaned ? 'orphan' : null,
            candidate.prunable ? 'prunable' : null,
          ].filter(Boolean).join(',') || '-';
          const rel = path.relative(process.cwd(), candidate.path).replace(/\\/g, '/');
          console.log(`  ${(candidate.age || '?').padEnd(5)}  ${flags.padEnd(14)}  ${rel}`);
        }
        console.log(`\n${candidates.length} worktree(s) would be removed.`);
        if (args['dry-run']) { console.log('Dry run - nothing removed. Re-run without --dry-run to proceed.'); return; }
      }

      const { execSync } = require('child_process');
      let removed = 0;
      for (const candidate of candidates) {
        try {
          if (candidate.unregistered) {
            fs.rmSync(candidate.path, { recursive: true, force: true });
          } else {
            execSync(`git worktree remove --force "${candidate.path}"`, { stdio: 'pipe' });
            if (candidate.branch) {
              try { execSync(`git branch -D "${candidate.branch}"`, { stdio: 'pipe' }); } catch {}
            }
          }
          removed++;
        } catch (e) {
          console.log(`  x Failed to remove ${candidate.path}: ${e.message}`);
        }
      }
      if (!args.json) console.log(`\nOK Removed ${removed}/${candidates.length} worktree(s)`);
    },
  });
}

module.exports = { createHealthPruneCommand };
