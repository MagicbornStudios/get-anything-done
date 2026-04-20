#!/usr/bin/env node

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const RELEASE_DIR = join(DIST_DIR, 'release');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function parseArgs(argv) {
  const parsed = {
    platform: process.platform,
    arch: process.arch,
    outDir: RELEASE_DIR,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--platform' && argv[i + 1]) parsed.platform = argv[++i];
    else if (arg === '--arch' && argv[i + 1]) parsed.arch = argv[++i];
    else if (arg === '--out-dir' && argv[i + 1]) parsed.outDir = resolve(argv[++i]);
  }
  return parsed;
}

function getTarget(platform, arch) {
  const platformLabel = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'darwin' : platform;
  const archLabel = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;
  return `bun-${platformLabel}-${archLabel}`;
}

function getArtifactName(platform, arch) {
  const platformLabel = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform;
  const base = `gad-v${pkg.version}-${platformLabel}-${arch}`;
  return platform === 'win32' ? `${base}.exe` : base;
}

function writeInstallNotes(outDir, artifactName) {
  const notesPath = join(outDir, 'INSTALL.txt');
  writeFileSync(
    notesPath,
    [
      `GAD ${pkg.version} Bun release artifact`,
      '',
      `Artifact: ${artifactName}`,
      '',
      'Release model:',
      '  - primary binary built with `bun build --compile`',
      '  - GitHub Releases is the distribution source of truth',
      '  - Node SEA pipeline is deprecated and retained only as an escape hatch',
      '',
      'Portable use:',
      process.platform === 'win32'
        ? `  .\\${artifactName} --help`
        : `  ./$(basename "${artifactName}") --help`,
      '',
    ].join('\n'),
  );
}

function maybeCopyWindowsInstaller(outDir) {
  if (process.platform !== 'win32') return;
  const installerSource = join(ROOT, 'scripts', 'install-gad-windows.ps1');
  const installerDest = join(outDir, 'install-gad-windows.ps1');
  copyFileSync(installerSource, installerDest);
}

function buildGadTui(outDir, gadVersion) {
  // Locate gad-tui package relative to the monorepo root (two dirs above vendor/get-anything-done).
  const monoRoot = join(ROOT, '..', '..');
  const tuiPkg = join(monoRoot, 'packages', 'gad-tui');
  const tuiExeSrc = join(tuiPkg, 'dist', 'gad-tui-windows.exe');
  const tuiExeDest = join(outDir, `gad-tui-v${gadVersion}-windows-x64.exe`);

  try {
    // Run the gad-tui bun compile via pnpm filter.
    execFileSync('pnpm', ['--filter', '@magicborn/gad-tui', 'build:bun'], {
      cwd: monoRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    copyFileSync(tuiExeSrc, tuiExeDest);
    console.log(`Built gad-tui executable: dist/release/gad-tui-v${gadVersion}-windows-x64.exe`);
  } catch (err) {
    process.stderr.write(`[warn] gad-tui build skipped: ${err.message}\n`);
    process.stderr.write(`[warn] gad.exe will still ship; install gad-tui manually via \`pnpm --filter @magicborn/gad-tui build:bun\`.\n`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = getTarget(args.platform, args.arch);
  const artifactName = getArtifactName(args.platform, args.arch);
  const artifactPath = join(args.outDir, artifactName);

  mkdirSync(args.outDir, { recursive: true });
  rmSync(artifactPath, { force: true });

  // Pre-bundle: generate static require manifest so bun build --compile can
  // trace every bin/commands/*.cjs module. Without this, the filesystem-
  // discovery loader is opaque to the bundler and command modules get
  // dropped from the exe.
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-manifest.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  // Pre-bundle: freeze git SHA + src hash into the exe so gad version and the
  // pre-commit staleness check (task 66-04) don't rely on runtime git queries
  // against the user's cwd (task 66-06).
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-stamp.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  execFileSync(
    'bun',
    ['build', '--compile', '--target', target, join(ROOT, 'bin', 'gad.cjs'), '--outfile', artifactPath],
    { cwd: ROOT, stdio: 'inherit' },
  );

  maybeCopyWindowsInstaller(args.outDir);
  writeInstallNotes(args.outDir, artifactName);

  console.log(`Built GAD Bun executable: ${relative(ROOT, artifactPath)}`);

  // Build gad-tui exe alongside gad.exe (soft dependency — skip+warn on failure).
  buildGadTui(args.outDir, pkg.version);
}

main();
