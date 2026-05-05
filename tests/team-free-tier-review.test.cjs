'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { isFreeTierLane, buildReviewBody, maybeQueueReview } = require('../lib/team/free-tier-review.cjs');

test('isFreeTierLane: matches lanes listed in cfg.free_tier_lanes', () => {
  const cfg = { free_tier_lanes: ['opencode-nemotron-reasoning', 'opencode-gpt-oss'] };
  assert.equal(isFreeTierLane(cfg, 'opencode-nemotron-reasoning'), true);
  assert.equal(isFreeTierLane(cfg, 'opencode-gpt-oss'), true);
  assert.equal(isFreeTierLane(cfg, 'codex-primary'), false);
  assert.equal(isFreeTierLane(cfg, null), false);
});

test('isFreeTierLane: respects per-spec requires_review override', () => {
  const cfg = { free_tier_lanes: [] };
  assert.equal(isFreeTierLane(cfg, 'some-lane', { requires_review: true }), true);
  assert.equal(isFreeTierLane(cfg, 'some-lane', { requires_review: false }), false);
});

test('isFreeTierLane: empty/missing config returns false', () => {
  assert.equal(isFreeTierLane(null, 'opencode-nemotron-reasoning'), false);
  assert.equal(isFreeTierLane({}, 'opencode-nemotron-reasoning'), false);
});

test('buildReviewBody: includes original handoff, worker, lane, runtime, action', () => {
  const body = buildReviewBody({
    originalRef: 'h-2026-05-05T19-00-00-global-131',
    projectid: 'global',
    phase: '131',
    taskId: 'GLOBAL-T-131-09',
    workerId: 'w4',
    lane: 'opencode-nemotron-reasoning',
    runtime: 'opencode',
    commit: 'abc123',
  });
  assert.match(body, /Original handoff:.*global-131/);
  assert.match(body, /Worker:.*w4.*opencode-nemotron-reasoning.*opencode/s);
  assert.match(body, /Project \/ phase:.*global.*131/s);
  assert.match(body, /Task:.*GLOBAL-T-131-09/);
  assert.match(body, /Commit:.*abc123/);
  assert.match(body, /Verify this completion/);
});

test('maybeQueueReview: skips when work is not a handoff', () => {
  const calls = [];
  const handoffsLib = { createHandoff: () => { calls.push('called'); return { id: 'x' }; } };
  const result = maybeQueueReview({
    cfg: { free_tier_lanes: ['opencode-nemotron-reasoning'] },
    workerId: 'w4',
    lane: 'opencode-nemotron-reasoning',
    runtime: 'opencode',
    work: { kind: 'mailbox', ref: 'm-1' },
    result: { code: 0, rate_limited: false },
    handoffsLib,
    logWrite: () => {},
  });
  assert.equal(result, null);
  assert.equal(calls.length, 0);
});

test('maybeQueueReview: skips when rate_limited or non-zero exit', () => {
  const handoffsLib = { createHandoff: () => { throw new Error('should not be called'); } };
  const work = { kind: 'handoff', ref: 'h-1', frontmatter: { projectid: 'global', phase: '131' } };
  const cfg = { free_tier_lanes: ['opencode-nemotron-reasoning'] };
  const base = { cfg, workerId: 'w4', lane: 'opencode-nemotron-reasoning', runtime: 'opencode', work, handoffsLib, logWrite: () => {} };
  assert.equal(maybeQueueReview({ ...base, result: { code: 0, rate_limited: true } }), null);
  assert.equal(maybeQueueReview({ ...base, result: { code: 1, rate_limited: false } }), null);
});

test('maybeQueueReview: skips when lane is not free-tier', () => {
  const handoffsLib = { createHandoff: () => { throw new Error('should not be called'); } };
  const work = { kind: 'handoff', ref: 'h-1', frontmatter: { projectid: 'global', phase: '131' } };
  const cfg = { free_tier_lanes: ['opencode-nemotron-reasoning'] };
  const result = maybeQueueReview({
    cfg,
    workerId: 'w1',
    lane: 'codex-primary',
    runtime: 'codex-cli',
    work,
    result: { code: 0, rate_limited: false },
    handoffsLib,
    logWrite: () => {},
  });
  assert.equal(result, null);
});

test('maybeQueueReview: queues review handoff for free-tier lane completion', () => {
  const calls = [];
  const logs = [];
  const handoffsLib = {
    createHandoff: (args) => { calls.push(args); return { id: 'h-review-1', filePath: '/tmp/x.md' }; },
  };
  const work = {
    kind: 'handoff',
    ref: 'h-original-1',
    frontmatter: { projectid: 'global', phase: '131', task_id: 'GLOBAL-T-131-09' },
  };
  const result = maybeQueueReview({
    baseDir: '/tmp/repo',
    cfg: { free_tier_lanes: ['opencode-nemotron-reasoning'] },
    workerId: 'w4',
    lane: 'opencode-nemotron-reasoning',
    runtime: 'opencode',
    work,
    result: { code: 0, rate_limited: false },
    handoffsLib,
    logWrite: (entry) => logs.push(entry),
  });

  assert.equal(result.id, 'h-review-1');
  assert.equal(calls.length, 1);
  const created = calls[0];
  assert.equal(created.projectid, 'global');
  assert.equal(created.phase, '131');
  assert.equal(created.priority, 'normal');
  assert.equal(created.estimatedContext, 'bounded');
  assert.equal(created.runtimePreference, 'claude-code');
  assert.match(created.body, /h-original-1/);
  assert.match(created.body, /w4/);
  assert.match(created.createdBy, /team-w4-free-tier-review/);

  const queuedLog = logs.find((l) => l.kind === 'review-handoff-queued');
  assert.ok(queuedLog, 'expected review-handoff-queued log entry');
  assert.equal(queuedLog.original_ref, 'h-original-1');
  assert.equal(queuedLog.review_ref, 'h-review-1');
  assert.equal(queuedLog.runtime_preference, 'claude-code');
});

test('maybeQueueReview: skips silently when projectid/phase missing in frontmatter', () => {
  const handoffsLib = { createHandoff: () => { throw new Error('should not be called'); } };
  const logs = [];
  const result = maybeQueueReview({
    cfg: { free_tier_lanes: ['opencode-nemotron-reasoning'] },
    workerId: 'w4',
    lane: 'opencode-nemotron-reasoning',
    runtime: 'opencode',
    work: { kind: 'handoff', ref: 'h-broken', frontmatter: {} },
    result: { code: 0, rate_limited: false },
    handoffsLib,
    logWrite: (entry) => logs.push(entry),
  });
  assert.equal(result, null);
  const skipLog = logs.find((l) => l.kind === 'review-handoff-skip');
  assert.ok(skipLog);
});

test('maybeQueueReview: errors from createHandoff are caught and logged', () => {
  const handoffsLib = { createHandoff: () => { throw new Error('disk full'); } };
  const logs = [];
  const result = maybeQueueReview({
    cfg: { free_tier_lanes: ['opencode-nemotron-reasoning'] },
    workerId: 'w4',
    lane: 'opencode-nemotron-reasoning',
    runtime: 'opencode',
    work: { kind: 'handoff', ref: 'h-1', frontmatter: { projectid: 'global', phase: '131' } },
    result: { code: 0, rate_limited: false },
    handoffsLib,
    logWrite: (entry) => logs.push(entry),
  });
  assert.equal(result, null);
  const errLog = logs.find((l) => l.kind === 'review-handoff-error');
  assert.ok(errLog);
  assert.match(errLog.error, /disk full/);
});
