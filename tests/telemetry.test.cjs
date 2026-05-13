const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { createTempDir, cleanup } = require('./helpers.cjs');
const { createTelemetryCommand, _private } = require('../bin/commands/telemetry.cjs');

function writeJsonl(filePath, entries) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function makeDeps(tmpDir) {
  return {
    findRepoRoot: () => tmpDir,
    gadConfig: {
      load: () => ({ roots: [{ id: 'global', path: '.', planningDir: '.planning' }] }),
    },
    resolveRoots: () => [{ id: 'global', path: '.', planningDir: '.planning' }],
    getLastActiveProjectid: () => 'global',
    outputError: (message) => { throw new Error(message); },
  };
}

describe('gad telemetry summary', () => {
  let tmpDir;
  const handoffId = 'h-2026-05-04T20-04-20-global-89';

  beforeEach(() => {
    tmpDir = createTempDir('gad-telemetry-');
    writeText(path.join(tmpDir, 'gad-config.toml'), [
      '[[planning.roots]]',
      'id = "global"',
      'path = "."',
      'planningDir = ".planning"',
      '',
    ].join('\n'));
    writeText(path.join(tmpDir, '.planning', 'handoffs', 'closed', `${handoffId}.md`), [
      '---',
      `id: ${handoffId}`,
      'projectid: global',
      'phase: 89',
      'task_id: 89-06',
      '---',
      '',
      'body',
      '',
    ].join('\n'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('factory exposes telemetry summary command', () => {
    const command = createTelemetryCommand(makeDeps(tmpDir));
    assert.equal(command.meta.name, 'telemetry');
    assert.ok(command.subCommands.summary);
  });

  test('collects joined records across whiteboard, gad-log, trace, and worker streams', () => {
    writeJsonl(path.join(tmpDir, '.planning', '.sessions', 's-20260504-deadbeef', 'events.jsonl'), [
      {
        ts: '2026-05-04T20:04:20.000Z',
        kind: 'session-start',
        session_id: 's-20260504-deadbeef',
        schema_version: 1,
        runtime: 'codex-cli',
        projectid: 'global',
        claimed_handoff: handoffId,
        model_profile: 'quality',
      },
      {
        ts: '2026-05-04T20:04:21.000Z',
        kind: 'tool-call',
        session_id: 's-20260504-deadbeef',
        schema_version: 1,
        step_id: 'st-1',
        tool: 'Read',
        target: 'vendor/get-anything-done/bin/commands/activity.cjs',
        ok: true,
        duration_ms: 125,
      },
      {
        ts: '2026-05-04T20:04:21.100Z',
        kind: 'attribution-link',
        session_id: 's-20260504-deadbeef',
        schema_version: 1,
        step_id: 'st-1',
        artifact_kind: 'task-stamp',
        artifact_id: 'GLOBAL-T-89-06',
        agent: 'team-w1',
      },
    ]);

    writeJsonl(path.join(tmpDir, '.planning', '.gad-log', '2026-05-04.jsonl'), [
      {
        ts: '2026-05-04T20:04:23.000Z',
        type: 'tool_call',
        tool: 'Bash',
        session_id: 'trace-session-1',
        input_summary: 'gad tasks show 89-06 --projectid global',
        gad_command: 'tasks show 89-06 --projectid global',
        duration_ms: 250,
        runtime: { id: 'codex-cli', model: 'gpt-5.4' },
        success: true,
      },
    ]);

    writeJsonl(path.join(tmpDir, '.planning', '.trace-events.jsonl'), [
      {
        ts: '2026-05-04T20:04:24.000Z',
        type: 'tool_use',
        tool: 'Bash',
        runtime: { id: 'codex-cli', session_id: 'trace-session-1', model: 'gpt-5.4' },
        inputs: { command: `gad handoffs show ${handoffId}` },
        duration_ms: 400,
        success: true,
      },
    ]);

    writeJsonl(path.join(tmpDir, '.planning', 'team', 'workers', 'w1', 'log.jsonl'), [
      {
        ts: '2026-05-04T20:04:19.000Z',
        worker_id: 'w1',
        kind: 'worker-start',
        runtime: 'codex-cli',
        runtime_cmd: 'codex exec',
      },
      {
        ts: '2026-05-04T20:04:25.000Z',
        worker_id: 'w1',
        kind: 'work-complete',
        ref: handoffId,
        exit_code: 0,
        duration_ms: 1000,
      },
    ]);

    const records = _private.collectTelemetryRecords(tmpDir);
    assert.equal(records.length, 4);

    const filtered = _private.applyFilters(records, {
      projectid: 'global',
      session: '',
      runtime: '',
      phase: '',
      task: '',
      handoff: '',
      since: '',
    });
    const summary = _private.summarizeRecords(filtered, { projectid: 'global' });

    assert.equal(summary.totalCalls, 4);
    assert.equal(summary.successCount, 4);
    assert.equal(summary.failureCount, 0);
    assert.equal(summary.attributedRecords, 4);
    assert.equal(summary.coverageGaps.source_streams.length, 0);
    assert.equal(summary.perSource['whiteboard'].count, 1);
    assert.equal(summary.perSource['gad-log'].count, 1);
    assert.equal(summary.perSource.trace.count, 1);
    assert.equal(summary.perSource['worker-log'].count, 1);
    assert.equal(summary.slowestCalls[0].duration_ms, 1000);

    const traceRecord = records.find((record) => record.source_stream === 'trace');
    assert.equal(traceRecord.projectid, 'global');
    assert.equal(traceRecord.handoff_id, handoffId);
    assert.equal(traceRecord.task_id, 'GLOBAL-T-89-06');
  });

  test('filters by task, phase, and handoff', () => {
    const records = [
      {
        ts: '2026-05-04T20:04:21.000Z',
        runtime: 'codex-cli',
        model: null,
        duration_ms: 100,
        success: true,
        source_stream: 'whiteboard',
        tokens: { input: null, output: null, cache: { read: null, write: null } },
        task_id: 'GLOBAL-T-89-06',
        handoff_id: handoffId,
        artifact_lineage: [],
        session_id: 's-1',
        projectid: 'global',
        phase: '89',
        tool: 'Read',
        target: 'file',
      },
      {
        ts: '2026-05-04T20:04:22.000Z',
        runtime: 'codex-cli',
        model: null,
        duration_ms: 50,
        success: true,
        source_stream: 'gad-log',
        tokens: { input: null, output: null, cache: { read: null, write: null } },
        task_id: 'GLOBAL-T-88-01',
        handoff_id: 'h-2026-05-04T20-04-20-global-88',
        artifact_lineage: [],
        session_id: null,
        projectid: 'global',
        phase: '88',
        tool: 'Bash',
        target: 'gad tasks list',
      },
    ];

    assert.equal(_private.applyFilters(records, {
      projectid: 'global', session: '', runtime: '', phase: '', task: '89-06', handoff: '', since: '',
    }).length, 1);
    assert.equal(_private.applyFilters(records, {
      projectid: 'global', session: '', runtime: '', phase: '89', task: '', handoff: '', since: '',
    }).length, 1);
    assert.equal(_private.applyFilters(records, {
      projectid: 'global', session: '', runtime: '', phase: '', task: '', handoff: handoffId, since: '',
    }).length, 1);
  });

  test('summary command prints json without debug noise', async () => {
    writeText(path.join(tmpDir, '.planning', 'model-pricing-snapshot.json'), JSON.stringify({
      generated_at: '2026-05-04T05:00:00.000Z',
      providers: {
        openai: {
          models: [
            { id: 'gpt-5.4', input_per_m: 5, output_per_m: 20 },
          ],
        },
      },
    }, null, 2));
    writeJsonl(path.join(tmpDir, '.planning', '.sessions', 's-20260504-deadbeef', 'events.jsonl'), [
      {
        ts: '2026-05-04T20:04:20.000Z',
        kind: 'session-start',
        session_id: 's-20260504-deadbeef',
        schema_version: 1,
        runtime: 'codex-cli',
        projectid: 'global',
      },
      {
        ts: '2026-05-04T20:04:21.000Z',
        kind: 'tool-call',
        session_id: 's-20260504-deadbeef',
        schema_version: 1,
        step_id: 'st-1',
        tool: 'Read',
        target: 'file',
        ok: true,
        duration_ms: 125,
      },
    ]);

    const output = [];
    const originalLog = console.log;
    console.log = (...args) => output.push(args.join(' '));
    try {
      const command = createTelemetryCommand(makeDeps(tmpDir));
      await command.subCommands.summary.run({
        args: { projectid: 'global', session: '', runtime: '', phase: '', task: '', handoff: '', since: '', json: true },
      });
    } finally {
      console.log = originalLog;
    }

    const rendered = output.join('\n');
    assert.doesNotMatch(rendered, /\[debug\]/);
    const parsed = JSON.parse(rendered);
    assert.equal(parsed.totalCalls, 1);
    assert.equal(parsed.successCount, 1);
    assert.ok(parsed.histograms);
    assert.equal(parsed.histograms.recordsMissingTokenUsage, 1);
  });

  test('builds token and estimated-cost histograms from priced token-bearing calls', () => {
    const snapshot = {
      generated_at: '2026-05-04T05:00:00.000Z',
      providers: {
        openai: {
          models: [
            { id: 'gpt-5.4', input_per_m: 5, output_per_m: 20 },
          ],
        },
      },
    };
    const records = [
      {
        ts: '2026-05-04T20:04:21.000Z',
        runtime: 'codex-cli',
        model: 'gpt-5.4',
        duration_ms: 100,
        success: true,
        source_stream: 'whiteboard',
        tokens: { input: 2000, output: 500, cache: { read: 100, write: null } },
        task_id: 'GLOBAL-T-89-08',
        handoff_id: handoffId,
        artifact_lineage: [],
        session_id: 's-1',
        projectid: 'global',
        phase: '89',
        tool: 'Read',
        target: 'file',
      },
      {
        ts: '2026-05-04T20:04:22.000Z',
        runtime: 'codex-cli',
        model: 'gpt-5.4',
        duration_ms: 150,
        success: true,
        source_stream: 'trace',
        tokens: { input: null, output: null, cache: { read: null, write: null } },
        task_id: 'GLOBAL-T-89-08',
        handoff_id: handoffId,
        artifact_lineage: [],
        session_id: 's-1',
        projectid: 'global',
        phase: '89',
        tool: 'Bash',
        target: 'cmd',
      },
      {
        ts: '2026-05-04T20:04:23.000Z',
        runtime: 'codex-cli',
        model: 'unknown-model',
        duration_ms: 175,
        success: true,
        source_stream: 'gad-log',
        tokens: { input: 1000, output: 1000, cache: { read: null, write: null } },
        task_id: 'GLOBAL-T-89-08',
        handoff_id: handoffId,
        artifact_lineage: [],
        session_id: 's-1',
        projectid: 'global',
        phase: '89',
        tool: 'Bash',
        target: 'cmd',
      },
    ];

    const summary = _private.summarizeRecords(records, { projectid: 'global' }, { pricingSnapshot: snapshot });
    assert.equal(summary.histograms.recordsWithReportedTokens, 2);
    assert.equal(summary.histograms.recordsMissingTokenUsage, 1);
    assert.equal(summary.histograms.recordsMissingPricing, 1);
    assert.equal(summary.histograms.totalKnownTokensAcrossRecords, 4600);
    assert.equal(summary.histograms.tokenVolumeBuckets.find((bucket) => bucket.key === '1k-10k').count, 2);
    assert.equal(summary.histograms.estimatedUsdBuckets.find((bucket) => bucket.key === '0.01-0.10').count, 1);
    assert.equal(summary.histograms.missingPricingModels[0], 'unknown-model');
    assert.equal(summary.histograms.topEstimatedCalls[0].model, 'gpt-5.4');
    assert.equal(summary.histograms.dependencyNote.includes('Phase 106'), true);
  });

  test('extracts token fields from future-compatible payload shapes', () => {
    const direct = _private.extractTokensFromEntry({
      tokens_input: 10,
      tokens_output: 20,
      tokens_cache_read: 30,
      tokens_cache_write: 40,
    });
    assert.deepEqual(direct, {
      input: 10,
      output: 20,
      cache: { read: 30, write: 40 },
    });

    const nested = _private.extractTokensFromEntry({
      usage: {
        prompt_tokens: 11,
        completion_tokens: 22,
        cache_read_tokens: 33,
      },
    });
    assert.deepEqual(nested, {
      input: 11,
      output: 22,
      cache: { read: 33, write: null },
    });
  });
});
