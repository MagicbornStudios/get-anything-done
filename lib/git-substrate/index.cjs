'use strict';
/**
 * git-substrate/index.cjs — Phase 256-02
 *
 * Single abstraction over two git backends:
 *   SystemGit  — shells out to the system `git` binary (preferred)
 *   IsogitGit  — isomorphic-git lazy-require (fallback; operator installs with
 *                `pnpm add -w isomorphic-git` when needed)
 *
 * Detection (cached in module scope):
 *   1. `where git`  (Windows)
 *   2. `which git`  (POSIX)
 *   3. `GIT_SUBSTRATE=isogit` env override
 *   If binary not found AND env not set → defaults to isogit with a warning.
 *
 * API (all methods async, all paths absolute strings):
 *   status(repoPath)                        → StatusEntry[]
 *   log(repoPath, n?)                       → Commit[]
 *   diff(repoPath, staged?)                 → FileDiff[]
 *   branchList(repoPath)                    → Branch[]
 *   checkout(repoPath, branch)              → void
 *   createBranch(repoPath, name, from?)     → void
 *   stage(repoPath, files)                  → void
 *   commit(repoPath, msg)                   → string (SHA)
 *   push(repoPath, remote?, branch?)        → void
 *   pull(repoPath, remote?, branch?)        → void
 *   fetch(repoPath, remote?)                → void
 *   clone(url, destPath)                    → void
 *   currentBranch(repoPath)                 → string
 */

const { spawnSync, execFileSync } = require('child_process');
const path = require('path');
const os = require('os');

// ── Detection ─────────────────────────────────────────────────────────────────

let _detectedBinary = undefined; // undefined = not yet detected; null = not found

