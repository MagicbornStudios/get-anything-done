'use strict';

const path = require('path');

/**
 * Derive the effective current phase from ROADMAP phases, falling back to the
 * STATE.xml hint only when the roadmap gives no signal.
 *
 * Priority:
 *   1. Last phase that is planned or active/in-progress (trailing edge of work).
 *      New phases are always appended as "planned", so the last planned phase is
 *      the most reliable proxy for where the operator is working now.
 *   2. Last in-progress/active phase (handles edge case where all frontier is done).
 *   3. STATE.xml <current-phase> value (legacy/manual soft hint).
 *   4. Last phase in the list (absolute fallback).
 *
 * This makes <current-phase> in STATE.xml a soft hint that cannot stale-poison
 * the sprint window. Drift becomes impossible — ROADMAP.xml is the single source
 * of truth. (Bug: state-current-phase-stale-2026-05-13)
 *
 * @param {Array<{id: string, status: string}>} phases - all phases from ROADMAP
 * @param {string} fallback - STATE.xml current-phase value
 * @returns {string} effective current phase ID
 */
function deriveCurrentPhaseFromRoadmap(phases, fallback) {
  if (!phases || phases.length === 0) return fallback || '';

  const doneStatuses = new Set(['done', 'cancelled', 'skipped']);
  const activeStatuses = new Set(['in-progress', 'active']);

  // 1. Last phase that is planned or active/in-progress (trailing edge of open work)
  const frontierPhases = phases.filter(p => !doneStatuses.has(String(p.status || '').toLowerCase()));
  if (frontierPhases.length > 0) return frontierPhases[frontierPhases.length - 1].id;

  // 2. Last in-progress/active phase (all frontier phases completed — project nearly done)
  const activePhases = phases.filter(p => activeStatuses.has(String(p.status || '').toLowerCase()));
  if (activePhases.length > 0) return activePhases[activePhases.length - 1].id;

  // 3. STATE.xml soft hint
  if (fallback) return fallback;

  // 4. Last phase in list
  return phases[phases.length - 1].id;
}

function resolveScopedSnapshot(deps, root, baseDir, planDir, args) {
  const phases = deps.readPhases(root, baseDir);
  const stateXml = deps.readXmlFile(path.join(planDir, 'STATE.xml'));
  const state = deps.readState(root, baseDir);
  const currentPhase = deriveCurrentPhaseFromRoadmap(phases, state.currentPhase || '');
  const nextAction = state.nextAction || '';
  const allTasks = deps.readTasks(root, baseDir, {});
  const taskMap = new Map(allTasks.map((task) => [task.id, task]));
  const scopedTaskId = String(args.taskid || '').trim();
  const explicitPhaseId = String(args.phaseid || '').trim();
  const scopedTask = scopedTaskId ? taskMap.get(scopedTaskId) : null;

  if (scopedTaskId && !scopedTask) {
    deps.outputError(`Task not found for snapshot scope: ${scopedTaskId}`);
  }

  const scopedPhaseId = explicitPhaseId || (scopedTask ? scopedTask.phase : '');
  if (scopedPhaseId && !phases.find((phase) => phase.id === scopedPhaseId)) {
    deps.outputError(`Phase not found for snapshot scope: ${scopedPhaseId}`);
  }
  if (args.full && (scopedPhaseId || scopedTaskId)) {
    deps.outputError('`gad snapshot --full` cannot be combined with --phaseid or --taskid.');
  }

  return {
    phases,
    stateXml,
    state,
    currentPhase,
    nextAction,
    allTasks,
    scopedTaskId,
    scopedTask,
    scopedPhaseId,
  };
}

function buildScopeDescriptor(root, scoped) {
  return {
    projectId: root.id,
    phaseId: scoped.scopedPhaseId || null,
    taskId: scoped.scopedTaskId || null,
    snapshotMode: scoped.scopedTask ? 'task' : (scoped.scopedPhaseId ? 'phase' : 'project'),
    isScoped: Boolean(scoped.scopedTask || scoped.scopedPhaseId),
  };
}

module.exports = {
  buildScopeDescriptor,
  resolveScopedSnapshot,
  deriveCurrentPhaseFromRoadmap,
};
