'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { loadState, saveState, appendHistory, writeHeartbeat } = require('../../../lib/delta-train/state.cjs');
const { runExport } = require('../../../lib/telemetry/export.cjs');
const { deltaTrainRoot } = require('../../../lib/delta-train/paths.cjs');

/**
 * Single iteration of the delta-training loop.
 */
module.exports = defineCommand({
  meta: {
    name: 'tick',
    description: 'Run a single iteration of the delta-training loop.',
  },
  args: {
    'dry-run': { type: 'boolean', description: 'Log steps without executing training/benchmark', default: false },
    projectid: { type: 'string', description: 'Project to run for', default: 'global' },
  },
  async run({ args }) {
    const baseDir = process.cwd();
    const state = loadState(baseDir);
    const tickId = `tick-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const startedAt = new Date().toISOString();

    console.log(`[delta-train] Starting tick ${tickId}`);
    writeHeartbeat(baseDir, { phase: 'starting', tick_id: tickId });

    try {
      // 1. Export telemetry
      const outDir = path.join(baseDir, '.planning', 'delta-training', 'exports', tickId);
      writeHeartbeat(baseDir, { phase: 'exporting', tick_id: tickId });
      
      const exportResult = await runExport({
        rootDir: baseDir,
        outDir,
        since: state.last_pull_ts,
        format: 'jsonl',
        redact: true,
      });

      if (exportResult.rowCount === 0) {
        console.log('[delta-train] No new telemetry since last pull. Skipping tick.');
        state.skip_count += 1;
        state.last_tick_at = new Date().toISOString();
        saveState(baseDir, state);
        appendHistory(baseDir, {
          tick_id: tickId,
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          outcome: 'skipped',
          reason: 'no-new-telemetry',
          input_envelopes: 0,
        });
        return;
      }

      console.log(`[delta-train] Exported ${exportResult.rowCount} envelopes.`);

      // 2. Training (Subprocess invocation)
      // For now, we'll just log this as a placeholder until Task 147-06 is ready.
      if (args['dry-run']) {
        console.log('[delta-train] [DRY RUN] Would invoke training script in slm-learning.');
      } else {
        // TODO: Invoke actual training scripts in slm-learning
        console.log('[delta-train] Training invocation not yet implemented.');
      }

      // 3. Benchmarking
      if (args['dry-run']) {
        console.log('[delta-train] [DRY RUN] Would invoke benchmark script in slm-learning.');
      }

      // 4. Update state
      state.tick_count += 1;
      state.last_tick_at = new Date().toISOString();
      state.last_pull_ts = exportResult.manifest.until;
      state.consecutive_failures = 0;
      saveState(baseDir, state);

      appendHistory(baseDir, {
        tick_id: tickId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        outcome: args['dry-run'] ? 'dry-run' : 'completed',
        input_envelopes: exportResult.rowCount,
      });

      console.log(`[delta-train] Tick ${tickId} finished.`);
    } catch (e) {
      const reason = classifyError(e);
      console.error(`[delta-train] Tick ${tickId} FAILED: ${reason} (${e.message})`);
      state.consecutive_failures += 1;
      saveState(baseDir, state);
      appendHistory(baseDir, {
        tick_id: tickId,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        outcome: 'errored',
        reason,
      });
    }
  },
});

function classifyError(e) {
  const msg = e.message || '';
  if (msg.includes('CUDA out of memory')) return 'gpu-oom';
  if (msg.includes('ENOSPC')) return 'disk-full';
  if (msg.includes('telemetry export')) return 'export-failed';
  if (msg.includes('training script')) return 'train-failed';
  if (msg.includes('benchmark script')) return 'bench-failed';
  return 'unknown-error';
}
