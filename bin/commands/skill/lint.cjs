'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillLintCommand(deps) {
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
  const skillLint = defineCommand({
    meta: { name: 'lint', description: 'Run the non-blocking skill linter across canonical skills or one named skill' },
    args: {
      id: { type: 'string', description: 'Lint a single canonical skill id', default: '' },
      severity: { type: 'string', description: 'Filter to issues at or above error|warning|info', default: '' },
      json: { type: 'boolean', description: 'JSON output', default: false },
    },
    run({ args }) {
      const { finalSkillsDir } = resolveSkillRoots(repoRoot);
      const minimumSeverity = String(args.severity || '').trim().toLowerCase();
      if (minimumSeverity && !['error', 'warning', 'info'].includes(minimumSeverity)) {
        outputError(`Invalid severity: ${minimumSeverity}. Expected error, warning, or info.`);
      }

      let reports;
      if (args.id) {
        const skillPath = path.join(finalSkillsDir, String(args.id), 'SKILL.md');
        if (!fs.existsSync(skillPath)) {
          outputError(`Skill not found: ${args.id}`);
        }
        reports = [lintSkill(skillPath, { gadDir: repoRoot })];
      } else {
        reports = lintAllSkills(finalSkillsDir, { gadDir: repoRoot });
      }

      const filteredReports = reports.map((report) => ({
        ...report,
        issues: filterIssuesBySeverity(report.issues || [], minimumSeverity),
      }));
      const summary = summarizeLint(filteredReports);

      if (args.json || shouldUseJson()) {
        console.log(JSON.stringify({ summary, reports: filteredReports }, null, 2));
        return;
      }

      const issueBuckets = filteredReports.filter((report) => report.issues.length > 0);
      console.log(`Skill lint report - ${summary.totalSkills} skills, ${summary.clean} clean, ${issueBuckets.length} with issues`);
      if (issueBuckets.length > 0) console.log('');
      for (const report of issueBuckets) {
        console.log(`${path.relative(repoRoot, report.skillPath)} (${report.issues.length} issue${report.issues.length === 1 ? '' : 's'})`);
        for (const issue of report.issues) {
          console.log(`  [${issue.severity}] ${issue.code} - ${issue.message}`);
        }
        console.log('');
      }
      console.log(`Summary: ${summary.bySeverity.error} errors, ${summary.bySeverity.warning} warnings, ${summary.bySeverity.info} info`);
      console.log(`Total tokens: ${summary.totalTokens} across ${summary.totalSkills} skills (avg ${summary.averageTokens}/skill)`);
    },
  });
  return skillLint;
}

module.exports = { createSkillLintCommand };