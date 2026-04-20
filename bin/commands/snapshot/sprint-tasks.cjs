'use strict';

const path = require('path');

function buildSprintTaskSection(deps, context, sprintPhaseIds) {
  const { baseDir, root, readOnlySnapshot, allTasks, repoRoot } = context;
  const sprintPhaseIdSet = new Set(sprintPhaseIds.map(String));
  const isSprintPhase = (phaseId) => sprintPhaseIdSet.has(String(phaseId));
  const sprintUseGraph = deps.graphExtractor.isGraphQueryEnabled(path.join(baseDir, root.path));
  let sprintOpenTasks;
  let sprintTasksSection = '';
  let sprintDoneCount;
  let outOfSprintOpenCount = 0;

  if (sprintUseGraph) {
    const { graph: sprintGraph } = deps.graphExtractor.loadOrBuildGraph(root, baseDir, {
      gadDir: repoRoot,
      readOnly: readOnlySnapshot,
    });
    if (sprintGraph) {
      const sprintAllResult = deps.graphExtractor.queryGraph(sprintGraph, { type: 'task' });
      const sprintAllMatches = sprintAllResult.matches || [];
      const sprintOpenMatches = sprintAllMatches.filter((match) => match.status !== 'done' && match.status !== 'cancelled');
      sprintDoneCount = sprintAllMatches.filter((match) => match.status === 'done').length;
      const inSprintOpenMatches = sprintOpenMatches.filter((match) => {
        const taskPhase = match.id.replace(/^task:/, '').split('-')[0];
        return isSprintPhase(taskPhase);
      });
      outOfSprintOpenCount = sprintOpenMatches.length - inSprintOpenMatches.length;
      if (inSprintOpenMatches.length > 0) {
        let currentTaskPhase = '';
        for (const match of inSprintOpenMatches) {
          const taskId = match.id.replace(/^task:/, '');
          const taskPhase = taskId.split('-')[0];
          if (taskPhase !== currentTaskPhase) {
            currentTaskPhase = taskPhase;
            sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
          }
          const goalText = (match.goal || match.label || '').slice(0, 120);
          const extraAttrs = [
            match.skill ? `skill="${match.skill}"` : '',
            match.type ? `type="${match.type}"` : '',
          ].filter(Boolean).join(' ');
          const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
          sprintTasksSection += `    <task id="${taskId}" status="${match.status}"${attrStr}>${goalText}</task>\n`;
        }
      }
      sprintOpenTasks = inSprintOpenMatches;
    } else {
      sprintDoneCount = allTasks.filter((task) => task.status === 'done').length;
      sprintOpenTasks = [];
    }
  } else {
    const allOpenTasks = allTasks.filter((task) => task.status !== 'done' && task.status !== 'cancelled');
    const inSprintOpenTasks = allOpenTasks.filter((task) => {
      const taskPhase = task.id ? task.id.split('-')[0] : '';
      return isSprintPhase(taskPhase);
    });
    outOfSprintOpenCount = allOpenTasks.length - inSprintOpenTasks.length;
    sprintOpenTasks = inSprintOpenTasks;
    if (inSprintOpenTasks.length > 0) {
      let currentTaskPhase = '';
      for (const task of inSprintOpenTasks) {
        const taskPhase = task.id ? task.id.split('-')[0] : '';
        if (taskPhase !== currentTaskPhase) {
          currentTaskPhase = taskPhase;
          sprintTasksSection += `\n  <phase id="${taskPhase.padStart(2, '0')}">\n`;
        }
        const goalText = (task.goal || '').slice(0, 120);
        const extraAttrs = [
          task.skill ? `skill="${task.skill}"` : '',
          task.type ? `type="${task.type}"` : '',
          task.agentId ? `agent-id="${task.agentId}"` : '',
        ].filter(Boolean).join(' ');
        const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
        sprintTasksSection += `    <task id="${task.id}" status="${task.status}"${attrStr}>${goalText}</task>\n`;
      }
    }
    sprintDoneCount = allTasks.filter((task) => task.status === 'done').length;
  }

  if (outOfSprintOpenCount > 0) {
    sprintTasksSection += `\n(+${outOfSprintOpenCount} open out-of-sprint — see \`gad tasks --projectid ${root.id}\`)\n`;
  }

  return {
    sprintOpenTasks,
    sprintDoneCount,
    outOfSprintOpenCount,
    sprintTasksSection,
  };
}

module.exports = { buildSprintTaskSection };
