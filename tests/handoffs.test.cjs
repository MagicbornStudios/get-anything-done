'use strict';
/**
 * handoffs.test.cjs — unit tests for lib/handoffs.cjs.
 *
 * Pure tests — injectable fsImpl fake, no real disk access.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const {
  HandoffError,
  parseFrontmatter,
  stringifyFrontmatter,
  listHandoffs,
  readHandoff,
  claimHandoff,
  completeHandoff,
  createHandoff,
} = require('../lib/handoffs.cjs');

// ---------------------------------------------------------------------------
// fs fake
// ---------------------------------------------------------------------------

function makeFsFake(files = {}) {
  // files: { '/abs/path/to/file.md': 'content', ... }
  const store = Object.assign({}, files);
  return {
    store,
    readdirSync(dir) {
      const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
      const names = [];
      for (const p of Object.keys(store)) {
        if (p.startsWith(prefix)) {
          const rest = p.slice(prefix.length);
          if (!rest.includes(path.sep)) names.push(rest);
        }
      }
      if (names.length === 0 && !Object.keys(store).some(p => p.startsWith(prefix))) {
        const err = Object.assign(new Error('ENOENT: ' + dir), { code: 'ENOENT' });
        throw err;
      }
      return names;
    },
    readFileSync(p) {
      if (!(p in store)) {
        const err = Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
        throw err;
      }
      return store[p];
    },
    writeFileSync(p, data) { store[p] = data; },
    renameSync(src, dest) {
      if (!(src in store)) throw Object.assign(new Error('ENOENT: ' + src), { code: 'ENOENT' });
      store[dest] = store[src];
      delete store[src];
    },
    mkdirSync() { /* no-op in fake */ },
    existsSync(p) { return p in store; },
  };
}

// ---------------------------------------------------------------------------
// Sample handoff content
// ---------------------------------------------------------------------------

const BASE_DIR = '/repo';

function openPath(id) {
  return path.join(BASE_DIR, '.planning', 'handoffs', 'open', `${id}.md`);
}
function claimedPath(id) {
  return path.join(BASE_DIR, '.planning', 'handoffs', 'claimed', `${id}.md`);
}
function closedPath(id) {
  return path.join(BASE_DIR, '.planning', 'handoffs', 'closed', `${id}.md`);
}

function makeHandoffText(id, { projectid = 'gad', phase = '60', priority = 'normal', estimatedContext = 'mechanical', claimedBy = null, claimedAt = null, completedAt = null, runtimePreference = null } = {}) {
  const lines = [
    '---',
    `id: ${id}`,
    `projectid: ${projectid}`,
    `phase: ${phase}`,
    `task_id: null`,
    `created_at: 2026-04-18T10:00:00.000Z`,
    `created_by: claude-opus-4-7`,
    `claimed_by: ${claimedBy === null ? 'null' : claimedBy}`,
    `claimed_at: ${claimedAt === null ? 'null' : claimedAt}`,
    `completed_at: ${completedAt === null ? 'null' : completedAt}`,
    `priority: ${priority}`,
    `estimated_context: ${estimatedContext}`,
  ];
  if (runtimePreference) lines.push(`runtime_preference: ${runtimePreference}`);
  lines.push('---');
  lines.push('');
  lines.push('# Body text\n\nSome handoff details here.');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// parseFrontmatter / stringifyFrontmatter round-trip
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  test('parses frontmatter and body correctly', () => {
    const text = '---\nid: h-123\nprojectid: gad\npriority: high\n---\n\n# Body\n\nContent here.';
    const { frontmatter, body } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.id, 'h-123');
    assert.strictEqual(frontmatter.projectid, 'gad');
    assert.strictEqual(frontmatter.priority, 'high');
    assert.match(body, /# Body/);
  });

  test('null values parsed as null (not string "null")', () => {
    const text = '---\nclaimed_by: null\nclaimed_at: null\n---\n';
    const { frontmatter } = parseFrontmatter(text);
    assert.strictEqual(frontmatter.claimed_by, null);
    assert.strictEqual(frontmatter.claimed_at, null);
  });

  test('handles text without frontmatter', () => {
    const text = 'Just body text.';
    const { frontmatter, body } = parseFrontmatter(text);
    assert.deepStrictEqual(frontmatter, {});
    assert.strictEqual(body, 'Just body text.');
  });
});

