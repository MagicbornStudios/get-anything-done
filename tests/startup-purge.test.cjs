/**
 * startup-purge.test.cjs — unit tests for lib/startup-purge.cjs (task 60-05a).
 *
 * Tests run with pure fakes for `fs.existsSync` / `fs.readdirSync` and a
 * fake lifecycle whose `purgeExpired` is scripted. No real FS, no real
 * envelopes.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  listProjectEnvelopes,
  purgeExpiredAllProjects,
  renderStartupPurgeSummary,
} = require('../lib/startup-purge.cjs');

function makeFsFake({ exists = true, entries = [] } = {}) {
  return {
    existsSync: () => exists,
    readdirSync: () => entries,
  };
}

function makeLifecycleFake(scripts = {}) {
  const calls = [];
  return {
    calls,
    impl: {
      async purgeExpired(args) {
        calls.push(args);
        const script = scripts[args.projectId];
        if (script instanceof Error) throw script;
        return script || { purgedCount: 0, byKey: {} };
      },
    },
  };
}

describe('startup-purge: listProjectEnvelopes', () => {
  test('empty when .gad/secrets does not exist', () => {
    const out = listProjectEnvelopes('/fake', makeFsFake({ exists: false }));
    assert.deepStrictEqual(out, []);
  });

  test('filters to files with .enc suffix; strips the suffix', () => {
    const fsFake = makeFsFake({
      entries: ['proj-a.enc', 'proj-b.enc', 'proj-a.audit.jsonl', 'README.md', '.gitignore'],
    });
    const out = listProjectEnvelopes('/fake', fsFake);
    assert.deepStrictEqual(out.sort(), ['proj-a', 'proj-b']);
  });

  test('swallows readdir errors and returns empty array', () => {
    const fsFake = {
      existsSync: () => true,
      readdirSync: () => { throw new Error('EACCES'); },
    };
    const out = listProjectEnvelopes('/fake', fsFake);
    assert.deepStrictEqual(out, []);
  });

  test('empty-string or dot-enc filenames are filtered out', () => {
    const fsFake = makeFsFake({
      entries: ['.enc', 'valid.enc'],
    });
    const out = listProjectEnvelopes('/fake', fsFake);
    assert.deepStrictEqual(out, ['valid']);
  });
});

describe('startup-purge: purgeExpiredAllProjects', () => {
  test('calls lifecycle.purgeExpired per project envelope; aggregates purgedCount', async () => {
    const fsFake = makeFsFake({ entries: ['a.enc', 'b.enc', 'c.enc'] });
    const { impl: lifecycle, calls } = makeLifecycleFake({
      a: { purgedCount: 2, byKey: { K: [1, 2] } },
      b: { purgedCount: 0, byKey: {} },
      c: { purgedCount: 1, byKey: { K: [3] } },
    });

    const summary = await purgeExpiredAllProjects({
      baseDir: '/fake',
      lifecycle,
      fsImpl: fsFake,
    });

    assert.strictEqual(summary.scanned, 3);
    assert.strictEqual(summary.purgedCount, 3);
    // byProject contains only non-zero purges (b is skipped from the list).
    assert.strictEqual(summary.byProject.length, 2);
    const ids = summary.byProject.map((p) => p.projectId).sort();
    assert.deepStrictEqual(ids, ['a', 'c']);
    // Each project was invoked exactly once.
    assert.strictEqual(calls.length, 3);
  });

  test('per-project errors are collected, never thrown', async () => {
    const fsFake = makeFsFake({ entries: ['ok.enc', 'bad.enc'] });
    const err = new Error('BAG_CORRUPT');
    err.code = 'BAG_CORRUPT';
    const { impl: lifecycle } = makeLifecycleFake({
      ok: { purgedCount: 1, byKey: { K: [1] } },
      bad: err,
    });

    const summary = await purgeExpiredAllProjects({
      baseDir: '/fake',
      lifecycle,
      fsImpl: fsFake,
    });

    assert.strictEqual(summary.scanned, 2);
    assert.strictEqual(summary.purgedCount, 1);
    assert.strictEqual(summary.errors.length, 1);
    assert.strictEqual(summary.errors[0].projectId, 'bad');
    assert.strictEqual(summary.errors[0].code, 'BAG_CORRUPT');
    assert.match(summary.errors[0].message, /BAG_CORRUPT/);
  });

  test('no envelopes → scanned 0, zero summary', async () => {
    const fsFake = makeFsFake({ entries: [] });
    const { impl: lifecycle } = makeLifecycleFake();
    const summary = await purgeExpiredAllProjects({
      baseDir: '/fake',
      lifecycle,
      fsImpl: fsFake,
    });
    assert.deepStrictEqual(summary, { scanned: 0, purgedCount: 0, byProject: [], errors: [] });
  });

  test('asOf is threaded through to every lifecycle call as a Date', async () => {
    const fsFake = makeFsFake({ entries: ['a.enc'] });
    const { impl: lifecycle, calls } = makeLifecycleFake();
    const cutoff = new Date('2026-04-01T00:00:00Z');

    await purgeExpiredAllProjects({
      baseDir: '/fake',
      asOf: cutoff,
      lifecycle,
      fsImpl: fsFake,
    });

    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].asOf instanceof Date);
    assert.strictEqual(calls[0].asOf.toISOString(), cutoff.toISOString());
  });
});

describe('startup-purge: renderStartupPurgeSummary', () => {
  test('empty string when zero envelopes scanned', () => {
    const line = renderStartupPurgeSummary({ scanned: 0, purgedCount: 0, byProject: [], errors: [] });
    assert.strictEqual(line, '');
  });

  test('no-purge scanned line when nothing was expired', () => {
    const line = renderStartupPurgeSummary({ scanned: 3, purgedCount: 0, byProject: [], errors: [] });
    assert.match(line, /scanned 3 project bag\(s\), 0 expired versions/);
  });

  test('purge summary lists each project and count', () => {
    const line = renderStartupPurgeSummary({
      scanned: 2,
      purgedCount: 3,
      byProject: [
        { projectId: 'a', purgedCount: 2, byKey: {} },
        { projectId: 'b', purgedCount: 1, byKey: {} },
      ],
      errors: [],
    });
    assert.match(line, /purged 3 expired key version\(s\) across 2 project\(s\): a=2, b=1/);
  });

  test('error count is appended when errors present', () => {
    const line = renderStartupPurgeSummary({
      scanned: 2,
      purgedCount: 0,
      byProject: [],
      errors: [{ projectId: 'bad', message: 'BAG_CORRUPT' }],
    });
    assert.match(line, /1 bag\(s\) errored — see audit log/);
  });
});
