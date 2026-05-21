'use strict';
/**
 * tests/recommend-profile.test.cjs
 *
 * Unit tests for lib/team/recommend-profile.cjs
 * Uses node:test (built-in, no external deps).
 *
 * Covers:
 *   - Each machine class boundary (Tiny / Small / Medium / Workstation)
 *   - Boundary edge cases (exactly at threshold, just below/above)
 *   - Overcommit warning
 *   - Low-disk warning
 *   - Output shape
 *   - Predicate integration (supportsLocalModel, hasEnoughFreeRam, hasEnoughDisk)
 *
 * Run: node --test tests/recommend-profile.test.cjs
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { recommendTeamProfile } = require('../lib/team/recommend-profile.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal machineProfile with only ram_free_gb and disk_free_gb required. */
function mk(ram_free_gb, disk_free_gb = 50, extra = {}) {
  return { ram_free_gb, disk_free_gb, ...extra };
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

test('recommendTeamProfile: returns required keys', () => {
  const result = recommendTeamProfile(mk(2));
  assert.ok('machine_class' in result);
  assert.ok('recommended_workers' in result);
  assert.ok('recommended_team_profile' in result);
  assert.ok('recommended_local_model_tier' in result);
  assert.ok('runtime_mix' in result);
  assert.ok(Array.isArray(result.warnings));
});

// ---------------------------------------------------------------------------
// Tiny class  (freeRam < 4 GB)
// ---------------------------------------------------------------------------

test('Tiny: 2.3 GB free -> Solo Safe / 1 worker', () => {
  const r = recommendTeamProfile(mk(2.3));
  assert.equal(r.machine_class, 'Tiny');
  assert.equal(r.recommended_workers, 1);
  assert.equal(r.recommended_team_profile, 'Solo Safe');
  assert.match(r.recommended_local_model_tier, /rules\+classical/i);
});

test('Tiny: 0 GB free -> Solo Safe', () => {
  const r = recommendTeamProfile(mk(0));
  assert.equal(r.machine_class, 'Tiny');
  assert.equal(r.recommended_workers, 1);
});

test('Tiny: 3.99 GB free (just below 4 GB threshold)', () => {
  const r = recommendTeamProfile(mk(3.99));
  assert.equal(r.machine_class, 'Tiny');
});

test('Tiny: no warnings when disk is fine', () => {
  const r = recommendTeamProfile(mk(2, 50));
  assert.equal(r.warnings.length, 0);
});

// ---------------------------------------------------------------------------
// Small class  (4 GB <= freeRam < 8 GB)
// ---------------------------------------------------------------------------

test('Small: 4.0 GB free (exactly at lower boundary -> Small)', () => {
  const r = recommendTeamProfile(mk(4.0));
  assert.equal(r.machine_class, 'Small');
  assert.equal(r.recommended_team_profile, 'Local ML Support');
  assert.match(r.recommended_local_model_tier, /Qwen 0\.5B/);
});

test('Small: 6 GB free', () => {
  const r = recommendTeamProfile(mk(6));
  assert.equal(r.machine_class, 'Small');
  assert.ok(r.recommended_workers >= 1 && r.recommended_workers <= 2);
});

test('Small: 7.99 GB free (just below 8 GB threshold)', () => {
  const r = recommendTeamProfile(mk(7.99));
  assert.equal(r.machine_class, 'Small');
});

// ---------------------------------------------------------------------------
// Medium class  (8 GB <= freeRam < 16 GB)
// ---------------------------------------------------------------------------

test('Medium: 8.0 GB free (exactly at lower boundary -> Medium)', () => {
  const r = recommendTeamProfile(mk(8.0));
  assert.equal(r.machine_class, 'Medium');
  assert.equal(r.recommended_team_profile, 'Hybrid Coding');
  assert.match(r.recommended_local_model_tier, /Qwen 1\.5B/);
});

test('Medium: 12 GB free', () => {
  const r = recommendTeamProfile(mk(12));
  assert.equal(r.machine_class, 'Medium');
  assert.ok(r.recommended_workers >= 2 && r.recommended_workers <= 4);
});

test('Medium: 15.99 GB free (just below 16 GB threshold)', () => {
  const r = recommendTeamProfile(mk(15.99));
  assert.equal(r.machine_class, 'Medium');
});

// ---------------------------------------------------------------------------
// Workstation class  (freeRam >= 16 GB)
// ---------------------------------------------------------------------------

test('Workstation: 16.0 GB free (exactly at lower boundary -> Workstation)', () => {
  const r = recommendTeamProfile(mk(16.0));
  assert.equal(r.machine_class, 'Workstation');
  assert.equal(r.recommended_team_profile, 'Workstation');
  assert.match(r.recommended_local_model_tier, /7B/);
});

test('Workstation: 32 GB free', () => {
  const r = recommendTeamProfile(mk(32));
  assert.equal(r.machine_class, 'Workstation');
  assert.ok(r.recommended_workers >= 4 && r.recommended_workers <= 8);
});

test('Workstation: 64 GB free (high-end)', () => {
  const r = recommendTeamProfile(mk(64));
  assert.equal(r.machine_class, 'Workstation');
});

// ---------------------------------------------------------------------------
// Overcommit warning
// ---------------------------------------------------------------------------

test('overcommit: Tiny machine with 2 workers -> warning', () => {
  const r = recommendTeamProfile(mk(2), { currentWorkers: 2 });
  assert.ok(r.warnings.some(w => /overcommit/i.test(w)));
  assert.ok(r.warnings.some(w => /2 workers running/i.test(w)));
  assert.ok(r.warnings.some(w => /1 recommended/i.test(w)));
});

test('overcommit: Medium machine with 5 workers -> warning', () => {
  const r = recommendTeamProfile(mk(12), { currentWorkers: 5 });
  assert.ok(r.warnings.some(w => /overcommit/i.test(w)));
});

test('overcommit: Workstation with 8 workers (at limit) -> no overcommit warning', () => {
  const r = recommendTeamProfile(mk(32), { currentWorkers: 8 });
  assert.ok(!r.warnings.some(w => /overcommit/i.test(w)));
});

test('overcommit: Workstation with 9 workers (over limit) -> warning', () => {
  const r = recommendTeamProfile(mk(32), { currentWorkers: 9 });
  assert.ok(r.warnings.some(w => /overcommit/i.test(w)));
});

test('overcommit: no opts.currentWorkers -> no overcommit warning', () => {
  const r = recommendTeamProfile(mk(2));
  assert.ok(!r.warnings.some(w => /overcommit/i.test(w)));
});

test('overcommit: Small machine with 1 worker (at limit) -> no overcommit warning', () => {
  const r = recommendTeamProfile(mk(6), { currentWorkers: 2 });
  assert.ok(!r.warnings.some(w => /overcommit/i.test(w)));
});

// ---------------------------------------------------------------------------
// Disk warnings
// ---------------------------------------------------------------------------

test('low disk: < 10 GB free -> warning', () => {
  const r = recommendTeamProfile(mk(12, 5));
  assert.ok(r.warnings.some(w => /low free disk/i.test(w)));
});

test('adequate disk: >= 10 GB free -> no disk warning', () => {
  const r = recommendTeamProfile(mk(12, 10));
  assert.ok(!r.warnings.some(w => /low free disk/i.test(w)));
});

// ---------------------------------------------------------------------------
// Graceful handling of missing / partial input
// ---------------------------------------------------------------------------

test('missing machineProfile -> Tiny defaults', () => {
  const r = recommendTeamProfile(null);
  assert.equal(r.machine_class, 'Tiny');
  assert.equal(r.recommended_workers, 1);
});

test('missing ram_free_gb -> defaults to 0, Tiny', () => {
  const r = recommendTeamProfile({ disk_free_gb: 50 });
  assert.equal(r.machine_class, 'Tiny');
});

test('missing disk_free_gb -> defaults to 0, triggers disk warning', () => {
  const r = recommendTeamProfile({ ram_free_gb: 12 });
  assert.ok(r.warnings.some(w => /low free disk/i.test(w)));
});

test('extra machine fields are ignored', () => {
  const r = recommendTeamProfile(mk(10, 50, {
    gpu_present: true,
    gpu_name: 'RTX 4090',
    vram_total_gb: 24,
    cpu_cores: 16,
    cpu_threads: 32,
    os: 'windows 11',
    ram_total_gb: 32,
    disk_total_gb: 500
  }));
  assert.equal(r.machine_class, 'Medium');
});

// ---------------------------------------------------------------------------
// runtime_mix content spot-checks
// ---------------------------------------------------------------------------

test('runtime_mix: Tiny contains "Solo Safe" content', () => {
  const r = recommendTeamProfile(mk(2));
  assert.ok(r.runtime_mix.length > 0);
  assert.match(r.runtime_mix, /foreground coding runtime/i);
});

test('runtime_mix: Workstation contains multiple runtimes reference', () => {
  const r = recommendTeamProfile(mk(32));
  assert.match(r.runtime_mix, /coding runtimes/i);
});
