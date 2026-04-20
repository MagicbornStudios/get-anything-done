'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createEvolutionPromoteCommand({ repoRoot, evolutionPaths }) {
  return defineCommand({
    meta: { name: 'promote', description: 'Promote a proto-skill into skills/ + workflows/ (joins species DNA)' },
    args: {
      slug: { type: 'positional', description: 'proto-skill slug', required: true },
      name: { type: 'string', description: 'final skill name in skills/ (defaults to slug)', required: false },
    },
    run({ args }) {
      const { protoSkillsDir, finalSkillsDir, candidatesDir } = evolutionPaths(repoRoot);
      const protoDir = path.join(protoSkillsDir, args.slug);
      if (!fs.existsSync(protoDir)) {
        console.error(`No proto-skill at ${protoDir}`);
        process.exit(1);
      }
      const skillPath = path.join(protoDir, 'SKILL.md');
      if (!fs.existsSync(skillPath)) {
        console.error('Missing SKILL.md in proto-skill - cannot promote');
        process.exit(1);
      }

      let frontmatterName = null;
      try {
        const skillBody = fs.readFileSync(skillPath, 'utf8');
        const fmMatch = skillBody.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
        if (fmMatch) {
          const nameLine = fmMatch[1].match(/^name:\s*(.+?)\s*$/m);
          if (nameLine && nameLine[1]) frontmatterName = nameLine[1].trim();
        }
      } catch {}
      const finalName = args.name || frontmatterName || args.slug;
      const finalDir = path.join(finalSkillsDir, finalName);
      if (fs.existsSync(finalDir)) {
        console.error(`Final skill dir already exists at ${finalDir} - refusing to overwrite. Pass --name <other> or remove it manually.`);
        process.exit(1);
      }

      fs.mkdirSync(finalDir, { recursive: true });

      const siblingWorkflowPath = path.join(protoDir, 'workflow.md');
      const hasSiblingWorkflow = fs.existsSync(siblingWorkflowPath);
      const workflowsDir = path.join(repoRoot, 'workflows');
      const canonicalWorkflowPath = hasSiblingWorkflow
        ? path.join(workflowsDir, `${finalName}.md`)
        : null;

      if (hasSiblingWorkflow) {
        if (fs.existsSync(canonicalWorkflowPath)) {
          fs.rmSync(finalDir, { recursive: true, force: true });
          console.error(
            `Canonical workflow already exists at ${path.relative(repoRoot, canonicalWorkflowPath)} - refusing to overwrite. Pass --name <other> or remove it manually.`
          );
          process.exit(1);
        }
        fs.mkdirSync(workflowsDir, { recursive: true });
      }

      for (const entry of fs.readdirSync(protoDir, { withFileTypes: true })) {
        if (hasSiblingWorkflow && entry.name === 'workflow.md') continue;
        const src = path.join(protoDir, entry.name);
        const dest = path.join(finalDir, entry.name);
        if (entry.isDirectory()) fs.cpSync(src, dest, { recursive: true });
        else fs.copyFileSync(src, dest);
      }

      if (hasSiblingWorkflow) {
        fs.copyFileSync(siblingWorkflowPath, canonicalWorkflowPath);
      }

      const copiedSkillPath = path.join(finalDir, 'SKILL.md');
      let copiedSkillBody = fs.readFileSync(copiedSkillPath, 'utf8');
      if (hasSiblingWorkflow) {
        const canonicalRef = `workflows/${finalName}.md`;
        copiedSkillBody = copiedSkillBody.replace(
          /^(workflow:\s*)(.+)$/m,
          (_, prefix) => `${prefix}${canonicalRef}`
        );
      }
      copiedSkillBody = copiedSkillBody.replace(
        /^(status:\s*)proto\s*$/m,
        (_, prefix) => `${prefix}stable`
      );
      fs.writeFileSync(copiedSkillPath, copiedSkillBody);

      fs.rmSync(protoDir, { recursive: true, force: true });
      const candidateDir = path.join(candidatesDir, args.slug);
      if (fs.existsSync(candidateDir)) fs.rmSync(candidateDir, { recursive: true, force: true });

      console.log(`Promoted ${args.slug} -> ${path.relative(repoRoot, finalDir)}`);
      if (hasSiblingWorkflow) {
        console.log(`  Split workflow: ${path.relative(repoRoot, canonicalWorkflowPath)}`);
      } else {
        console.log('  (no sibling workflow.md - SKILL.md promoted as inline body)');
      }
      console.log(`  Removed proto-skill: ${path.relative(repoRoot, protoDir)}`);
    },
  });
}

module.exports = { createEvolutionPromoteCommand };
