'use strict';
/**
 * bin/commands/runtime/budget.cjs
 *
 * gad runtime budget — token-cost dimension + rate-limit prediction.
 *
 * Subcommands:
 *   gad runtime budget show [--projectid X] [--worker-id Y] [--since Z] [--json]
 *     Current token aggregation per worker/runtime.
 *
 *   gad runtime budget predict [--worker-id X] [--projectid Y] [--json]
 *     Calls predictNextRateLimit for one worker (or all workers).
 *
 *   gad runtime budget histogram --task-shape <s> [--since X] [--json]
 *     Token distribution for a task shape (p50/p90/p99/mean/n).
 *
 *   gad runtime budget snapshot [--projectid X] [--json]
 *     Persists current state to .planning/.gad-log/token-budgets.jsonl.
 */

const path = require('path');
const { defineCommand } = require('citty');
const {
  aggregateWorkerTokens,
  predictNextRateLimit,
  costPerHandoff,
  histogram,
  persistBudgetSnapshot,
} = require('../../../lib/runtime-budget/index.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve project root from GAD context or fall back to cwd.
 */
function resolveRoot(context) {
  return (context && context.runtimeRepoRoot) || process.cwd();
}

/**
 * Format seconds as a human-readable string (e.g. 3600 → "1h 0m").
 */
function fmtSeconds(seconds) {
  if (seconds == null) return 'n/a';
  if (seconds <= 0) return '<1m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${seconds % 60}s`;
}

/**
 * Print a simple aligned table to stdout.
 */
function printTable(rows, cols) {
  if (!rows.length) { console.log('  (no data)'); return; }
  // Compute column widths
  const widths = cols.map((col) => {
    const header = col.label || col.key;
    const maxData = Math.max(...rows.map((r) => String(r[col.key] != null ? r[col.key] : '-').length));
    return Math.max(header.length, maxData);
  });
  const header = cols.map((col, i) => (col.label || col.key).padEnd(widths[i])).join('  ');
  const divider = cols.map((col, i) => '─'.repeat(widths[i])).join('  ');
  console.log('  ' + header);
  console.log('  ' + divider);
  for (const row of rows) {
    const line = cols.map((col, i) => {
      const val = row[col.key] != null ? String(row[col.key]) : '-';
      return val.padEnd(widths[i]);
    }).join('  ');
    console.log('  ' + line);
  }
}

// ---------------------------------------------------------------------------
// Sub-command: show
// ---------------------------------------------------------------------------

function createBudgetShowCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'show', description: 'Show current token usage per worker/runtime from worker logs.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      'worker-id': { type: 'string', description: 'Filter to a specific worker (e.g. w1)', default: '' },
      since: { type: 'string', description: 'ISO timestamp — only include records after this time', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({ projectId: args.projectid });
        const root = resolveRoot(context);
        const sinceArg = args.since || '';
        const workerIdFilter = args['worker-id'] || '';
        const isJson = args.json || shouldUseJson();

        let records = aggregateWorkerTokens({ projectRoot: root, since: sinceArg || undefined });
        if (workerIdFilter) records = records.filter((r) => r.workerId === workerIdFilter);

        // Summarize per worker
        const byWorker = new Map();
        for (const rec of records) {
          const key = rec.workerId;
          if (!byWorker.has(key)) {
            byWorker.set(key, {
              workerId: rec.workerId,
              runtime: rec.runtime || 'unknown',
              handoffs: 0,
              totalTokens: 0,
              rateLimitCount: 0,
              lastTs: null,
            });
          }
          const w = byWorker.get(key);
          w.handoffs += 1;
          w.totalTokens += rec.totalTokens || 0;
          if (rec.rateLimited) w.rateLimitCount += 1;
          if (!w.lastTs || (rec.ts && rec.ts > w.lastTs)) w.lastTs = rec.ts;
        }

        const rows = Array.from(byWorker.values()).sort((a, b) => a.workerId.localeCompare(b.workerId));

        const payload = {
          aggregatedAt: new Date().toISOString(),
          projectRoot: root,
          since: sinceArg || null,
          workerFilter: workerIdFilter || null,
          workers: rows,
          totals: {
            handoffs: records.length,
            totalTokens: records.reduce((s, r) => s + (r.totalTokens || 0), 0),
            rateLimitEvents: records.filter((r) => r.rateLimited).length,
          },
        };

        if (isJson) { console.log(JSON.stringify(payload, null, 2)); return; }

        console.log(`Runtime budget — token aggregation (project=${context.projectId || 'auto'}${sinceArg ? ', since=' + sinceArg : ''})`);
        console.log('');
        printTable(rows.map((r) => ({
          ...r,
          totalTokens: r.totalTokens.toLocaleString(),
          lastTs: r.lastTs ? r.lastTs.slice(0, 19).replace('T', ' ') : '-',
        })), [
          { key: 'workerId', label: 'WORKER' },
          { key: 'runtime', label: 'RUNTIME' },
          { key: 'handoffs', label: 'HANDOFFS' },
          { key: 'totalTokens', label: 'TOTAL_TOKENS' },
          { key: 'rateLimitCount', label: 'RATE_LIMITS' },
          { key: 'lastTs', label: 'LAST_ACTIVITY' },
        ]);
        console.log('');
        console.log(`Totals: ${payload.totals.handoffs} handoffs, ${payload.totals.totalTokens.toLocaleString()} tokens, ${payload.totals.rateLimitEvents} rate-limit events`);
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-command: predict
// ---------------------------------------------------------------------------

function createBudgetPredictCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'predict', description: 'Predict when a worker will next hit its rate limit.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      'worker-id': { type: 'string', description: 'Worker id to predict for (e.g. w1); omit for all workers', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({ projectId: args.projectid });
        const root = resolveRoot(context);
        const workerIdArg = args['worker-id'] || '';
        const isJson = args.json || shouldUseJson();

        const predictions = [];
        if (workerIdArg) {
          predictions.push({ workerId: workerIdArg, ...predictNextRateLimit({ workerId: workerIdArg, projectRoot: root }) });
        } else {
          // Predict for all workers that have logs
          const { _internal } = require('../../../lib/runtime-budget/index.cjs');
          const logs = _internal.discoverWorkerLogs(root);
          for (const { workerId } of logs) {
            const pred = predictNextRateLimit({ workerId, projectRoot: root });
            predictions.push({ workerId, ...pred });
          }
        }

        const payload = {
          predictedAt: new Date().toISOString(),
          projectRoot: root,
          predictions,
        };

        if (isJson) { console.log(JSON.stringify(payload, null, 2)); return; }

        console.log(`Runtime budget — rate-limit prediction (project=${context.projectId || 'auto'})`);
        console.log('');
        printTable(predictions.map((p) => ({
          workerId: p.workerId || '-',
          etaSeconds: p.etaSeconds != null ? fmtSeconds(p.etaSeconds) : '-',
          rateTokensPerHour: p.rateTokensPerHour != null ? p.rateTokensPerHour.toLocaleString() : '-',
          threshold: p.threshold != null ? p.threshold.toLocaleString() : '-',
          status: p.etaSeconds != null ? (p.etaSeconds < 1800 ? 'WARN' : 'OK') : (p.reason || 'n/a'),
        })), [
          { key: 'workerId', label: 'WORKER' },
          { key: 'etaSeconds', label: 'ETA' },
          { key: 'rateTokensPerHour', label: 'TOKENS/HR' },
          { key: 'threshold', label: 'THRESHOLD' },
          { key: 'status', label: 'STATUS' },
        ]);
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-command: histogram
// ---------------------------------------------------------------------------

function createBudgetHistogramCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'histogram', description: 'Token-cost distribution for a task shape.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      'task-shape': { type: 'string', description: 'Task shape: a runtime id or context tier (micro/small/medium/large)', default: '' },
      since: { type: 'string', description: 'ISO timestamp — only include records after this time', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({ projectId: args.projectid });
        const root = resolveRoot(context);
        const taskShape = args['task-shape'] || '';
        const sinceArg = args.since || '';
        const isJson = args.json || shouldUseJson();

        const hist = histogram({ projectRoot: root, taskShape: taskShape || undefined, since: sinceArg || undefined });
        const costRows = costPerHandoff({ projectRoot: root, since: sinceArg || undefined, byRuntime: true });

        const payload = {
          computedAt: new Date().toISOString(),
          projectRoot: root,
          taskShape: taskShape || 'all',
          since: sinceArg || null,
          histogram: hist,
          costByRuntime: costRows,
        };

        if (isJson) { console.log(JSON.stringify(payload, null, 2)); return; }

        console.log(`Runtime budget — histogram (task-shape=${taskShape || 'all'}, project=${context.projectId || 'auto'})`);
        console.log('');
        if (!hist.n) {
          console.log('  No token data found for the given filter.');
          return;
        }
        console.log(`  n=${hist.n}  mean=${(hist.mean || 0).toLocaleString()}  p50=${(hist.p50 || 0).toLocaleString()}  p90=${(hist.p90 || 0).toLocaleString()}  p99=${(hist.p99 || 0).toLocaleString()}`);
        console.log('');
        if (costRows.length) {
          console.log('  Cost by runtime:');
          printTable(costRows.map((r) => ({
            runtime: r.runtime,
            contextTier: r.contextTier,
            timeTier: r.timeTier,
            count: r.count,
            totalTokens: (r.totalTokens || 0).toLocaleString(),
            avgTokens: (r.avgTokens || 0).toLocaleString(),
          })), [
            { key: 'runtime', label: 'RUNTIME' },
            { key: 'contextTier', label: 'CONTEXT_TIER' },
            { key: 'timeTier', label: 'TIME_TIER' },
            { key: 'count', label: 'COUNT' },
            { key: 'totalTokens', label: 'TOTAL_TOKENS' },
            { key: 'avgTokens', label: 'AVG_TOKENS' },
          ]);
        }
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-command: snapshot
// ---------------------------------------------------------------------------

function createBudgetSnapshotCommand({ resolveGadRuntimeContext, output, outputError, shouldUseJson }) {
  return defineCommand({
    meta: { name: 'snapshot', description: 'Persist current budget state to .planning/.gad-log/token-budgets.jsonl.' },
    args: {
      projectid: { type: 'string', description: 'Project id', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    async run({ args }) {
      try {
        const context = await resolveGadRuntimeContext({ projectId: args.projectid });
        const root = resolveRoot(context);
        const isJson = args.json || shouldUseJson();

        const result = persistBudgetSnapshot({ projectRoot: root });

        const payload = {
          persistedAt: new Date().toISOString(),
          written: result.written,
          path: result.path,
          snapshot: result.snapshot,
        };

        if (isJson) { console.log(JSON.stringify(payload, null, 2)); return; }

        if (result.written) {
          console.log(`Budget snapshot persisted → ${result.path}`);
          const snap = result.snapshot;
          console.log(`  totalHandoffs=${snap.totalHandoffs}  totalTokens=${(snap.totalTokens || 0).toLocaleString()}  rateLimitEvents=${snap.totalRateLimitEvents}`);
        } else {
          console.log(`Budget snapshot: write failed (path=${result.path})`);
        }
      } catch (err) {
        outputError(err.message);
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Aggregator factory
// ---------------------------------------------------------------------------

function createRuntimeBudgetCommand(deps) {
  return defineCommand({
    meta: {
      name: 'budget',
      description: 'Runtime token-cost dimension: show usage, predict rate limits, histogram per task shape, persist time-series.',
    },
    subCommands: {
      show: createBudgetShowCommand(deps),
      predict: createBudgetPredictCommand(deps),
      histogram: createBudgetHistogramCommand(deps),
      snapshot: createBudgetSnapshotCommand(deps),
    },
  });
}

module.exports = { createRuntimeBudgetCommand };
