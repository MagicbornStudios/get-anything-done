#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RELEASE_DIR = join(ROOT, 'dist', 'release');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function parseArgs(argv) {
  const parsed = {
    tag: `v${pkg.version}`,
    title: `GAD v${pkg.version}`,
    notesFile: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--tag' && argv[i + 1]) parsed.tag = argv[++i];
    else if (arg === '--title' && argv[i + 1]) parsed.title = argv[++i];
    else if (arg === '--notes-file' && argv[i + 1]) parsed.notesFile = argv[++i];
  }
  return parsed;
}

function getArtifacts() {
  if (!existsSync(RELEASE_DIR)) {
    throw new Error('dist/release does not exist. Run `npm run build:release` first.');
  }
  const entries = readdirSync(RELEASE_DIR)
    .filter((name) => /^gad-v.+/.test(name) || name === 'install-gad-windows.ps1' || name === 'INSTALL.txt')
    .map((name) => join(RELEASE_DIR, name));
  if (entries.length === 0) {
    throw new Error('No release artifacts found in dist/release.');
  }
  return entries;
}

function hasRelease(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const artifacts = getArtifacts();

  if (!hasRelease(args.tag)) {
    const createArgs = ['release', 'create', args.tag, '--title', args.title];
    if (args.notesFile) {
      createArgs.push('--notes-file', args.notesFile);
    } else {
      createArgs.push('--generate-notes');
    }
    execFileSync('gh', createArgs, { cwd: ROOT, stdio: 'inherit' });
  }

  execFileSync('gh', ['release', 'upload', args.tag, ...artifacts, '--clobber'], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log(`Published ${artifacts.length} artifact(s) to GitHub release ${args.tag}.`);
}

main();
