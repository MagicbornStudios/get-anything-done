'use strict';
/**
 * Tests for gad cron CLI.
 *
 * Strategy: all tests use --dry-run or test JSON-layer functions directly,
 * so NO real OS-level tasks are created or removed during the test run.
 * The spawnSync(schtasks) / writeCrontab calls only fire when dryRun=false,
 * which is never triggered here.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { runGadCli, cleanup } = require('./helpers.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createCronTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-cron-test-'));
  // Minimal gad-config.toml so findRepoRoot() + resolveRoots() resolve here.
  // Roots must be under [planning] section per gad-config.cjs fromToml().
  fs.writeFileSync(
    path.join(tmpDir, 'gad-config.toml'),
    '[planning]\n\n[[planning.roots]]\nid = "cron-test"\npath = "."\n',
    'utf8',
  );
  fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  return tmpDir;
}

// Run a gad cron subcommand in the tmp project dir.
function runCron(args, tmpDir) {
  return runGadCli(['cron', ...args], tmpDir);
}

// ---------------------------------------------------------------------------
// Unit tests — JSON layer (lib/cron/index.cjs)
// ---------------------------------------------------------------------------

describe('lib/cron/index — JSON layer', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-cron-unit-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(() => cleanup(tmpDir));

  test('isValidCronExpr accepts 5-field expressions', () => {
    const { isValidCronExpr } = require('../lib/cron/index.cjs');
    assert.ok(isValidCronExpr('0 3 * * *'), 'daily 3am');
    assert.ok(isValidCronExpr('* * * * *'), 'every minute');
    assert.ok(isValidCronExpr('15 6 1 * *'), 'monthly');
    assert.ok(isValidCronExpr('0 0 * * 0'), 'weekly Sunday');
  });

  test('isValidCronExpr rejects malformed expressions', () => {
    const { isValidCronExpr } = require('../lib/cron/index.cjs');
    assert.ok(!isValidCronExpr('* * * *'), '4 fields');
    assert.ok(!isValidCronExpr(''), 'empty string');
    assert.ok(!isValidCronExpr('@daily'), 'macro-style (not supported)');
  });

  test('readCronJson returns [] when file missing', () => {
    const { readCronJson } = require('../lib/cron/index.cjs');
    const planningDir = path.join(tmpDir, '.planning');
    assert.deepStrictEqual(readCronJson(planningDir), []);
  });

  test('writeCronJson + readCronJson round-trip', () => {
    const { readCronJson, writeCronJson } = require('../lib/cron/index.cjs');
    const planningDir = path.join(tmpDir, '.planning');
    const entries = [
      { name: 'test-job', schedule: '0 3 * * *', command: 'evolution evolve', created_at: '2026-01-01T00:00:00.000Z', last_run_at: null, enabled: true },
    ];
    writeCronJson(planningDir, entries);
    const read = readCronJson(planningDir);
    assert.deepStrictEqual(read, entries);
  });

  test('appendCronLog writes JSONL entry', () => {
    const { appendCronLog, cronLogPath } = require('../lib/cron/index.cjs');
    const planningDir = path.join(tmpDir, '.planning');
    appendCronLog(planningDir, { name: 'test-job', exit_code: 0 });
    appendCronLog(planningDir, { name: 'test-job', exit_code: 1 });
    const lines = fs.readFileSync(cronLogPath(planningDir), 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 2);
    assert.deepStrictEqual(JSON.parse(lines[0]), { name: 'test-job', exit_code: 0 });
    assert.deepStrictEqual(JSON.parse(lines[1]), { name: 'test-job', exit_code: 1 });
  });
});

// ---------------------------------------------------------------------------
// Unit tests — Windows scheduler helpers (no real schtasks calls)
// ---------------------------------------------------------------------------

describe('scheduler-windows — mapCronToSchtasks', () => {
  const { mapCronToSchtasks } = require('../lib/cron/scheduler-windows.cjs');

  test('every-minute maps to MINUTE', () => {
    const r = mapCronToSchtasks('* * * * *');
    assert.strictEqual(r.sc, 'MINUTE');
  });

  test('hourly maps to HOURLY', () => {
    const r = mapCronToSchtasks('0 * * * *');
    assert.strictEqual(r.sc, 'HOURLY');
  });

  test('daily maps to DAILY with /ST', () => {
    const r = mapCronToSchtasks('30 3 * * *');
    assert.strictEqual(r.sc, 'DAILY');
    assert.ok(r.modArgs.includes('03:30'), `Expected 03:30, got ${r.modArgs}`);
  });

  test('weekly maps to WEEKLY with day name', () => {
    const r = mapCronToSchtasks('0 8 * * 1'); // Monday
    assert.strictEqual(r.sc, 'WEEKLY');
    assert.ok(r.modArgs.includes('MON'), `Expected MON, got ${r.modArgs}`);
  });

  test('monthly maps to MONTHLY', () => {
    const r = mapCronToSchtasks('0 6 15 * *');
    assert.strictEqual(r.sc, 'MONTHLY');
    assert.ok(r.modArgs.includes('15'), `Expected day 15, got ${r.modArgs}`);
  });

  test('complex expression falls back to MINUTE', () => {
    const r = mapCronToSchtasks('*/15 * * * *'); // every 15 minutes
    assert.strictEqual(r.sc, 'MINUTE');
  });
});

