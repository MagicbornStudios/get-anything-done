'use strict';
/**
 * Worktree helper utilities — extracted from bin/gad.cjs.
 * Pure helpers for inspecting git worktrees and on-disk agent worktree dirs.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function listGitWorktrees() {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf8' });
    const worktrees = [];
    let current = null;
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current) worktrees.push(current);
        current = { path: line.slice(9).trim() };
      } else if (line.startsWith('HEAD ')) {
        if (current) current.head = line.slice(5).trim();
      } else if (line.startsWith('branch ')) {
        if (current) current.branch = line.slice(7).trim().replace('refs/heads/', '');
      } else if (line.startsWith('detached')) {
        if (current) current.detached = true;
      } else if (line.startsWith('prunable')) {
        if (current) {
          current.prunable = true;
          current.prunableReason = line.slice('prunable'.length).trim() || '';
        }
      }
    }
    if (current) worktrees.push(current);
    return worktrees;
  } catch {
    return [];
  }
}

// Scan known on-disk locations for agent worktrees that may not be
// registered with `git worktree`. Closes the gap behind 63-health-cli:
// `.claude/worktrees/agent-*` directories left behind by crashed runtimes
// never show up in `git worktree list --porcelain`.
function discoverOnDiskAgentWorktrees(repoRoot) {
  const root = repoRoot || process.cwd();
  if (!root) return [];
  const dirs = [
    path.join(root, '.claude', 'worktrees'),
    path.join(root, '.codex', 'worktrees'),
    path.join(root, '.cursor', 'worktrees'),
  ];
  const out = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!/^agent[-_]/i.test(entry.name)) continue;
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

function listAllWorktrees(repoRoot) {
  const registered = listGitWorktrees();
  const known = new Set(registered.map((w) => path.resolve(w.path).toLowerCase()));
  const onDisk = discoverOnDiskAgentWorktrees(repoRoot);
  for (const dir of onDisk) {
    const key = path.resolve(dir).toLowerCase();
    if (known.has(key)) continue;
    registered.push({ path: dir, unregistered: true });
    known.add(key);
  }
  return registered;
}

function findWorktreeByPartial(partial) {
  const worktrees = listAllWorktrees();
  return worktrees.filter((w) => w.path.includes(partial) || (w.branch && w.branch.includes(partial)));
}

function humanAge(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

function worktreeInfo(worktree) {
  const info = { ...worktree };
  try {
    const stat = fs.statSync(worktree.path);
    info.ageMs = Date.now() - stat.mtimeMs;
    info.age = humanAge(info.ageMs);
  } catch {
    info.age = '?';
    info.ageMs = Infinity;
  }
  info.exists = fs.existsSync(worktree.path);
  info.isOrphaned = !info.exists;
  info.isStale = Boolean(worktree.prunable) || info.isOrphaned || Boolean(worktree.unregistered);
  const wp = String(worktree.path || '');
  info.isAgent = /[\\/](?:\.claude|\.codex|\.cursor)[\\/]worktrees[\\/]agent[-_]/i.test(wp);
  if (worktree.unregistered) info.isAgent = info.isAgent || true;
  try {
    if (fs.existsSync(worktree.path)) {
      const gameDir = path.join(worktree.path, 'game');
      info.hasGame = fs.existsSync(gameDir);
      info.hasBuild = fs.existsSync(path.join(gameDir, 'dist', 'index.html'));
      info.hasPlanning = fs.existsSync(path.join(gameDir, '.planning')) || fs.existsSync(path.join(worktree.path, '.planning'));
    }
  } catch {}
  return info;
}

module.exports = {
  listGitWorktrees,
  discoverOnDiskAgentWorktrees,
  listAllWorktrees,
  findWorktreeByPartial,
  humanAge,
  worktreeInfo,
};
