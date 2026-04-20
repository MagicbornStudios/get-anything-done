'use strict';
/**
 * lib/team/lock.cjs — file-based mutex for serializing TASK-REGISTRY.xml
 * writes across worker subprocesses.
 *
 * Uses exclusive file creation (`fs.writeFileSync` with flag `wx`) as the
 * acquire primitive — on all platforms this is atomic: either the file is
 * created and you own it, or EEXIST and you retry.
 *
 * Stale-lock recovery: the lock file records pid + epoch-ms. If the pid
 * isn't alive AND the lock is older than STALE_MS, the next acquirer
 * unlinks it and retries. Prevents a crashed worker from wedging the team.
 */

const fs = require('fs');
const path = require('path');
const { locksRoot } = require('./paths.cjs');

const DEFAULT_STALE_MS = 60_000;
const DEFAULT_RETRY_MS = 100;
const DEFAULT_TIMEOUT_MS = 30_000;

function lockFilePath(baseDir, name) {
  return path.join(locksRoot(baseDir), `${name}.lock`);
}

function writeLockFile(p, owner) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ owner, pid: process.pid, acquired_at: Date.now() }), { flag: 'wx' });
}

function pidAlive(pid) {
  if (!pid || typeof pid !== 'number') return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function tryAcquireOnce(baseDir, name, owner) {
  const p = lockFilePath(baseDir, name);
  try { writeLockFile(p, owner); return true; }
  catch (err) {
    if (err.code !== 'EEXIST') throw err;
    // Check stale
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
    if (meta && (Date.now() - (meta.acquired_at || 0)) > DEFAULT_STALE_MS && !pidAlive(meta.pid)) {
      try { fs.unlinkSync(p); } catch {}
      try { writeLockFile(p, owner); return true; } catch {}
    }
    return false;
  }
}

async function acquire(baseDir, name, { owner = `pid-${process.pid}`, timeoutMs = DEFAULT_TIMEOUT_MS, retryMs = DEFAULT_RETRY_MS } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (tryAcquireOnce(baseDir, name, owner)) return;
    await new Promise(r => setTimeout(r, retryMs));
  }
  throw new Error(`team lock timeout: ${name} (waited ${timeoutMs}ms)`);
}

function release(baseDir, name) {
  try { fs.unlinkSync(lockFilePath(baseDir, name)); } catch {}
}

async function withLock(baseDir, name, fn, opts) {
  await acquire(baseDir, name, opts);
  try { return await fn(); }
  finally { release(baseDir, name); }
}

module.exports = { acquire, release, withLock, tryAcquireOnce, lockFilePath };