describe('scheduler-windows — installTask dry-run', () => {
  const { installTask } = require('../lib/cron/scheduler-windows.cjs');

  test('dry-run returns command array without invoking schtasks', () => {
    const result = installTask({
      name: 'my-job',
      schedule: '0 3 * * *',
      command: 'evolution evolve',
      gadCjsPath: '/fake/gad.cjs',
      dryRun: true,
    });
    assert.ok(result.ok, 'dry-run should succeed');
    assert.ok(Array.isArray(result.command), 'command should be an array');
    assert.ok(result.command[0] === 'schtasks', 'first arg is schtasks');
    assert.ok(result.command.includes('gad-cron-my-job'), 'task name in args');
    assert.ok(result.command.includes('/Create'), '/Create present');
    assert.ok(result.command.includes('/F'), '/F (force) present');
  });

  test('dry-run removeTask returns command without invoking schtasks', () => {
    const { removeTask } = require('../lib/cron/scheduler-windows.cjs');
    const result = removeTask({ name: 'my-job', dryRun: true });
    assert.ok(result.ok);
    assert.ok(result.command.includes('/Delete'));
    assert.ok(result.command.includes('gad-cron-my-job'));
  });
});

// ---------------------------------------------------------------------------
// Unit tests — Unix scheduler helpers
// ---------------------------------------------------------------------------

describe('scheduler-unix — removeBlock', () => {
  const { removeBlock } = require('../lib/cron/scheduler-unix.cjs');

  test('removes sentinel block from crontab string', () => {
    const crontab = [
      '# existing-job',
      '# gad-cron-begin:my-job',
      '0 3 * * * node /path/gad.cjs evolution evolve',
      '# gad-cron-end:my-job',
      '# another-job',
    ].join('\n');
    const result = removeBlock(crontab, 'my-job');
    assert.ok(!result.includes('gad-cron-begin:my-job'), 'begin sentinel removed');
    assert.ok(!result.includes('gad-cron-end:my-job'), 'end sentinel removed');
    assert.ok(result.includes('# existing-job'), 'other content preserved');
    assert.ok(result.includes('# another-job'), 'other content preserved');
  });

  test('returns unchanged string when block not present', () => {
    const crontab = '# existing-job\n0 * * * * echo hi\n';
    const result = removeBlock(crontab, 'nonexistent');
    assert.strictEqual(result, crontab);
  });
});

describe('scheduler-unix — installTask dry-run', () => {
  const { installTask } = require('../lib/cron/scheduler-unix.cjs');

  test('dry-run returns lines without calling crontab', () => {
    const result = installTask({
      name: 'my-job',
      schedule: '0 3 * * *',
      command: 'evolution evolve',
      gadCjsPath: '/fake/gad.cjs',
      dryRun: true,
    });
    assert.ok(result.ok, 'dry-run should succeed');
    assert.ok(Array.isArray(result.lines), 'lines returned');
    const joined = result.lines.join('\n');
    assert.ok(joined.includes('gad-cron-begin:my-job'), 'begin sentinel present');
    assert.ok(joined.includes('gad-cron-end:my-job'), 'end sentinel present');
    assert.ok(joined.includes('0 3 * * *'), 'cron expression present');
  });
});

// ---------------------------------------------------------------------------
// Integration tests — CLI via gad cron add/list/remove with --dry-run
// No real OS tasks are created; --dry-run prevents OS calls.
// ---------------------------------------------------------------------------

