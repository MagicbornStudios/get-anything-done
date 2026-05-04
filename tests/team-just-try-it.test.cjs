'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const handoffs = require('../lib/handoffs.cjs');
const { handleRateLimitedHandoff } = require('../lib/team/worker-loop.cjs');
const {
  cooldownPath,
  isHandoffExhausted,
  isHandoffExhaustedForRuntime,
  isHandoffExhaustedForRuntimes,
} = require('../lib/team/rate-limit.cjs');
const { isHandoffCompatible, runtimeAffinityRank, sortHandoffsForPickup } = require('../lib/agent-detect.cjs');

const tempDirs = [];

function makeTempDir() {
  const dir = createTempDir('gad-team-just-try-it-');
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    cleanup(tempDirs.pop());
  }
});

test('rate-limited codex handoff reopens for gemini without writing cooldown state', () => {
  const baseDir = makeTempDir();
  fs.mkdirSync(path.join(baseDir, '.planning', 'handoffs', 'open'), { recursive: true });
  fs.mkdirSync(path.join(baseDir, '.planning', 'handoffs', 'claimed'), { recursive: true });

  const { id } = handoffs.createHandoff({
    baseDir,
    projectid: 'global',
    phase: '95',
    priority: 'high',
    estimatedContext: 'reasoning',
    body: 'retry this handoff',
    createdBy: 'test',
    runtimePreference: 'codex-cli',
    runtimeFallbacks: ['gemini-cli', 'opencode'],
  });
  handoffs.claimHandoff({ baseDir, id, agent: 'team-w1', runtime: 'codex-cli' });

  const events = [];
  const outcome = handleRateLimitedHandoff({
    baseDir,
    runtime: 'codex-cli',
    work: { ref: id },
    handoffsLib: handoffs,
    workerId: 'w1',
    logWrite: (entry) => events.push(entry),
    attemptedAccountIndexes: [0],
    result: { code: 143, stdout: '', stderr: 'You have hit your usage limit', rate_limited: true },
  });

  assert.equal(outcome.action, 'requeued');
  assert.equal(fs.existsSync(cooldownPath(baseDir)), false);

  const reopened = handoffs.readHandoff({ baseDir, id });
  assert.equal(reopened.bucket, 'open');
  assert.equal(reopened.frontmatter.unclaim_history.length, 1);
  assert.equal(reopened.frontmatter.unclaim_history[0].reason, 'rate-limit');
  assert.ok(events.some((entry) => entry.kind === 'runtime-rate-limit-on-call'));

  assert.equal(isHandoffCompatible(reopened.frontmatter, 'gemini-cli'), true);
  assert.equal(runtimeAffinityRank(reopened.frontmatter, 'gemini-cli'), 1);
  assert.equal(runtimeAffinityRank(reopened.frontmatter, 'opencode'), 2);

  const picked = sortHandoffsForPickup([{ id, frontmatter: reopened.frontmatter }], 'gemini-cli');
  assert.equal(picked[0].id, id);

  handoffs.claimHandoff({ baseDir, id, agent: 'team-w2', runtime: 'gemini-cli' });
  const reclaimed = handoffs.readHandoff({ baseDir, id });
  assert.equal(reclaimed.bucket, 'claimed');
  assert.equal(reclaimed.frontmatter.claimed_by, 'team-w2');
});

test('runtime_required keeps a mismatched runtime from claiming the handoff', () => {
  const frontmatter = {
    runtime_preference: 'codex-cli',
    runtime_required: true,
    runtime_fallbacks: ['gemini-cli'],
  };
  assert.equal(isHandoffCompatible(frontmatter, 'codex-cli'), true);
  assert.equal(isHandoffCompatible(frontmatter, 'gemini-cli'), false);
});

test('three rate-limit unclaims exhaust the handoff', () => {
  assert.equal(isHandoffExhausted({
    unclaim_history: [
      { reason: 'rate-limit' },
      { reason: 'rate-limit' },
      { reason: 'rate-limit' },
    ],
  }), true);
});

test('per-runtime exhaustion: gemini-bounced handoff still eligible for codex/opencode', () => {
  const handoff = {
    unclaim_history: [
      { reason: 'rate-limit', runtime: 'gemini-cli' },
      { reason: 'rate-limit', runtime: 'gemini-cli' },
      { reason: 'rate-limit', runtime: 'gemini-cli' },
    ],
  };
  assert.equal(isHandoffExhaustedForRuntime(handoff, 'gemini-cli'), true);
  assert.equal(isHandoffExhaustedForRuntime(handoff, 'codex-cli'), false);
  assert.equal(isHandoffExhaustedForRuntime(handoff, 'opencode'), false);
});

test('per-runtime: legacy entries without runtime field are inert when no mapper provided', () => {
  const legacyHandoff = {
    unclaim_history: [
      { reason: 'rate-limit', by: 'team-w2' },
      { reason: 'rate-limit', by: 'team-w2' },
      { reason: 'rate-limit', by: 'team-w2' },
    ],
  };
  assert.equal(isHandoffExhaustedForRuntime(legacyHandoff, 'codex-cli'), false);
  assert.equal(isHandoffExhaustedForRuntime(legacyHandoff, 'gemini-cli'), false);
  // Legacy global check still flags it (back-compat preserved):
  assert.equal(isHandoffExhausted(legacyHandoff), true);
});

test('per-runtime: legacy entries get attributed via byToRuntime mapper', () => {
  const legacyHandoff = {
    unclaim_history: [
      { reason: 'rate-limit', by: 'team-w2' },
      { reason: 'rate-limit', by: 'team-w2' },
      { reason: 'rate-limit', by: 'team-w2' },
    ],
  };
  // Mapper: team-w2 is the gemini worker.
  const byToRuntime = (by) => (by === 'team-w2' ? 'gemini-cli' : null);
  assert.equal(
    isHandoffExhaustedForRuntime(legacyHandoff, 'gemini-cli', { byToRuntime }),
    true,
    'gemini-cli should be exhausted via mapper',
  );
  assert.equal(
    isHandoffExhaustedForRuntime(legacyHandoff, 'codex-cli', { byToRuntime }),
    false,
    'codex-cli should NOT be exhausted (different runtime via mapper)',
  );
});

test('team-level: exhausted only when EVERY configured runtime hits cap', () => {
  const handoff = {
    unclaim_history: [
      { reason: 'rate-limit', runtime: 'gemini-cli' },
      { reason: 'rate-limit', runtime: 'gemini-cli' },
      { reason: 'rate-limit', runtime: 'gemini-cli' },
    ],
  };
  // Gemini exhausted but team still has codex+opencode → not team-exhausted:
  assert.equal(
    isHandoffExhaustedForRuntimes(handoff, ['codex-cli', 'opencode', 'gemini-cli']),
    false,
  );
  // Lone gemini team → team-exhausted:
  assert.equal(isHandoffExhaustedForRuntimes(handoff, ['gemini-cli']), true);
});
