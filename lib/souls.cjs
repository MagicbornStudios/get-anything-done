'use strict';

const fs = require('fs');
const path = require('path');

function slugify(value) {
  return String(value || 'soul')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'soul';
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resolveProjectRoot(startDir, explicitPath) {
  return path.resolve(explicitPath || startDir || process.cwd());
}

function narrativeDir(projectRoot) {
  return path.join(projectRoot, 'narrative');
}

function soulsDir(projectRoot) {
  return path.join(narrativeDir(projectRoot), 'souls');
}

function soulPath(projectRoot, soulId) {
  return path.join(soulsDir(projectRoot), `${slugify(soulId)}.md`);
}

function readNarrativeToml(projectRoot) {
  const filePath = path.join(narrativeDir(projectRoot), 'narrative.toml');
  if (!fs.existsSync(filePath)) return { filePath, activeSoul: '', raw: '' };
  const raw = fs.readFileSync(filePath, 'utf8');
  const activeMatch = raw.match(/^\s*activeSoul\s*=\s*"([^"]+)"/m);
  return { filePath, activeSoul: activeMatch ? activeMatch[1] : '', raw };
}

function writeNarrativeToml(projectRoot, activeSoul) {
  const dir = narrativeDir(projectRoot);
  ensureDir(dir);
  const current = readNarrativeToml(projectRoot);
  const nextLine = `activeSoul = "${slugify(activeSoul)}"`;
  let body;
  if (current.raw && /^\s*activeSoul\s*=.*$/m.test(current.raw)) {
    body = current.raw.replace(/^\s*activeSoul\s*=.*$/m, nextLine);
  } else {
    body = [
      nextLine,
      'narrativeDir = "narrative"',
      '',
      '# Souls live in narrative/souls/*.md.',
      '# Books and in-world documents can be added beside this file.',
      '',
      current.raw || '',
    ].join('\n');
  }
  fs.writeFileSync(current.filePath, body.trimEnd() + '\n');
  return current.filePath;
}

function renderSoulBody({ name, projectName, body }) {
  return [
    `# ${name}`,
    '',
    body || `Default soul for ${projectName || 'this project'}.`,
    '',
    '## Operating stance',
    '',
    '- Preserve the project narrative, vocabulary, and decision tone.',
    '- Start from `gad snapshot` and the planning artifacts before acting.',
    '- When speech, input, or UX is part of the work, surface real limitations and live state.',
    '',
  ].join('\n');
}

function writeSoul(projectRoot, { soul = 'project-soul', name = '', projectName = '', body = '', force = false }) {
  const soulId = slugify(soul || name);
  const filePath = soulPath(projectRoot, soulId);
  ensureDir(path.dirname(filePath));
  if (fs.existsSync(filePath) && !force) {
    return { filePath, soulId, written: false, existed: true };
  }
  fs.writeFileSync(filePath, renderSoulBody({ name: name || soulId, projectName, body }));
  return { filePath, soulId, written: true, existed: false };
}

function listSouls(projectRoot) {
  const dir = soulsDir(projectRoot);
  const activeSoul = readNarrativeToml(projectRoot).activeSoul;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((file) => {
      const id = file.replace(/\.md$/, '');
      return { id, active: id === activeSoul, path: path.join(dir, file) };
    });
}

function writeSoulPointer(projectRoot, soulId, { force = false } = {}) {
  const target = path.join(projectRoot, 'SOUL.md');
  const content = [
    `# ${soulId}`,
    '',
    `Active soul: \`${soulId}\``,
    '',
    `Soul body: \`narrative/souls/${soulId}.md\``,
    '',
    'Agents should read this file first, then run the project snapshot before planning or implementation.',
    '',
  ].join('\n');
  if (fs.existsSync(target) && !force) {
    const fallback = path.join(projectRoot, '.SOUL.md.gad-init');
    fs.writeFileSync(fallback, content);
    return { target, outputPath: fallback, existed: true };
  }
  fs.writeFileSync(target, content);
  return { target, outputPath: target, existed: false };
}

module.exports = {
  listSouls,
  readNarrativeToml,
  resolveProjectRoot,
  slugify,
  writeNarrativeToml,
  writeSoul,
  writeSoulPointer,
};
