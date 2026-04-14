#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CANONICAL_SKILLS = path.join(ROOT, 'skills');

function ensureDir(dirPath) {
  mkdirSync(dirPath, { recursive: true });
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

function main() {
  ensureDir(CANONICAL_SKILLS);
  const skillDirs = existsSync(CANONICAL_SKILLS) ? walkDirs(CANONICAL_SKILLS).length : 0;
  console.log(`Synced canonical skills in ${path.relative(ROOT, CANONICAL_SKILLS)}`);
  console.log(`  total skill directories: ${skillDirs}`);
  console.log('  commands are generated at install time only');
}

main();
