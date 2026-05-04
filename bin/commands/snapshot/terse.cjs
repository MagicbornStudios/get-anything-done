'use strict';

const path = require('path');
const { buildSprintTaskSection } = require('./sprint-tasks.cjs');

function handleTerseSnapshot(deps, context, args) {
  const {
    baseDir,
    root,
    planDir,
    sprintSize,
    currentPhase,
    stateXml,
    phases,
    allTasks,
  } = context;

  const sprintIndex = deps.getCurrentSprintIndex(phases, sprintSize, currentPhase);
  const sprintPhaseIds = deps.getSprintPhaseIds(phases, sprintSize, sprintIndex);
  const lines = [];

  // Sprint scope
  lines.push(`Snapshot (terse): ${root.id} - phases ${sprintPhaseIds.join(', ')}`);
  lines.push('');

  // Active phase
  const activePhase = phases.find((p) => p.id === currentPhase);
  if (activePhase) {
    lines.push(`Active phase: ${activePhase.id} [${activePhase.status}] ${activePhase.title || ''}`);
    if (activePhase.goal) lines.push(`  Goal: ${(activePhase.goal || '').slice(0, 200)}`);
  } else {
    lines.push(`Active phase: ${currentPhase || '(none)'}`);
  }
  lines.push('');

  // Open task count
  const openTasks = allTasks.filter((t) => t.status !== 'done');
  const sprintOpenTasks = openTasks.filter((t) => sprintPhaseIds.includes(t.phase));
  lines.push(`Open tasks: ${sprintOpenTasks.length} in sprint, ${openTasks.length} total`);
  lines.push('');

  // Last 3 state-log entries
  if (stateXml) {
    const logMatch = stateXml.match(/<state-log>([\s\S]*?)<\/state-log>/);
    if (logMatch) {
      const entryRe = /<entry([^>]*)>([\s\S]*?)<\/entry>/g;
      const entries = [];
      let em;
      while ((em = entryRe.exec(logMatch[1])) !== null) {
        const attrs = em[1];
        const text = em[2].trim();
        const agentMatch = attrs.match(/agent="([^"]*)"/);
        const atMatch = attrs.match(/at="([^"]*)"/);
        entries.push({
          agent: agentMatch ? agentMatch[1] : '(unknown)',
          at: atMatch ? atMatch[1] : '',
          text: text.slice(0, 120),
        });
      }
      const last3 = entries.slice(-3);
      if (last3.length > 0) {
        lines.push('Last 3 state-log entries:');
        for (const entry of last3.reverse()) {
          lines.push(`  - [${entry.at.slice(11, 19) || entry.at}] ${entry.agent}: ${entry.text}`);
        }
      }
    }
  }

  const output = lines.join('\n');
  console.log(output);
  console.log(`-- end terse snapshot (~${Math.round(output.length / 4)} tokens) --`);
}

module.exports = { handleTerseSnapshot };
