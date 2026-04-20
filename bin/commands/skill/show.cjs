'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillShowCommand(deps) {
  const {
    repoRoot,
    findRepoRoot,
    outputError,
    shouldUseJson,
    evolutionPaths,
    resolveSkillRoots,
    listSkillDirs,
    readSkillFrontmatter,
    validateSkillLaneFilter,
    skillMatchesLane,
    resolveSkillWorkflowPath,
    normalizeSkillLaneValues,
    lintSkill,
    summarizeLint,
    lintAllSkills,
    filterIssuesBySeverity,
    auditSkillTokens,
    buildSkillUsageIndex,
    evolutionPromote,
    evolutionInstall,
    isCanonicalGadRepo,
  } = deps;
  const skillShow = defineCommand({
    meta: { name: 'show', description: 'Show a canonical or proto-skill: resolved paths, frontmatter, and (optionally) SKILL.md + workflow body. Decision gad-194, task 42.2-20.' },
    args: {
      id: { type: 'positional', description: 'skill id (e.g. gad-plan-phase) or slug', required: true },
      body: { type: 'boolean', description: 'Also print SKILL.md and workflow file body', default: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const roots = [
        { label: 'canonical', dir: finalSkillsDir },
        { label: 'proto', dir: protoSkillsDir },
      ];
      let hit = null;
      for (const root of roots) {
        const entries = listSkillDirs(root.dir);
        for (const s of entries) {
          const fm = readSkillFrontmatter(s.skillFile);
          if (s.id === args.id || fm.name === args.id || fm.name === `gad:${args.id.replace(/^gad-/, '')}`) {
            hit = { ...s, fm, origin: root.label };
            break;
          }
        }
        if (hit) break;
      }

      if (!hit) {
        console.error(`Skill not found: ${args.id}`);
        console.error(`  Try:  gad skill list --paths   # full inventory with paths`);
        process.exit(1);
      }

      console.log(`Skill: ${hit.id}  [${hit.origin}]`);
      console.log(`  public name: ${hit.fm.name || '(none)'}`);
      console.log(`  description: ${(hit.fm.description || '').replace(/\s+/g, ' ').trim()}`);
      console.log(`  SKILL.md:    ${hit.skillFile}`);
      if (hit.fm.workflow) {
        const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
        const exists = fs.existsSync(resolved);
        console.log(`  workflow:    ${resolved}${exists ? '' : ' (MISSING)'}`);
      } else {
        console.log(`  workflow:    (none — inline body in SKILL.md)`);
      }

      if (args.body) {
        console.log('');
        console.log('-- SKILL.md ---------------------------------------------------');
        console.log(fs.readFileSync(hit.skillFile, 'utf8'));
        if (hit.fm.workflow) {
          const resolved = resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow);
          if (fs.existsSync(resolved)) {
            console.log('');
            console.log(`-- workflow (${path.relative(repoRoot, resolved)}) --------`);
            console.log(fs.readFileSync(resolved, 'utf8'));
          }
        }
      }
    },
  });
  return skillShow;
}

module.exports = { createSkillShowCommand };