#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LEGACY_WORKSPACE_SKILLS = path.join(ROOT, '.agents', 'skills');
const CANONICAL_SKILLS = path.join(ROOT, 'skills');
const COMMANDS_ROOT = path.join(ROOT, 'commands', 'gad');

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
}

function resetDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  ensureDir(dirPath);
}

function walkDirs(rootDir, rel = '') {
  const current = path.join(rootDir, rel);
  const entries = readdirSync(current, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nextRel = rel ? path.join(rel, entry.name) : entry.name;
    const nextDir = path.join(rootDir, nextRel);
    if (existsSync(path.join(nextDir, 'SKILL.md'))) {
      found.push(nextRel);
    }
    found.push(...walkDirs(rootDir, nextRel));
  }
  return found;
}

function walkMarkdownFiles(rootDir, rel = '') {
  const current = path.join(rootDir, rel);
  const entries = readdirSync(current, { withFileTypes: true });
  const found = [];
  for (const entry of entries) {
    const nextRel = rel ? path.join(rel, entry.name) : entry.name;
    const nextPath = path.join(rootDir, nextRel);
    if (entry.isDirectory()) {
      found.push(...walkMarkdownFiles(rootDir, nextRel));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      found.push(nextRel);
    }
  }
  return found;
}

function copyCanonicalWorkspaceSkills() {
  if (!existsSync(LEGACY_WORKSPACE_SKILLS)) return 0;
  const skillDirs = walkDirs(LEGACY_WORKSPACE_SKILLS);
  let count = 0;
  for (const rel of skillDirs) {
    const srcDir = path.join(LEGACY_WORKSPACE_SKILLS, rel);
    const destDir = path.join(CANONICAL_SKILLS, rel);
    ensureDir(path.dirname(destDir));
    cpSync(srcDir, destDir, { recursive: true, force: true });
    count++;
  }
  return count;
}

function commandRelToSkillName(commandRel) {
  const withoutExt = commandRel.replace(/\.md$/i, '');
  return `gad-${withoutExt.split(path.sep).join('-')}`;
}

function syncCommandBackedSkills() {
  if (!existsSync(COMMANDS_ROOT)) return 0;
  const commandFiles = walkMarkdownFiles(COMMANDS_ROOT);
  let count = 0;
  for (const rel of commandFiles) {
    const srcFile = path.join(COMMANDS_ROOT, rel);
    const skillName = commandRelToSkillName(rel);
    const destDir = path.join(CANONICAL_SKILLS, skillName);
    ensureDir(destDir);
    const content = readFileSync(srcFile, 'utf8');
    writeFileSync(path.join(destDir, 'SKILL.md'), content);
    writeFileSync(path.join(destDir, 'COMMAND.md'), content);
    writeFileSync(
      path.join(destDir, 'skill.json'),
      JSON.stringify(
        {
          id: skillName,
          canonical: true,
          source: 'command',
          commandPath: rel.replace(/\\/g, '/'),
        },
        null,
        2
      ) + '\n'
    );
    count++;
  }
  return count;
}

function syncGeneratedCommandsFromSkills() {
  resetDir(COMMANDS_ROOT);
  const skillDirs = walkDirs(CANONICAL_SKILLS);
  let count = 0;
  for (const rel of skillDirs) {
    const skillDir = path.join(CANONICAL_SKILLS, rel);
    const commandFile = path.join(skillDir, 'COMMAND.md');
    const metaFile = path.join(skillDir, 'skill.json');
    if (!existsSync(commandFile) || !existsSync(metaFile)) continue;
    let commandPath = null;
    try {
      const meta = JSON.parse(readFileSync(metaFile, 'utf8'));
      commandPath = typeof meta.commandPath === 'string' ? meta.commandPath : null;
    } catch {}
    if (!commandPath) continue;
    const destFile = path.join(COMMANDS_ROOT, commandPath);
    ensureDir(path.dirname(destFile));
    writeFileSync(destFile, readFileSync(commandFile, 'utf8'));
    count++;
  }
  return count;
}

function main() {
  ensureDir(CANONICAL_SKILLS);
  const copiedWorkspace = copyCanonicalWorkspaceSkills();
  const syncedCommands = syncCommandBackedSkills();
  const generatedCommands = syncGeneratedCommandsFromSkills();
  const skillDirs = existsSync(CANONICAL_SKILLS) ? walkDirs(CANONICAL_SKILLS).length : 0;
  console.log(`Synced canonical skills in ${path.relative(ROOT, CANONICAL_SKILLS)}`);
  console.log(`  workspace skills copied: ${copiedWorkspace}`);
  console.log(`  command-backed skills:   ${syncedCommands}`);
  console.log(`  total skill directories: ${skillDirs}`);
  console.log(`  generated commands:      ${generatedCommands}`);
}

main();
