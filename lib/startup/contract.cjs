'use strict';
/**
 * startup/contract.cjs — print the GAD session-start contract block.
 *
 * Pure formatting. No side effects, no spawns, no disk reads beyond
 * iterating the list of configured roots.
 */

function buildContractLines({ config, sideEffectsMode }) {
  const lines = [
    'GAD session startup — one command gets you full context.',
    '',
    '  gad snapshot --projectid <id>      # full context dump, ~6-7k tokens',
    '',
    '  NOTE: `gad snapshot` is the canonical orientation command (D6, 2026-04-20).',
    '        `gad startup` is an alias kept for one release.',
    '',
    'What snapshot gives you:',
    '  - STATE.xml (current phase, next-action, references)',
    '  - ROADMAP in-sprint phases',
    '  - Open + recently-done tasks in sprint window',
    '  - Recent decisions (last 30)',
    '  - EQUIPPED SKILLS (top 5 by relevance, with workflow pointers)',
    '  - DOCS-MAP + file references',
    '',
    'After reading snapshot output:',
    '  1. Act on the <next-action> line in STATE.xml — this is what to do next.',
    '  2. Browse EQUIPPED SKILLS for skills relevant to the current sprint.',
    '     Use `gad skill show <id>` to inspect any skill end-to-end.',
    '  3. Use `gad skill list --paths` for the full skill inventory with paths.',
    '',
    'Cross-session continuity:',
    '  - Decisions live in .planning/DECISIONS.xml — query with `gad decisions`.',
    '  - Task attribution is on TASK-REGISTRY.xml entries (skill= attribute).',
    '  - Re-run snapshot after auto-compact to re-hydrate.',
    '',
    'Artifact id formats:',
    '  - Project ids come from gad-config.toml [[planning.roots]] (example: global).',
    '  - Phase ids are roadmap ids like 79, 80, or 42.5.',
    '  - Task ids are phase-prefixed ids like 60-05a or 65-07.',
    '  - Decision ids preserve their stored prefix: use gad-285, not 285.',
    '  - Handoff ids are full timestamped ids like h-2026-04-30T19-02-05-global-65.',
    '  - When unsure, list first and copy the exact stored/legacy id.',
    '',
    'Rehydration cost note (decision gad-195, 2026-04-15):',
    '  Snapshot is ~6-7k tokens. Running it every turn wastes cache. Run it',
    '  once at session start and at clean phase boundaries. Between those',
    '  points, trust the planning doc edits you made — they are durable.',
    '',
    'Common project ids on this repo:',
  ];

  if (config && Array.isArray(config.roots) && config.roots.length > 0) {
    for (const root of config.roots) lines.push(`  - ${root.id}`);
  } else {
    lines.push('  (run `gad projects list` to see available project ids)');
  }

  lines.push('');
  lines.push('Single most important command: `gad snapshot --projectid <id>`.');
  lines.push('Everything else is optional until you have that context.');

  if (sideEffectsMode && sideEffectsMode.enabled) {
    lines.push('');
    lines.push(`Side effects suppressed: ${sideEffectsMode.reasons.join(', ')}`);
  }

  return lines;
}

function printContract({ config, sideEffectsMode, logger = console }) {
  logger.log(buildContractLines({ config, sideEffectsMode }).join('\n'));
}

module.exports = { buildContractLines, printContract };
