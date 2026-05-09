'use strict';
/**
 * team-status-warnings.test.cjs — invariant alarm for `gad team status`.
 *
 * Operator standing rule (2026-05-09): claimed_handoff_count MUST NOT
 * exceed live_team_worker_count + N_external_agents. Today's incident
 * left 55 claimed handoffs with 9 zombie workers — `gad team status`
 * should immediately surface this on every run.
 *
 * Three cases:
 *   1. No violations → warnings = []
 *   2. claims_exceed_capacity (more claimed than live workers)
 *   3. Both oldest_stale_claim AND zombie_workers
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  computeWarnings,
  formatWarnings,
  STALE_CLAIM_THRESHOLD_S,
} = require('../bin/commands/team/status.cjs');
const { createTempDir, cleanup } = require('./helpers.cjs');

function isoMinusSeconds(seconds) {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function writeClaimedHandoff(baseDir, id, frontmatter) {
  const dir = path.join(baseDir, '.planning', 'handoffs', 'claimed');
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['---'];
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(`${k}: ${v == null ? 'null' : v}`);
  }
  lines.push('---', '', 'body');
  fs.writeFileSync(path.join(dir, `${id}.md`), lines.join('\n'));
}

test('case 1: no violations → empty warnings, formatWarnings prints "WARNINGS: none"', () => {
  const baseDir = createTempDir('gad-team-warn-1-');
  try {
    // No claimed/ dir at all, all workers STOPPED
    const workerRows = [
      { id: 'w1', state: 'STOPPED', heartbeat_age_s: 1200 },
      { id: 'w2', state: 'STOPPED', heartbeat_age_s: 1200 },
    ];
    const warnings = computeWarnings({ baseDir, workerRows });
    assert.deepEqual(warnings, []);

    const lines = formatWarnings(warnings);
    assert.deepEqual(lines, ['WARNINGS: none']);
  } finally {
    cleanup(baseDir);
  }
});

test('case 1b: claimed=0, all workers STOPPED → no zombies (STOPPED is excluded)', () => {
  const baseDir = createTempDir('gad-team-warn-1b-');
  try {
    fs.mkdirSync(path.join(baseDir, '.planning', 'handoffs', 'claimed'), { recursive: true });
    const workerRows = [
      // STOPPED + old heartbeat must NOT be classified as zombie
      { id: 'w1', state: 'STOPPED', heartbeat_age_s: 99999 },
      { id: 'w2', state: 'NOT_STARTED', heartbeat_age_s: 99999 },
    ];
    const warnings = computeWarnings({ baseDir, workerRows });
    assert.deepEqual(warnings, []);
  } finally {
    cleanup(baseDir);
  }
});

test('case 2: claims_exceed_capacity — 5 claimed, 2 live workers, excess=3', () => {
  const baseDir = createTempDir('gad-team-warn-2-');
  try {
    // 5 fresh claims (well under stale threshold so only the capacity rule fires)
    const freshTs = isoMinusSeconds(60);
    for (let i = 0; i < 5; i++) {
      writeClaimedHandoff(baseDir, `h-fresh-${i}`, {
        id: `h-fresh-${i}`,
        projectid: 'global',
        phase: '1',
        claimed_by: 'codex-cli',
        claimed_at: freshTs,
      });
    }
    const workerRows = [
      // 2 live workers
      { id: 'w1', state: 'WORKING', heartbeat_age_s: 30 },
      { id: 'w2', state: 'IDLE', heartbeat_age_s: 60 },
      // 1 stopped (excluded from live AND zombie)
      { id: 'w3', state: 'STOPPED', heartbeat_age_s: 9999 },
    ];

    const warnings = computeWarnings({ baseDir, workerRows });
    const kinds = warnings.map((w) => w.kind);
    assert.ok(kinds.includes('claims_exceed_capacity'),
      `expected claims_exceed_capacity in ${JSON.stringify(kinds)}`);

    const cap = warnings.find((w) => w.kind === 'claims_exceed_capacity');
    assert.equal(cap.claimed, 5);
    assert.equal(cap.live_workers, 2);
    assert.equal(cap.excess, 3);

    // No zombies, no stale claims
    assert.equal(kinds.includes('zombie_workers'), false);
    assert.equal(kinds.includes('oldest_stale_claim'), false);

    // formatWarnings produces the expected line
    const formatted = formatWarnings(warnings);
    assert.equal(formatted[0], 'WARNINGS:');
    assert.ok(formatted.some((l) =>
      l.includes('invariant_violation=claims_exceed_capacity') &&
      l.includes('claimed=5') &&
      l.includes('live_workers=2') &&
      l.includes('excess=3')
    ), `formatted lines: ${JSON.stringify(formatted)}`);
  } finally {
    cleanup(baseDir);
  }
});

test('case 2b: external agents satisfy capacity → no claims_exceed_capacity', () => {
  const baseDir = createTempDir('gad-team-warn-2b-');
  try {
    const freshTs = isoMinusSeconds(60);
    for (let i = 0; i < 3; i++) {
      writeClaimedHandoff(baseDir, `h-fresh-${i}`, {
        id: `h-fresh-${i}`,
        projectid: 'global',
        phase: '1',
        claimed_by: 'codex-cli',
        claimed_at: freshTs,
      });
    }
    const workerRows = [
      { id: 'w1', state: 'WORKING', heartbeat_age_s: 30 },
    ];
    // 1 live + 2 external = 3 capacity, 3 claimed, no excess
    const warnings = computeWarnings({ baseDir, workerRows, externalAgents: 2 });
    assert.equal(warnings.find((w) => w.kind === 'claims_exceed_capacity'), undefined);
  } finally {
    cleanup(baseDir);
  }
});

test('case 3: both oldest_stale_claim AND zombie_workers fire', () => {
  const baseDir = createTempDir('gad-team-warn-3-');
  try {
    // One stale claim (7h ago — over the 6h threshold)
    const staleTs = isoMinusSeconds(7 * 60 * 60);
    writeClaimedHandoff(baseDir, 'h-stale-1', {
      id: 'h-stale-1',
      projectid: 'global',
      phase: '1',
      claimed_by: 'codex-cli',
      claimed_at: staleTs,
    });
    // And a fresh one (so the older-than-threshold logic must pick the right record)
    writeClaimedHandoff(baseDir, 'h-fresh-1', {
      id: 'h-fresh-1',
      projectid: 'global',
      phase: '1',
      claimed_by: 'gemini-cli',
      claimed_at: isoMinusSeconds(60),
    });

    const workerRows = [
      // 1 zombie — IDLE state but heartbeat older than 5 min
      { id: 'w1', state: 'IDLE', heartbeat_age_s: 600 },
      // 1 zombie — WORKING state, heartbeat older than 5 min
      { id: 'w6', state: 'WORKING', heartbeat_age_s: 1200 },
      // 1 live (does not get counted as zombie)
      { id: 'w2', state: 'IDLE', heartbeat_age_s: 30 },
    ];

    const warnings = computeWarnings({ baseDir, workerRows });
    const kinds = warnings.map((w) => w.kind);

    assert.ok(kinds.includes('oldest_stale_claim'),
      `expected oldest_stale_claim in ${JSON.stringify(kinds)}`);
    assert.ok(kinds.includes('zombie_workers'),
      `expected zombie_workers in ${JSON.stringify(kinds)}`);

    const stale = warnings.find((w) => w.kind === 'oldest_stale_claim');
    assert.equal(stale.ref, 'h-stale-1');
    assert.equal(stale.claimed_by, 'codex-cli');
    assert.ok(stale.age_seconds > STALE_CLAIM_THRESHOLD_S,
      `age ${stale.age_seconds} should exceed threshold ${STALE_CLAIM_THRESHOLD_S}`);
    assert.equal(stale.threshold_seconds, STALE_CLAIM_THRESHOLD_S);

    const zomb = warnings.find((w) => w.kind === 'zombie_workers');
    assert.equal(zomb.count, 2);
    assert.deepEqual(zomb.ids.sort(), ['w1', 'w6']);

    // claims_exceed_capacity: 2 claimed vs 1 live = excess 1
    const cap = warnings.find((w) => w.kind === 'claims_exceed_capacity');
    assert.ok(cap, 'claims_exceed_capacity should also fire (2 claimed > 1 live)');
    assert.equal(cap.claimed, 2);
    assert.equal(cap.live_workers, 1);
    assert.equal(cap.excess, 1);

    // Format check
    const formatted = formatWarnings(warnings);
    assert.equal(formatted[0], 'WARNINGS:');
    assert.ok(formatted.some((l) => l.includes('oldest_stale_claim') && l.includes('ref=h-stale-1') && l.includes('threshold=6h')));
    assert.ok(formatted.some((l) => l.includes('zombie_workers') && l.includes('count=2') && (l.includes('w1,w6') || l.includes('w6,w1'))));
  } finally {
    cleanup(baseDir);
  }
});
