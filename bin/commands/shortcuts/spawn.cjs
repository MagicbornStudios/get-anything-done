'use strict';

function createSpawnCommand({ defineCommand, outputError, evalRun }) {
  return defineCommand({
    meta: { name: 'spawn', description: 'Spawn a new generation from a species (evolutionary: create a build)' },
    args: {
      target: { type: 'positional', description: 'Project/species path (e.g. escape-the-dungeon/vcs-test)', required: true },
      runtime: { type: 'string', description: 'Runtime driving the eval (claude-code, codex, cursor, etc.)', default: '' },
      'prompt-only': { type: 'boolean', description: 'Only generate the bootstrap prompt, do not create worktree', default: false },
      execute: { type: 'boolean', description: 'Output JSON for the orchestrating agent to spawn a worktree agent with full tracing', default: false },
      'install-skills': { type: 'string', description: 'Comma-separated paths to skills to install into the eval template before running', default: '' },
    },
    async run({ args }) {
      const parts = args.target.split('/');
      if (parts.length < 2) {
        outputError('Usage: gad spawn <project>/<species>');
        process.exit(1);
      }

      await evalRun.run({
        args: {
          project: args.target,
          baseline: 'HEAD',
          runtime: args.runtime,
          'prompt-only': args['prompt-only'],
          execute: args.execute,
          'install-skills': args['install-skills'],
        },
      });
    },
  });
}

module.exports = { createSpawnCommand };
