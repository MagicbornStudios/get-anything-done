'use strict';

const path = require('path');
const fs = require('fs');
const { listAllWorktrees, worktreeInfo } = require('../../../lib/worktree-helpers.cjs');

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
    for (const child of children) {
      entries++;
      if (entries >= maxEntries || Date.now() - start > deadlineMs) { truncated = true; break; }
      const full = path.join(cur, child.name);
      try {
        if (child.isSymbolicLink()) continue;
        if (child.isDirectory()) stack.push(full);
        else if (child.isFile()) bytes += fs.statSync(full).size;
      } catch {}
    }
  }
  return { bytes, truncated };
}

function diskFreeFor(targetPath) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(targetPath);
      return {
        totalBytes: Number(stats.blocks) * Number(stats.bsize),
        freeBytes: Number(stats.bavail) * Number(stats.bsize),
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
  return [
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
  ]
    .map((candidate) => ({ ...candidate, abs: path.join(repoRoot, candidate.rel) }))
    .filter((candidate) => fs.existsSync(candidate.abs));
}

function cacheCandidates(repoRoot) {
  const out = [];
  const push = (label, rel) => {
    const abs = path.join(repoRoot, rel);
    if (fs.existsSync(abs)) out.push({ label, rel, abs });
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

function listWorktreesInfo() {
  return listAllWorktrees().map(worktreeInfo);
}

module.exports = {
  cacheCandidates,
  dirSizeBounded,
  diskFreeFor,
  formatBytes,
  fs,
  hotDirCandidates,
  listWorktreesInfo,
  path,
};
