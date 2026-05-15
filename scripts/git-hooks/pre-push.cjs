#!/usr/bin/env node
// scripts/git-hooks/pre-push
//
// Pre-push protection hook (GLOBAL-T-233-11 + GLOBAL-T-233-12).
//
// Aborts the push if ANY of the following are true for the to-be-pushed range:
//   1. A blob size exceeds 50MB (GitHub warns at 50MB, hard-rejects at 100MB —
//      we cut at 50MB for margin).
//   2. A pushed path matches a banned-prefix (planning artifacts, build output,
//      cached dependencies — these should never reach the remote).
//   3. A blob's content matches one of a handful of high-confidence secret
//      patterns (Stripe live keys, AWS keys, Anthropic `sk-ant-*`, OpenAI
//      `sk-*`, generic Bearer tokens, RSA private-key headers).
//      Falls back to a built-in regex set; uses `trufflehog filesystem` if
//      installed on PATH for higher recall.
//   4. ANY submodule listed in `.gitmodules` is ahead of its upstream
//      (untracked commits will produce a 404 when the monorepo gitlink is
//      pushed and CI tries to fetch the SHA).
//
// Usage:
//   - Install via `scripts/git-hooks/install.sh` (POSIX) or `install.ps1`
//     (Windows). Both copy/symlink THIS file to `.git/hooks/pre-push`.
//   - Also runs in CI via `.github/workflows/repo-hygiene.yml` against the
//     PR/push range — same script, same logic, no drift.
//
// Inputs (git contract):
//   stdin: lines of "<local_ref> <local_sha> <remote_ref> <remote_sha>"
//   argv : [0]=node, [1]=this-script, [2]=remote_name, [3]=remote_url
//   When invoked outside of git (e.g. by CI), the wrapper passes a synthetic
//   range via REPO_HYGIENE_RANGE=<base>..<head> env var.
//
// Exit codes:
//   0 — all checks passed, push proceeds.
//   1 — at least one check failed, push aborted.
//   2 — internal error (e.g. node-side exception). Surfaced as failure.
//
// Bypass: `git push --no-verify` skips this hook. Do not do that.

'use strict';

const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_BLOB_BYTES = 50 * 1024 * 1024; // 50 MB
const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    return process.cwd();
  }
})();

// ---------------------------------------------------------------------------
// Banned path patterns. Glob-style; matched against repo-relative posix paths.
// Anchored anywhere unless the pattern starts with '/'.
// ---------------------------------------------------------------------------
const BANNED_PATTERNS = [
  '.planning/datasets/',
  '.planning/.trace-archive/',
  '.planning/.sessions/',
  '.planning/.presence/',
  '.planning/.gad-log/',
  'node_modules/',
  'dist/',
  '.next/',
  '.cache/',
  'target/release/',
  'target/debug/',
];

