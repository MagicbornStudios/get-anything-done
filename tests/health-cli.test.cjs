// Tests for `gad health` (task 63-health-cli).
// Drives the CLI end-to-end against a scratch repo so the assertions
// catch regressions in command wiring, on-disk worktree discovery,
// JSON output shape, and dry-run safety semantics.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const gadBin = path.join(repoRoot, 'bin', 'gad.cjs');

function runGad(args, opts = {}) {
  // Use the source CLI (node bin/gad.cjs) so tests don't depend on the
  // compiled bun binary being present.
  const out = execFileSync(process.execPath, [gadBin, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: opts.timeout || 15000,
    cwd: opts.cwd || process.cwd(),
    env: opts.env || process.env,
  });
  return out;
}

function makeScratchRepo() {
  // Minimal repo skeleton: enough for findRepoRoot() to anchor here +
  // for the on-disk worktree scanner to find leftover agent dirs.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-health-test-'));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'config.json'), '{}');
  return root;
}

describe('gad health (63-health-cli)', () => {
  test('health --help lists all three subcommands', () => {
    const out = runGad(['health', '--help']);
    assert.match(out, /\bdisk\b/);
    assert.match(out, /\bprune\b/);
    assert.match(out, /\bcaches\b/);
  });

  test('health disk --json reports root + free space + hogs array', () => {
    const root = makeScratchRepo();
    try {
      const out = runGad(['health', 'disk', '--json', '--top', '3'], { cwd: root });
      const parsed = JSON.parse(out);
      assert.equal(typeof parsed.root, 'string');
      assert.equal(parsed.root, fs.realpathSync(root));
      assert.ok('free' in parsed, 'free key present');
      assert.ok(Array.isArray(parsed.hogs), 'hogs is an array');
      // Empty scratch has no hot dirs, so hogs is just []
      assert.equal(parsed.hogs.length, 0);
      assert.equal(typeof parsed.scanned, 'number');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('health caches --json defaults to dry-run', () => {
    const root = makeScratchRepo();
    // Plant a fake .next so the candidate list is non-empty.
    const fakeNext = path.join(root, 'apps', 'portfolio', '.next');
    fs.mkdirSync(fakeNext, { recursive: true });
    fs.writeFileSync(path.join(fakeNext, 'BUILD_ID'), 'abc');
    try {
      const out = runGad(['health', 'caches', '--json'], { cwd: root });
      const parsed = JSON.parse(out);
      assert.equal(parsed.willRemove, false, 'default is dry-run, willRemove=false');
      assert.ok(Array.isArray(parsed.candidates));
      const labels = parsed.candidates.map(c => c.label);
      assert.ok(labels.includes('apps/portfolio/.next'), 'fake .next was discovered');
      // Dry-run must not delete the dir.
      assert.equal(fs.existsSync(fakeNext), true, 'fake .next survived dry-run');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('health caches --remove actually deletes the candidate', () => {
    const root = makeScratchRepo();
    const fakeCache = path.join(root, 'node_modules', '.cache');
    fs.mkdirSync(fakeCache, { recursive: true });
    fs.writeFileSync(path.join(fakeCache, 'junk'), 'x'.repeat(1024));
    try {
      const out = runGad(['health', 'caches', '--remove', '--json'], { cwd: root });
      const parsed = JSON.parse(out);
      assert.equal(parsed.willRemove, true);
      assert.ok(parsed.candidates.length >= 1);
      assert.equal(fs.existsSync(fakeCache), false, 'cache directory removed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('health prune --worktrees --dry-run is safe with no candidates', () => {
    const root = makeScratchRepo();
    try {
      const out = runGad(['health', 'prune', '--worktrees', '--dry-run', '--json'], { cwd: root });
      const parsed = JSON.parse(out);
      assert.ok(Array.isArray(parsed.candidates));
      assert.equal(parsed.dryRun, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('health prune --worktrees discovers unregistered .claude/worktrees/agent-* dirs', () => {
    // Validates the gap behind 63-health-cli motivation: leftover agent
    // worktree dirs that git does not know about must surface here.
    const root = makeScratchRepo();
    const stale = path.join(root, '.claude', 'worktrees', 'agent-stale-001');
    fs.mkdirSync(stale, { recursive: true });
    fs.writeFileSync(path.join(stale, 'README'), 'stale worktree');
    // Backdate to 4 days so it crosses the default 3d threshold.
    const fourDaysAgo = Date.now() - 4 * 24 * 3600 * 1000;
    fs.utimesSync(stale, fourDaysAgo / 1000, fourDaysAgo / 1000);
    try {
      const out = runGad(
        ['health', 'prune', '--worktrees', '--dry-run', '--json', '--older-than', '3d'],
        { cwd: root },
      );
      const parsed = JSON.parse(out);
      const match = parsed.candidates.find(c => c.path.includes('agent-stale-001'));
      assert.ok(match, 'unregistered agent worktree surfaced as a prune candidate');
      assert.equal(match.unregistered, true);
      // Dry-run must NOT delete the dir.
      assert.equal(fs.existsSync(stale), true, 'dry-run preserved the unregistered dir');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('worktree list also surfaces unregistered agent dirs', () => {
    const root = makeScratchRepo();
    const stale = path.join(root, '.claude', 'worktrees', 'agent-listed-002');
    fs.mkdirSync(stale, { recursive: true });
    try {
      const out = runGad(['worktree', 'list', '--json'], { cwd: root });
      const parsed = JSON.parse(out);
      const match = parsed.find(w => w.path && w.path.includes('agent-listed-002'));
      assert.ok(match, 'unregistered worktree appears in `worktree list --json`');
      assert.equal(match.unregistered, true);
      assert.equal(match.isAgent, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