describe('stringifyFrontmatter', () => {
  test('produces --- delimited frontmatter', () => {
    const out = stringifyFrontmatter({ id: 'h-123', priority: 'high', claimed_by: null }, '# Body\n');
    assert.ok(out.startsWith('---\n'));
    assert.match(out, /id: h-123/);
    assert.match(out, /claimed_by: null/);
    assert.match(out, /# Body/);
  });
});

describe('parseFrontmatter / stringifyFrontmatter round-trip', () => {
  test('parse → stringify → parse yields same data', () => {
    const original = {
      id: 'h-test-roundtrip',
      projectid: 'gad',
      phase: '60',
      task_id: null,
      priority: 'normal',
      estimated_context: 'mechanical',
      claimed_by: null,
      claimed_at: null,
      completed_at: null,
    };
    const body = '# My handoff\n\nDo the thing.\n';
    const text = stringifyFrontmatter(original, body);
    const { frontmatter: parsed, body: parsedBody } = parseFrontmatter(text);
    assert.strictEqual(parsed.id, original.id);
    assert.strictEqual(parsed.projectid, original.projectid);
    assert.strictEqual(parsed.priority, original.priority);
    assert.strictEqual(parsed.claimed_by, null);
    assert.strictEqual(parsedBody, body);
  });
});

// ---------------------------------------------------------------------------
// listHandoffs
// ---------------------------------------------------------------------------

describe('listHandoffs: filter by bucket', () => {
  test('default bucket=open returns only open handoffs', () => {
    const fake = makeFsFake({
      [openPath('h-open-1')]: makeHandoffText('h-open-1', { projectid: 'gad' }),
      [claimedPath('h-claimed-1')]: makeHandoffText('h-claimed-1', { projectid: 'gad', claimedBy: 'claude' }),
    });
    const results = listHandoffs({ baseDir: BASE_DIR, bucket: 'open', fsImpl: fake });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'h-open-1');
    assert.strictEqual(results[0].bucket, 'open');
  });

  test('bucket=claimed returns only claimed handoffs', () => {
    const fake = makeFsFake({
      [openPath('h-open-1')]: makeHandoffText('h-open-1'),
      [claimedPath('h-claimed-1')]: makeHandoffText('h-claimed-1', { claimedBy: 'claude' }),
    });
    const results = listHandoffs({ baseDir: BASE_DIR, bucket: 'claimed', fsImpl: fake });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'h-claimed-1');
  });

  test('bucket=all returns handoffs from all buckets', () => {
    const fake = makeFsFake({
      [openPath('h-open-1')]: makeHandoffText('h-open-1'),
      [claimedPath('h-claimed-1')]: makeHandoffText('h-claimed-1', { claimedBy: 'claude' }),
      [closedPath('h-closed-1')]: makeHandoffText('h-closed-1', { completedAt: '2026-04-18T12:00:00Z' }),
    });
    const results = listHandoffs({ baseDir: BASE_DIR, bucket: 'all', fsImpl: fake });
    assert.strictEqual(results.length, 3);
  });
});

describe('listHandoffs: filter by projectid', () => {
  test('filters by projectid frontmatter', () => {
    const fake = makeFsFake({
      [openPath('h-gad-1')]: makeHandoffText('h-gad-1', { projectid: 'get-anything-done' }),
      [openPath('h-other-1')]: makeHandoffText('h-other-1', { projectid: 'other-project' }),
    });
    const results = listHandoffs({ baseDir: BASE_DIR, projectid: 'get-anything-done', fsImpl: fake });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].frontmatter.projectid, 'get-anything-done');
  });
});

