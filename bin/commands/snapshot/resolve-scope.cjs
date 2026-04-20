'use strict';

const path = require('path');

function resolveScopedSnapshot(deps, root, baseDir, planDir, args) {
  const phases = deps.readPhases(root, baseDir);
  const stateXml = deps.readXmlFile(path.join(planDir, 'STATE.xml'));
  const currentPhase = stateXml ? (stateXml.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1]?.trim() || '' : '';
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
    currentPhase,
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
};
