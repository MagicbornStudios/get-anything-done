'use strict';
/**
 * gad sprint — sprint boundaries and context
 *
 * Required deps: findRepoRoot, gadConfig, resolveRoots, readPhases, readTasks,
 *   readXmlFile, shouldUseJson
 */

const path = require('path');
const { defineCommand } = require('citty');

function getSprintPhaseIds(phases, sprintSize, sprintIndex) {
  const start = sprintIndex * sprintSize;
  return phases.slice(start, start + sprintSize).map(p => p.id);
}

function getCurrentSprintIndex(phases, sprintSize, currentPhaseId) {
  const idx = phases.findIndex(p => p.id === currentPhaseId || p.id === String(currentPhaseId).padStart(2, '0'));
  return idx >= 0 ? Math.floor(idx / sprintSize) : 0;
}

function createSprintCommand(deps) {
  const { findRepoRoot, gadConfig, resolveRoots, readPhases, readTasks, readXmlFile, shouldUseJson } = deps;

  const show = defineCommand({
    meta: { name: 'show', description: 'Show sprint boundaries and phases in each sprint' },
    args: {
      projectid: { type: 'string', description: 'Project ID', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      const sprintSize = config.sprintSize || 5;

      for (const root of roots) {
        const phases = readPhases(root, baseDir);
        if (phases.length === 0) continue;
        const totalSprints = Math.ceil(phases.length / sprintSize);

        if (args.json || shouldUseJson()) {
          const sprints = [];
          for (let i = 0; i < totalSprints; i++) {
            const ids = getSprintPhaseIds(phases, sprintSize, i);
            sprints.push({ sprintIndex: i, phaseIds: ids, phases: phases.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, title: p.title, status: p.status })) });
          }
          console.log(JSON.stringify({ project: root.id, sprintSize, sprints }, null, 2));
        } else {
          console.log(`\nSprints for ${root.id} (size=${sprintSize}):\n`);
          for (let i = 0; i < totalSprints; i++) {
            const ids = getSprintPhaseIds(phases, sprintSize, i);
            const sprintPhases = phases.filter(p => ids.includes(p.id));
            console.log(`  Sprint ${i}: phases ${ids.join(', ')}`);
            for (const p of sprintPhases) console.log(`    ${p.id}  ${(p.title || '').slice(0, 50)}  [${p.status}]`);
          }
        }
      }
    },
  });

  const context = defineCommand({
    meta: { name: 'context', description: 'Sprint-scoped context window: paths + summary for current sprint' },
    args: {
      projectid: { type: 'string', description: 'Project ID', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const config = gadConfig.load(baseDir);
      const roots = resolveRoots(args, baseDir, config.roots);
      const sprintSize = config.sprintSize || 5;

      for (const root of roots) {
        const phases = readPhases(root, baseDir);
        const stateContent = readXmlFile(path.join(baseDir, root.path, root.planningDir, 'STATE.xml'));
        const currentPhase = stateContent ? (stateContent.match(/<current-phase>([\s\S]*?)<\/current-phase>/) || [])[1] || '' : '';
        const k = getCurrentSprintIndex(phases, sprintSize, currentPhase.trim());
        const phaseIds = getSprintPhaseIds(phases, sprintSize, k);
        const sprintPhases = phases.filter(p => phaseIds.includes(p.id));
        const tasks = readTasks(root, baseDir, {});
        const sprintTasks = tasks.filter(t => {
          const taskPhase = t.id ? t.id.split('-')[0] : '';
          return phaseIds.includes(taskPhase) || phaseIds.includes(taskPhase.padStart(2, '0'));
        });
        const openTasks = sprintTasks.filter(t => t.status !== 'done');

        const context = {
          project: root.id, sprintIndex: k, sprintSize, phaseIds,
          phases: sprintPhases.map(p => ({ id: p.id, title: p.title, status: p.status })),
          taskCount: sprintTasks.length, openTaskCount: openTasks.length,
        };

        if (args.json || shouldUseJson()) {
          console.log(JSON.stringify(context, null, 2));
        } else {
          console.log(`\nSprint ${k} (${root.id}): phases ${phaseIds.join(', ')}`);
          for (const p of sprintPhases) console.log(`  ${p.id}  ${(p.title || '').slice(0, 60)}  [${p.status}]`);
          console.log(`\nTasks: ${sprintTasks.length} total, ${openTasks.length} open`);
        }
      }
    },
  });

  return defineCommand({
    meta: { name: 'sprint', description: 'Sprint management — show boundaries and get sprint context window' },
    subCommands: { show, context },
  });
}

module.exports = { createSprintCommand, getSprintPhaseIds, getCurrentSprintIndex };