describe('listHandoffs: mineFirst ordering', () => {
  test('mineFirst=true sorts matching runtime_preference to top', () => {
    const fake = makeFsFake({
      [openPath('h-other')]: makeHandoffText('h-other', { runtimePreference: 'codex' }),
      [openPath('h-mine')]: makeHandoffText('h-mine', { runtimePreference: 'claude-code' }),
    });
    const results = listHandoffs({ baseDir: BASE_DIR, mineFirst: true, runtime: 'claude-code', fsImpl: fake });
    assert.strictEqual(results[0].id, 'h-mine');
  });
});

// ---------------------------------------------------------------------------
// readHandoff
// ---------------------------------------------------------------------------

describe('readHandoff', () => {
  test('reads handoff from open bucket', () => {
    const id = 'h-read-test';
    const fake = makeFsFake({
      [openPath(id)]: makeHandoffText(id, { projectid: 'gad', priority: 'high' }),
    });
    const { frontmatter, body } = readHandoff({ baseDir: BASE_DIR, id, fsImpl: fake });
    assert.strictEqual(frontmatter.id, id);
    assert.strictEqual(frontmatter.priority, 'high');
    assert.match(body, /Body text/);
  });

  test('reads handoff from claimed bucket', () => {
    const id = 'h-claimed-read';
    const fake = makeFsFake({
      [claimedPath(id)]: makeHandoffText(id, { claimedBy: 'claude' }),
    });
    const result = readHandoff({ baseDir: BASE_DIR, id, fsImpl: fake });
    assert.strictEqual(result.bucket, 'claimed');
  });

  test('throws HANDOFF_NOT_FOUND for missing id', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => readHandoff({ baseDir: BASE_DIR, id: 'h-missing', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'HANDOFF_NOT_FOUND',
    );
  });
});

// ---------------------------------------------------------------------------
// claimHandoff
// ---------------------------------------------------------------------------

