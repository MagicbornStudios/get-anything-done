#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST_DIR = join(ROOT, 'dist');
const RELEASE_DIR = join(DIST_DIR, 'release');
const SUPPORT_DIR = join(DIST_DIR, 'release-support');
const SEA_SENTINEL = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

console.warn('[deprecated] scripts/build-release.mjs uses the Node SEA pipeline.');
console.warn('[deprecated] Prefer `node scripts/build-bun-release.mjs` or `npm run build:release` instead.');

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

function runNodeScript(relativeScript) {
  execFileSync(process.execPath, [join(ROOT, relativeScript)], {
    stdio: 'inherit',
    cwd: ROOT,
  });
}

function listFilesRecursive(rootDir, currentDir = rootDir, results = []) {
  for (const entry of readdirSync(currentDir)) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      listFilesRecursive(rootDir, fullPath, results);
    } else {
      results.push(relative(rootDir, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

function getPostjectBinary() {
  const base = join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'postject.cmd' : 'postject');
  if (!existsSync(base)) {
    throw new Error('postject is not installed. Run `npm install` in vendor/get-anything-done`.');
  }
  return base;
}

function buildAssetMap() {
  const files = listFilesRecursive(SUPPORT_DIR);
  const assets = {};
  for (const file of files) {
    assets[file] = join(SUPPORT_DIR, file);
  }
  return assets;
}

function generateSeaConfig(configPath, blobPath, bootstrapPath, assets) {
  const config = {
    main: bootstrapPath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets,
  };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

function copyBaseExecutable(targetPath) {
  copyFileSync(process.execPath, targetPath);
}

function injectBlob(executablePath, blobPath, platform) {
  const postject = getPostjectBinary();
  const args = [
    executablePath,
    'NODE_SEA_BLOB',
    blobPath,
    '--sentinel-fuse',
    SEA_SENTINEL,
  ];
  if (platform === 'darwin') {
    args.push('--macho-segment-name', 'NODE_SEA');
  }
  if (process.platform === 'win32') {
    const result = spawnSync(postject, args, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: true,
    });
    if (result.status !== 0) {
      throw new Error(`postject failed with status ${result.status || 1}`);
    }
  } else {
    execFileSync(postject, args, {
      stdio: 'inherit',
      cwd: ROOT,
    });
  }
}

function writeWindowsInstallInstructions(outDir, artifactName) {
  const installerSource = join(ROOT, 'scripts', 'install-gad-windows.ps1');
  const installerDest = join(outDir, 'install-gad-windows.ps1');
  copyFileSync(installerSource, installerDest);
  const notesPath = join(outDir, 'INSTALL.txt');
  writeFileSync(
    notesPath,
    [
      `GAD ${pkg.version} release artifact`,
      '',
      `Artifact: ${artifactName}`,
      '',
      'Windows:',
      `  powershell -ExecutionPolicy Bypass -File .\\install-gad-windows.ps1 -Artifact .\\${artifactName}`,
      '',
      'Portable use:',
      `  .\\${artifactName} --help`,
      '',
      'Packaged runtime install example:',
      `  .\\${artifactName} install all --codex --global`,
      '',
    ].join('\n'),
  );
}

function getArtifactName(platform, arch) {
  const platformLabel = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : platform;
  const base = `gad-v${pkg.version}-${platformLabel}-${arch}`;
  return platform === 'win32' ? `${base}.exe` : base;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.platform !== process.platform || args.arch !== process.arch) {
    throw new Error(`Cross-platform SEA builds must run on the target platform/arch. Requested ${args.platform}/${args.arch}, current ${process.platform}/${process.arch}.`);
  }

  mkdirSync(args.outDir, { recursive: true });
  runNodeScript('scripts/build-hooks.js');
  runNodeScript('scripts/build-cli.mjs');
  runNodeScript('scripts/build-release-support.mjs');

  const artifactName = getArtifactName(args.platform, args.arch);
  const executablePath = join(args.outDir, artifactName);
  const blobPath = join(args.outDir, `sea-prep-${args.platform}-${args.arch}.blob`);
  const configPath = join(args.outDir, `sea-config-${args.platform}-${args.arch}.json`);
  const bootstrapPath = join(ROOT, 'scripts', 'sea-bootstrap.cjs');
  const assets = buildAssetMap();

  rmSync(executablePath, { force: true });
  rmSync(blobPath, { force: true });
  rmSync(configPath, { force: true });

  generateSeaConfig(configPath, blobPath, bootstrapPath, assets);
  execFileSync(process.execPath, ['--experimental-sea-config', configPath], {
    stdio: 'inherit',
    cwd: ROOT,
  });
  copyBaseExecutable(executablePath);
  injectBlob(executablePath, blobPath, args.platform);

  if (args.platform === 'win32') {
    writeWindowsInstallInstructions(args.outDir, artifactName);
  }

  console.log(`Built GAD executable: ${relative(ROOT, executablePath)}`);
  console.log(`  support tree: ${relative(ROOT, SUPPORT_DIR)}`);
  console.log(`  blob: ${relative(ROOT, blobPath)}`);
}

main();
