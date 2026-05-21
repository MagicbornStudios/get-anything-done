'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const {
  createHandoff,
  claimHandoff,
  readHandoff,
} = require('../lib/handoffs.cjs');
const { reclaimStaleClaims } = require('../lib/handoffs-reclaim.cjs');

function writeWorkerStatus(baseDir, workerId, status) {
  const dir = path.join(baseDir, '.planning', 'team', 'workers', workerId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2), 'utf8');
}

function backdateClaim(baseDir, id, isoTs) {
  const filePath = path.join(baseDir, '.planning', 'handoffs', 'claimed', `${id}.md`);
  const text = fs.readFileSync(filePath, 'utf8');
  const updated = text.replace(/^claimed_at:.*$/m, `claimed_at: ${isoTs}`);
  fs.writeFileSync(filePath, updated, 'utf8');
}

describe('reclaimStaleClaims', () => {
  test('stale claim by a STOPPED team worker is reclaimed', () => {
    const tmpDir = createTempDir('gad-reclaim-stopped-');
    try {
      // Worker w7 stopped 1 day ago.
      writeWorkerStatus(tmpDir, 'w7', {
        id: 'w7',
        runtime: 'codex-cli',
        state: 'STOPPED',
        last_heartbeat: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        stopped_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
        current_ref: null,
      });

      // Make a handoff and claim it as team-w7.
      const created = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '99',
        body: 'stale work',
        createdBy: 'team-w7',
      });
      claimHandoff({ baseDir: tmpDir, id: created.id, agent: 'team-w7' });

      // Backdate beyond the default 90s threshold.
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      backdateClaim(tmpDir, created.id, twoMinutesAgo);

      const result = reclaimStaleClaims({ baseDir: tmpDir });

      assert.strictEqual(result.reclaimed.length, 1, 'one handoff should have been reclaimed');
      assert.strictEqual(result.skipped.length, 0, 'no skips expected');
      assert.strictEqual(result.reclaimed[0].id, created.id);
      assert.strictEqual(result.reclaimed[0].claimer, 'team-w7');
      assert.match(result.reclaimed[0].evidence, /STOPPED/);

      // Handoff should now be back in open/, claim metadata cleared.
      const after = readHandoff({ baseDir: tmpDir, id: created.id });
      assert.strictEqual(after.bucket, 'open');
      assert.strictEqual(after.frontmatter.claimed_by, '');
      assert.strictEqual(after.frontmatter.claimed_at, '');
      assert.ok(Array.isArray(after.frontmatter.unclaim_history));
      assert.strictEqual(after.frontmatter.unclaim_history.length, 1);
      assert.strictEqual(after.frontmatter.unclaim_history[0].reason, 'orphaned-claim');
      assert.strictEqual(after.frontmatter.unclaim_history[0].by, 'reclaim-sweeper');
      const secondPass = reclaimStaleClaims({ baseDir: tmpDir });
      assert.strictEqual(secondPass.reclaimed.length, 0, 'second sweep should be a no-op');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('recent claim (< staleAfter) by an alive team worker is skipped', () => {
    const tmpDir = createTempDir('gad-reclaim-alive-');
    try {
      // Worker w8 is WORKING with a fresh heartbeat.
      writeWorkerStatus(tmpDir, 'w8', {
        id: 'w8',
        runtime: 'claude-code',
        state: 'WORKING',
        last_heartbeat: new Date(Date.now() - 30 * 1000).toISOString(),
        current_ref: 'something-else',
      });

      const created = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '99',
        body: 'fresh work',
        createdBy: 'team-w8',
      });
      claimHandoff({ baseDir: tmpDir, id: created.id, agent: 'team-w8' });

      // No backdating — claim is seconds old, well under default 6h threshold.
      const result = reclaimStaleClaims({ baseDir: tmpDir });

      assert.strictEqual(result.reclaimed.length, 0, 'nothing should be reclaimed');
      assert.strictEqual(result.skipped.length, 1, 'one skip expected');
      assert.strictEqual(result.skipped[0].id, created.id);
      assert.match(result.skipped[0].reason, /not-stale/);

      // Handoff stays in claimed/.
      const after = readHandoff({ baseDir: tmpDir, id: created.id });
      assert.strictEqual(after.bucket, 'claimed');
      assert.strictEqual(after.frontmatter.claimed_by, 'team-w8');
    } finally {
      cleanup(tmpDir);
    }
  });

  test('dry-run does not move files', () => {
    const tmpDir = createTempDir('gad-reclaim-dryrun-');
    try {
      writeWorkerStatus(tmpDir, 'w9', {
        id: 'w9',
        state: 'STOPPED',
        last_heartbeat: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        current_ref: null,
      });

      const created = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '99',
        body: 'dry-run target',
        createdBy: 'team-w9',
      });
      claimHandoff({ baseDir: tmpDir, id: created.id, agent: 'team-w9' });
      backdateClaim(tmpDir, created.id, new Date(Date.now() - 2 * 60 * 1000).toISOString());

      const result = reclaimStaleClaims({ baseDir: tmpDir, dryRun: true });

      assert.strictEqual(result.reclaimed.length, 1);
      assert.strictEqual(result.reclaimed[0].dry_run, true);

      // File still in claimed/.
      const after = readHandoff({ baseDir: tmpDir, id: created.id });
      assert.strictEqual(after.bucket, 'claimed');
    } finally {
      cleanup(tmpDir);
    }
  });
});
