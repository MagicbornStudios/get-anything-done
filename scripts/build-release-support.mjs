#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const SUPPORT_DIR = join(DIST_DIR, 'release-support');
const RUNTIME_DIR = join(SUPPORT_DIR, 'get-anything-done');

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

const SUPPORT_ENTRIES = [
  'bin',
  'dist/gad.cjs',
  'agents',
  'hooks/dist',
  'references',
  'skills',
  'templates',
  'workflows',
  'CHANGELOG.md',
  'package.json',
];

const RUNTIME_ENTRIES = [
  'bin',
  'agents',
  'hooks/dist',
  'references',
  'skills',
  'templates',
  'workflows',
  'CHANGELOG.md',
  'package.json',
];

function resetDir(dirPath) {
  rmSync(dirPath, { recursive: true, force: true });
  mkdirSync(dirPath, { recursive: true });
}

function copyEntry(relativePath, destinationRoot) {
  const sourcePath = join(ROOT, relativePath);
  const destinationPath = join(destinationRoot, relativePath);
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing release support entry: ${relativePath}`);
  }
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

function writeReleaseManifest() {
  const manifest = {
    version: pkg.version,
    built_at: new Date().toISOString(),
    support_entries: SUPPORT_ENTRIES,
    runtime_entries: RUNTIME_ENTRIES,
    runtime_root: 'get-anything-done',
    cli_entry: 'dist/gad.cjs',
    installer_entry: 'bin/install.js',
  };
  writeFileSync(join(SUPPORT_DIR, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

function main() {
  if (!existsSync(join(DIST_DIR, 'gad.cjs'))) {
    throw new Error('dist/gad.cjs is missing. Run `node scripts/build-cli.mjs` first.');
  }
  if (!existsSync(join(ROOT, 'hooks', 'dist'))) {
    throw new Error('hooks/dist is missing. Run `node scripts/build-hooks.js` first.');
  }

  resetDir(SUPPORT_DIR);
  for (const entry of SUPPORT_ENTRIES) {
    copyEntry(entry, SUPPORT_DIR);
  }

  mkdirSync(RUNTIME_DIR, { recursive: true });
  for (const entry of RUNTIME_ENTRIES) {
    const sourcePath = join(ROOT, entry);
    const runtimeRelative = entry === 'hooks/dist' ? 'hooks' : entry;
    const destinationPath = join(RUNTIME_DIR, runtimeRelative);
    mkdirSync(dirname(destinationPath), { recursive: true });
    cpSync(sourcePath, destinationPath, { recursive: true, force: true });
  }

  writeReleaseManifest();

  console.log(`Built release support tree for GAD v${pkg.version}`);
  console.log(`  support: ${relative(ROOT, SUPPORT_DIR)}`);
  console.log(`  runtime: ${relative(ROOT, RUNTIME_DIR)}`);
}

main();

