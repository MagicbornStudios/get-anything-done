'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createTryStageCommand(deps) {
  return defineCommand({
    meta: { name: 'stage', description: 'Stage a skill into .gad-try/<slug>/ (default subcommand)' },
    args: {
      ref: { type: 'positional', description: 'slug | path | git url', required: true },
      yes: { type: 'boolean', description: 'Skip consent gate (scripted mode)', default: false },
      branch: { type: 'string', description: 'Explicit branch/tag for git sources (skips fallback probe). Task 42.2-40.b.', default: '' },
    },
    run({ args }) {
      const repoRoot = path.resolve(__dirname, '..', '..', '..');
      const { cwd, sandboxRoot } = deps.tryPaths();

      let resolved;
      try {
        resolved = deps.resolveTrySource(args.ref, repoRoot, { branch: args.branch || undefined });
      } catch (error) {
        console.error(`gad try: ${error.message}`);
        process.exit(1);
      }

      try {
        const upperPath = path.join(resolved.sourceDir, 'SKILL.md');
        const lowerPath = path.join(resolved.sourceDir, 'skill.md');
        const skillPath = fs.existsSync(upperPath) ? upperPath : lowerPath;
        const skillBody = fs.readFileSync(skillPath, 'utf8');
        const skillDeps = deps.extractSkillDependencies(skillBody);

        console.log(`gad try ${resolved.slug}`);
        deps.printConsentGate(skillDeps, resolved);

        if (!args.yes && (skillDeps.installs.length > 0 || skillDeps.implicit.length > 0)) {
          console.log('  Note: staging is non-destructive. Install commands above');
          console.log('  will only run if you invoke the skill via your coding agent.');
          console.log('');
        }

        const sandboxDir = deps.stageTrySandbox(resolved, sandboxRoot);
        deps.writeTryProvenance(sandboxDir, resolved, skillDeps);
        deps.writeTryEntry(sandboxDir, resolved, skillBody);

        const prompt = deps.buildHandoffPrompt(resolved);
        const clipboardTool = deps.copyToClipboardSync(prompt);

        console.log('');
        console.log(`  Staged ${path.relative(cwd, sandboxDir)}`);
        console.log(`  Handoff prompt: ${path.relative(cwd, path.join(sandboxDir, 'ENTRY.md'))}`);
        if (clipboardTool) {
          console.log(`  Clipboard: copied via ${clipboardTool}`);
        } else {
          console.log('  Clipboard: (no clipboard tool found — prompt is in ENTRY.md)');
        }
        console.log('');
        console.log(`Paste this into your coding agent running in ${cwd}:`);
        console.log('');
        console.log(`  ${prompt}`);
        console.log('');
        console.log('Then:');
        console.log('  gad try status                     # list all staged sandboxes');
        console.log(`  gad try cleanup ${resolved.slug}   # remove this sandbox when done`);
      } finally {
        resolved.cleanup();
      }
    },
  });
}

module.exports = { createTryStageCommand };
