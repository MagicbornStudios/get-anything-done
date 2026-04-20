'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillStatusCommand(deps) {
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
  const skillStatus = defineCommand({
    meta: { name: 'status', description: 'Show one skill health card: frontmatter, lint issues, bundle completeness, usage, and token footprint' },
    args: {
      id: { type: 'positional', description: 'Skill id (canonical or proto)', required: true },
    },
    run({ args }) {
      const baseDir = findRepoRoot();
      const { protoSkillsDir, finalSkillsDir } = resolveSkillRoots(repoRoot);
      const roots = [
        { label: 'canonical', dir: finalSkillsDir },
        { label: 'proto', dir: protoSkillsDir },
      ];
      let hit = null;
      for (const root of roots) {
        const candidate = listSkillDirs(root.dir).find((skill) => skill.id === args.id);
        if (!candidate) continue;
        hit = { ...candidate, origin: root.label, fm: readSkillFrontmatter(candidate.skillFile) };
        break;
      }
      if (!hit) outputError(`Skill not found: ${args.id}`);

      const lintReport = lintSkill(hit.skillFile, { gadDir: repoRoot });
      const workflowPath = hit.fm.workflow ? resolveSkillWorkflowPath(repoRoot, hit.dir, hit.fm.workflow) : null;
      const skillTokens = auditSkillTokens(hit.skillFile, { gadDir: repoRoot });
      const workflowTokenAudit = workflowPath && fs.existsSync(workflowPath)
        ? auditSkillTokens(workflowPath, { gadDir: repoRoot })
        : null;
      const usageIndex = buildSkillUsageIndex(baseDir, finalSkillsDir);
      const usage = usageIndex.bySkill.get(hit.id) || null;
      const bundleChecks = [
        ['SKILL.md', true],
        ['PROVENANCE.md', fs.existsSync(path.join(hit.dir, 'PROVENANCE.md'))],
        ['VALIDATION.md', fs.existsSync(path.join(hit.dir, 'VALIDATION.md'))],
        ['workflow.md', fs.existsSync(path.join(hit.dir, 'workflow.md'))],
        ['COMMAND.md', fs.existsSync(path.join(hit.dir, 'COMMAND.md'))],
        ['references/', fs.existsSync(path.join(hit.dir, 'references'))],
      ];

      console.log(`Skill: ${hit.id} [${hit.origin}]`);
      console.log(`  name:       ${hit.fm.name || hit.id}`);
      console.log(`  lane:       ${normalizeSkillLaneValues(hit.fm.lane).join(', ') || '(none)'}`);
      console.log(`  type:       ${hit.fm.type || '(none)'}`);
      console.log(`  status:     ${hit.fm.status || '(none)'}`);
      console.log(`  parent:     ${hit.fm.parent_skill || '(none)'}`);
      if (workflowPath) {
        console.log(`  workflow:   ${hit.fm.workflow} [${fs.existsSync(workflowPath) ? 'ok' : 'missing'}]`);
      } else {
        console.log('  workflow:   (none)');
      }
      if (workflowTokenAudit) {
        const totalTokens = (skillTokens.totalTokens || 0) + (workflowTokenAudit.totalTokens || 0);
        console.log(`  tokens:     ~${skillTokens.totalTokens || 0} SKILL.md + ~${workflowTokenAudit.totalTokens || 0} workflow (~${totalTokens} total)`);
      } else {
        console.log(`  tokens:     ~${lintReport.tokenEstimate} (SKILL.md)`);
      }
      console.log(`  bundle:     ${bundleChecks.map(([label, ok]) => `${label} ${ok ? '[ok]' : '[missing]'}`).join('  ')}`);
      if (usage) {
        const projects = usage.projects || [];
        const projectSummary = projects.length === 1 ? ` (${projects[0]})` : '';
        console.log(`  usage:      ${usage.runs} done tasks, ${projects.length} project${projects.length === 1 ? '' : 's'}${projectSummary}; last run ${usage.lastUsedAt ? usage.lastUsedAt.slice(0, 10) : 'unknown'}`);
      } else {
        console.log('  usage:      0 done tasks, 0 projects; last run unknown');
      }
      if (hit.fm.canonicalization_rationale) {
        console.log(`  lineage:    ${String(hit.fm.canonicalization_rationale).replace(/\s+/g, ' ').trim()}`);
      }
      console.log('');
      console.log(`Issues${lintReport.issues.length === 0 ? ': (none)' : ` (${lintReport.issues.length}):`}`);
      if (lintReport.issues.length > 0) {
        for (const issue of lintReport.issues) {
          console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
        }
      }
      console.log('');
      console.log('Section tokens:');
      for (const section of skillTokens.sections || []) {
        console.log(`  ${section.name.padEnd(34, ' ')} ~${section.tokens}`);
      }
      console.log(`  ${'(total)'.padEnd(34, ' ')} ~${skillTokens.totalTokens || 0}`);
    },
  });
  return skillStatus;
}

module.exports = { createSkillStatusCommand };