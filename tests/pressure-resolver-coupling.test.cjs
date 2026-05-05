'use strict';
/**
 * Phase 136 — Pressure ↔ Level coupling.
 * Tests for the resolver-index + dampening compute + level-up gate.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildResolverIndex,
  resolversFor,
  parseFrontmatter,
} = require('../lib/skills/resolver-index.cjs');
const { aggregatePressure } = require('../lib/entropy/compute.cjs');
const xpMath = require('../lib/xp-math.cjs');

function mkdtemp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeSkill(rootDir, slug, frontmatter, body = '# stub') {
  const dir = path.join(rootDir, slug);
  fs.mkdirSync(dir, { recursive: true });
  const fmText = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${fmText}\n---\n\n${body}\n`);
}

test('resolver-index reads solves_pressure_source from SKILL.md frontmatter', () => {
  const tmp = mkdtemp('gad-resolver-');
  const skillsRoot = path.join(tmp, 'vendor', 'get-anything-done', 'skills');
  fs.mkdirSync(skillsRoot, { recursive: true });

  writeSkill(skillsRoot, 'has-resolver', {
    name: 'has-resolver',
    description: 'declares resolver',
    solves_pressure_source: 'rate-limit-codex',
  });
  writeSkill(skillsRoot, 'no-resolver', {
    name: 'no-resolver',
    description: 'no field',
  });
  writeSkill(skillsRoot, 'multi-resolver', {
    name: 'multi-resolver',
    description: 'array form',
    solves_pressure_source: '[handoff-backlog, unclaim-cascade]',
  });

  const idx = buildResolverIndex({ repoRoot: tmp });
  assert.ok(idx.has('rate-limit-codex'), 'rate-limit-codex pattern should exist');
  assert.deepStrictEqual(idx.get('rate-limit-codex'), ['has-resolver']);
  assert.ok(idx.has('handoff-backlog'));
  assert.ok(idx.has('unclaim-cascade'));
  assert.deepStrictEqual(idx.get('handoff-backlog'), ['multi-resolver']);
  assert.equal(idx.has('any-other'), false);

  // Skills with no field contribute nothing.
  let total = 0;
  for (const slugs of idx.values()) total += slugs.length;
  assert.equal(total, 3, 'three pattern→slug entries (one + two from array)');

  // resolversFor matches exact and substring.
  assert.deepStrictEqual(resolversFor(idx, 'rate-limit-codex'), ['has-resolver']);
  assert.deepStrictEqual(resolversFor(idx, 'handoff-backlog'), ['multi-resolver']);
  assert.deepStrictEqual(resolversFor(idx, 'nothing-matches'), []);

  cleanup(tmp);
});

test('aggregatePressure dampens matched signals when resolverIndex provided', () => {
  // Build signals with a non-trivial open-handoff backlog.
  const signals = {
    gadLog: [],
    workerLog: [],
    openHandoffs: Array.from({ length: 30 }, (_, i) => ({
      id: `h-${i}`,
      phase: '100',
      unclaimCount: 0,
      rateLimitCount: 0,
    })),
    errors: { recent: 0, openStatus: 0 },
  };

  const baseline = aggregatePressure(signals);
  const baselineScore = baseline.score;
  assert.ok(baselineScore > 0, 'baseline should have non-zero pressure');
  assert.equal(baseline.breakdown.resolved_signals, 0);

  // Now provide a resolver for handoff-backlog → score should drop.
  const resolverIndex = new Map([['handoff-backlog', ['some-skill']]]);
  const dampened = aggregatePressure(signals, { resolverIndex });
  assert.ok(dampened.score < baselineScore, `dampened (${dampened.score}) < baseline (${baselineScore})`);
  assert.equal(dampened.breakdown.resolved_signals, 1);
  assert.deepStrictEqual(dampened.breakdown.resolved_signal_list, ['handoff-backlog']);

  // Two resolvers → further dampening.
  const idx2 = new Map([['handoff-backlog', ['skill-a', 'skill-b']]]);
  const dampened2 = aggregatePressure(signals, { resolverIndex: idx2 });
  assert.ok(dampened2.score < dampened.score, 'two resolvers dampen more than one');
});

test('meetsResolvedSignalThreshold gates level-up correctly', () => {
  // Schedule: level 1->2 needs 3, 2->3 needs 6, 3->4 needs 10, 4->5 needs 15.
  assert.equal(xpMath.resolvedSignalsToNextLevel(1), 3);
  assert.equal(xpMath.resolvedSignalsToNextLevel(2), 6);
  assert.equal(xpMath.resolvedSignalsToNextLevel(3), 10);
  assert.equal(xpMath.resolvedSignalsToNextLevel(4), 15);

  assert.equal(xpMath.meetsResolvedSignalThreshold(1, 2), false);
  assert.equal(xpMath.meetsResolvedSignalThreshold(1, 3), true);
  assert.equal(xpMath.meetsResolvedSignalThreshold(1, 5), true);
  assert.equal(xpMath.meetsResolvedSignalThreshold(2, 5), false);
  assert.equal(xpMath.meetsResolvedSignalThreshold(2, 6), true);
  assert.equal(xpMath.meetsResolvedSignalThreshold(3, 9), false);
  assert.equal(xpMath.meetsResolvedSignalThreshold(3, 10), true);
});

test('parseFrontmatter handles arrays, single values, and absent field', () => {
  const fm = parseFrontmatter('---\nname: foo\nsolves_pressure_source: rate-limit-codex\n---\nbody');
  assert.equal(fm.solves_pressure_source, 'rate-limit-codex');

  const fm2 = parseFrontmatter('---\nname: bar\nsolves_pressure_source: [a, b, c]\n---\n');
  assert.deepStrictEqual(fm2.solves_pressure_source, ['a', 'b', 'c']);

  const fm3 = parseFrontmatter('---\nname: baz\n---\n');
  assert.equal(fm3.solves_pressure_source, undefined);
});
