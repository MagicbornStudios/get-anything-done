'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_INIT_TEMPLATE_DIR = path.join(__dirname, '..', '..', '..', 'templates', 'project-init');

const PROJECT_INIT_TARGETS = [
  { template: 'AGENTS.md', relativePath: 'AGENTS.md' },
  { template: 'CLAUDE.md', relativePath: 'CLAUDE.md' },
  { template: 'SOUL.md', relativePath: 'SOUL.md' },
  { template: 'planning-AGENTS.md', relativePath: path.join('.planning', 'AGENTS.md') },
];

function renderProjectInitTemplate(templateBody, vars) {
  return templateBody.replace(/\{\{\s*(project_id|project_name|project_upper)\s*\}\}/g, (_, key) => vars[key] || '');
}

function loadProjectInitTemplate(templateName) {
  const templatePath = path.join(PROJECT_INIT_TEMPLATE_DIR, templateName);
  return fs.readFileSync(templatePath, 'utf8');
}

function fallbackInitPath(targetPath) {
  return path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.gad-init`);
}

function scaffoldProjectInitInstructions(projectPath, vars) {
  const results = [];

  for (const spec of PROJECT_INIT_TARGETS) {
    const targetPath = path.join(projectPath, spec.relativePath);
    const rendered = renderProjectInitTemplate(loadProjectInitTemplate(spec.template), vars);
    const exists = fs.existsSync(targetPath);
    const outputPath = exists ? fallbackInitPath(targetPath) : targetPath;

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, rendered);

    results.push({
      template: spec.template,
      targetPath,
      outputPath,
      existed: exists,
      compareHint: exists
        ? `Compare ${path.basename(targetPath)} with ${path.basename(outputPath)} before merging.`
        : '',
    });
  }

  return results;
}

module.exports = {
  PROJECT_INIT_TARGETS,
  renderProjectInitTemplate,
  scaffoldProjectInitInstructions,
};
