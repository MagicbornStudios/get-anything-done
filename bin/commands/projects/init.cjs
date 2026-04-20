'use strict';

const fs = require('fs');
const path = require('path');
const { defineCommand } = require('citty');

function createProjectsInitCommand(deps) {
  const {
    findRepoRoot,
    gadConfig,
    normalizePath,
    writeRootsToToml,
    INIT_XML_FILES,
    INIT_XML_TEMPLATES,
  } = deps;

  return defineCommand({
    meta: { name: 'init', description: 'Initialize a new project with canonical XML .planning/ scaffold' },
    args: {
      name: { type: 'string', description: 'Project display name (default: folder name)', default: '' },
      projectid: { type: 'string', description: 'Project id (default: slug of --name)', default: '' },
      path: { type: 'string', description: 'Project path (default: cwd)', default: '' },
      format: { type: 'string', description: 'Scaffold format: xml (default) or md (legacy)', default: 'xml' },
      force: { type: 'boolean', description: 'Overwrite existing files', default: false },
    },
    run({ args }) {
      const projectPath = path.resolve(args.path || process.cwd());
      const baseDir = findRepoRoot(projectPath);
      const config = gadConfig.load(baseDir);
      const projectName = args.name || path.basename(projectPath);
      const projectId = (args.projectid || projectName).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const planDir = path.join(projectPath, '.planning');
      const format = (args.format || 'xml').toLowerCase();

      if (format !== 'xml' && format !== 'md') {
        console.error(`✗ Unknown --format "${args.format}". Expected xml or md.`);
        process.exitCode = 1;
        return;
      }

      fs.mkdirSync(planDir, { recursive: true });

      const targets = format === 'xml'
        ? INIT_XML_FILES.slice()
        : ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md', 'PROJECT.md', 'TASK-REGISTRY.xml', 'DECISIONS.xml', 'ERRORS-AND-ATTEMPTS.xml'];

      const collisions = targets.filter((file) => fs.existsSync(path.join(planDir, file)));
      if (collisions.length && !args.force) {
        console.error(`✗ Refusing to init — ${collisions.length} file(s) already exist in ${planDir}:`);
        for (const collision of collisions) console.error(`    ${collision}`);
        console.error('  Re-run with --force to overwrite.');
        process.exitCode = 1;
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const written = [];

      if (format === 'xml') {
        for (const file of INIT_XML_FILES) {
          fs.writeFileSync(path.join(planDir, file), INIT_XML_TEMPLATES[file](projectId, today));
          written.push(file);
        }
      } else {
        const templateDir = path.join(__dirname, '..', '..', '..', 'templates');
        const mdStarters = [
          ['state.md', 'STATE.md'],
          ['roadmap.md', 'ROADMAP.md'],
          ['requirements.md', 'REQUIREMENTS.md'],
          ['project.md', 'PROJECT.md'],
        ];
        for (const [templateName, destName] of mdStarters) {
          const dest = path.join(planDir, destName);
          const src = path.join(templateDir, templateName);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
          } else {
            fs.writeFileSync(dest, `# ${destName.replace('.md', '')}\n\nProject: ${projectName}\n`);
          }
          written.push(destName);
        }
        for (const file of ['TASK-REGISTRY.xml', 'DECISIONS.xml', 'ERRORS-AND-ATTEMPTS.xml']) {
          fs.writeFileSync(path.join(planDir, file), INIT_XML_TEMPLATES[file](projectId, today));
          written.push(file);
        }
      }

      console.log(`✓ Initialized .planning/ in ${projectPath}`);
      console.log(`  Format: ${format}`);
      console.log(`  Project id: ${projectId}`);
      console.log(`  Files written (${written.length}):`);
      for (const file of written) console.log(`    ${file}`);

      const relPath = normalizePath(path.relative(baseDir, projectPath) || '.');
      if (!config.roots.find((root) => normalizePath(root.path) === relPath)) {
        config.roots.push({ id: projectId, path: relPath, planningDir: '.planning', discover: false });
        writeRootsToToml(baseDir, config.roots, config, { gadConfig, resolveTomlPath: deps.resolveTomlPath });
        console.log(`  Registered as [${projectId}] at path "${relPath}" in ${path.join(baseDir, 'gad-config.toml')}`);
      }

      console.log('');
      console.log('Next steps:');
      console.log(`  gad projects audit --project ${projectId}    # verify canonical shape`);
      console.log(`  gad discuss-phase --projectid ${projectId}   # capture phase 00 context`);
      console.log(`  gad plan-phase --projectid ${projectId}      # plan phase 00`);
    },
  });
}

module.exports = { createProjectsInitCommand };
