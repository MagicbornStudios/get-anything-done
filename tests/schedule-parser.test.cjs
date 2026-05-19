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
// Edge cases / cron field syntax (phase 254-15)
// ---------------------------------------------------------------------------

test('parse list cron field "0,15,30,45 * * * *" → kind=cron', () => {
  const r = parse('0,15,30,45 * * * *');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0,15,30,45 * * * *');
});

test('parse step cron field "*/5 * * * *" → kind=cron', () => {
  const r = parse('*/5 * * * *');
  assert.strictEqual(r.kind, 'cron');
});

test('parse range cron field "0 9-17 * * *" → kind=cron', () => {
  const r = parse('0 9-17 * * *');
  assert.strictEqual(r.kind, 'cron');
});

test('parse @hourly → cron 0 * * * *', () => {
  const r = parse('@hourly');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 * * * *');
});

test('parse @yearly → cron 0 0 1 1 *', () => {
  const r = parse('@yearly');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 0 1 1 *');
});

test('parse @midnight → cron 0 0 * * *', () => {
  const r = parse('@midnight');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 0 * * *');
});

test('parse cron with leading/trailing whitespace trims', () => {
  const r = parse('  0 3 * * *  ');
  assert.strictEqual(r.kind, 'cron');
  assert.strictEqual(r.expression, '0 3 * * *');
});

test('parse cron field out-of-range rejected (minute=60)', () => {
  assert.throws(() => parse('60 0 * * *'), /out of range/);
});

test('parse cron field out-of-range rejected (hour=24)', () => {
  assert.throws(() => parse('0 24 * * *'), /out of range/);
});

test('parse cron field out-of-range rejected (month=13)', () => {
  assert.throws(() => parse('0 0 1 13 *'), /out of range/);
});

test('parse cron field invalid syntax rejected (alpha)', () => {
  assert.throws(() => parse('foo bar baz qux quux'), /invalid cron field/);
});

test('parse 0hz rejected', () => {
  assert.throws(() => parse('0hz'), /hz must be > 0/);
});

test('parse predicate with string value (quoted)', () => {
  const r = parse('when:phase_status == "done"');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.value, 'done');
});

test('parse predicate with negative value', () => {
  const r = parse('when:level_delta >= -1');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.value, -1);
});

test('parse predicate with operator <=', () => {
  const r = parse('when:open_tasks <= 50');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.op, '<=');
});

test('parse predicate with operator ==', () => {
  const r = parse('when:drift_flag == false');
  assert.strictEqual(r.kind, 'predicate');
  assert.strictEqual(r.value, false);
});

test('parse on:deploy → known event', () => {
  const r = parse('on:deploy');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.known, true);
});

test('parse on:bench-complete → known event', () => {
  const r = parse('on:bench-complete');
  assert.strictEqual(r.kind, 'event');
  assert.strictEqual(r.known, true);
});

test('parse uppercase unit "5M" → interval m', () => {
  const r = parse('5M');
  assert.strictEqual(r.kind, 'interval');
  assert.strictEqual(r.unit, 'm');
  assert.strictEqual(r.ms, 5 * 60 * 1000);
});

test('parse uppercase HZ "10HZ" → hz', () => {
  const r = parse('10HZ');
  assert.strictEqual(r.kind, 'hz');
  assert.strictEqual(r.intervalMs, 100);
});

test('validate every shape returns valid', () => {
  const samples = [
    '30s', '5m', '1h', '1d',
    '10hz', '0.5hz',
    '@daily', '@weekly', '@hourly', '@monthly', '@yearly', '@midnight',
    '0 3 * * *', '*/5 * * * *', '0 9-17 * * 1-5', '0,30 * * * *',
    'on:commit', 'on:phase-close', 'on:level-up', 'on:task-stamp', 'on:custom',
    'when:level_delta >= 2', 'when:flag == true', 'when:count != 0',
  ];
  for (const s of samples) {
    const r = validate(s);
    assert.strictEqual(r.valid, true, `expected ${s} to be valid, got: ${r.error}`);
  }
});

test('validate rejects known-bad strings with errors', () => {
  const samples = [
    '',                  // empty
    'banana',            // unknown
    '60 0 * * *',        // out-of-range minute
    '0hz',               // hz must be >0
    'when:',             // malformed predicate
    'on:',               // malformed event
  ];
  for (const s of samples) {
    const r = validate(s);
    assert.strictEqual(r.valid, false, `expected ${s} to be invalid`);
    assert.ok(r.error && r.error.length > 0, `expected ${s} to have an error message`);
  }
});

test('nextRun cron step "*/15 * * * *" advances by 15-min boundaries', () => {
  const now = new Date(2026, 4, 18, 10, 7, 0); // local 10:07
  const p = parse('*/15 * * * *');
  const nr = nextRun(p, now);
  assert.ok(nr instanceof Date);
  // next match must be at a minute divisible by 15 and >= 10:08
  assert.strictEqual(nr.getMinutes() % 15, 0);
});

test('nextRun cron with list "0,30 * * * *" hits next 30-min slot', () => {
  const now = new Date(2026, 4, 18, 10, 14, 0); // local 10:14
  const p = parse('0,30 * * * *');
  const nr = nextRun(p, now);
  assert.ok(nr instanceof Date);
  assert.strictEqual(nr.getMinutes(), 30);
  assert.strictEqual(nr.getHours(), 10);
});

