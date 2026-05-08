'use strict';

const path = require('path');
const { defineCommand } = require('citty');
const { createHealthDiskCommand } = require('./health/disk.cjs');
const { createHealthPruneCommand } = require('./health/prune.cjs');
const { createHealthCachesCommand } = require('./health/caches.cjs');

// ─── disk --all-projects ──────────────────────────────────────────────────────

function createHealthDiskAllProjectsCommand({ findRepoRoot, gadConfig }) {
  return defineCommand({
    meta: { name: 'disk', description: 'Disk usage rollup — single-project hot dirs (default) or --all-projects cross-project table. 75-17.' },
    args: {
      'all-projects': { type: 'boolean', description: 'Cross-project size rollup from gad-config.toml planning.roots', default: false },
      json:           { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
      'budget-ms':    { type: 'string',  description: 'Per-dir walk deadline in ms (default 8000)', default: '8000' },
      // Pass-through args for original disk command
      top:            { type: 'string',  description: 'How many hogs to show (default 5, single-project only)', default: '5' },
    },
    run({ args }) {
      if (!args['all-projects']) {
        // Delegate to original single-project disk command
        const { createHealthDiskCommand } = require('./health/disk.cjs');
        const { dirSizeBounded, diskFreeFor, formatBytes, hotDirCandidates } = require('./health/shared.cjs');
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
          console.log(JSON.stringify({ root, free, hogs: hogs.map((hog) => ({ label: hog.label, path: hog.abs, bytes: hog.bytes, truncated: hog.truncated })), scanned: hot.length }, null, 2));
          return;
        }
        console.log('Disk health\n');
        console.log(`  Repo root: ${root}`);
        if (free) {
          const usedBytes = free.totalBytes - free.freeBytes;
          const pct = ((usedBytes / free.totalBytes) * 100).toFixed(1);
          console.log(`  Volume:    ${formatBytes(free.freeBytes)} free of ${formatBytes(free.totalBytes)} (${pct}% used)`);
          if (free.freeBytes < 10 * 1024 * 1024 * 1024 || free.freeBytes / free.totalBytes < 0.10) {
            console.log(`  WARN Disk pressure: ${formatBytes(free.freeBytes)} free. Run \`gad health caches --remove\` or \`gad health prune --worktrees\`.`);
          }
        }
        if (hogs.length === 0) { console.log('\n  No hot directories present.'); return; }
        console.log(`\n  Top ${hogs.length} hot directories:\n`);
        console.log('    SIZE        WALK   PATH');
        console.log(`    ${'-'.repeat(10)}  ${'-'.repeat(5)}  ${'-'.repeat(46)}`);
        for (const hog of hogs) {
          const sizeStr = `${formatBytes(hog.bytes)}${hog.truncated ? '+' : ''}`.padEnd(10);
          const walkStr = `${hog.walkMs}ms`.padStart(5);
          console.log(`    ${sizeStr}  ${walkStr}  ${hog.label}`);
        }
        return;
      }

      // --all-projects: cross-project rollup
      const { rollupAllProjects, formatRollupTable } = require('../../lib/disk-rollup.cjs');
      const repoRoot = findRepoRoot();
      const deadlineMs = Math.max(500, parseInt(args['budget-ms'], 10) || 8000);
      const rows = rollupAllProjects(repoRoot, { deadlineMs, gadConfig });

      if (args.json) {
        console.log(JSON.stringify({ repoRoot, rows }, null, 2));
        return;
      }

      console.log('Cross-project disk rollup\n');
      if (rows.length === 0) {
        console.log('  No planning roots found.');
        return;
      }
      console.log(formatRollupTable(rows).split('\n').map((l) => '  ' + l).join('\n'));
      const bigProjects = rows.filter((r) => r.notes);
      if (bigProjects.length > 0) {
        console.log('\n  Projects >1 GB: ' + bigProjects.map((r) => r.id).join(', '));
        console.log('  Run `gad health archive-old-shards --dry-run` to see archivable shards.');
      }
    },
  });
}

// ─── archive-old-shards ───────────────────────────────────────────────────────

