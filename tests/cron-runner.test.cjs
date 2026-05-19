'use strict';
/**
 * Tests for lib/cron/runner.cjs (event-bus) and the `gad event` CLI.
 *
 * Phase 254-03. Verifies:
 *   - emitEvent logs to .planning/.gad-log/events-YYYY-MM-DD.jsonl
 *   - listEventSubscribers filters by parsed schedule (event kind)
 *   - disabled subscribers are skipped
 *   - dry-run does NOT spawn the subcommand but still appends a dispatch line
 *   - gad event emit + subscribers + list CLI surfaces behave end-to-end
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  emitEvent,
  listEventSubscribers,
  eventsLogPath,
} = require('../lib/cron/runner.cjs');
const { runGadCli, cleanup } = require('./helpers.cjs');

function mkProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-cron-runner-'));
  fs.writeFileSync(
    path.join(dir, 'gad-config.toml'),
    '[planning]\n\n[[planning.roots]]\nid = "runner-test"\npath = "."\n',
    'utf8',
  );
  fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  return dir;
}

function writeCron(planningDir, entries) {
  fs.writeFileSync(
    path.join(planningDir, 'cron.json'),
    JSON.stringify(entries, null, 2),
    'utf8',
  );
}

describe('lib/cron/runner — event-bus', () => {
  let tmp;
  let planningDir;

  beforeEach(() => {
    tmp = mkProject();
    planningDir = path.join(tmp, '.planning');
  });

  afterEach(() => cleanup(tmp));

  test('emitEvent with no subscribers still logs the emit line', () => {
    const result = emitEvent({ planningDir, event: 'commit' });
    assert.strictEqual(result.subscribers, 0);
    assert.strictEqual(result.runs.length, 0);
    const raw = fs.readFileSync(eventsLogPath(planningDir), 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    assert.strictEqual(lines.length, 1);
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.type, 'emit');
    assert.strictEqual(parsed.event, 'commit');
    assert.strictEqual(parsed.subscriber_count, 0);
  });

  test('listEventSubscribers matches schedule on:<event> only', () => {
    writeCron(planningDir, [
      { id: 'a', schedule: 'on:commit', command: '--version' },
      { id: 'b', schedule: 'on:other', command: '--version' },
      { id: 'c', schedule: '5m', command: '--version' }, // time-based, ignored
      { id: 'd', schedule: 'on:commit', command: '--version', enabled: false }, // disabled
    ]);
    const subs = listEventSubscribers(planningDir, 'commit');
    assert.strictEqual(subs.length, 1);
    assert.strictEqual(subs[0].id, 'a');
  });

  test('listEventSubscribers tolerates malformed schedule strings', () => {
    writeCron(planningDir, [
      { id: 'bad', schedule: '!!not a real schedule!!', command: '--version' },
      { id: 'good', schedule: 'on:commit', command: '--version' },
    ]);
    const subs = listEventSubscribers(planningDir, 'commit');
    assert.strictEqual(subs.length, 1);
    assert.strictEqual(subs[0].id, 'good');
  });

  test('emitEvent dry-run skips spawn but logs dispatch line', () => {
    writeCron(planningDir, [
      { id: 'a', schedule: 'on:commit', command: '--version' },
    ]);
    const result = emitEvent({ planningDir, event: 'commit', dryRun: true });
    assert.strictEqual(result.subscribers, 1);
    assert.strictEqual(result.runs.length, 1);
    assert.ok(result.runs[0].dry_run);
    const raw = fs.readFileSync(eventsLogPath(planningDir), 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0].type, 'emit');
    assert.strictEqual(lines[1].type, 'dispatch');
    assert.strictEqual(lines[1].name, 'a');
    assert.ok(lines[1].dry_run);
  });

  test('emitEvent records payload in emit line', () => {
    const payload = { commit: 'abc123', author: 'tester' };
    emitEvent({ planningDir, event: 'commit', payload });
    const raw = fs.readFileSync(eventsLogPath(planningDir), 'utf8');
    const line = JSON.parse(raw.split(/\r?\n/).filter(Boolean)[0]);
    assert.deepStrictEqual(line.payload, payload);
  });
});

describe('gad event — CLI surface', () => {
  let tmp;

  beforeEach(() => {
    tmp = mkProject();
  });

  afterEach(() => cleanup(tmp));

  test('gad event emit with no subscribers exits 0', () => {
    const r = runGadCli(['event', 'emit', 'commit', '--projectid', 'runner-test'], tmp);
    assert.ok(r.success, `error: ${r.error}`);
    assert.match(r.output, /0 subscriber/);
  });

  test('gad event subscribers reports empty', () => {
    const r = runGadCli(['event', 'subscribers', 'commit', '--projectid', 'runner-test'], tmp);
    assert.ok(r.success, `error: ${r.error}`);
    assert.match(r.output, /No subscribers/);
  });

  test('gad event emit --dry-run with matching subscriber writes dispatch line', () => {
    writeCron(path.join(tmp, '.planning'), [
      { id: 'sub1', schedule: 'on:commit', command: '--version' },
    ]);
    const r = runGadCli(
      ['event', 'emit', 'commit', '--dry-run', '--projectid', 'runner-test'],
      tmp,
    );
    assert.ok(r.success, `error: ${r.error}`);
    assert.match(r.output, /1 subscriber/);
    assert.match(r.output, /sub1\s+dry-run/);
  });

  test('gad event emit rejects malformed event names', () => {
    const r = runGadCli(
      ['event', 'emit', 'bad event!', '--projectid', 'runner-test'],
      tmp,
    );
    assert.ok(!r.success, 'expected failure for malformed event name');
  });

  test('gad event emit rejects invalid --payload JSON', () => {
    const r = runGadCli(
      ['event', 'emit', 'commit', '--payload', '{not json}', '--projectid', 'runner-test'],
      tmp,
    );
    assert.ok(!r.success, 'expected failure for invalid payload JSON');
  });
});