function detectGitBinary() {
  if (_detectedBinary !== undefined) return _detectedBinary;
  if (process.env.GIT_SUBSTRATE === 'isogit') {
    _detectedBinary = null;
    return null;
  }
  try {
    const isWin = os.platform() === 'win32';
    const probe = isWin
      ? spawnSync('where', ['git'], { encoding: 'utf8', timeout: 5000, windowsHide: true })
      : spawnSync('which', ['git'], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    if (probe.status === 0 && probe.stdout.trim()) {
      _detectedBinary = probe.stdout.trim().split(/\r?\n/)[0].trim();
    } else {
      _detectedBinary = null;
    }
  } catch {
    _detectedBinary = null;
  }
  return _detectedBinary;
}

// ── SystemGit impl ─────────────────────────────────────────────────────────────

class SystemGit {
  constructor(gitPath) {
    this._git = gitPath;
  }

  _run(repoPath, args, opts = {}) {
    const result = spawnSync(this._git, args, {
      cwd: repoPath,
      encoding: 'utf8',
      timeout: opts.timeout || 30000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0 && !opts.allowNonZero) {
      const msg = (result.stderr || '').trim() || `git ${args[0]} exited ${result.status}`;
      throw new Error(msg);
    }
    return (result.stdout || '').trim();
  }

  async status(repoPath) {
    const out = this._run(repoPath, ['status', '--porcelain=v1']);
    if (!out) return [];
    return out.split('\n').map(line => ({
      xy: line.slice(0, 2),
      path: line.slice(3),
    }));
  }

  async log(repoPath, n = 20) {
    const sep = '\x1f';
    const fmt = [`%H${sep}%h${sep}%an${sep}%ae${sep}%ai${sep}%s`].join('');
    const out = this._run(repoPath, ['log', `--format=${fmt}`, `-n`, String(n)], { allowNonZero: true });
    if (!out) return [];
    return out.split('\n').filter(Boolean).map(line => {
      const [hash, short, authorName, authorEmail, date, subject] = line.split(sep);
      return { hash, short, authorName, authorEmail, date, subject };
    });
  }

  async diff(repoPath, staged = false) {
    const args = staged ? ['diff', '--cached', '--name-status'] : ['diff', '--name-status'];
    const out = this._run(repoPath, args, { allowNonZero: true });
    if (!out) return [];
    return out.split('\n').filter(Boolean).map(line => {
      const [status, ...rest] = line.split('\t');
      return { status: status.trim(), path: rest.join('\t') };
    });
  }

  async branchList(repoPath) {
    const out = this._run(repoPath, ['branch', '-a', '--format=%(refname:short) %(HEAD)'], { allowNonZero: true });
    if (!out) return [];
    return out.split('\n').filter(Boolean).map(line => {
      const parts = line.split(' ');
      const current = parts[parts.length - 1] === '*';
      const name = parts.slice(0, current ? parts.length - 1 : parts.length).join(' ').trim();
      return { name, current: parts.includes('*') };
    });
  }

  async checkout(repoPath, branch) {
    this._run(repoPath, ['checkout', branch]);
  }

  async createBranch(repoPath, name, from) {
    const args = from ? ['checkout', '-b', name, from] : ['checkout', '-b', name];
    this._run(repoPath, args);
  }

  async stage(repoPath, files) {
    this._run(repoPath, ['add', '--', ...files]);
  }

  async commit(repoPath, msg) {
    this._run(repoPath, ['commit', '-m', msg]);
    const sha = this._run(repoPath, ['rev-parse', 'HEAD']);
    return sha;
  }

  async push(repoPath, remote = 'origin', branch) {
    const args = branch ? ['push', remote, branch] : ['push', remote];
    this._run(repoPath, args, { timeout: 60000 });
  }

  async pull(repoPath, remote = 'origin', branch) {
    const args = branch ? ['pull', remote, branch] : ['pull'];
    this._run(repoPath, args, { timeout: 60000 });
  }

  async fetch(repoPath, remote = 'origin') {
    this._run(repoPath, ['fetch', remote], { timeout: 60000 });
  }

  async clone(url, destPath) {
    // clone runs from parent dir
    const parent = path.dirname(destPath);
    const name = path.basename(destPath);
    spawnSync(this._git, ['clone', url, name], {
      cwd: parent,
      encoding: 'utf8',
      timeout: 120000,
      windowsHide: true,
    });
  }

  async currentBranch(repoPath) {
    return this._run(repoPath, ['branch', '--show-current'], { allowNonZero: true });
  }
}

// ── IsogitGit impl ────────────────────────────────────────────────────────────

class IsogitGit {
  _requireIsogit() {
    let git, fs;
    try {
      git = require('isomorphic-git');
      fs = require('fs');
    } catch {
      throw new Error(
        '[git-substrate] isomorphic-git is not installed. ' +
        'Run `pnpm add -w isomorphic-git` to enable the fallback backend, ' +
        'or ensure the system git binary is on PATH.'
      );
    }
    return { git, fs };
  }

  async status(repoPath) {
    const { git, fs } = this._requireIsogit();
    const matrix = await git.statusMatrix({ fs, dir: repoPath });
    return matrix
      .filter(([, head, workdir, stage]) => !(head === 1 && workdir === 1 && stage === 1))
      .map(([filepath, head, workdir, stage]) => ({
        xy: `${head === 0 ? '?' : workdir !== 1 ? 'M' : ' '}${stage !== 1 ? 'S' : ' '}`,
        path: filepath,
      }));
  }

  async log(repoPath, n = 20) {
    const { git, fs } = this._requireIsogit();
    const commits = await git.log({ fs, dir: repoPath, depth: n });
    return commits.map(c => ({
      hash: c.oid,
      short: c.oid.slice(0, 7),
      authorName: c.commit.author.name,
      authorEmail: c.commit.author.email,
      date: new Date(c.commit.author.timestamp * 1000).toISOString(),
      subject: c.commit.message.split('\n')[0],
    }));
  }

  async diff(repoPath, staged = false) {
    // isomorphic-git has limited diff; return status-based approximation
    const entries = await this.status(repoPath);
    return entries.map(e => ({ status: e.xy.trim() || 'M', path: e.path }));
  }

  async branchList(repoPath) {
    const { git, fs } = this._requireIsogit();
    const branches = await git.listBranches({ fs, dir: repoPath });
    const current = await this.currentBranch(repoPath);
    return branches.map(name => ({ name, current: name === current }));
  }

  async checkout(repoPath, branch) {
    const { git, fs } = this._requireIsogit();
    await git.checkout({ fs, dir: repoPath, ref: branch });
  }

  async createBranch(repoPath, name, from) {
    const { git, fs } = this._requireIsogit();
    if (from) await git.checkout({ fs, dir: repoPath, ref: from });
    await git.branch({ fs, dir: repoPath, ref: name, checkout: true });
  }

  async stage(repoPath, files) {
    const { git, fs } = this._requireIsogit();
    for (const f of files) {
      await git.add({ fs, dir: repoPath, filepath: f });
    }
  }

  async commit(repoPath, msg) {
    const { git, fs } = this._requireIsogit();
    const sha = await git.commit({ fs, dir: repoPath, message: msg, author: { name: 'operator', email: 'operator@local' } });
    return sha;
  }

  async push(repoPath, remote = 'origin', branch) {
    const { git, fs } = this._requireIsogit();
    const ref = branch || await this.currentBranch(repoPath);
    await git.push({ fs, dir: repoPath, remote, ref });
  }

  async pull(repoPath, remote = 'origin', branch) {
    const { git, fs } = this._requireIsogit();
    const ref = branch || await this.currentBranch(repoPath);
    await git.pull({ fs, dir: repoPath, remote, ref, author: { name: 'operator', email: 'operator@local' } });
  }

  async fetch(repoPath, remote = 'origin') {
    const { git, fs } = this._requireIsogit();
    await git.fetch({ fs, dir: repoPath, remote });
  }

  async clone(url, destPath) {
    const { git, fs } = this._requireIsogit();
    await git.clone({ fs, dir: destPath, url });
  }

  async currentBranch(repoPath) {
    const { git, fs } = this._requireIsogit();
    const branch = await git.currentBranch({ fs, dir: repoPath });
    return branch || 'HEAD';
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * createSubstrate() — returns a cached GitSubstrate instance.
 * Prefer SystemGit when a git binary is found; fall back to IsogitGit.
 */
function createSubstrate() {
  if (_instance) return _instance;
  const bin = detectGitBinary();
  if (bin) {
    _instance = new SystemGit(bin);
  } else {
    if (process.env.GIT_SUBSTRATE !== 'isogit') {
      process.stderr.write(
        '[git-substrate] WARNING: no git binary found — using isomorphic-git fallback. ' +
        'Install git or set GIT_SUBSTRATE=isogit to suppress this warning.\n'
      );
    }
    _instance = new IsogitGit();
  }
  return _instance;
}

/** Reset the cached instance (used in tests). */
function resetSubstrate() {
  _instance = null;
  _detectedBinary = undefined;
}

module.exports = { createSubstrate, resetSubstrate, SystemGit, IsogitGit, detectGitBinary };
