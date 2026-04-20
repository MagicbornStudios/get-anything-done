'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionDiscardCommand({ repoRoot, evolutionPaths }) {
  return defineCommand({
    meta: { name: 'discard', description: 'Discard a proto-skill (deletes the directory)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      keepCandidate: { type: 'boolean', description: 'keep the candidate file (only delete the proto-skill draft)', required: false },
    },
    run({ args }) {
      const { protoSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        process.exit(1);
      }
      fs.rmSync(protoDir, { recursive: true, force: true });
      console.log(`Discarded proto-skill: ${path.relative(repoRoot, protoDir)}`);
      if (!args.keepCandidate) {
        const candidateDir = path.join(candidatesDir, args.slug);
        if (fs.existsSync(candidateDir)) {
          fs.rmSync(candidateDir, { recursive: true, force: true });
          console.log(`Discarded candidate:    ${path.relative(repoRoot, candidateDir)}`);
        }
      }
    },
  });
}

module.exports = { createEvolutionDiscardCommand };