describe('gad cron CLI — JSON layer via --dry-run', () => {
  let tmpDir;

  beforeEach(() => { tmpDir = createCronTempProject(); });
  afterEach(() => cleanup(tmpDir));

  test('add --dry-run: prints entry + OS command, does NOT write cron.json', () => {
    const result = runCron([
      'add',
      '--name', 'nightly-evolution',
      '--schedule', '0 3 * * *',
      '--command', 'evolution evolve',
      '--projectid', 'cron-test',
      '--dry-run',
    ], tmpDir);

    assert.ok(result.success, `CLI failed: ${result.error}`);
    assert.ok(result.output.includes('DRY RUN'), 'dry-run label present');
    assert.ok(result.output.includes('nightly-evolution'), 'entry name mentioned');

    // cron.json must NOT have been written
    const cronJson = path.join(tmpDir, '.planning', 'cron.json');
    assert.ok(!fs.existsSync(cronJson), 'cron.json should not be created in dry-run');
  });

  test('add → list → remove round-trip (--dry-run on add+remove to avoid OS calls)', () => {
    // We test the JSON round-trip: add without dry-run but mock the OS call by
    // patching the scheduler. Since we can't easily mock in-process, we use the
    // fact that on Windows schtasks may or may not be available. We'll use --dry-run
    // for OS operations but manually write cron.json to test list/remove.

    const planningDir = path.join(tmpDir, '.planning');
    const { writeCronJson } = require('../lib/cron/index.cjs');

    // Directly write the entry (simulates a successful add)
    writeCronJson(planningDir, [{
      name: 'nightly-evolution',
      schedule: '0 3 * * *',
      command: 'evolution evolve',
      created_at: '2026-01-01T00:00:00.000Z',
      last_run_at: null,
      enabled: true,
    }]);

    // list
    const listResult = runCron(['list', '--projectid', 'cron-test', '--json'], tmpDir);
    assert.ok(listResult.success, `list failed: ${listResult.error}`);
    const entries = JSON.parse(listResult.output);
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].name, 'nightly-evolution');
    assert.strictEqual(entries[0].schedule, '0 3 * * *');

    // remove --dry-run: does not touch JSON or OS
    const removeResult = runCron([
      'remove',
      '--name', 'nightly-evolution',
      '--projectid', 'cron-test',
      '--dry-run',
    ], tmpDir);
    assert.ok(removeResult.success, `remove dry-run failed: ${removeResult.error}`);
    assert.ok(removeResult.output.includes('DRY RUN'), 'dry-run label');

    // JSON unchanged after dry-run remove
    const { readCronJson } = require('../lib/cron/index.cjs');
    const stillThere = readCronJson(planningDir);
    assert.strictEqual(stillThere.length, 1, 'entry still in JSON after dry-run remove');
  });

  test('list empty project returns informative message', () => {
    const result = runCron(['list', '--projectid', 'cron-test'], tmpDir);
    assert.ok(result.success, `list failed: ${result.error}`);
    assert.ok(result.output.includes('No cron entries'), 'empty message present');
  });

  test('add rejects invalid cron expression', () => {
    const result = runCron([
      'add',
      '--name', 'bad-job',
      '--schedule', '* * * *',  // only 4 fields
      '--command', 'evolution evolve',
      '--projectid', 'cron-test',
    ], tmpDir);
    assert.ok(!result.success, 'should fail with invalid cron');
    assert.ok(
      (result.error || result.output).includes('Invalid cron expression') ||
      (result.error || result.output).includes('invalid'),
      'error message mentions invalid expression'
    );
  });

  test('add rejects invalid name (special chars)', () => {
    const result = runCron([
      'add',
      '--name', 'bad name!',
      '--schedule', '0 3 * * *',
      '--command', 'evolution evolve',
      '--projectid', 'cron-test',
    ], tmpDir);
    assert.ok(!result.success, 'should fail with invalid name');
  });

  test('remove nonexistent entry exits with error', () => {
    const result = runCron([
      'remove',
      '--name', 'does-not-exist',
      '--projectid', 'cron-test',
    ], tmpDir);
    assert.ok(!result.success, 'should fail for missing entry');
    assert.ok(
      (result.error || result.output).includes('not found'),
      'error mentions not found'
    );
  });
});
