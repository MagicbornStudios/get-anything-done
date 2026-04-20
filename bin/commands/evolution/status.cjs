'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { classifyProtoSkillDraftingState } = require('../../../lib/proto-skill-state.cjs');

function createEvolutionStatusCommand({ repoRoot, evolutionPaths, protoSkillRelativePath }) {
  return defineCommand({
    meta: { name: 'status', description: 'Show evolution state - pending proto-skills + candidates' },
    run() {
      const { candidatesDir, protoSkillsDir, evolutionsDir } = evolutionPaths(repoRoot);
      const candidates = fs.existsSync(candidatesDir)
        ? fs.readdirSync(candidatesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const protoSkills = fs.existsSync(protoSkillsDir)
        ? fs.readdirSync(protoSkillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
        : [];
      const evolutions = fs.existsSync(evolutionsDir)
        ? fs.readdirSync(evolutionsDir).filter((e) => !e.startsWith('.'))
        : [];

      const drafting = classifyProtoSkillDraftingState(candidatesDir, protoSkillsDir);

      if (candidates.length === 0 && protoSkills.length === 0) {
        console.log('No active evolution.');
        console.log(`  ${evolutions.length} historical evolutions recorded in skills/.evolutions/`);
        return;
      }
      console.log(`Active evolution: ${evolutions[evolutions.length - 1] || '(no marker found)'}`);
      console.log('');

      console.log('Drafting queue (create-proto-skill):');
      console.log(`  pending:     ${drafting.pending.length}   (candidate without proto-skill dir)`);
      console.log(`  in-progress: ${drafting.inProgress.length}   (PROVENANCE.md present, SKILL.md missing - resume target)`);
      console.log(`  complete:    ${drafting.complete.length}   (proto-skill bundle drafted)`);
      console.log('');

      if (drafting.inProgress.length > 0) {
        console.log('Resume in-progress proto-skills (previous run crashed mid-draft):');
        for (const slug of drafting.inProgress) {
          console.log(`  - ${protoSkillRelativePath(slug)}/   [PROVENANCE.md only]`);
        }
        console.log('');
      }

      if (candidates.length > 0) {
        console.log(`Candidates (raw, awaiting drafting): ${candidates.length}`);
        for (const c of candidates) console.log(`  - .planning/candidates/${c}/`);
        console.log('');
      }
      if (protoSkills.length > 0) {
        console.log(`Proto-skills (drafted, awaiting human review): ${protoSkills.length}`);
        for (const p of protoSkills) {
          const hasValidation = fs.existsSync(path.join(protoSkillsDir, p, 'VALIDATION.md'));
          console.log(`  - ${protoSkillRelativePath(p)}/   ${hasValidation ? '[validated]' : '[no validation yet]'}`);
        }
        console.log('');
        console.log('Review then run:');
        console.log('  gad evolution install <slug> [--codex|--claude|...]   # test without promotion');
        console.log('  gad evolution promote <slug>   # joins species DNA');
        console.log('  gad evolution discard <slug>   # delete');
      }
    },
  });
}

module.exports = { createEvolutionStatusCommand };
