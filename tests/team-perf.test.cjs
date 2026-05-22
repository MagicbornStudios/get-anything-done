'use strict';
/**
 * team-perf.test.cjs - regression coverage for `gad team perf`.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { summarizeTeamPerf } = require('../lib/team/perf.cjs');
const { createPerfCommand } = require('../bin/commands/team/perf.cjs');

function mkProjectRoot(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function writeJsonl(filePath, rows) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

function writeClosedHandoff(baseDir, id, taskId) {
  const filePath = path.join(baseDir, '.planning', 'handoffs', 'closed', `${id}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, [
    '---',
    `id: ${id}`,
    'projectid: global',
    'phase: 282',
    `task_id: ${taskId}`,
    '---',
    '',
    'body',
    '',
  ].join('\n'));
}

test('summarizeTeamPerf aggregates worker throughput, done-task count, and token totals', () => {
  const root = mkProjectRoot('gad-team-perf-');
  try {
    writeJson(path.join(root, '.planning', 'tasks', '282-32.json'), {
      id: '282-32',
      phase: '282',
      status: 'done',
      goal: 'perf telemetry',
    });
    writeClosedHandoff(root, 'h-2026-05-22T02-14-28-global-282', '282-32');

    writeJsonl(path.join(root, '.planning', 'team', 'workers', 'w1', 'log.jsonl'), [
      { ts: '2026-05-22T02:00:00.000Z', kind: 'worker-start', worker_id: 'w1', runtime: 'claude-code' },
      {
        ts: '2026-05-22T02:05:00.000Z',
        kind: 'work-complete',
        worker_id: 'w1',
        runtime: 'claude-code',
        ref: 'h-2026-05-22T02-14-28-global-282',
        exit_code: 0,
        rate_limited: false,
        tokens_input: 1200,
        tokens_output: 300,
        tokens_total: 1500,
      },
      {
        ts: '2026-05-22T02:06:00.000Z',
        kind: 'runtime-rate-limit-on-call',
        worker_id: 'w1',
        runtime: 'claude-code',
        ref: 'h-rate-limit',
      },
    ]);

    writeJsonl(path.join(root, '.planning', 'team', 'workers', 'w2', 'log.jsonl'), [
      { ts: '2026-05-22T02:00:00.000Z', kind: 'worker-start', worker_id: 'w2', runtime: 'opencode' },
      {
        ts: '2026-05-22T02:10:00.000Z',
        kind: 'work-complete',
        worker_id: 'w2',
        runtime: 'opencode',
        ref: 'h-opencode-no-tokens',
        exit_code: 0,
        rate_limited: false,
        tokens_input: null,
        tokens_output: null,
        tokens_total: null,
      },
    ]);

    const report = summarizeTeamPerf({
      baseDir: root,
      since: '2026-05-22T02:00:00.000Z',
      projectid: 'global',
    });

    assert.deepEqual(Object.keys(report), ['since', 'projectid', 'workers', 'totals']);
    assert.equal(report.since, '2026-05-22T02:00:00.000Z');
    assert.equal(report.projectid, 'global');
    assert.equal(report.workers.length, 2);

    const w1 = report.workers.find((worker) => worker.worker_id === 'w1');
    const w2 = report.workers.find((worker) => worker.worker_id === 'w2');
    assert.ok(w1);
    assert.ok(w2);

    assert.deepEqual(w1, {
      worker_id: 'w1',
      runtime: 'claude-code',
      handoffs_completed: 1,
      tasks_closed: 1,
      tokens_input: 1200,
      tokens_output: 300,
      tokens_total: 1500,
      rate_limit_hits: 1,
    });
    assert.deepEqual(w2, {
      worker_id: 'w2',
      runtime: 'opencode',
      handoffs_completed: 1,
      tasks_closed: 0,
      tokens_input: 0,
      tokens_output: 0,
      tokens_total: 0,
      rate_limit_hits: 0,
    });
    assert.deepEqual(report.totals, {
      handoffs_completed: 2,
      tasks_closed: 1,
      tokens_input: 1200,
      tokens_output: 300,
      tokens_total: 1500,
      rate_limit_hits: 1,
    });
  } finally {
    cleanup(root);
  }
});

test('createPerfCommand emits the documented JSON shape', () => {
  const root = mkProjectRoot('gad-team-perf-cli-');
  try {
    writeJsonl(path.join(root, '.planning', 'team', 'workers', 'w1', 'log.jsonl'), [
      { ts: '2026-05-22T02:00:00.000Z', kind: 'worker-start', worker_id: 'w1', runtime: 'codex-cli' },
      {
        ts: '2026-05-22T02:01:00.000Z',
        kind: 'work-complete',
        worker_id: 'w1',
        runtime: 'codex-cli',
        ref: 'h-codex',
        exit_code: 0,
        rate_limited: false,
        tokens_input: 10,
        tokens_output: 5,
        tokens_total: 15,
      },
    ]);

    let output = '';
    const originalLog = console.log;
    console.log = (text) => { output += `${text}\n`; };
    try {
      const command = createPerfCommand({
        findRepoRoot: () => root,
        gadConfig: { load: () => ({ roots: [{ projectid: 'global', path: '.', planningDir: '.planning' }] }) },
        resolveRoots: () => [{ projectid: 'global', path: '.', planningDir: '.planning' }],
        getLastActiveProjectid: () => 'global',
        outputError: (message) => { throw new Error(message); },
      });

      command.run({
        args: {
          projectid: 'global',
          since: '2026-05-22T02:00:00.000Z',
          json: true,
        },
      });
    } finally {
      console.log = originalLog;
    }

    const parsed = JSON.parse(output);
    assert.equal(parsed.since, '2026-05-22T02:00:00.000Z');
    assert.equal(parsed.projectid, 'global');
    assert.deepEqual(parsed.workers, [{
      worker_id: 'w1',
      runtime: 'codex-cli',
      handoffs_completed: 1,
      tasks_closed: 0,
      tokens_input: 10,
      tokens_output: 5,
      tokens_total: 15,
      rate_limit_hits: 0,
    }]);
    assert.deepEqual(parsed.totals, {
      handoffs_completed: 1,
      tasks_closed: 0,
      tokens_input: 10,
      tokens_output: 5,
      tokens_total: 15,
      rate_limit_hits: 0,
    });
  } finally {
    cleanup(root);
  }
});
