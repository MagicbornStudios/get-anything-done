'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionValidateCommand({ repoRoot, evolutionPaths }) {
  return defineCommand({
    meta: { name: 'validate', description: 'Run advisory validator on a proto-skill (writes VALIDATION.md)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug (directory name under .planning/proto-skills/)', required: true },
    },
    run({ args }) {
      const { protoSkillsDir } = evolutionPaths(repoRoot);
      const dir = path.join(protoSkillsDir, args.slug);
      const skillPath = path.join(dir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error(`No proto-skill found at ${skillPath}`);
        process.exit(1);
      }
      const { writeValidation } = require('../../../lib/evolution-validator.cjs');
      const { outPath, result } = writeValidation(skillPath, path.resolve(repoRoot, '..', '..'));
      const okFiles = result.fileRefs.filter((f) => f.exists).length;
      const okCmds = result.cliCommands.filter((c) => c.valid === true).length;
      console.log(`Validated ${args.slug}`);
      console.log(`  File refs: ${okFiles}/${result.fileRefs.length}`);
      console.log(`  CLI cmds:  ${okCmds}/${result.cliCommands.length}`);
      console.log(`  -> ${outPath}`);
    },
  });
}

module.exports = { createEvolutionValidateCommand };
