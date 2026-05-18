'use strict';

/**
 * Tests for lib/schedule-parser/index.cjs
 * Phase 254-02 | 2026-05-18
 *
 * Run: node vendor/get-anything-done/tests/schedule-parser.test.cjs
 */

const assert = require('assert');
const path   = require('path');
const { parse, validate, nextRun } = require(
  path.join(__dirname, '../lib/schedule-parser/index.cjs')
);

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Interval tests
// ---------------------------------------------------------------------------

test('parse 30s → interval ms=30000', () => {
  const r = parse('30s');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.ms, 30000);
  assert.strictEqual(r.unit, 's');
  assert.strictEqual(r.value, 30);
});

test('parse 5m → interval ms=300000', () => {
  const r = parse('5m');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.ms, 5 * 60 * 1000);
});

test('parse 1h → interval ms=3600000', () => {
  const r = parse('1h');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.ms, 3600000);
});

test('parse 1d → interval ms=86400000', () => {
  const r = parse('1d');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.ms, 86400000);
});

test('parse 0.5m → interval ms=30000', () => {
  const r = parse('0.5m');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.ms, 30000);
});

// ---------------------------------------------------------------------------
// Hz tests
// ---------------------------------------------------------------------------

test('parse 10hz → hz intervalMs=100', () => {
  const r = parse('10hz');
  assert.strictEqual(r.kind, 'hz');
  assert.strictEqual(r.hz, 10);
  assert.strictEqual(r.intervalMs, 100);
});

test('parse 1hz → hz intervalMs=1000', () => {
  const r = parse('1hz');
  assert.strictEqual(r.kind, 'hz');
  assert.strictEqual(r.intervalMs, 1000);
});

test('parse 0.5hz → hz intervalMs=2000', () => {
  const r = parse('0.5hz');
  assert.strictEqual(r.kind, 'hz');
  assert.strictEqual(r.intervalMs, 2000);
});

// ---------------------------------------------------------------------------
// Cron / shorthand tests
// ---------------------------------------------------------------------------

test('parse @daily → cron 0 0 * * *', () => {
  const r = parse('@daily');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 0 * * *');
  assert.strictEqual(r.shorthand, '@daily');
});

test('parse @weekly → cron 0 0 * * 0', () => {
  const r = parse('@weekly');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 0 * * 0');
});

test('parse 5-field cron → kind=cron', () => {
  const r = parse('0 3 * * *');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 3 * * *');
  assert.strictEqual(r.shorthand, null);
});

test('parse */15 * * * * (step cron) → kind=cron', () => {
  const r = parse('*/15 * * * *');
  assert.strictEqual(r.kind, 'cron');
});

// ---------------------------------------------------------------------------
// Event-driven tests
// ---------------------------------------------------------------------------

test('parse on:commit → event commit (known)', () => {
  const r = parse('on:commit');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.event, 'commit');
  assert.strictEqual(r.known, true);
});

test('parse on:phase-close → event phase-close', () => {
  const r = parse('on:phase-close');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.event, 'phase-close');
});

test('parse on:level-up → event level-up', () => {
  const r = parse('on:level-up');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.event, 'level-up');
});

test('parse on:task-stamp → event task-stamp', () => {
  const r = parse('on:task-stamp');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.event, 'task-stamp');
});

test('parse on:custom-event → event (unknown but parsed)', () => {
  const r = parse('on:custom-event');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.event, 'custom-event');
  assert.strictEqual(r.known, false);
});

// ---------------------------------------------------------------------------
// Predicate tests
// ---------------------------------------------------------------------------

test('parse when:level_delta >= 2 → predicate', () => {
  const r = parse('when:level_delta >= 2');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.identifier, 'level_delta');
  assert.strictEqual(r.op, '>=');
  assert.strictEqual(r.value, 2);
});

test('parse when:dataset_delta_mb > 500 → predicate', () => {
  const r = parse('when:dataset_delta_mb > 500');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.identifier, 'dataset_delta_mb');
  assert.strictEqual(r.op, '>');
  assert.strictEqual(r.value, 500);
});

test('parse when:drift_flag == true → predicate boolean value', () => {
  const r = parse('when:drift_flag == true');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.value, true);
});

test('parse when:score != 0 → predicate op!=', () => {
  const r = parse('when:score != 0');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.op, '!=');
  assert.strictEqual(r.value, 0);
});

// ---------------------------------------------------------------------------
// validate() tests
// ---------------------------------------------------------------------------

test('validate "5m" → valid', () => {
  assert.strictEqual(validate('5m').valid, true);
});

test('validate "garbage" → invalid', () => {
  const r = validate('garbage');
  assert.strictEqual(r.valid, false);
  assert.ok(r.error.length > 0);
});

test('validate empty string → invalid', () => {
  const r = validate('');
  assert.strictEqual(r.valid, false);
});

test('validate "on:commit" → valid', () => {
  assert.strictEqual(validate('on:commit').valid, true);
});

// ---------------------------------------------------------------------------
// nextRun() tests
// ---------------------------------------------------------------------------

test('nextRun interval: returns now + ms', () => {
  const now = new Date('2026-05-18T10:00:00Z');
  const p   = parse('5m');
  const nr  = nextRun(p, now);
  assert.strictEqual(nr.getTime(), now.getTime() + 5 * 60 * 1000);
});

test('nextRun hz: returns now + intervalMs', () => {
  const now = new Date('2026-05-18T10:00:00Z');
  const p   = parse('10hz');
  const nr  = nextRun(p, now);
  assert.strictEqual(nr.getTime(), now.getTime() + 100);
});

test('nextRun event → null', () => {
  const p  = parse('on:commit');
  const nr = nextRun(p, new Date());
  assert.strictEqual(nr, null);
});

test('nextRun predicate → null', () => {
  const p  = parse('when:level_delta >= 2');
  const nr = nextRun(p, new Date());
  assert.strictEqual(nr, null);
});

test('nextRun cron @daily: next occurrence is at local midnight', () => {
  // Use a local-time reference to avoid TZ-dependent UTC assertions
  const now = new Date(2026, 4, 18, 10, 30, 0); // local 10:30
  const p   = parse('@daily');
  const nr  = nextRun(p, now);
  assert.ok(nr instanceof Date, 'nextRun should return a Date');
  assert.ok(nr > now, 'next run must be in the future');
  // @daily = 0 0 * * * → next fire at local midnight
  assert.strictEqual(nr.getHours(), 0);
  assert.strictEqual(nr.getMinutes(), 0);
});

test('nextRun cron specific hour: 0 3 * * * next fires at 03:00 local', () => {
  // Reference: local 10:00, so next 03:00 is tomorrow
  const now = new Date(2026, 4, 18, 10, 0, 0);
  const p   = parse('0 3 * * *');
  const nr  = nextRun(p, now);
  assert.ok(nr instanceof Date);
  assert.ok(nr > now);
  assert.strictEqual(nr.getHours(), 3);
  assert.strictEqual(nr.getMinutes(), 0);
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

test('parse throws on non-string', () => {
  assert.throws(() => parse(42), /expected string/);
});

test('parse throws on unrecognised string', () => {
  assert.throws(() => parse('every tuesday'), /unrecognised schedule/);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
