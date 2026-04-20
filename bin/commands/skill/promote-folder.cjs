'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createSkillPromoteFolderCommand(deps) {
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
  const skillPromoteFolder = defineCommand({
    meta: { name: 'promote-folder', description: 'Promote any skill-shaped folder into the canonical get-anything-done framework `skills/` + `workflows/` tree. Generalizes `evolution promote` — source can be `.planning/proto-skills/<slug>/` (the evolve-loop pathway), a hand-authored draft, or a consumer project proto-skill being elevated to framework canonical. Consumer projects do NOT use this — their proto-skills auto-register in the project tree. Decision gad-196 (task 42.2-32/34).' },
    args: {
      source: { type: 'positional', description: 'absolute or relative path to a skill-shaped folder (must contain SKILL.md with valid frontmatter)', required: true },
      name: { type: 'string', description: 'Final skill name (defaults to source dir basename)', default: '' },
      'dry-run': { type: 'boolean', description: 'Print what would happen without writing anything', default: false },
      force: { type: 'boolean', description: 'Overwrite an existing skills/<name>/ or workflows/<name>.md at the destination', default: false },
    },
    run({ args }) {
      const srcDir = path.resolve(args.source);
      if (!fs.existsSync(srcDir) || !fs.statSync(srcDir).isDirectory()) {
        console.error(`Source path is not a directory: ${srcDir}`);
        process.exit(1);
      }
      const srcSkill = path.join(srcDir, 'SKILL.md');
      if (!fs.existsSync(srcSkill)) {
        console.error(`Source folder is not skill-shaped: missing SKILL.md at ${srcSkill}`);
        process.exit(1);
      }

      const raw = fs.readFileSync(srcSkill, 'utf8');
      const fmMatch = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
      if (!fmMatch) {
        console.error(`SKILL.md has no frontmatter block: ${srcSkill}`);
        process.exit(1);
      }
      const fmBody = fmMatch[1];
      const nameMatch = fmBody.match(/^name:\s*(.+?)\s*$/m);
      const descMatch = fmBody.match(/^description:\s*(.+?)\s*$/m);
      if (!nameMatch) {
        console.error(`SKILL.md frontmatter missing required 'name:' key`);
        process.exit(1);
      }
      if (!descMatch) {
        console.error(`SKILL.md frontmatter missing required 'description:' key`);
        process.exit(1);
      }

      const finalName = args.name || path.basename(srcDir);
      if (!isCanonicalGadRepo(repoRoot)) {
        console.error('Refusing promote-folder: not in the canonical get-anything-done repo.');
        console.error('');
        console.error('Detection: git remote.origin.url must match MagicbornStudios/get-anything-done,');
        console.error('or a .gad-canonical sentinel file must exist at the repo root.');
        console.error('');
        console.error('Consumer projects do not promote — proto-skills in a consumer project');
        console.error("live in that project's own tree and are automatically available.");
        console.error('There is no cross-project install operation for this command.');
        process.exit(1);
      }
      const destRoot = repoRoot;

      const destSkillDir = path.join(destRoot, 'skills', finalName);
      const destWorkflowsDir = path.join(destRoot, 'workflows');

      const workflowRefMatch = fmBody.match(/^workflow:\s*(.+?)\s*$/m);
      let workflowRef = null;
      let sourceWorkflowPath = null;
      let destCanonicalWorkflowPath = null;
      if (workflowRefMatch) {
        workflowRef = workflowRefMatch[1].replace(/^["']|["']$/g, '').trim();
        const isSibling = workflowRef.startsWith('./') || workflowRef.startsWith('../');
        if (isSibling) {
          sourceWorkflowPath = path.resolve(srcDir, workflowRef);
        } else {
          const candidate = path.resolve(path.dirname(path.dirname(srcDir)), workflowRef);
          if (fs.existsSync(candidate)) sourceWorkflowPath = candidate;
        }
        destCanonicalWorkflowPath = path.join(destWorkflowsDir, `${finalName}.md`);
      }

      const collisions = [];
      if (fs.existsSync(destSkillDir) && !args.force) {
        collisions.push(`destination skill dir already exists: ${destSkillDir}`);
      }
      if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath) && !args.force) {
        collisions.push(`destination workflow file already exists: ${destCanonicalWorkflowPath}`);
      }
      if (collisions.length > 0) {
        console.error('Refusing to overwrite (pass --force to override):');
        for (const c of collisions) console.error(`  ${c}`);
        process.exit(1);
      }

      console.log(`Promote skill folder`);
      console.log(`  source:      ${srcDir}`);
      console.log(`  destination: ${destSkillDir}`);
      if (destCanonicalWorkflowPath) {
        console.log(`  workflow →   ${destCanonicalWorkflowPath}`);
      }
      console.log(`  name:        ${finalName}`);
      console.log(`  public name: ${nameMatch[1].replace(/^["']|["']$/g, '').trim()}`);
      console.log('');

      if (args['dry-run']) {
        console.log('--dry-run: no files written.');
        return;
      }

      fs.mkdirSync(destSkillDir, { recursive: true });
      if (destCanonicalWorkflowPath) fs.mkdirSync(destWorkflowsDir, { recursive: true });

      const siblingToSkip = sourceWorkflowPath && workflowRef &&
        (workflowRef.startsWith('./') || workflowRef.startsWith('../'))
        ? path.resolve(sourceWorkflowPath)
        : null;
      for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const src = path.join(srcDir, entry.name);
        if (siblingToSkip && path.resolve(src) === siblingToSkip) continue;
        const dest = path.join(destSkillDir, entry.name);
        if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
        else fs.copyFileSync(src, dest);
      }

      if (sourceWorkflowPath && fs.existsSync(sourceWorkflowPath) && destCanonicalWorkflowPath) {
        fs.copyFileSync(sourceWorkflowPath, destCanonicalWorkflowPath);
        const canonicalRef = `workflows/${finalName}.md`;
        const destSkillFile = path.join(destSkillDir, 'SKILL.md');
        const destRaw = fs.readFileSync(destSkillFile, 'utf8');
        const rewritten = destRaw.replace(
          /^(workflow:\s*)(.+)$/m,
          (_, prefix) => `${prefix}${canonicalRef}`
        );
        fs.writeFileSync(destSkillFile, rewritten);
      }

      console.log(`Promoted → ${path.relative(destRoot, destSkillDir)}`);
      if (destCanonicalWorkflowPath && fs.existsSync(destCanonicalWorkflowPath)) {
        console.log(`  Workflow: ${path.relative(destRoot, destCanonicalWorkflowPath)}`);
      }
      console.log('');
      console.log('Verify:');
      console.log(`  gad skill show ${finalName}`);
    },
  });
  return skillPromoteFolder;
}

module.exports = { createSkillPromoteFolderCommand };