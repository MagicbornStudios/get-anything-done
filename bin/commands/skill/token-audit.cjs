'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillTokenAuditCommand(deps) {
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
  const skillTokenAudit = defineCommand({
    meta: { name: 'token-audit', description: 'Audit canonical skill token footprint and highlight the largest skill bundles' },
    args: {
      top: { type: 'string', description: 'How many skills to show (default 10)', default: '10' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { finalSkillsDir } = resolveSkillRoots(repoRoot);
      const topN = Math.max(1, Number.parseInt(String(args.top || '10'), 10) || 10);
      const audits = listSkillDirs(finalSkillsDir).map((skill) => ({
        id: skill.id,
        path: skill.skillFile,
        audit: auditSkillTokens(skill.skillFile, { gadDir: repoRoot }),
      }));
      const summary = {
        totalSkills: audits.length,
        totalTokens: audits.reduce((sum, entry) => sum + (entry.audit.totalTokens || 0), 0),
      };
      summary.averageTokens = summary.totalSkills > 0 ? Math.round(summary.totalTokens / summary.totalSkills) : 0;
      const top = [...audits]
        .sort((a, b) => (b.audit.totalTokens || 0) - (a.audit.totalTokens || 0))
        .slice(0, topN);

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({
          summary,
          top: top.map((entry) => ({
            id: entry.id,
            path: path.relative(repoRoot, entry.path),
            totalTokens: entry.audit.totalTokens || 0,
            sections: entry.audit.sections || [],
          })),
        }, null, 2));
        return;
      }

      console.log(`Skill token audit - ${summary.totalSkills} skills, ${summary.totalTokens} total tokens, ${summary.averageTokens} avg`);
      console.log('');
      console.log(`Top ${top.length} bloat:`);
      for (const entry of top) {
        console.log(`  ${(entry.audit.totalTokens || 0).toString().padStart(4, ' ')}  ${path.relative(repoRoot, entry.path)}`);
      }
      const breakdown = top.slice(0, Math.min(3, top.length));
      if (breakdown.length > 0) {
        console.log('');
        console.log(`Per-section breakdown for top ${breakdown.length}:`);
        for (const entry of breakdown) {
          console.log(`  ${entry.id}:`);
          for (const section of entry.audit.sections || []) {
            console.log(`    ${section.name.padEnd(28, ' ')} ~${section.tokens}`);
          }
        }
      }
    },
  });
  return skillTokenAudit;
}

module.exports = { createSkillTokenAuditCommand };