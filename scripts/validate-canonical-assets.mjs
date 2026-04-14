#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SKIP_SKILL_DIRS = new Set(['candidates', 'emergent', 'proto-skills']);
const REF_PATTERNS = [
  { prefix: '@workflows/', dir: 'workflows' },
  { prefix: '@references/', dir: 'references' },
  { prefix: '@templates/', dir: 'templates' },
  { prefix: '@agents/', dir: 'agents' },
  { prefix: '@hooks/', dir: 'hooks' },
];

function toOsPath(p) {
  return p.replace(/\//g, path.sep);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dir, predicate = () => true, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
      continue;
    }
    if (predicate(full)) out.push(full);
  }
  return out;
}

function parseFrontmatterName(content) {
  const match = content.match(/^name:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

function validateSkillCatalog(errors, warnings) {
  const skillsRoot = path.join(root, 'skills');
  const seenNames = new Map();

  for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (SKIP_SKILL_DIRS.has(entry.name)) continue;

    const skillDir = path.join(skillsRoot, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = readText(skillFile);
    const publicName = parseFrontmatterName(content);
    if (!publicName) {
      errors.push(`Missing frontmatter name in ${path.relative(root, skillFile)}`);
      continue;
    }

    const siblings = seenNames.get(publicName) || [];
    siblings.push(entry.name);
    seenNames.set(publicName, siblings);

    const metaFile = path.join(skillDir, 'skill.json');
    const commandFile = path.join(skillDir, 'COMMAND.md');
    if (fs.existsSync(metaFile) && !fs.existsSync(commandFile)) {
      errors.push(`skill.json present but COMMAND.md missing in ${path.relative(root, skillDir)}`);
    }
    if (!entry.name.startsWith('gad-') && publicName.startsWith('gad:')) {
      warnings.push(`Plain-name skill dir still exposes GAD command identity: ${entry.name} -> ${publicName}`);
    }
  }

  for (const [publicName, dirs] of seenNames.entries()) {
    if (dirs.length > 1) {
      errors.push(`Duplicate public skill name ${publicName} in ${dirs.join(', ')}`);
    }
  }
}

function validateRefs(errors) {
  const scanRoots = ['skills', 'workflows', 'references', 'agents', 'hooks'].map((p) => path.join(root, p));
  const textFiles = scanRoots.flatMap((dir) =>
    walkFiles(
      dir,
      (file) => file.endsWith('.md') || file.endsWith('.txt') || file.endsWith('.json')
    )
  );

  const refRegex = /@(?:workflows|references|templates|agents|hooks)\/[A-Za-z0-9._/-]+/g;

  for (const file of textFiles) {
    const content = readText(file);
    const matches = content.match(refRegex) || [];
    for (const ref of matches) {
      const mapping = REF_PATTERNS.find((item) => ref.startsWith(item.prefix));
      if (!mapping) continue;
      const rel = ref.slice(mapping.prefix.length).replace(/[.,;:!?]+$/g, '');
      const target = path.join(root, mapping.dir, toOsPath(rel));
      if (!fs.existsSync(target)) {
        errors.push(`Broken reference ${ref} in ${path.relative(root, file)}`);
      }
    }
  }
}

function main() {
  const errors = [];
  const warnings = [];

  validateSkillCatalog(errors, warnings);
  validateRefs(errors);

  if (warnings.length) {
    console.log('Warnings:');
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (errors.length) {
    console.error('Canonical asset validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Canonical asset validation passed.');
}

main();
