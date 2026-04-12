#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sea = require('node:sea');
const { createRequire } = require('node:module');

function readManifest() {
  return JSON.parse(sea.getAsset('release-manifest.json', 'utf8'));
}

function ensureSupportTree() {
  const manifest = readManifest();
  const supportRoot = path.join(os.homedir(), '.gad', 'runtime', manifest.version);
  const manifestPath = path.join(supportRoot, 'release-manifest.json');
  let needsExtract = true;

  if (fs.existsSync(manifestPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const cliPath = path.join(supportRoot, manifest.cli_entry);
      needsExtract =
        existing.version !== manifest.version ||
        existing.built_at !== manifest.built_at ||
        !fs.existsSync(cliPath);
    } catch {
      needsExtract = true;
    }
  }

  if (needsExtract) {
    fs.mkdirSync(supportRoot, { recursive: true });
    for (const key of sea.getAssetKeys()) {
      const destination = path.join(supportRoot, key);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      const asset = Buffer.from(sea.getAsset(key));
      fs.writeFileSync(destination, asset);
      if (process.platform !== 'win32' && (key.endsWith('.sh') || key.startsWith('bin/') || key.startsWith('hooks/'))) {
        try {
          fs.chmodSync(destination, 0o755);
        } catch {}
      }
    }
  }

  return { manifest, supportRoot };
}

function runExtractedEntry(entryPath, argv) {
  process.argv = argv;
  const localRequire = createRequire(entryPath);
  localRequire(entryPath);
}

function main() {
  if (!sea.isSea()) {
    console.error('sea-bootstrap.cjs is intended to run inside a packaged GAD executable.');
    process.exit(1);
  }

  const { manifest, supportRoot } = ensureSupportTree();
  process.env.GAD_PACKAGED_ROOT = supportRoot;
  process.env.GAD_PACKAGED_VERSION = manifest.version;
  process.env.GAD_PACKAGED_EXECUTABLE = process.execPath;

  if (process.argv[2] === '__gad_internal_install__') {
    const installerPath = path.join(supportRoot, manifest.installer_entry);
    runExtractedEntry(installerPath, [process.execPath, installerPath, ...process.argv.slice(3)]);
    return;
  }

  const cliPath = path.join(supportRoot, manifest.cli_entry);
  runExtractedEntry(cliPath, [process.execPath, cliPath, ...process.argv.slice(2)]);
}

main();