function createHealthArchiveOldShardsCommand({ findRepoRoot, gadConfig }) {
  return defineCommand({
    meta: { name: 'archive-old-shards', description: 'Archive old log/trace shards to remote target + record manifest. 75-18.' },
    args: {
      days:      { type: 'string',  description: 'Age threshold in days (default 30)', default: '30' },
      target:    { type: 'string',  description: 'Remote target: hf-hub | supabase (default hf-hub)', default: 'hf-hub' },
      'dry-run': { type: 'boolean', description: 'List what WOULD be archived without uploading', default: false },
      auto:      { type: 'boolean', description: 'Combined archive + purge in one shot (daemon mode)', default: false },
      json:      { type: 'boolean', description: 'Emit machine-readable JSON result', default: false },
    },
    async run({ args }) {
      const { archiveOldShards, purgeConfirmedEntries, SAFETY_WINDOW_MS } = require('../../lib/archive-purge.cjs');
      const repoRoot = findRepoRoot();
      const days = Math.max(1, parseInt(args.days, 10) || 30);
      const olderThanMs = days * 24 * 60 * 60 * 1000;
      const target = args.target || 'hf-hub';
      const dryRun = Boolean(args['dry-run']);
      const log = args.json ? () => {} : (msg) => console.log('  ' + msg);

      // Resolve all roots
      let roots = [];
      try {
        const cfg = gadConfig.load(repoRoot);
        roots = (cfg.roots || []).map((r) => ({
          id: r.id,
          absRootPath: path.isAbsolute(r.path) ? r.path : path.resolve(repoRoot, r.path),
          planningDir: r.planningDir || '.planning',
        }));
      } catch (e) {
        if (!args.json) console.log(`  WARN: could not load config: ${e.message}`);
      }

      // Always probe slm_learning sibling
      const slmCandidates = [
        path.resolve(repoRoot, '..', 'slm_learning'),
        path.resolve(repoRoot, '..', 'slm-learning'),
      ];
      const { existsSync } = require('fs');
      for (const p of slmCandidates) {
        if (existsSync(p) && !roots.find((r) => r.id === 'slm-learning')) {
          roots.push({ id: 'slm-learning', absRootPath: p, planningDir: '.planning' });
        }
      }

      const manifestPath = path.join(repoRoot, '.planning', '.archive-manifest.jsonl');

      if (!args.json) {
        console.log(`Archive old shards (older than ${days}d, target: ${target}${dryRun ? ', dry-run' : ''})\n`);
      }

      let archiveResult;
      try {
        archiveResult = await archiveOldShards(roots, { olderThanMs, target, dryRun, manifestPath, log });
      } catch (e) {
        if (args.json) {
          console.log(JSON.stringify({ ok: false, error: e.message }));
        } else {
          console.log(`\n  ERROR: ${e.message}`);
        }
        process.exitCode = 1;
        return;
      }

      if (args.json) {
        console.log(JSON.stringify({
          ok: true,
          dryRun,
          target,
          shardsFound: archiveResult.shards.length,
          uploaded: archiveResult.uploaded.length,
          skipped: archiveResult.skipped.length,
          errors: archiveResult.errors.length,
          manifestEntries: archiveResult.manifestEntries.length,
          manifestPath,
        }, null, 2));
      } else {
        console.log(`\n  Shards found: ${archiveResult.shards.length}`);
        if (!dryRun) {
          console.log(`  Uploaded: ${archiveResult.uploaded.length}`);
          console.log(`  Errors:   ${archiveResult.errors.length}`);
          console.log(`  Manifest: ${manifestPath}`);
        }
      }

      // --auto: also purge after archive
      if (args.auto && !dryRun) {
        if (!args.json) console.log('\n  Running auto-purge (24h safety window)...');
        const purgeResult = purgeConfirmedEntries(manifestPath, SAFETY_WINDOW_MS, { dryRun: false, log });
        if (args.json) return; // already printed JSON above
        console.log(`  Purged: ${purgeResult.purged.length}, Skipped: ${purgeResult.skipped.length}, Errors: ${purgeResult.errors.length}`);
      }
    },
  });
}

// ─── purge-archived ───────────────────────────────────────────────────────────

function createHealthPurgeArchivedCommand({ findRepoRoot }) {
  return defineCommand({
    meta: { name: 'purge-archived', description: 'Delete local shards whose archive entry is >24h old. Without --confirm, lists what would be purged. 75-18.' },
    args: {
      confirm:       { type: 'boolean', description: 'Actually delete files (default: dry-run list)', default: false },
      'safety-hours': { type: 'string',  description: 'Safety window in hours (default 24)', default: '24' },
      json:          { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
    },
    run({ args }) {
      const { purgeConfirmedEntries, readManifest, isConfirmed } = require('../../lib/archive-purge.cjs');
      const repoRoot = findRepoRoot();
      const manifestPath = path.join(repoRoot, '.planning', '.archive-manifest.jsonl');
      const safetyHours = Math.max(1, parseFloat(args['safety-hours']) || 24);
      const safetyWindowMs = safetyHours * 60 * 60 * 1000;
      const dryRun = !args.confirm;

      const log = args.json ? () => {} : (msg) => console.log('  ' + msg);

      if (!args.json) {
        console.log(`Purge archived shards (safety window: ${safetyHours}h${dryRun ? ', dry-run' : ''})\n`);
        if (!require('fs').existsSync(manifestPath)) {
          console.log('  No archive manifest found. Run `gad health archive-old-shards` first.');
          return;
        }
      }

      const result = purgeConfirmedEntries(manifestPath, safetyWindowMs, { dryRun, log });

      if (args.json) {
        console.log(JSON.stringify({
          ok: true,
          dryRun,
          manifestPath,
          purged: result.purged.length,
          skipped: result.skipped.length,
          errors: result.errors.length,
          purgedFiles: result.purged,
          errorDetails: result.errors,
        }, null, 2));
        return;
      }

      console.log(`\n  Would purge / Purged: ${result.purged.length}`);
      console.log(`  Skipped (not ready):  ${result.skipped.length}`);
      console.log(`  Errors:               ${result.errors.length}`);
      if (dryRun && result.purged.length > 0) {
        console.log('\n  Re-run with --confirm to delete these files.');
      }
    },
  });
}

function createHealthCommand(deps) {
  return defineCommand({
    meta: { name: 'health', description: 'Machine health surface - disk pressure, stale-worktree prune, cache enumeration (63-health-cli, 75-17, 75-18)' },
    subCommands: {
      disk: createHealthDiskAllProjectsCommand(deps),
      prune: createHealthPruneCommand(deps),
      caches: createHealthCachesCommand(deps),
      'archive-old-shards': createHealthArchiveOldShardsCommand(deps),
      'purge-archived': createHealthPurgeArchivedCommand(deps),
    },
  });
}

module.exports = { createHealthCommand };
module.exports.register = (ctx) => ({
  health: createHealthCommand(ctx.common),
});
