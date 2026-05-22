'use strict';
/**
 * gad team perf - aggregate per-worker completion throughput and token usage.
 *
 * Reads worker log.jsonl files under .planning/team/workers and returns a
 * per-worker rollup scoped by `since`. Token counts come from work-complete
 * entries when the runtime reports them; otherwise they remain null per handoff
 * and do not contribute to totals.
 */

const fs = require('fs');
const path = require('path');
const { listHandoffs } = require('../handoffs.cjs');
const taskFiles = require('../task-files.cjs');

function readJsonl(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toMs(value) {
  if (!value) return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : ms;
}

function normalizeNumber(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function listWorkerDirs(baseDir) {
  const workersDir = path.join(baseDir, '.planning', 'team', 'workers');
  try {
    return fs.readdirSync(workersDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function readTaskStatusIndex(baseDir) {
  const planningDir = path.join(baseDir, '.planning');
  if (!taskFiles.hasTasksDir(planningDir)) return new Map();
  const tasks = taskFiles.listAll(planningDir);
  return new Map(tasks.map((task) => [String(task.id), String(task.status || '').toLowerCase()]));
}

function readHandoffTaskIndex(baseDir) {
  const byId = new Map();
  for (const bucket of ['open', 'claimed', 'closed']) {
    let rows = [];
    try {
      rows = listHandoffs({ baseDir, bucket }) || [];
    } catch {
      rows = [];
    }
    for (const row of rows) {
      const taskId = row && row.frontmatter ? row.frontmatter.task_id : null;
      byId.set(row.id, taskId ? String(taskId) : null);
    }
  }
  return byId;
}

function createEmptyWorkerSummary(workerId, runtime = null) {
  return {
    worker_id: workerId,
    runtime,
    handoffs_completed: 0,
    tasks_closed: 0,
    tokens_input: 0,
    tokens_output: 0,
    tokens_total: 0,
    rate_limit_hits: 0,
  };
}

function addKnown(target, value) {
  return target + (Number.isFinite(value) ? value : 0);
}

function summarizeWorkerLog(workerId, filePath, handoffTaskIndex, taskStatusIndex, sinceMs) {
  const summary = createEmptyWorkerSummary(workerId);
  const lines = readJsonl(filePath);
  const closedTasks = new Set();

  for (const entry of lines) {
    const entryMs = toMs(entry.ts);
    if (sinceMs != null && (entryMs == null || entryMs < sinceMs)) continue;

    if (entry.kind === 'worker-start' && !summary.runtime) {
      summary.runtime = entry.runtime || null;
      continue;
    }

    if (entry.kind === 'runtime-rate-limit-on-call') {
      if (!summary.runtime && entry.runtime) summary.runtime = entry.runtime;
      summary.rate_limit_hits += 1;
      continue;
    }

    if (entry.kind !== 'work-complete') continue;
    if (!summary.runtime && entry.runtime) summary.runtime = entry.runtime;
    if (entry.exit_code !== 0 || entry.rate_limited === true) continue;

    summary.handoffs_completed += 1;

    const tokensInput = normalizeNumber(entry.tokens_input != null ? entry.tokens_input : entry.tokens_in);
    const tokensOutput = normalizeNumber(entry.tokens_output != null ? entry.tokens_output : entry.tokens_out);
    const tokensTotal = normalizeNumber(
      entry.tokens_total != null
        ? entry.tokens_total
        : (Number.isFinite(tokensInput) && Number.isFinite(tokensOutput) ? tokensInput + tokensOutput : null)
    );

    summary.tokens_input = addKnown(summary.tokens_input, tokensInput);
    summary.tokens_output = addKnown(summary.tokens_output, tokensOutput);
    summary.tokens_total = addKnown(summary.tokens_total, tokensTotal);

    const handoffId = entry.ref ? String(entry.ref) : null;
    const taskId = handoffId ? handoffTaskIndex.get(handoffId) : null;
    if (taskId && taskStatusIndex.get(taskId) === 'done') closedTasks.add(taskId);
  }

  summary.tasks_closed = closedTasks.size;
  return summary;
}

function summarizeTeamPerf({ baseDir, since, projectid = null } = {}) {
  const sinceMs = since ? toMs(since) : null;
  const handoffTaskIndex = readHandoffTaskIndex(baseDir);
  const taskStatusIndex = readTaskStatusIndex(baseDir);
  const workers = [];

  for (const workerId of listWorkerDirs(baseDir)) {
    const filePath = path.join(baseDir, '.planning', 'team', 'workers', workerId, 'log.jsonl');
    workers.push(summarizeWorkerLog(workerId, filePath, handoffTaskIndex, taskStatusIndex, sinceMs));
  }

  const totals = workers.reduce((acc, worker) => ({
    handoffs_completed: acc.handoffs_completed + worker.handoffs_completed,
    tasks_closed: acc.tasks_closed + worker.tasks_closed,
    tokens_input: acc.tokens_input + worker.tokens_input,
    tokens_output: acc.tokens_output + worker.tokens_output,
    tokens_total: acc.tokens_total + worker.tokens_total,
    rate_limit_hits: acc.rate_limit_hits + worker.rate_limit_hits,
  }), {
    handoffs_completed: 0,
    tasks_closed: 0,
    tokens_input: 0,
    tokens_output: 0,
    tokens_total: 0,
    rate_limit_hits: 0,
  });

  return {
    since: since || null,
    projectid: projectid || null,
    workers,
    totals,
  };
}

module.exports = {
  summarizeTeamPerf,
  _private: {
    readHandoffTaskIndex,
    readTaskStatusIndex,
    summarizeWorkerLog,
  },
};
