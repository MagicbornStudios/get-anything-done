'use strict';
/**
 * startup/subagents-section.cjs — render the "DAILY SUBAGENTS PENDING" block.
 *
 * Reads today's pending subagent runs via lib/subagent-dispatch.cjs and
 * prints them as a table plus an auto-spawn / manual-spawn footer.
 *
 * auto-spawn is on by default; disable via `[subagents] autoSpawn = false`
 * in gad-config.toml or env `GAD_DAILY_AUTOSPAWN=off|false|0`.
 *
 * Non-fatal: any error is swallowed so snapshot still runs.
 */

const path = require('path');

function resolveAutoSpawn({ config }) {
  const envFlag = String(process.env.GAD_DAILY_AUTOSPAWN || '').toLowerCase();
  if (envFlag === 'off' || envFlag === 'false' || envFlag === '0') return false;
  if (config && config.subagents && config.subagents.autoSpawn === false) return false;
  return true;
}

function printDailySubagents({
  baseDir,
  config,
  render,
  logger = console,
  listTodaysRuns = null,
}) {
  try {
    const loader = listTodaysRuns || require('../subagent-dispatch.cjs').listTodaysRuns;
    const runs = loader({ baseDir });
    const pending = runs.filter((r) => r.status !== 'completed');
    if (pending.length === 0) return;

    const autoSpawn = resolveAutoSpawn({ config });

    logger.log('');
    logger.log(`-- DAILY SUBAGENTS PENDING (${pending.length}) ${'-'.repeat(Math.max(0, 38 - String(pending.length).length))}`);
    const rows = pending.map((r) => ({
      project: r.projectId,
      task: r.taskId || '-',
      status: r.status,
      prompt: r.promptPath ? path.relative(baseDir, path.join(baseDir, r.promptPath)) : '-',
    }));
    logger.log(render(rows, { format: 'table', headers: ['project', 'task', 'status', 'prompt'] }));
    logger.log('');

    if (autoSpawn) {
      logger.log("AUTO-SPAWN (default-on): spawn each subagent NOW via your runtime's Agent / subprocess-spawn mechanism.");
      logger.log('Model recommendation: Haiku for mechanical tasks, Sonnet for implementation (see tip multi-agent-offload-cheaper-01).');
      logger.log('After the subagent commits:');
    } else {
      logger.log('AUTO-SPAWN DISABLED (config). Orchestrator: spawn manually when ready, then:');
    }
    for (const p of pending) {
      const taskFlag = p.taskId ? ` --task-id ${p.taskId}` : '';
      logger.log(`  gad subagents mark-completed --projectid ${p.projectId}${taskFlag} --commit <sha>`);
    }
    if (autoSpawn) {
      logger.log('');
      logger.log('Opt out: set `[subagents] autoSpawn = false` in gad-config.toml, or env GAD_DAILY_AUTOSPAWN=off.');
    }
    logger.log('');
  } catch {
    /* non-fatal — startup still runs without the daily-subagents section */
  }
}

module.exports = { printDailySubagents, resolveAutoSpawn };