test('nextRun cron range "0 9-17 * * *" — 18:00 → 09:00 next day', () => {
  const now = new Date(2026, 4, 18, 18, 0, 0); // local 18:00
  const p = parse('0 9-17 * * *');
  const nr = nextRun(p, now);
  assert.ok(nr instanceof Date);
  assert.strictEqual(nr.getHours(), 9);
  assert.strictEqual(nr.getMinutes(), 0);
  assert.ok(nr.getDate() > now.getDate() || nr.getMonth() > now.getMonth());
});

// ---------------------------------------------------------------------------
// Integration with lib/cron validators (phase 254-05)
// ---------------------------------------------------------------------------

const {
  validateScheduleString,
  validateScheduleEntry,
  validateCronJsonShape,
} = require(path.join(__dirname, '../lib/cron/index.cjs'));

test('cron.validateScheduleString accepts unified syntax', () => {
  for (const s of ['5m', '10hz', '0 3 * * *', '@daily', 'on:commit', 'when:flag == true']) {
    const r = validateScheduleString(s);
    assert.strictEqual(r.valid, true, `expected ${s} valid`);
    assert.ok(r.kind);
  }
});

test('cron.validateScheduleString rejects garbage', () => {
  const r = validateScheduleString('every tuesday');
  assert.strictEqual(r.valid, false);
});

test('cron.validateScheduleEntry rejects entry without schedule', () => {
  const r = validateScheduleEntry({ id: 'x', command: 'gad noop' });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some((e) => /schedule/.test(e)));
});

test('cron.validateScheduleEntry rejects entry without command', () => {
  const r = validateScheduleEntry({ id: 'x', schedule: '5m' });
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some((e) => /command/.test(e)));
});

test('cron.validateScheduleEntry rejects entry without id/name', () => {
  const r = validateScheduleEntry({ schedule: '5m', command: 'gad noop' });
  assert.strictEqual(r.valid, false);
});

test('cron.validateScheduleEntry accepts complete entry (id form)', () => {
  const r = validateScheduleEntry({
    id: 'deploy-on-level-up',
    schedule: 'on:level-up',
    command: 'gad desk ship',
    enabled: true,
  });
  assert.strictEqual(r.valid, true);
  assert.deepStrictEqual(r.errors, []);
});

test('cron.validateScheduleEntry accepts legacy name+schedule entry', () => {
  const r = validateScheduleEntry({
    name: 'retrain-tick',
    schedule: '0 3 * * *',
    command: 'gad models lifecycle trigger --all',
  });
  assert.strictEqual(r.valid, true);
});

test('cron.validateCronJsonShape accepts object form { entries:[...] }', () => {
  const doc = {
    entries: [
      { id: 'a', schedule: '5m', command: 'gad x' },
      { id: 'b', schedule: '@daily', command: 'gad y' },
    ],
  };
  const r = validateCronJsonShape(doc);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.entries.length, 2);
});

test('cron.validateCronJsonShape accepts legacy array form', () => {
  const doc = [{ name: 'a', schedule: '5m', command: 'gad x' }];
  const r = validateCronJsonShape(doc);
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.entries.length, 1);
});

test('cron.validateCronJsonShape rejects duplicate ids', () => {
  const doc = {
    entries: [
      { id: 'dup', schedule: '5m', command: 'gad x' },
      { id: 'dup', schedule: '@daily', command: 'gad y' },
    ],
  };
  const r = validateCronJsonShape(doc);
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some((e) => /duplicate id/.test(e)));
});

test('cron.validateCronJsonShape rejects non-array, non-object doc', () => {
  const r = validateCronJsonShape('garbage');
  assert.strictEqual(r.valid, false);
  assert.ok(r.errors.some((e) => /array|entries/.test(e)));
});

// ---------------------------------------------------------------------------
// Integration smoke: gad schedule CLI (phase 254-14 smoke via spawnSync)
// ---------------------------------------------------------------------------

const { spawnSync } = require('node:child_process');
const GAD = path.join(__dirname, '..', 'bin', 'gad.cjs');

function runGad(args, env) {
  return spawnSync(process.execPath, [GAD, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
  });
}

test('gad schedule validate "5m" → exit 0', () => {
  const r = runGad(['schedule', 'validate', '5m']);
  assert.strictEqual(r.status, 0, `stdout:${r.stdout} stderr:${r.stderr}`);
  assert.ok(/VALID/.test(r.stdout));
  assert.ok(/interval/.test(r.stdout));
});

test('gad schedule validate "garbage" → exit 1', () => {
  const r = runGad(['schedule', 'validate', 'garbage']);
  assert.strictEqual(r.status, 1);
  assert.ok(/INVALID/.test(r.stdout));
});

test('gad schedule validate --json emits parseable JSON', () => {
  const r = runGad(['schedule', 'validate', '@daily', '--json']);
  assert.strictEqual(r.status, 0);
  const parsedOut = JSON.parse(r.stdout);
  assert.strictEqual(parsedOut.valid, true);
  assert.strictEqual(parsedOut.parsed.kind, 'cron');
});

test('gad schedule next-run "5m" --count 3 → 3 ISO timestamps', () => {
  const r = runGad(['schedule', 'next-run', '5m', '--count', '3']);
  assert.strictEqual(r.status, 0);
  const matches = r.stdout.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g) || [];
  assert.ok(matches.length >= 3, `expected 3+ timestamps in ${r.stdout}`);
});

test('gad schedule next-run "on:commit" → reports no fire-time', () => {
  const r = runGad(['schedule', 'next-run', 'on:commit']);
  assert.strictEqual(r.status, 0);
  assert.ok(/no deterministic fire-time/.test(r.stdout));
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
