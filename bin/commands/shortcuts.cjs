'use strict';
/**
 * Top-level shortcut commands (decision gad-219):
 *   - spawn  → delegates to evalRun for "create a build from species"
 *   - breed  → unions two species into a new one
 *   - play   → HTTP preview of preserved generation build artifact
 *
 * Required deps: outputError, evalRun (cmd object with .run),
 *   evalDataAccess (factory returning data-access API),
 *   servePreservedGenerationBuildArtifact.
 */

const { defineCommand } = require('citty');

function createShortcutCommands(deps) {
  const { outputError, evalRun, evalDataAccess, servePreservedGenerationBuildArtifact } = deps;

  const spawnCmd = defineCommand({
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
      await evalRun.run({ args: {
        project: args.target,
        baseline: 'HEAD',
        runtime: args.runtime,
        'prompt-only': args['prompt-only'],
        execute: args.execute,
        'install-skills': args['install-skills'],
      } });
    },
  });

  const breedCmd = defineCommand({
    meta: { name: 'breed', description: 'Breed two species into a new one — union + shed redundancy (decision gad-219)' },
    args: {
      project: { type: 'string', description: 'Project id', required: true },
      parentA: { type: 'string', description: 'Primary parent species (precedence on scalar conflicts)', required: true },
      parentB: { type: 'string', description: 'Secondary parent species', required: true },
      name: { type: 'string', description: 'New species name (kebab-case)', required: true },
      description: { type: 'string', description: 'Override description', default: '' },
      workflow: { type: 'string', description: 'Override workflow (gad, bare, emergent)', default: '' },
      noInherit: { type: 'boolean', description: 'Do not set inherits_from on the bred species', default: false },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const da = evalDataAccess();
      const result = da.breedSpecies(args.project, args.parentA, args.parentB, args.name, {
        description: args.description || undefined,
        workflow: args.workflow || undefined,
        noInherit: args.noInherit,
      });
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Bred "${args.parentA}" + "${args.parentB}" -> "${args.name}" in project "${args.project}"`);
        console.log(`  shed: dna=${result.shed.dna}, installedSkills=${result.shed.installedSkills}`);
        console.log(`  dir: ${result.speciesDir}`);
      }
    },
  });

  const playCmd = defineCommand({
    meta: {
      name: 'play',
      description:
        "HTTP preview of a preserved generation's **build artifact** (HTML). Same as `gad generation open`. Not `gad site serve`. Use `--no-browser` for editor iframe workflows.",
    },
    args: {
      target: { type: 'positional', description: 'Project/species/version (e.g. escape-the-dungeon/bare/v3)', required: true },
      noBrowser: {
        type: 'boolean',
        description: 'Do not open a system browser; print the preview URL only.',
        default: false,
      },
    },
    run({ args }) {
      const parts = args.target.split('/');
      if (parts.length < 3) {
        outputError('Usage: gad play <project>/<species>/<version>');
        process.exit(1);
      }
      const version = parts[parts.length - 1];
      const project = parts.slice(0, -1).join('/');
      const noBrowser = args.noBrowser === true || args['no-browser'] === true;
      servePreservedGenerationBuildArtifact({
        project,
        version,
        logPrefix: '[gad play]',
        noBrowser,
      });
    },
  });

  return { spawnCmd, breedCmd, playCmd };
}

module.exports = { createShortcutCommands };
