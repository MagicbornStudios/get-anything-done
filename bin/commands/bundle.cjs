'use strict';
/**
 * gad bundle — export GAD skills as portable bundles for agent runtime upload
 *
 * Required deps: readSkillFrontmatter
 */

const path = require('path');
const fs = require('fs');
const { defineCommand } = require('citty');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function createBundleCommand(deps) {
  const { readSkillFrontmatter } = deps;

  const bundleExport = defineCommand({
    meta: {
      name: 'export',
      description: 'Export one or all GAD skills as a self-contained bundle for upload to Claude Code, OpenCode, or other agent runtimes. Inlines workflow content so the bundle is portable.',
    },
    args: {
      name: { type: 'positional', description: 'Skill name (e.g. gad-visual-context-system) or --all', required: false },
      all: { type: 'boolean', description: 'Export all canonical skills' },
      output: { type: 'string', description: 'Output directory (default: ./skill-bundles/<name> or ./skill-bundles/all)', required: false },
      zip: { type: 'boolean', description: 'Also create a .zip archive for upload', default: false },
    },
    run({ args }) {
      const repoRoot = path.resolve(__dirname, '..', '..');
      const skillsDir = path.join(repoRoot, 'skills');

      if (!args.all && !args.name) {
        console.error('Provide a skill name or use --all');
        console.error('  gad bundle export gad-visual-context-system');
        console.error('  gad bundle export --all');
        process.exit(1);
      }

      const outputBase = args.output ? path.resolve(args.output) : path.join(process.cwd(), 'skill-bundles');
      const skillsToBundle = [];

      if (args.all) {
        function walk(dir) {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const skillDir = path.join(dir, entry.name);
            const skillMd = path.join(skillDir, 'SKILL.md');
            if (fs.existsSync(skillMd)) skillsToBundle.push({ id: entry.name, dir: skillDir });
            else walk(skillDir);
          }
        }
        walk(skillsDir);
      } else {
        const skillName = args.name.replace(/^skills\//, '');
        const skillDir = path.join(skillsDir, skillName);
        const skillMd = path.join(skillDir, 'SKILL.md');
        if (!fs.existsSync(skillMd)) { console.error(`Skill not found: ${skillName}`); process.exit(1); }
        skillsToBundle.push({ id: skillName, dir: skillDir });
      }

      for (const { id, dir } of skillsToBundle) {
        const skillMd = path.join(dir, 'SKILL.md');
        const content = fs.readFileSync(skillMd, 'utf8');
        const fm = readSkillFrontmatter(skillMd);

        let outDir = path.join(outputBase, id);
        if (args.all) { fs.mkdirSync(outputBase, { recursive: true }); fs.mkdirSync(outDir, { recursive: true }); }
        else fs.mkdirSync(outDir, { recursive: true });

        let bundled = content;

        if (fm.workflow) {
          const isSibling = fm.workflow.startsWith('./') || fm.workflow.startsWith('../');
          const workflowPath = isSibling
            ? path.resolve(dir, fm.workflow)
            : path.join(repoRoot, fm.workflow);

          if (fs.existsSync(workflowPath)) {
            let workflowContent = fs.readFileSync(workflowPath, 'utf8');
            workflowContent = workflowContent.split('\n').filter(line => line.trim() !== '---').join('\n').trim();
            bundled = content.replace(
              /^workflow:\s*.+$/m,
              `workflow_content: |\n${workflowContent.split('\n').map(l => '  ' + l).join('\n')}`
            );
            bundled = bundled.split('\n');
            for (let i = 1; i < bundled.length; i++) {
              if (bundled[i].trim() === '---') { bundled = bundled.slice(0, i + 1); break; }
            }
            bundled = bundled.join('\n') + '\n';
            bundled = bundled.replace(/<([^>]+)>/g, '&lt;$1&gt;');
          } else {
            console.warn(`  [warn] Workflow not found: ${workflowPath}`);
          }
        }

        fs.writeFileSync(path.join(outDir, 'SKILL.md'), bundled);
        console.log(`  ✓ ${id}`);

        const evalsSrc = path.join(dir, 'evals');
        if (fs.existsSync(evalsSrc)) {
          const evalsDest = path.join(outDir, 'evals');
          copyDirRecursive(evalsSrc, evalsDest);
          console.log(`    + evals/`);
        }

        if (args.zip) {
          const zipPath = outDir + '.zip';
          try {
            const archiver = require('archiver') || null;
            if (archiver) {
              const { execSync } = require('child_process');
              execSync(`cd "${path.dirname(outDir)}" && npx --yes archiver --output "${zipPath}" --source "${path.basename(outDir)}"`, { stdio: 'inherit' });
              console.log(`    → ${id}.zip`);
            }
          } catch {
            console.log(`    [skip] zip unavailable, SKILL.md exported`);
          }
        }
      }

      console.log(`\n  Bundled ${skillsToBundle.length} skill(s) → ${outputBase}`);
      if (!args.zip) console.log('  Run with --zip to create uploadable archives.');
    },
  });

  return defineCommand({
    meta: { name: 'bundle', description: 'Export GAD skills as portable bundles for agent runtime upload' },
    subCommands: { export: bundleExport },
  });
}

module.exports = { createBundleCommand };
module.exports.register = (ctx) => ({ bundle: createBundleCommand(ctx.extras.bundle) });
