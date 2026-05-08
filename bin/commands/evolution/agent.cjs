'use strict';
/**
 * bin/commands/evolution/agent.cjs — gad evolution agent <prompt>
 *
 * Dispatches an evolution agent handoff with the canonical skill loadout.
 * Returns the handoff id on success.
 *
 * Usage:
 *   gad evolution agent "<prompt>" [--projectid X] [--phase N] [--dry-run]
 */

const { defineCommand } = require('citty');
const { dispatchEvolutionAgent, EVOLUTION_AGENT_SKILLS, EVOLUTION_AGENT_PROFILE } = require('../../../lib/agents/evolution-agent.cjs');

function createEvolutionAgentCommand({ repoRoot, findRepoRoot, gadConfig, resolveRoots, outputError } = {}) {
  return defineCommand({
    meta: {
      name: 'agent',
      description: 'Dispatch an evolution agent handoff with the canonical skill loadout',
    },
    args: {
      prompt: {
        type: 'positional',
        description: 'Instruction to the evolution agent',
        required: false,
      },
      projectid: {
        type: 'string',
        description: 'Target project id (default: global)',
        default: 'global',
      },
      phase: {
        type: 'string',
        description: 'Target phase (default: 107)',
        default: '107',
      },
      'dry-run': {
        type: 'boolean',
        description: 'Print the handoff body without creating it',
        default: false,
      },
      info: {
        type: 'boolean',
        description: 'Print skill loadout + agent profile and exit',
        default: false,
      },
    },
    run({ args }) {
      // --info: dump profile and exit
      if (args.info) {
        console.log('Evolution agent — skill loadout:');
        for (const s of EVOLUTION_AGENT_SKILLS) {
          console.log(`  ${s}`);
        }
        console.log('\nAgent profile:');
        console.log(JSON.stringify(EVOLUTION_AGENT_PROFILE, null, 2));
        return;
      }

      const promptArg = args.prompt;
      if (!promptArg || !String(promptArg).trim()) {
        const err = typeof outputError === 'function' ? outputError : console.error.bind(console);
        err('evolution agent: prompt is required. Usage: gad evolution agent "<prompt>" [--projectid X]');
        process.exit(1);
        return;
      }

      // Resolve project root
      let projectRoot;
      try {
        const baseDir = typeof findRepoRoot === 'function' ? findRepoRoot() : process.cwd();
        if (gadConfig && typeof gadConfig.load === 'function' && typeof resolveRoots === 'function') {
          const config = gadConfig.load(baseDir);
          const roots = resolveRoots({ projectid: args.projectid || 'global' }, baseDir, config.roots);
          const root = (roots && roots[0]) || null;
          projectRoot = root
            ? require('path').resolve(baseDir, root.path || '.')
            : baseDir;
        } else {
          projectRoot = repoRoot || baseDir;
        }
      } catch {
        projectRoot = repoRoot || process.cwd();
      }

      const dryRun = args['dry-run'] || false;
      const result = dispatchEvolutionAgent({
        prompt: String(promptArg).trim(),
        projectRoot,
        projectid: args.projectid || 'global',
        phase: args.phase || '107',
        dryRun,
      });

      if (dryRun) {
        console.log('--- DRY RUN: handoff body ---');
        console.log(result.body);
        console.log('--- end ---');
      } else {
        console.log(`Handoff created: ${result.id}`);
      }
    },
  });
}

module.exports = { createEvolutionAgentCommand };
