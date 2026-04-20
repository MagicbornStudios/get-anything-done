'use strict';
/**
 * gad health — machine health surface (disk/prune/caches). Task 63-health-cli.
 *
 * Required deps: findRepoRoot, outputError, listAllWorktrees, worktreeInfo
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  const fixed = n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1);
  return `${fixed} ${units[i]}`;
}

function dirSizeBounded(dir, opts = {}) {
  const maxEntries = opts.maxEntries || 50000;
  const deadlineMs = opts.deadlineMs || 1500;
  const start = Date.now();
  let bytes = 0;
  let entries = 0;
  let truncated = false;
  const stack = [dir];
  while (stack.length) {
    if (entries >= maxEntries || Date.now() - start > deadlineMs) { truncated = true; break; }
    const cur = stack.pop();
    let children;
    try { children = fs.readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const c of children) {
      entries++;
      if (entries >= maxEntries || Date.now() - start > deadlineMs) { truncated = true; break; }
      const full = path.join(cur, c.name);
      try {
        if (c.isSymbolicLink()) continue;
        if (c.isDirectory()) stack.push(full);
        else if (c.isFile()) { const st = fs.statSync(full); bytes += st.size; }
      } catch {}
    }
  }
  return { bytes, truncated };
}

function diskFreeFor(targetPath) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(targetPath);
      return {
        totalBytes: Number(s.blocks) * Number(s.bsize),
        freeBytes: Number(s.bavail) * Number(s.bsize),
      };
    }
  } catch {}
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const drive = path.parse(path.resolve(targetPath)).root.replace(/\\$/, '');
      const out = execSync(
        `wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size /format:list`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 1500 },
      );
      const free = Number((out.match(/FreeSpace=(\d+)/) || [, ''])[1]) || 0;
      const total = Number((out.match(/Size=(\d+)/) || [, ''])[1]) || 0;
      if (free && total) return { totalBytes: total, freeBytes: free };
    } catch {}
  }
  return null;
}

function hotDirCandidates(repoRoot) {
  const candidates = [
    { label: 'node_modules', rel: 'node_modules' },
    { label: 'apps/portfolio/.next', rel: 'apps/portfolio/.next' },
    { label: 'vendor/get-anything-done/site/.next', rel: 'vendor/get-anything-done/site/.next' },
    { label: 'vendor/get-anything-done/dist', rel: 'vendor/get-anything-done/dist' },
    { label: '.releases', rel: '.releases' },
    { label: 'apps/portfolio/public/evals', rel: 'apps/portfolio/public/evals' },
    { label: '.claude/worktrees', rel: '.claude/worktrees' },
    { label: '.codex/worktrees', rel: '.codex/worktrees' },
    { label: '.cursor/worktrees', rel: '.cursor/worktrees' },
    { label: '.planning/.gad-log', rel: '.planning/.gad-log' },
  ];
  return candidates
    .map(c => ({ ...c, abs: path.join(repoRoot, c.rel) }))
    .filter(c => fs.existsSync(c.abs));
}

function cacheCandidates(repoRoot) {
  const out = [];
  const push = (label, rel, opts = {}) => {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) return;
    out.push({ label, rel, abs, ...opts });
  };
  push('apps/portfolio/.next', 'apps/portfolio/.next');
  push('vendor/get-anything-done/site/.next', 'vendor/get-anything-done/site/.next');
  push('vendor/get-anything-done/dist/release', 'vendor/get-anything-done/dist/release');
  push('vendor/get-anything-done/dist/release-artifacts', 'vendor/get-anything-done/dist/release-artifacts');
  push('vendor/get-anything-done/dist/release-upload', 'vendor/get-anything-done/dist/release-upload');
  push('node_modules/.cache', 'node_modules/.cache');
  push('apps/portfolio/node_modules/.cache', 'apps/portfolio/node_modules/.cache');
  push('vendor/get-anything-done/site/node_modules/.cache', 'vendor/get-anything-done/site/node_modules/.cache');
  return out;
}

function createHealthCommand(deps) {
  const { findRepoRoot, outputError, listAllWorktrees, worktreeInfo } = deps;

  const disk = defineCommand({
    meta: { name: 'disk', description: 'Report disk free + top hot-directory hogs (bounded; <2s on Windows). 63-health-cli.' },
    args: {
      json: { type: 'boolean', description: 'Emit machine-readable JSON', default: false },
      'top': { type: 'string', description: 'How many hogs to show (default 5)', default: '5' },
      'budget-ms': { type: 'string', description: 'Per-directory walk deadline in ms (default 1500)', default: '1500' },
    },
    run({ args }) {
      const root = findRepoRoot();
      const top = Math.max(1, parseInt(args['top'], 10) || 5);
      const deadlineMs = Math.max(100, parseInt(args['budget-ms'], 10) || 1500);
      const free = diskFreeFor(root);
      const hot = hotDirCandidates(root).map(c => {
        const t0 = Date.now();
        const { bytes, truncated } = dirSizeBounded(c.abs, { deadlineMs });
        return { ...c, bytes, truncated, walkMs: Date.now() - t0 };
      });
      hot.sort((a, b) => b.bytes - a.bytes);
      const hogs = hot.slice(0, top);

      if (args.json) {
        console.log(JSON.stringify({
          root,
          free,
          hogs: hogs.map(h => ({ label: h.label, path: h.abs, bytes: h.bytes, truncated: h.truncated })),
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
          console.log(`  ⚠  Disk pressure: ${formatBytes(free.freeBytes)} free (${pct}% used). Builds likely to ENOSPC. Run \`gad health caches --remove\` or \`gad health prune --worktrees\`.`);
        }
      } else {
        console.log('  Volume:    free-space lookup unavailable on this platform');
      }
      if (hogs.length === 0) { console.log('\n  No hot directories present.'); return; }
      console.log(`\n  Top ${hogs.length} hot directories (size, walk-ms):\n`);
      console.log('    SIZE        WALK   PATH');
      console.log('    ──────────  ─────  ──────────────────────────────────────────────');
      for (const h of hogs) {
        const sizeStr = (formatBytes(h.bytes) + (h.truncated ? '+' : '')).padEnd(10);
        const walkStr = `${h.walkMs}ms`.padStart(5);
        console.log(`    ${sizeStr}  ${walkStr}  ${h.label}`);
      }
      if (hogs.some(h => h.truncated)) {
        console.log('\n  Sizes marked + were truncated by the walk budget — re-run with --budget-ms 5000 for an exact reading.');
      }
    },
  });

  const prune = defineCommand({
    meta: { name: 'prune', description: 'Prune stale state safely (worktrees today; caches via `gad health caches --remove`). 63-health-cli.' },
    args: {
      worktrees: { type: 'boolean', description: 'Prune stale agent worktrees (registered + on-disk leftovers)', default: false },
      'older-than': { type: 'string', description: 'Age threshold (e.g. 12h, 3d) — default 3d', default: '3d' },
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

      const worktrees = listAllWorktrees().map(worktreeInfo);
      const candidates = worktrees.filter(w => {
        if (!w.isAgent) return false;
        if (w.ageMs < thresholdMs) return false;
        return true;
      });

      if (args.json) {
        console.log(JSON.stringify({
          thresholdMs,
          candidates: candidates.map(c => ({
            path: c.path, age: c.age, ageMs: c.ageMs,
            unregistered: Boolean(c.unregistered),
            orphan: Boolean(c.isOrphaned),
            prunable: Boolean(c.prunable),
            branch: c.branch || null,
          })),
          dryRun: Boolean(args['dry-run']),
        }, null, 2));
        if (args['dry-run']) return;
      } else {
        if (candidates.length === 0) { console.log(`No agent worktrees older than ${args['older-than']}.`); return; }
        console.log(`Agent worktree prune candidates (older than ${args['older-than']}):\n`);
        console.log('  AGE    FLAGS           PATH');
        console.log('  ─────  ──────────────  ──────────────────────────────────────────');
        for (const w of candidates) {
          const flags = [
            w.unregistered ? 'unregistered' : null,
            w.isOrphaned ? 'orphan' : null,
            w.prunable ? 'prunable' : null,
          ].filter(Boolean).join(',') || '-';
          const rel = path.relative(process.cwd(), w.path).replace(/\\/g, '/');
          console.log(`  ${(w.age || '?').padEnd(5)}  ${flags.padEnd(14)}  ${rel}`);
        }
        console.log(`\n${candidates.length} worktree(s) would be removed.`);
        if (args['dry-run']) { console.log('Dry run — nothing removed. Re-run without --dry-run to proceed.'); return; }
      }

      const { execSync } = require('child_process');
      let removed = 0;
      for (const w of candidates) {
        try {
          if (w.unregistered) {
            fs.rmSync(w.path, { recursive: true, force: true });
          } else {
            execSync(`git worktree remove --force "${w.path}"`, { stdio: 'pipe' });
            if (w.branch) {
              try { execSync(`git branch -D "${w.branch}"`, { stdio: 'pipe' }); } catch {}
            }
          }
          removed++;
        } catch (e) {
          console.log(`  ✗ Failed to remove ${w.path}: ${e.message}`);
        }
      }
      if (!args.json) console.log(`\n✓ Removed ${removed}/${candidates.length} worktree(s)`);
    },
  });

  const caches = defineCommand({
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
      const cands = cacheCandidates(root).map(c => {
        const { bytes, truncated } = dirSizeBounded(c.abs, { deadlineMs });
        return { ...c, bytes, truncated };
      });
      cands.sort((a, b) => b.bytes - a.bytes);
      const totalBytes = cands.reduce((s, c) => s + c.bytes, 0);
      const willRemove = args.remove === true;

      if (args.json) {
        console.log(JSON.stringify({
          root,
          candidates: cands.map(c => ({ label: c.label, path: c.abs, bytes: c.bytes, truncated: c.truncated })),
          totalBytes, willRemove,
        }, null, 2));
      } else {
        console.log('Cache candidates (reproducible build outputs)\n');
        if (cands.length === 0) { console.log('  No cache directories present.'); return; }
        console.log('  SIZE        PATH');
        console.log('  ──────────  ────────────────────────────────────────────────────');
        for (const c of cands) {
          const sizeStr = (formatBytes(c.bytes) + (c.truncated ? '+' : '')).padEnd(10);
          console.log(`  ${sizeStr}  ${c.label}`);
        }
        console.log(`\n  Total: ${formatBytes(totalBytes)}`);
        if (!willRemove) { console.log('\n  Dry run. Re-run with --remove to clear these directories.'); return; }
      }

      if (!willRemove) return;
      let removed = 0;
      let freedBytes = 0;
      for (const c of cands) {
        try {
          fs.rmSync(c.abs, { recursive: true, force: true });
          removed++;
          freedBytes += c.bytes;
        } catch (e) {
          if (!args.json) console.log(`  ✗ Failed to remove ${c.label}: ${e.message}`);
        }
      }
      if (!args.json) console.log(`\n✓ Removed ${removed}/${cands.length} cache(s); freed ~${formatBytes(freedBytes)}`);
    },
  });

  return defineCommand({
    meta: { name: 'health', description: 'Machine health surface — disk pressure, stale-worktree prune, cache enumeration (63-health-cli)' },
    subCommands: { disk, prune, caches },
  });
}

module.exports = { createHealthCommand };
module.exports.register = (ctx) => ({
  health: createHealthCommand({ ...ctx.common, ...ctx.extras.worktree }),
});
