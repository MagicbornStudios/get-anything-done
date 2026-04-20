'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillPromoteCommand(deps) {
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
  const skillPromote = defineCommand({
    meta: { name: 'promote', description: 'Promote a proto-skill — --framework (canonical skills/) or --project (consumer runtime dir)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      framework: { type: 'boolean', description: 'Promote to canonical skills/ (canonical repo only)' },
      project: { type: 'boolean', description: "Install into the current project's coding-agent runtime dirs" },
      name: { type: 'string', description: 'final skill name for --framework (defaults to slug)', required: false },
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
      'config-dir': { type: 'string', description: 'Custom runtime config directory (--project only)', default: '' },
    },
    run({ args }) {
      if (args.framework && args.project) {
        console.error('Choose either --framework or --project, not both.');
        process.exit(1);
      }
      if (!args.framework && !args.project) {
        console.error('Specify a mode: --framework (canonical skills/) or --project (consumer runtime).');
        console.error('');
        console.error('Examples:');
        console.error('  gad skill promote my-skill --framework                # canonical (repo gate)');
        console.error('  gad skill promote my-skill --project --claude          # install to ./.claude/skills/');
        console.error('  gad skill promote my-skill --project --all --global    # install to all runtimes globally');
        process.exit(1);
      }

      if (args.framework) {
        if (!isCanonicalGadRepo(repoRoot)) {
          console.error('Refusing --framework promote: this does not look like the canonical get-anything-done repo.');
          console.error('');
          console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
          console.error('or a .gad-canonical sentinel file must exist at the repo root.');
          console.error('');
          console.error('For a consumer project, use: gad skill promote <slug> --project [--claude|--codex|...]');
          process.exit(1);
        }
        return evolutionPromote.run({ args: { slug: args.slug, name: args.name } });
      }

      return evolutionInstall.run({
        args: {
          slug: args.slug,
          claude: args.claude,
          codex: args.codex,
          cursor: args.cursor,
          windsurf: args.windsurf,
          augment: args.augment,
          copilot: args.copilot,
          antigravity: args.antigravity,
          all: args.all,
          global: args.global,
          local: args.local,
          'config-dir': args['config-dir'] || '',
        },
      });
    },
  });
  return skillPromote;
}

module.exports = { createSkillPromoteCommand };