'use strict';
/**
 * `gad skill …` command family — list, show, find, promote, promote-folder,
 * lint, status, token-audit. Includes `isCanonicalGadRepo` helper.
 *
 * skillPromote delegates to evolutionPromote/evolutionInstall (both injected).
 *
 * Most skill helpers stay in gad.cjs because snapshotCmd and canonical-skill
 * record builders also consume them; we accept them as factory deps.
 */

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');
const { createSkillPromoteCommand } = require('./skill/promote.cjs');
const { createSkillListCommand } = require('./skill/list.cjs');
const { createSkillLintCommand } = require('./skill/lint.cjs');
const { createSkillTokenAuditCommand } = require('./skill/token-audit.cjs');
const { createSkillStatusCommand } = require('./skill/status.cjs');
const { createSkillShowCommand } = require('./skill/show.cjs');
const { createSkillPromoteFolderCommand } = require('./skill/promote-folder.cjs');
const { createSkillFindCommand } = require('./skill/find.cjs');

function isCanonicalGadRepo(repoRoot) {
  try {
    if (fs.existsSync(path.join(repoRoot, '.gad-canonical'))) return true;
  } catch {}
  try {
    const out = require('child_process')
      .execSync('git config --get remote.origin.url', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    if (/MagicbornStudios\/get-anything-done(\.git)?$/i.test(out)) return true;
    if (/get-anything-done(\.git)?$/i.test(out)) return true;
  } catch {}
  return false;
}

function createSkillCommands(deps) {
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
  } = deps;

  const commandDeps = {
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
  };

  const skillPromote = createSkillPromoteCommand(commandDeps);

  const skillList = createSkillListCommand(commandDeps);

  const skillLint = createSkillLintCommand(commandDeps);

  const skillTokenAudit = createSkillTokenAuditCommand(commandDeps);

  const skillStatus = createSkillStatusCommand(commandDeps);

  const skillShow = createSkillShowCommand(commandDeps);

  const skillPromoteFolder = createSkillPromoteFolderCommand(commandDeps);

  const skillFind = createSkillFindCommand(commandDeps);

  const skillCmd = defineCommand({
    meta: { name: 'skill', description: 'Skill ops — list, show, find, promote (--framework canonical / --project consumer runtime install), promote-folder (any skill-shaped folder → framework canonical, framework-only). See decisions gad-188, gad-196.' },
    subCommands: {
      list: skillList,
      show: skillShow,
      lint: skillLint,
      status: skillStatus,
      'token-audit': skillTokenAudit,
      find: skillFind,
      promote: skillPromote,
      'promote-folder': skillPromoteFolder,
    },
  });

  return { skillCmd, isCanonicalGadRepo };
}

module.exports = { createSkillCommands, isCanonicalGadRepo };
module.exports.register = (ctx) => {
  const { skillCmd } = createSkillCommands({
    ...ctx.common,
    ...ctx.extras.skill,
    evolutionPromote: ctx.services.evolution.evolutionPromote,
    evolutionInstall: ctx.services.evolution.evolutionInstall,
  });
  return { skill: skillCmd };
};
