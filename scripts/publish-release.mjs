#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RELEASE_DIR = join(ROOT, 'dist', 'release');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CURRENT_EXE_RE = new RegExp(`^gad-v${escapeRegExp(pkg.version)}-(windows|linux|macos)-.+(?:\\.exe)?$`);
const CURRENT_TARBALL_NAME = `${pkg.name}-${pkg.version}.tgz`;

export function parseArgs(argv) {
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

export function getReleaseDir(root = ROOT) {
  return process.env.GAD_RELEASE_DIR || join(root, 'dist', 'release');
}

export function isReleaseArtifactName(name) {
  return (
    CURRENT_EXE_RE.test(name) ||
    name === CURRENT_TARBALL_NAME ||
    name === 'install-gad-windows.ps1' ||
    name === 'INSTALL.txt'
  );
}

export function getArtifacts(releaseDir = getReleaseDir()) {
  if (!existsSync(releaseDir)) {
    throw new Error('dist/release does not exist. Run `npm run build:release` first.');
  }
  ensureReleaseTarball(releaseDir);
  const entries = readdirSync(releaseDir)
    .filter((name) => isReleaseArtifactName(name))
    .map((name) => join(releaseDir, name));
  if (entries.length === 0) {
    throw new Error('No release artifacts found in dist/release.');
  }
  if (!entries.some((entry) => entry.endsWith(CURRENT_TARBALL_NAME))) {
    throw new Error(
      `Release tarball ${CURRENT_TARBALL_NAME} missing from ${releaseDir} after npm pack.`,
    );
  }
  return entries;
}

// Per gad-274 / 64-C the npm-shape tarball is the canonical install
// payload for skills/hooks/agents (workflows/update.md downloads it via
// gh release download). Idempotent: skip the pack if the current-version
// tarball already exists in releaseDir.
export function ensureReleaseTarball(releaseDir = getReleaseDir(), root = ROOT) {
  const target = join(releaseDir, CURRENT_TARBALL_NAME);
  if (existsSync(target)) return target;
  execFileSync('npm', ['pack', '--pack-destination', releaseDir], {
    cwd: root,
    stdio: 'inherit',
  });
  if (!existsSync(target)) {
    throw new Error(
      `npm pack did not produce ${CURRENT_TARBALL_NAME} in ${releaseDir}.`,
    );
  }
  return target;
}

function hasRelease(tag) {
  try {
    execFileSync('gh', ['release', 'view', tag], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function main() {
  const args = parseArgs(process.argv.slice(2));
  const releaseDir = getReleaseDir();
  const artifacts = getArtifacts(releaseDir);

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

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
