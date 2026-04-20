'use strict';

const { defineCommand } = require('citty');
const { dirSizeBounded, diskFreeFor, formatBytes, hotDirCandidates } = require('./shared.cjs');

function createHealthDiskCommand({ findRepoRoot }) {
  return defineCommand({
    meta: { name: 'disk', description: 'Report disk free + top hot-directory hogs (bounded; <2s on Windows). 63-health-cli.' },
    args: {
      json: { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
      top: { type: 'string', description: 'How many hogs to show (default 5)', default: '5' },
      'budget-ms': { type: 'string', description: 'Per-directory walk deadline in ms (default 1500)', default: '1500' },
    },
    run({ args }) {
      const root = findRepoRoot();
      const top = Math.max(1, parseInt(args.top, 10) || 5);
      const deadlineMs = Math.max(100, parseInt(args['budget-ms'], 10) || 1500);
      const free = diskFreeFor(root);
      const hot = hotDirCandidates(root).map((candidate) => {
        const t0 = Date.now();
        const { bytes, truncated } = dirSizeBounded(candidate.abs, { deadlineMs });
        return { ...candidate, bytes, truncated, walkMs: Date.now() - t0 };
      });
      hot.sort((a, b) => b.bytes - a.bytes);
      const hogs = hot.slice(0, top);

      if (args.json) {
        console.log(JSON.stringify({
          root,
          free,
          hogs: hogs.map((hog) => ({ label: hog.label, path: hog.abs, bytes: hog.bytes, truncated: hog.truncated })),
          scanned: hot.length,
        }, null, 2));
        return;
      }

      console.log('Disk health\n');
      console.log(`  Repo root: ${root}`);
      if (free) {
        const usedBytes = free.totalBytes - free.freeBytes;
        const pct = ((usedBytes / free.totalBytes) * 100).toFixed(1);
        console.log(`  Volume:    ${formatBytes(free.freeBytes)} free of ${formatBytes(free.totalBytes)} (${pct}% used)`);
        const lowFree = free.freeBytes < 10 * 1024 * 1024 * 1024;
        const lowPct = free.freeBytes / free.totalBytes < 0.10;
        if (lowFree || lowPct) {
          console.log(`  WARN Disk pressure: ${formatBytes(free.freeBytes)} free (${pct}% used). Builds likely to ENOSPC. Run \`gad health caches --remove\` or \`gad health prune --worktrees\`.`);
        }
      } else {
        console.log('  Volume:    free-space lookup unavailable on this platform');
      }
      if (hogs.length === 0) { console.log('\n  No hot directories present.'); return; }
      console.log(`\n  Top ${hogs.length} hot directories (size, walk-ms):\n`);
      console.log('    SIZE        WALK   PATH');
      console.log(`    ${'-'.repeat(10)}  ${'-'.repeat(5)}  ${'-'.repeat(46)}`);
      for (const hog of hogs) {
        const sizeStr = `${formatBytes(hog.bytes)}${hog.truncated ? '+' : ''}`.padEnd(10);
        const walkStr = `${hog.walkMs}ms`.padStart(5);
        console.log(`    ${sizeStr}  ${walkStr}  ${hog.label}`);
      }
      if (hogs.some((hog) => hog.truncated)) {
        console.log('\n  Sizes marked + were truncated by the walk budget - re-run with --budget-ms 5000 for an exact reading.');
      }
    },
  });
}

module.exports = { createHealthDiskCommand };