// Built-in secret regex set (used when trufflehog not on PATH).
// Tuned for high precision — false positives in commit history are very
// expensive, so we err toward fewer patterns with strong markers.
const SECRET_PATTERNS = [
  { name: 'stripe-live', re: /\b(sk|rk|pk)_live_[A-Za-z0-9]{16,}\b/ },
  { name: 'stripe-test', re: /\b(sk|rk)_test_[A-Za-z0-9]{24,}\b/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'aws-secret-key', re: /\baws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}\b/i },
  { name: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { name: 'openai-key', re: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'github-pat', re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: 'github-fine-grained', re: /\bgithub_pat_[A-Za-z0-9_]{82}\b/ },
  { name: 'rsa-private', re: /-----BEGIN (RSA |OPENSSH |DSA |EC |PGP )?PRIVATE KEY-----/ },
  { name: 'jwt-bearer', re: /\bBearer\s+ey[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function red(s) { return process.stderr.isTTY ? `\x1b[31m${s}\x1b[0m` : s; }
function yellow(s) { return process.stderr.isTTY ? `\x1b[33m${s}\x1b[0m` : s; }
function bold(s) { return process.stderr.isTTY ? `\x1b[1m${s}\x1b[0m` : s; }

function gitCapture(args, opts = {}) {
  const r = spawnSync('git', args, {
    cwd: opts.cwd || REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || '').toString().trim();
    const err = new Error(`git ${args.join(' ')} failed (exit ${r.status}): ${msg}`);
    err.exitCode = r.status;
    err.stderr = msg;
    throw err;
  }
  return r.stdout.toString();
}

function gitCaptureSoft(args, opts = {}) {
  try { return gitCapture(args, opts); } catch { return null; }
}

function matchesBanned(repoPath) {
  // repoPath uses '/' separators (git canonical).
  for (const pat of BANNED_PATTERNS) {
    if (pat.endsWith('/')) {
      if (repoPath.startsWith(pat) || repoPath.includes(`/${pat}`)) return pat;
    } else if (repoPath === pat || repoPath.endsWith(`/${pat}`)) {
      return pat;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Range resolution. stdin (real git pre-push) OR env override (CI/test).
// Returns array of { localSha, remoteSha } pairs to inspect.
// ---------------------------------------------------------------------------
async function readStdin() {
  if (process.env.REPO_HYGIENE_RANGE) {
    const [base, head] = process.env.REPO_HYGIENE_RANGE.split('..');
    return [{
      localRef: 'HEAD',
      localSha: head || 'HEAD',
      remoteRef: 'refs/heads/main',
      remoteSha: base || '',
    }];
  }
  if (process.stdin.isTTY) {
    // No stdin — invoked manually. Compare HEAD against upstream if set.
    const upstream = gitCaptureSoft(['rev-parse', '--abbrev-ref', '@{u}']);
    if (!upstream) return [];
    const remoteSha = gitCaptureSoft(['rev-parse', upstream.trim()]) || '';
    return [{
      localRef: 'HEAD',
      localSha: gitCapture(['rev-parse', 'HEAD']).trim(),
      remoteRef: upstream.trim(),
      remoteSha: remoteSha.trim(),
    }];
  }
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) return resolve([]);
      const refs = text.split(/\r?\n/).map((line) => {
        const [localRef, localSha, remoteRef, remoteSha] = line.split(/\s+/);
        return { localRef, localSha, remoteRef, remoteSha };
      });
      resolve(refs);
    });
  });
}

// ---------------------------------------------------------------------------
// Enumerate (sha, path, size, ...content-loader) for every object newly
// introduced by the local side of the push.
// ---------------------------------------------------------------------------
function enumerateNewObjects(refs) {
  const zero = '0000000000000000000000000000000000000000';
  const out = []; // { mode, type, sha, size, path }

  for (const { localSha, remoteSha } of refs) {
    if (!localSha || localSha === zero) continue;

    let range;
    if (!remoteSha || remoteSha === zero) {
      // New branch — diff against default remote refs to avoid scanning all history.
      const remotes = gitCaptureSoft(['for-each-ref', '--format=%(refname)', 'refs/remotes/']);
      const remoteRefs = (remotes || '').trim().split(/\r?\n/).filter(Boolean);
      const excludes = remoteRefs.map((r) => `^${r}`).join(' ');
      range = excludes ? `${localSha} ${excludes}` : localSha;
    } else {
      range = `${remoteSha}..${localSha}`;
    }

    // git rev-list --objects walks all blobs introduced.
    const lsArgs = ['rev-list', '--objects', ...range.split(' ')];
    let listing;
    try {
      listing = gitCapture(lsArgs);
    } catch (err) {
      // Often "Invalid symmetric difference expression" when remote-side
      // history isn't local. Fall back to scanning the local sha only.
      listing = gitCaptureSoft(['rev-list', '--objects', localSha]) || '';
    }

    // For each line: "<sha> [<path>]"
    const lines = listing.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) continue;

    // Batch git cat-file --batch-check to resolve types + sizes.
    const checkInput = lines.map((l) => l.split(/\s+/, 1)[0]).join('\n') + '\n';
    const check = spawnSync(
      'git',
      ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
      { input: checkInput, encoding: 'utf8', cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 },
    );
    if (check.status !== 0) continue;

    const meta = new Map();
    for (const line of check.stdout.split(/\r?\n/)) {
      const [sha, type, size] = line.split(/\s+/);
      if (sha) meta.set(sha, { type, size: Number(size) });
    }

    for (const line of lines) {
      const [sha, ...pathParts] = line.split(/\s+/);
      const objPath = pathParts.join(' ');
      const info = meta.get(sha);
      if (!info || info.type !== 'blob') continue;
      out.push({ sha, path: objPath || '', size: info.size });
    }
  }

  // Dedupe by sha.
  const seen = new Set();
  return out.filter((o) => {
    if (seen.has(o.sha)) return false;
    seen.add(o.sha);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Check 1: blob size limit.
// ---------------------------------------------------------------------------
function checkBlobSizes(objects, errors) {
  for (const o of objects) {
    if (o.size > MAX_BLOB_BYTES) {
      const mb = (o.size / 1024 / 1024).toFixed(1);
      errors.push({
        kind: 'oversized-blob',
        msg: `${o.path || '(no path)'} is ${mb} MB (> 50 MB). GitHub will reject at 100 MB. Sha: ${o.sha.slice(0, 10)}`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 2: banned paths.
// ---------------------------------------------------------------------------
function checkBannedPaths(objects, errors) {
  for (const o of objects) {
    if (!o.path) continue;
    const banned = matchesBanned(o.path);
    if (banned) {
      errors.push({
        kind: 'banned-path',
        msg: `${o.path} matches banned pattern "${banned}". This directory should never be pushed.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3: secret scanning. Try trufflehog first; fall back to regex.
// ---------------------------------------------------------------------------
function hasTruffleHog() {
  const r = spawnSync('trufflehog', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function scanWithTruffleHog(refs, errors) {
  // trufflehog git --since-commit <remote> file://<root> --json
  // Run per-ref; collect findings.
  for (const { localSha, remoteSha } of refs) {
    if (!localSha) continue;
    const args = ['git', `file://${REPO_ROOT}`, '--json', '--no-update'];
    if (remoteSha && remoteSha !== '0000000000000000000000000000000000000000') {
      args.push('--since-commit', remoteSha);
    }
    const r = spawnSync('trufflehog', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (r.status === 0 || r.status === 1) {
      const out = (r.stdout || '').split(/\r?\n/).filter(Boolean);
      for (const line of out) {
        try {
          const o = JSON.parse(line);
          if (o.Verified || o.DetectorName) {
            errors.push({
              kind: 'secret',
              msg: `Possible ${o.DetectorName || 'secret'} in ${o.SourceMetadata?.Data?.Git?.file || '(unknown)'} (commit ${(o.SourceMetadata?.Data?.Git?.commit || '').slice(0, 10)})`,
            });
          }
        } catch { /* non-JSON line, skip */ }
      }
    }
  }
}

function scanWithRegex(objects, errors) {
  // Stream blob content via git cat-file --batch. Only scan blobs <= 2MB
  // — secrets in larger files are exceedingly rare and full scan is slow.
  const SCAN_LIMIT = 2 * 1024 * 1024;
  const candidates = objects.filter((o) => o.size > 0 && o.size <= SCAN_LIMIT);
  if (candidates.length === 0) return;

  const input = candidates.map((o) => o.sha).join('\n') + '\n';
  // Omit `encoding` so stdout/stderr come back as Buffer (default behavior).
  // 'buffer' as a string is NOT a valid encoding name in modern node and
  // throws ERR_UNKNOWN_ENCODING.
  const r = spawnSync('git', ['cat-file', '--batch'], {
    input,
    cwd: REPO_ROOT,
    maxBuffer: 512 * 1024 * 1024,
  });
  if (r.status !== 0) return;

  // Parse the streamed output: "<sha> <type> <size>\n<content>\n" per object.
  const buf = r.stdout;
  let pos = 0;
  let i = 0;
  while (pos < buf.length && i < candidates.length) {
    const headerEnd = buf.indexOf(0x0a, pos); // \n
    if (headerEnd < 0) break;
    const header = buf.slice(pos, headerEnd).toString('utf8');
    const [sha, type, sizeStr] = header.split(/\s+/);
    pos = headerEnd + 1;
    if (type !== 'blob') {
      // missing/invalid object; skip
      i += 1;
      continue;
    }
    const size = Number(sizeStr);
    const content = buf.slice(pos, pos + size).toString('utf8');
    pos += size + 1; // skip trailing newline
    const obj = candidates[i];
    i += 1;
    if (obj.sha !== sha) continue; // mis-aligned; bail this entry

    for (const { name, re } of SECRET_PATTERNS) {
      const m = content.match(re);
      if (m) {
        errors.push({
          kind: 'secret',
          msg: `${obj.path || obj.sha.slice(0, 10)} contains a value matching ${name} (regex hit on "${m[0].slice(0, 24)}...")`,
        });
        break; // one finding per blob is enough
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: submodule rot. For every .gitmodules entry, ensure HEAD is not
// ahead of @{upstream}. Skip submodules without upstream configured.
// ---------------------------------------------------------------------------
function readGitmodules() {
  const file = path.join(REPO_ROOT, '.gitmodules');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const entries = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('[submodule')) {
      if (current) entries.push(current);
      current = { name: line.match(/"([^"]+)"/)?.[1] || '' };
    } else if (current && line.includes('=')) {
      const [k, ...rest] = line.split('=');
      current[k.trim()] = rest.join('=').trim();
    }
  }
  if (current) entries.push(current);
  return entries;
}

function checkSubmoduleRot(errors) {
  const entries = readGitmodules();
  for (const sm of entries) {
    if (!sm.path) continue;
    const abs = path.join(REPO_ROOT, sm.path);
    if (!fs.existsSync(path.join(abs, '.git'))) {
      // Submodule not initialized — not our problem to flag here.
      continue;
    }
    const upstream = gitCaptureSoft(['rev-parse', '--abbrev-ref', '@{upstream}'], { cwd: abs });
    if (!upstream) {
      // No upstream configured. Skip — could be intentional (local fork).
      continue;
    }
    const aheadOut = gitCaptureSoft(
      ['rev-list', '--count', '@{upstream}..HEAD'],
      { cwd: abs },
    );
    if (!aheadOut) continue;
    const ahead = Number(aheadOut.trim());
    if (ahead > 0) {
      errors.push({
        kind: 'submodule-rot',
        msg: `Submodule ${sm.path} has ${ahead} unpushed commit(s) (upstream ${upstream.trim()}). Push the submodule first OR move the gitlink to a SHA on the upstream remote.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const refs = await readStdin();
  if (refs.length === 0) {
    // No refs to push (delete-only, or detached). Pass-through.
    return 0;
  }

  const errors = [];

  // Object-walk for checks 1-3.
  let objects = [];
  try {
    objects = enumerateNewObjects(refs);
  } catch (err) {
    process.stderr.write(yellow(`[repo-hygiene] could not enumerate objects: ${err.message}\n`));
  }

  checkBlobSizes(objects, errors);
  checkBannedPaths(objects, errors);

  if (process.env.REPO_HYGIENE_SKIP_SECRETS !== '1') {
    if (hasTruffleHog()) {
      scanWithTruffleHog(refs, errors);
    } else {
      scanWithRegex(objects, errors);
    }
  }

  // Submodule rot is always checked.
  checkSubmoduleRot(errors);

  if (errors.length > 0) {
    process.stderr.write(red(bold('\n[repo-hygiene] PUSH BLOCKED — fix the issues below.\n\n')));
    // Group by kind for readability.
    const byKind = {};
    for (const e of errors) {
      (byKind[e.kind] = byKind[e.kind] || []).push(e);
    }
    for (const kind of Object.keys(byKind)) {
      process.stderr.write(bold(`  ${kind} (${byKind[kind].length}):\n`));
      for (const e of byKind[kind].slice(0, 20)) {
        process.stderr.write(`    - ${e.msg}\n`);
      }
      if (byKind[kind].length > 20) {
        process.stderr.write(`    ... and ${byKind[kind].length - 20} more.\n`);
      }
      process.stderr.write('\n');
    }
    process.stderr.write(yellow('To bypass (NOT RECOMMENDED): git push --no-verify\n'));
    return 1;
  }

  process.stderr.write(`[repo-hygiene] OK — ${objects.length} object(s) scanned, no issues.\n`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(red(`[repo-hygiene] internal error: ${err.stack || err.message}\n`));
    process.exit(2);
  },
);