describe('claimHandoff', () => {
  test('happy path: moves file open→claimed and rewrites frontmatter', () => {
    const id = 'h-claim-me';
    const fake = makeFsFake({
      [openPath(id)]: makeHandoffText(id),
    });
    const destPath = claimHandoff({ baseDir: BASE_DIR, id, agent: 'claude-code', fsImpl: fake });
    // Source gone, dest present
    assert.ok(!fake.existsSync(openPath(id)));
    assert.ok(fake.existsSync(destPath));
    // Frontmatter updated
    const { frontmatter } = parseFrontmatter(fake.readFileSync(destPath));
    assert.strictEqual(frontmatter.claimed_by, 'claude-code');
    assert.ok(frontmatter.claimed_at && frontmatter.claimed_at !== 'null');
  });

  test('ALREADY_CLAIMED when file is already in claimed/', () => {
    const id = 'h-already-claimed';
    const fake = makeFsFake({
      [claimedPath(id)]: makeHandoffText(id, { claimedBy: 'codex' }),
    });
    assert.throws(
      () => claimHandoff({ baseDir: BASE_DIR, id, agent: 'claude-code', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'ALREADY_CLAIMED',
    );
  });

  test('HANDOFF_NOT_FOUND when file does not exist', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => claimHandoff({ baseDir: BASE_DIR, id: 'h-missing', agent: 'claude-code', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'HANDOFF_NOT_FOUND',
    );
  });
});

// ---------------------------------------------------------------------------
// completeHandoff
// ---------------------------------------------------------------------------

describe('completeHandoff', () => {
  test('happy path: moves file claimed→closed and sets completed_at', () => {
    const id = 'h-complete-me';
    const fake = makeFsFake({
      [claimedPath(id)]: makeHandoffText(id, { claimedBy: 'claude-code' }),
    });
    const destPath = completeHandoff({ baseDir: BASE_DIR, id, fsImpl: fake });
    assert.ok(!fake.existsSync(claimedPath(id)));
    assert.ok(fake.existsSync(destPath));
    const { frontmatter } = parseFrontmatter(fake.readFileSync(destPath));
    assert.ok(frontmatter.completed_at && frontmatter.completed_at !== 'null');
  });

  test('HANDOFF_NOT_FOUND when file is missing entirely', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => completeHandoff({ baseDir: BASE_DIR, id: 'h-missing', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'HANDOFF_NOT_FOUND',
    );
  });

  test('HANDOFF_NOT_FOUND when file is in open, not claimed', () => {
    const id = 'h-open-not-claimed';
    const fake = makeFsFake({
      [openPath(id)]: makeHandoffText(id),
    });
    assert.throws(
      () => completeHandoff({ baseDir: BASE_DIR, id, fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'HANDOFF_NOT_FOUND',
    );
  });
});

// ---------------------------------------------------------------------------
// createHandoff
// ---------------------------------------------------------------------------

describe('createHandoff', () => {
  test('writes file with all required frontmatter fields in open/', () => {
    const fake = makeFsFake({});
    const result = createHandoff({
      baseDir: BASE_DIR,
      projectid: 'get-anything-done',
      phase: '60',
      taskId: '60-09',
      priority: 'normal',
      estimatedContext: 'mechanical',
      body: '# My handoff\n\nDo this.',
      createdBy: 'claude-code',
      fsImpl: fake,
    });

    assert.ok(result.id.startsWith('h-'));
    assert.ok(result.filePath.includes('open'));
    assert.ok(fake.existsSync(result.filePath));

    const { frontmatter, body } = parseFrontmatter(fake.readFileSync(result.filePath));
    assert.strictEqual(frontmatter.projectid, 'get-anything-done');
    assert.strictEqual(frontmatter.phase, '60');
    assert.strictEqual(frontmatter.task_id, '60-09');
    assert.strictEqual(frontmatter.priority, 'normal');
    assert.strictEqual(frontmatter.estimated_context, 'mechanical');
    assert.strictEqual(frontmatter.created_by, 'claude-code');
    assert.strictEqual(frontmatter.claimed_by, null);
    assert.strictEqual(frontmatter.claimed_at, null);
    assert.strictEqual(frontmatter.completed_at, null);
    assert.ok(frontmatter.created_at);
    assert.match(body, /My handoff/);
  });

  test('path follows naming convention: h-<timestamp>-<projectid>-<phase>', () => {
    const fake = makeFsFake({});
    const result = createHandoff({
      baseDir: BASE_DIR,
      projectid: 'gad',
      phase: '42.4',
      body: 'content',
      fsImpl: fake,
    });
    // id starts with h- and contains the projectid
    assert.match(result.id, /^h-/);
    assert.match(result.id, /gad/);
    assert.match(result.id, /42-4/); // dots → dashes
  });

  test('optional runtimePreference written when provided', () => {
    const fake = makeFsFake({});
    const result = createHandoff({
      baseDir: BASE_DIR,
      projectid: 'gad',
      phase: '60',
      body: 'content',
      runtimePreference: 'claude-code',
      fsImpl: fake,
    });
    const { frontmatter } = parseFrontmatter(fake.readFileSync(result.filePath));
    assert.strictEqual(frontmatter.runtime_preference, 'claude-code');
  });

  test('VALIDATION_FAILED when projectid missing', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => createHandoff({ baseDir: BASE_DIR, phase: '60', body: 'x', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'VALIDATION_FAILED',
    );
  });

  test('VALIDATION_FAILED when body missing', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => createHandoff({ baseDir: BASE_DIR, projectid: 'gad', phase: '60', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'VALIDATION_FAILED',
    );
  });

  test('VALIDATION_FAILED for invalid priority', () => {
    const fake = makeFsFake({});
    assert.throws(
      () => createHandoff({ baseDir: BASE_DIR, projectid: 'gad', phase: '60', body: 'x', priority: 'urgent', fsImpl: fake }),
      (e) => e instanceof HandoffError && e.code === 'VALIDATION_FAILED',
    );
  });
});
