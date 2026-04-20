'use strict';

const { defineCommand } = require('citty');
const { cacheCandidates, dirSizeBounded, formatBytes, fs } = require('./shared.cjs');

function createHealthCachesCommand({ findRepoRoot }) {
  return defineCommand({
    meta: { name: 'caches', description: 'List (or remove) reproducible build caches. Default is dry-run. 63-health-cli.' },
    args: {
      'dry-run': { type: 'boolean', description: 'List candidates without removing (default true)', default: true },
      remove: { type: 'boolean', description: 'Actually delete the candidates (overrides --dry-run)', default: false },
      json: { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
      'budget-ms': { type: 'string', description: 'Per-directory walk deadline in ms (default 1500)', default: '1500' },
    },
    run({ args }) {
      const root = findRepoRoot();
      const deadlineMs = Math.max(100, parseInt(args['budget-ms'], 10) || 1500);
      const candidates = cacheCandidates(root).map((candidate) => {
        const { bytes, truncated } = dirSizeBounded(candidate.abs, { deadlineMs });
        return { ...candidate, bytes, truncated };
      });
      candidates.sort((a, b) => b.bytes - a.bytes);
      const totalBytes = candidates.reduce((sum, candidate) => sum + candidate.bytes, 0);
      const willRemove = args.remove === true;

      if (args.json) {
        console.log(JSON.stringify({
          root,
          candidates: candidates.map((candidate) => ({ label: candidate.label, path: candidate.abs, bytes: candidate.bytes, truncated: candidate.truncated })),
          totalBytes,
          willRemove,
        }, null, 2));
      } else {
        console.log('Cache candidates (reproducible build outputs)\n');
        if (candidates.length === 0) { console.log('  No cache directories present.'); return; }
        console.log('  SIZE        PATH');
        console.log(`  ${'-'.repeat(10)}  ${'-'.repeat(52)}`);
        for (const candidate of candidates) {
          const sizeStr = `${formatBytes(candidate.bytes)}${candidate.truncated ? '+' : ''}`.padEnd(10);
          console.log(`  ${sizeStr}  ${candidate.label}`);
        }
        console.log(`\n  Total: ${formatBytes(totalBytes)}`);
        if (!willRemove) { console.log('\n  Dry run. Re-run with --remove to clear these directories.'); return; }
      }

      if (!willRemove) return;
      let removed = 0;
      let freedBytes = 0;
      for (const candidate of candidates) {
        try {
          fs.rmSync(candidate.abs, { recursive: true, force: true });
          removed++;
          freedBytes += candidate.bytes;
        } catch (e) {
          if (!args.json) console.log(`  x Failed to remove ${candidate.label}: ${e.message}`);
        }
      }
      if (!args.json) console.log(`\nOK Removed ${removed}/${candidates.length} cache(s); freed ~${formatBytes(freedBytes)}`);
    },
  });
}

module.exports = { createHealthCachesCommand };
