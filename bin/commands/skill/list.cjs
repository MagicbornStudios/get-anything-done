'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillListCommand(deps) {
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
  const skillList = defineCommand({
    meta: { name: 'list', description: 'List canonical skills (from skills/) and any pending proto-skills' },
    args: {
      proto: { type: 'boolean', description: 'List only pending proto-skills' },
      canonical: { type: 'boolean', description: 'List only canonical skills' },
      paths: { type: 'boolean', description: 'Print absolute SKILL.md path and resolved workflow path for each skill (decision gad-194, task 42.2-20)' },
      lane: { type: 'string', description: 'Filter by lane (dev|prod|meta)', default: '' },
      'lint-summary': { type: 'boolean', description: 'Append a non-blocking lint summary for the listed canonical skills', default: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const showCanonical = !args.proto;
      const showProto = !args.canonical;
      const showPaths = Boolean(args.paths);
      const laneFilter = validateSkillLaneFilter(args.lane);
      let listedCanonical = [];
      if (showCanonical) {
        const canonical = listSkillDirs(finalSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
        listedCanonical = canonical;
        console.log(`Canonical skills (skills/): ${canonical.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
        for (const s of canonical) {
          const fm = readSkillFrontmatter(s.skillFile);
          console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
          if (showPaths) {
            console.log(`      SKILL.md: ${s.skillFile}`);
            if (fm.workflow) {
              const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
              const exists = fs.existsSync(resolved);
              console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
            }
          }
        }
        console.log('');
      }
      if (showProto) {
        const proto = listSkillDirs(protoSkillsDir).filter((skill) => skillMatchesLane(readSkillFrontmatter(skill.skillFile), laneFilter));
        console.log(`Proto-skills (.planning/proto-skills/): ${proto.length}${laneFilter ? `  lane=${laneFilter}` : ''}`);
        for (const s of proto) {
          const fm = readSkillFrontmatter(s.skillFile);
          console.log(`  ${s.id}${fm.name && fm.name !== s.id ? `  (${fm.name})` : ''}`);
          if (showPaths) {
            console.log(`      SKILL.md: ${s.skillFile}`);
            if (fm.workflow) {
              const resolved = resolveSkillWorkflowPath(repoRoot, s.dir, fm.workflow);
              const exists = fs.existsSync(resolved);
              console.log(`      workflow: ${resolved}${exists ? '' : ' (MISSING)'}`);
            }
          }
        }
        if (proto.length > 0) {
          console.log('');
          console.log('Promote with:');
          console.log('  gad skill promote <slug> --framework            # canonical (this repo only)');
          console.log('  gad skill promote <slug> --project --claude     # runtime install');
        }
      }
      if (args['lint-summary'] && showCanonical) {
        const lintReports = listedCanonical.map((skill) => lintSkill(skill.skillFile, { gadDir: repoRoot }));
        const lintSummary = summarizeLint(lintReports);
        console.log('');
        console.log(`Lint: ${lintSummary.clean} clean, ${lintSummary.bySeverity.error} errors, ${lintSummary.bySeverity.warning} warnings, ${lintSummary.bySeverity.info} info - run \`gad skill lint\` for detail.`);
      }
      console.log('');
      console.log('Authoring skills — which to fire when:');
      console.log('  create-skill         neutral generic authoring, no eval loop');
      console.log('  create-proto-skill   fast drafter inside evolution loop (candidate → proto)');
      console.log('  gad-skill-creator    GAD-tailored heavy path, eval scaffold');
      console.log('  merge-skill          fuse overlapping / duplicate skills');
      console.log('');
      console.log('Skill lifecycle (decision gad-183 / references/skill-shape.md §11):');
      console.log('  candidate → proto-skill → [install/validate] → promoted');
      console.log('  gad evolution evolve       # find high-pressure phases → write CANDIDATE.md');
      console.log('  create-proto-skill         # draft from candidate → .planning/proto-skills/<slug>/');
      console.log('  gad evolution install      # test in runtime without promoting');
      console.log('  gad evolution validate     # advisory checker → VALIDATION.md');
      console.log('  gad evolution promote      # → skills/<name>/ + workflows/<name>.md');
      console.log('');
      console.log('Discovery helpers:');
      console.log('  gad skill show <id>        # name, description, resolved workflow path');
      console.log('  gad skill show <id> --body # full SKILL.md + workflow contents');
      console.log('  gad skill list --paths     # inventory with absolute paths + MISSING flags');
    },
  });
  return skillList;
}

module.exports = { createSkillListCommand };