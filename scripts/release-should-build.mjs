#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { isReleaseSurfacePath } = require('./release-surface.cjs');
const ROOT = join(__dirname, '..');

function parseArgs(argv) {
  const parsed = {
    base: 'HEAD~1',
    head: 'HEAD',
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--base' && argv[i + 1]) parsed.base = argv[++i];
    else if (arg === '--head' && argv[i + 1]) parsed.head = argv[++i];
    else if (arg === '--json') parsed.json = true;
  }
  return parsed;
}

function getChangedFiles(base, head) {
  const output = execFileSync('git', ['diff', '--name-only', `${base}..${head}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = getChangedFiles(args.base, args.head);
  const matched = files.filter((file) => isReleaseSurfacePath(file));
  const result = {
    base: args.base,
    head: args.head,
    changed_files: files,
    release_surface_matches: matched,
    should_build: matched.length > 0,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Release build required: ${result.should_build ? 'yes' : 'no'}`);
  if (matched.length > 0) {
    console.log('');
    console.log('Matched release-surface paths:');
    for (const file of matched) {
      console.log(`  - ${file}`);
    }
  }
}

main();
