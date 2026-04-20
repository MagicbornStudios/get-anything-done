'use strict';

const { defineCommand } = require('citty');
const { fs, path, resolveLatestRunDir } = require('./shared.cjs');

function createEvalInheritSkillsCommand({ resolveOrDefaultEvalProjectDir, outputError }) {
  return defineCommand({
    meta: { name: 'inherit-skills', description: 'Copy agent-authored skills from a completed eval into another eval template (decision gad-112)' },
    args: {
      from: { type: 'string', description: 'Source eval project (or project/vN for a specific run)', required: true },
      to: { type: 'string', description: 'Target eval project name', required: true },
      'latest-only': { type: 'boolean', description: 'Only inherit skills from the latest run (not accumulated)', default: false },
    },
    run({ args }) {
      const parts = String(args.from || '').split('/');
      const srcProject = parts[0];
      let srcVersion = parts[1] || null;
      if (!srcProject) {
        outputError('Usage: gad eval inherit-skills --from eval-project --to target-project');
        return;
      }

      const srcProjectDir = resolveOrDefaultEvalProjectDir(srcProject);
      if (!srcVersion) {
        if (!fs.existsSync(srcProjectDir)) {
          outputError(`Eval project '${srcProject}' not found.`);
          return;
        }
        const latest = resolveLatestRunDir(srcProjectDir);
        if (!latest) {
          outputError(`No runs found for ${srcProject}. Run an eval first.`);
          return;
        }
        srcVersion = latest.name;
        console.log(`  Using latest run: ${srcProject}/${srcVersion}`);
      }

      const srcRunDir = path.join(srcProjectDir, srcVersion, 'run');
      if (!fs.existsSync(srcRunDir)) {
        outputError(`Source run not found: ${srcRunDir}`);
        return;
      }
      const targetProjectDir = resolveOrDefaultEvalProjectDir(args.to);

      const skillsDirs = [
        path.join(srcRunDir, 'game', '.planning', 'skills'),
        path.join(srcRunDir, '.planning', 'skills'),
        path.join(srcRunDir, 'game', 'skills'),
      ];
      const srcSkillsDir = skillsDirs.find((dir) => fs.existsSync(dir)) || null;
      if (!srcSkillsDir) {
        console.log(`No agent-authored skills found in ${srcProject}/${srcVersion}`);
        console.log('Checked: game/.planning/skills/, .planning/skills/, game/skills/');
        return;
      }

      const skills = fs.readdirSync(srcSkillsDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
      if (skills.length === 0) {
        console.log('No skills found in source directory.');
        return;
      }

      const targetDir = path.join(targetProjectDir, 'template', 'skills');
      fs.mkdirSync(targetDir, { recursive: true });

      for (const skill of skills) {
        fs.cpSync(path.join(srcSkillsDir, skill), path.join(targetDir, skill), { recursive: true });
        console.log(`  OK Inherited: ${skill} (from ${srcProject}/${srcVersion})`);
      }

      const agentsMd = path.join(targetProjectDir, 'template', 'AGENTS.md');
      if (fs.existsSync(agentsMd)) {
        let content = fs.readFileSync(agentsMd, 'utf8');
        const section = `\n\n## Inherited Skills (from ${srcProject}/${srcVersion})\n\n${skills.map((s) => `- \`skills/${s}/SKILL.md\``).join('\n')}\n`;
        if (!content.includes('## Inherited Skills')) {
          content += section;
          fs.writeFileSync(agentsMd, content);
        }
      }

      const metaFile = path.join(targetProjectDir, 'template', '.inherited-skills.json');
      fs.writeFileSync(metaFile, JSON.stringify({
        inherited_at: new Date().toISOString(),
        source: `${srcProject}/${srcVersion}`,
        skills: skills.map((skill) => ({ name: skill, source_path: path.join(srcSkillsDir, skill) })),
      }, null, 2));

      console.log(`\nOK Inherited ${skills.length} skill(s) from ${srcProject}/${srcVersion} -> ${args.to}`);
    },
  });
}

module.exports = { createEvalInheritSkillsCommand };
