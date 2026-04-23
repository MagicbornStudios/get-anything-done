'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const DONE_WORD_RE = /\b(verified|shipped|validated|complete[d]?|resolved|landed|implemented|proven|done)\b/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function normaliseStatus(status) {
  const value = String(status || 'planned').toLowerCase();
  return value === 'active' ? 'in-progress' : value;
}

function ageDays(updatedAt, now = new Date()) {
  if (!updatedAt) return null;
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

function hasRecentTaskCommit({ baseDir, root, taskId }) {
  const cwd = path.join(baseDir, root.path || '.');
  try {
    const out = execFileSync('git', [
      'log',
      '--since=30 days ago',
      '--all',
      '--format=%H',
      '--grep',
      escapeGitGrep(taskId),
      '-F',
    ], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

function escapeGitGrep(value) {
  return String(value || '');
}

function auditTasks({ tasks, baseDir, root, phase = '', now = new Date() }) {
  return tasks
    .filter((task) => !phase || String(task.phase) === String(phase))
    .map((task) => {
      const status = normaliseStatus(task.status);
      const updatedAt = task.updated_at || task.updatedAt || '';
      const age = ageDays(updatedAt, now);
      const flags = [];
      const goal = String(task.goal || '');

      if (status === 'planned' && DONE_WORD_RE.test(goal)) {
        flags.push('GOAL-READS-DONE');
      }

      if (status === 'in-progress') {
        if (age != null && age > 14) flags.push('STALE-INPROGRESS');

        const attributed = Boolean(
          String(task.agentId || task.agent_id || '').trim() ||
          String(task.runtime || '').trim() ||
          String(task.skill || '').trim()
        );
        if (!attributed) flags.push('ORPHAN');

        if (!hasRecentTaskCommit({ baseDir, root, taskId: task.id })) {
          flags.push('NO-CHANGES');
        }
      }

      return {
        id: task.id,
        phase: task.phase || '',
        status,
        updated_at: updatedAt,
        age_days: age == null ? '' : age,
        flags,
      };
    });
}

function splitDepends(depends) {
  return String(depends || '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function phaseRecommendations({ phases, tasks, auditRows }) {
  const byPhase = new Map();
  for (const task of tasks) {
    const key = String(task.phase || '');
    if (!byPhase.has(key)) byPhase.set(key, []);
    byPhase.get(key).push(task);
  }

  const phaseStatus = new Map(phases.map((phase) => [String(phase.id), normaliseStatus(phase.status)]));
  const readyToClose = [];
  const superseded = [];
  const empty = [];

  for (const phase of phases) {
    const id = String(phase.id);
    const status = normaliseStatus(phase.status);
    const phaseTasks = byPhase.get(id) || [];
    if (status !== 'done' && status !== 'cancelled' && phaseTasks.length > 0 && phaseTasks.every(isClosedTask)) {
      readyToClose.push({
        id,
        status,
        tasks: phaseTasks.length,
        recommendation: `gad phases close ${id}`,
      });
    }

    const deps = splitDepends(phase.depends);
    if (status === 'planned' && deps.length > 0 && deps.every((dep) => phaseStatus.get(dep) === 'cancelled')) {
      superseded.push({
        id,
        depends: deps,
        recommendation: `gad phases cancel ${id} --reason "dependency cascade"`,
      });
    }

    if (status === 'planned' && phaseTasks.length === 0) {
      empty.push({
        id,
        recommendation: 'review: kickoff or cancel',
      });
    }
  }

  const staleTasks = auditRows
    .filter((row) => row.flags.length > 0)
    .map((row) => ({
      id: row.id,
      phase: row.phase,
      status: row.status,
      updated_at: row.updated_at,
      age_days: row.age_days,
      flags: row.flags,
      recommendation: 'review task state',
    }));

  return { readyToClose, superseded, empty, staleTasks };
}

function isClosedTask(task) {
  const status = normaliseStatus(task.status);
  return status === 'done' || status === 'cancelled' || status === 'canceled';
}

module.exports = {
  auditTasks,
  phaseRecommendations,
  normaliseStatus,
};
