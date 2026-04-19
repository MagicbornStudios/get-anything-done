'use strict';
/**
 * gad discovery-test — print subagent discovery test battery instructions
 *
 * Self-contained: no external dependencies.
 */

const { defineCommand } = require('citty');

function createDiscoveryTestCommand() {
  return defineCommand({
    meta: { name: 'discovery-test', description: 'Print the subagent discovery test battery instructions. Operator runs the actual battery by invoking the gad:discovery-test skill (or gad:proto-skill-battery with --proto) in an agent session.' },
    args: {
      date: { type: 'string', description: 'ISO date for findings filename (default: today)', default: '' },
      agents: { type: 'string', description: 'Number of cold agents (default: 5 for canonical, 2×N for --proto)', default: '5' },
      proto: { type: 'boolean', description: 'Point at the proto-skill battery (findability + supersession per proto) instead of the canonical discovery battery', default: false },
    },
    run({ args }) {
      const today = args.date || new Date().toISOString().slice(0, 10);
      if (args.proto) {
        console.log('Proto-skill discoverability + supersession battery');
        console.log('');
        console.log(`  findings → .planning/notes/proto-skill-battery-${today}.md`);
        console.log(`  site data → site/data/proto-skill-findings.json`);
        console.log(`  agents    → 2 cold subagents per proto-skill (findability + supersession arms)`);
        console.log('');
        console.log('Runs as a skill (gad:proto-skill-battery). Per-proto measurement: findability');
        console.log('(0-10), execution_sufficiency (0-10), shed_score (0.0-1.0 from proto-vs-proto');
        console.log('supersession ranking). shed_score >= 0.5 flags for review; >= 0.75 recommends');
        console.log('eviction. Operator decides — battery NEVER mutates canonical state.');
        console.log('');
        console.log('  1. Read the workflow:  gad skill show gad-proto-skill-battery --body');
        console.log('  2. In your session: say "run the proto-skill battery"');
        console.log('  3. Automatic cadence: wired as step 9 of workflows/evolution-evolve.md,');
        console.log('     so every `gad evolution evolve` cycle runs the battery on its output.');
        console.log('');
        console.log('Cost: ~2 agents × ~50k tokens per proto. 10 proto-skills → ~1M tokens/run.');
        return;
      }
      const n = parseInt(args.agents, 10) || 5;
      console.log('Subagent discovery test battery');
      console.log('');
      console.log(`  findings → .planning/notes/subagent-discovery-findings-${today}.md`);
      console.log(`  site data → site/data/discovery-findings.json`);
      console.log(`  agents    → ${n} parallel cold subagents`);
      console.log('');
      console.log('Battery runs as a skill (gad:discovery-test), not as a direct CLI invocation —');
      console.log('it requires spawning subagents via the Agent tool, which only works from inside');
      console.log('a coding-agent session. To run it:');
      console.log('');
      console.log('  1. Read the workflow:  gad skill show gad-discovery-test --body');
      console.log('  2. In your session, invoke the skill by saying "run the discovery test battery"');
      console.log('     or by reading workflows/discovery-test.md and following the steps.');
      console.log('');
      console.log('The battery takes ~90 seconds wall-clock and ~250k total tokens (5 agents × ~50k).');
      console.log('Rerun after any change to the skill catalog, CLI discovery surface, or skill-shape docs.');
      console.log('');
      console.log('Target mean confidence: 8.5 / 10. Below that is a regression.');
      console.log('');
      console.log('Proto-skill variant: `gad discovery-test --proto` (per-proto findability + shed score).');
    },
  });
}

module.exports = { createDiscoveryTestCommand };
