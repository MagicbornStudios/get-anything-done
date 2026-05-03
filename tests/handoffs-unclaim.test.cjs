'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const {
  parseFrontmatter,
  createHandoff,
  claimHandoff,
  readHandoff,
  unclaimHandoff,
  HandoffError,
} = require('../lib/handoffs.cjs');

describe('unclaimHandoff', () => {
  test('claim then unclaim resets claim metadata and appends unclaim_history', () => {
    const tmpDir = createTempDir('gad-handoffs-unclaim-');
    try {
      const created = createHandoff({
        baseDir: tmpDir,
        projectid: 'global',
        phase: '95',
        body: 'body',
        createdBy: 'team-w3',
      });
      claimHandoff({ baseDir: tmpDir, id: created.id, agent: 'team-w3' });

      const destPath = unclaimHandoff({
        baseDir: tmpDir,
        id: created.id,
        reason: 'rate-limit',
        by: 'team-w3',
      });

      assert.ok(destPath.endsWith(path.join('.planning', 'handoffs', 'open', `${created.id}.md`)));
      assert.ok(fs.existsSync(destPath));

      const result = readHandoff({ baseDir: tmpDir, id: created.id });
      assert.strictEqual(result.bucket, 'open');
      assert.strictEqual(result.frontmatter.claimed_by, '');
      assert.strictEqual(result.frontmatter.claimed_at, '');
      assert.ok(Array.isArray(result.frontmatter.unclaim_history));
      assert.strictEqual(result.frontmatter.unclaim_history.length, 1);
      assert.strictEqual(result.frontmatter.unclaim_history[0].reason, 'rate-limit');
      assert.strictEqual(result.frontmatter.unclaim_history[0].by, 'team-w3');
      assert.ok(result.frontmatter.unclaim_history[0].at);

      const rawText = fs.readFileSync(destPath, 'utf8');
      const { frontmatter } = parseFrontmatter(rawText);
      assert.deepStrictEqual(frontmatter.unclaim_history, result.frontmatter.unclaim_history);
    } finally {
      cleanup(tmpDir);
    }
  });

  test('refuses to unclaim a closed handoff', () => {
    const tmpDir = createTempDir('gad-handoffs-unclaim-');
    try {
      const closedDir = path.join(tmpDir, '.planning', 'handoffs', 'closed');
      fs.mkdirSync(closedDir, { recursive: true });
      const id = 'h-closed';
      fs.writeFileSync(
        path.join(closedDir, `${id}.md`),
        [
          '---',
          `id: ${id}`,
          'projectid: global',
          'phase: 95',
          'claimed_by: team-w3',
          'claimed_at: 2026-05-03T02:23:05.842Z',
          'completed_at: 2026-05-03T03:00:00.000Z',
          '---',
          '',
          'body',
        ].join('\n'),
        'utf8',
      );

      assert.throws(
        () => unclaimHandoff({ baseDir: tmpDir, id, reason: 'nope', by: 'team-w3' }),
        (error) => error instanceof HandoffError && error.code === 'HANDOFF_CLOSED',
      );
    } finally {
      cleanup(tmpDir);
    }
  });
});
