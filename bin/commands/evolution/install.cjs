'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionInstallCommand({
  repoRoot,
  evolutionPaths,
  resolveProtoSkillInstallRuntimes,
  installProtoSkillToRuntime,
  protoSkillRelativePath,
}) {
  return defineCommand({
    meta: { name: 'install', description: 'Install a staged proto-skill into one or more coding-agent runtimes without promoting it' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      claude: { type: 'boolean' },
      codex: { type: 'boolean' },
      cursor: { type: 'boolean' },
      windsurf: { type: 'boolean' },
      augment: { type: 'boolean' },
      copilot: { type: 'boolean' },
      antigravity: { type: 'boolean' },
      all: { type: 'boolean' },
      global: { type: 'boolean' },
      local: { type: 'boolean' },
      'config-dir': { type: 'string', description: 'Custom runtime config directory', default: '' },
    },
    run({ args }) {
      if (args.global && args.local) {
        console.error('Choose either --global or --local for proto-skill install, not both.');
        process.exit(1);
      }
      const { protoSkillsDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`No proto-skill found at ${skillPath}`);
        process.exit(1);
      }
      const runtimes = resolveProtoSkillInstallRuntimes(args);
      const installMode = args.global ? 'global' : 'local';
      console.log(`Installing proto-skill ${args.slug} from ${protoSkillRelativePath(args.slug)}/`);
      console.log(`  mode: ${installMode}`);
      for (const runtime of runtimes) {
        const result = installProtoSkillToRuntime(protoDir, args.slug, runtime, {
          global: Boolean(args.global),
          configDir: args['config-dir'] || '',
        });
        console.log(`  ${runtime}: ${result.nativeDir}`);
        console.log(`           ${result.mirrorDir}`);
      }
      console.log('');
      console.log('Proto-skill remains staged in .planning until you promote or discard it.');
    },
  });
}

module.exports = { createEvolutionInstallCommand };
