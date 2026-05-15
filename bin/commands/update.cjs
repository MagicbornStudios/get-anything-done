'use strict';
/**
 * gad update — self-update from GitHub Releases.
 *
 * Pure-Node re-implementation of skills/gad-update/workflows/update.md so
 * non-Claude runtimes (codex/gemini/opencode) can call `gad update`
 * directly without the Skill tool.
 *
 * Shares release-lookup helpers with hooks/gad-check-update.js:
 *   - normalizeRepoSlug / compareVersions / listReleaseTagsFromLsRemote
 *
 * Asset naming convention (from .github/workflows/release-binaries.yml):
 *   gad-v<VERSION>-windows-x64.exe   + install-gad-windows.ps1
 *   gad-v<VERSION>-macos-arm64
 *   gad-v<VERSION>-linux-x64
 *   get-anything-done-<VERSION>.tgz  (optional — refreshes hooks/skills/agents)
 *
 * Windows self-replace: the bundled install-gad-windows.ps1 handles
 * the running-exe file-lock via Copy-WithLockRetry + a deferred
 * background helper. No additional staging needed on this side.
 *
 * Per decision gad-188 #1, GAD is never on public npm. This command
 * only talks to GitHub Releases.
 */

const { defineCommand } = require('citty');
const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');
const {
  compareVersions,
  listReleaseTagsFromLsRemote,
  normalizeRepoSlug,
  normalizeVersion,
} = require('../../hooks/gad-check-update.js');

const DEFAULT_RELEASE_REPO = 'MagicbornStudios/get-anything-done';

function resolveReleaseRepo() {
  const envRepo = normalizeRepoSlug(process.env.GAD_RELEASE_REPO);
  if (envRepo) return envRepo;
  try {
    const pkg = require('../../package.json');
    const url = typeof pkg.repository === 'string'
      ? pkg.repository
      : (pkg.repository && pkg.repository.url) || pkg.homepage || '';
    const slug = normalizeRepoSlug(url);
    if (slug) return slug;
  } catch {}
  return DEFAULT_RELEASE_REPO;
}

function getInstalledVersion() {
  try {
    const pkg = require('../../package.json');
    if (pkg && pkg.version) return normalizeVersion(pkg.version);
  } catch {}
  return '0.0.0';
}

function fetchLatestTag(repo) {
  // Prefer gh (auth + rate-limits handled). Fall back to git ls-remote.
  try {
    const tag = execFileSync('gh', ['api', `repos/${repo}/releases/latest`, '--jq', '.tag_name'], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
    }).trim();
    if (tag) return tag;
  } catch {}
  try {
    const out = execFileSync('git', ['ls-remote', '--tags', '--refs', `https://github.com/${repo}.git`], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
    }).trim();
    const tags = listReleaseTagsFromLsRemote(out);
    return tags[tags.length - 1] || '';
  } catch {}
  return '';
}

function fetchReleaseNotes(repo, tag) {
  try {
    return execFileSync('gh', ['release', 'view', tag, '--repo', repo], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
    });
  } catch {
    return '';
  }
}

function detectPlatform() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  if (process.platform === 'linux') return 'linux';
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function buildAssetName(platform, version) {
  if (platform === 'windows') return `gad-v${version}-windows-x64.exe`;
  if (platform === 'macos') return `gad-v${version}-macos-arm64`;
  if (platform === 'linux') return `gad-v${version}-linux-x64`;
  throw new Error(`Unsupported platform: ${platform}`);
}

function getInstallDir(platform) {
  if (platform === 'windows') {
    const local = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, 'Programs', 'gad', 'bin');
  }
  return process.env.GAD_BIN_DIR || path.join(os.homedir(), '.local', 'bin');
}

function ghAvailable() {
  try {
    execFileSync('gh', ['--version'], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function downloadAsset(repo, tag, pattern, destDir) {
  // Returns true on success.
  try {
    execFileSync('gh', [
      'release', 'download', tag,
      '--repo', repo,
      '--pattern', pattern,
      '--dir', destDir,
    ], { stdio: 'inherit', timeout: 120000, windowsHide: true });
    return true;
  } catch (err) {
    return false;
  }
}

function ask(question, def = 'y') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} [${def}] `, (answer) => {
      rl.close();
      const trimmed = (answer || '').trim().toLowerCase();
      resolve(trimmed || def.toLowerCase());
    });
  });
}

function clearUpdateCheckCache() {
  const targets = [
    path.join(os.homedir(), '.cache', 'gad', 'gad-update-check.json'),
    path.join(os.homedir(), '.cache', 'gsd', 'gsd-update-check.json'),
  ];
  for (const dir of ['.claude', '.config/opencode', '.opencode', '.gemini', '.codex']) {
    targets.push(path.join(os.homedir(), dir, 'cache', 'gad-update-check.json'));
    targets.push(path.join(process.cwd(), dir, 'cache', 'gad-update-check.json'));
  }
  for (const t of targets) {
    try { fs.unlinkSync(t); } catch {}
  }
}

function installBinaryWindows(tmpDir, assetName) {
  // Use the bundled install-gad-windows.ps1 — it handles the running-exe
  // lock via Copy-WithLockRetry + deferred background job.
  const ps1 = path.join(tmpDir, 'install-gad-windows.ps1');
  if (!fs.existsSync(ps1)) {
    throw new Error(`install-gad-windows.ps1 missing from release assets; cannot self-replace.`);
  }
  const artifact = path.join(tmpDir, assetName);
  const result = spawnSync('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', ps1,
    '-Artifact', artifact,
  ], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`install-gad-windows.ps1 exited with code ${result.status}`);
  }
}

function installBinaryPosix(tmpDir, assetName, platform) {
  const installDir = getInstallDir(platform);
  fs.mkdirSync(installDir, { recursive: true });
  const src = path.join(tmpDir, assetName);
  const dst = path.join(installDir, 'gad');
  fs.chmodSync(src, 0o755);
  fs.renameSync(src, dst);
  console.log(`Installed: ${dst}`);
}

function refreshTarballAssets(repo, tag, tmpDir) {
  // Optional — tarball refreshes hooks/skills/agents/runtime command wrappers.
  const ok = downloadAsset(repo, tag, 'get-anything-done-*.tgz', tmpDir);
  if (!ok) {
    console.log('(no tarball asset on this release — binary-only update)');
    return;
  }
  const tgz = fs.readdirSync(tmpDir).find((f) => f.startsWith('get-anything-done-') && f.endsWith('.tgz'));
  if (!tgz) {
    console.log('(tarball not found after download — skipping framework refresh)');
    return;
  }
  try {
    execFileSync('tar', ['-xzf', path.join(tmpDir, tgz), '-C', tmpDir], {
      stdio: 'inherit', windowsHide: true,
    });
  } catch (err) {
    console.log(`(tar extract failed: ${err.message} — skipping framework refresh)`);
    return;
  }
  const installer = path.join(tmpDir, 'package', 'bin', 'install.js');
  if (!fs.existsSync(installer)) {
    console.log('(package/bin/install.js missing — skipping framework refresh)');
    return;
  }
  const result = spawnSync(process.execPath, [installer, '--claude', '--global'], {
    stdio: 'inherit', windowsHide: true,
  });
  if (result.status !== 0) {
    console.log(`(framework refresh exited with code ${result.status})`);
  }
}

function createUpdateCommand() {
  return defineCommand({
    meta: { name: 'update', description: 'Update gad to the latest GitHub Release (per-OS binary + hooks/skills refresh)' },
    args: {
      check: { type: 'boolean', description: 'Only check for an update; do not install', default: false },
      yes: { type: 'boolean', alias: 'y', description: 'Skip confirmation prompt', default: false },
      'skip-tarball': { type: 'boolean', description: 'Skip the optional tarball refresh of hooks/skills/agents', default: false },
    },
    async run({ args }) {
      const repo = resolveReleaseRepo();
      const installed = getInstalledVersion();

      console.log(`Release repo:    ${repo}`);
      console.log(`Installed:       ${installed}`);

      const latestTag = fetchLatestTag(repo);
      if (!latestTag) {
        console.error(`\nCouldn't check for updates (gh + git ls-remote both failed).`);
        console.error(`To update manually: download from https://github.com/${repo}/releases/latest`);
        process.exit(1);
        return;
      }
      const latest = normalizeVersion(latestTag);
      console.log(`Latest:          ${latest} (${latestTag})`);

      const cmp = compareVersions(installed, latest);
      if (cmp === 0) {
        console.log(`\nAlready on the latest version.`);
        return;
      }
      if (cmp > 0) {
        console.log(`\nInstalled version is ahead of latest release (development build?).`);
        return;
      }

      if (args.check) {
        console.log(`\nUpdate available: ${installed} -> ${latest}`);
        console.log(`Run \`gad update\` to install.`);
        return;
      }

      // Show release notes (best-effort).
      const notes = fetchReleaseNotes(repo, latestTag);
      if (notes) {
        console.log(`\n--- Release notes for ${latestTag} -----------------------`);
        console.log(notes);
        console.log(`-----------------------------------------------------------\n`);
      }

      if (!args.yes) {
        const answer = await ask(`Install ${installed} -> ${latest}? (y/n)`, 'y');
        if (!answer.startsWith('y')) {
          console.log('Cancelled.');
          return;
        }
      }

      if (!ghAvailable()) {
        console.error(`\ngh CLI is required to download release assets. Install from https://cli.github.com/`);
        console.error(`Or update manually: download the per-OS binary from`);
        console.error(`  https://github.com/${repo}/releases/tag/${latestTag}`);
        process.exit(1);
        return;
      }

      const platform = detectPlatform();
      const assetName = buildAssetName(platform, latest);
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gad-update-'));

      console.log(`\nDownloading ${assetName} to ${tmpDir} ...`);
      const ok = downloadAsset(repo, latestTag, assetName, tmpDir);
      if (!ok) {
        console.error(`Failed to download ${assetName} from ${repo}@${latestTag}.`);
        process.exit(1);
        return;
      }

      if (platform === 'windows') {
        const psOk = downloadAsset(repo, latestTag, 'install-gad-windows.ps1', tmpDir);
        if (!psOk) {
          console.error('Failed to download install-gad-windows.ps1; cannot self-replace running gad.exe.');
          process.exit(1);
          return;
        }
        installBinaryWindows(tmpDir, assetName);
      } else {
        installBinaryPosix(tmpDir, assetName, platform);
      }

      if (!args['skip-tarball']) {
        console.log(`\nRefreshing hooks/skills/agents from tarball ...`);
        refreshTarballAssets(repo, latestTag, tmpDir);
      }

      clearUpdateCheckCache();

      console.log(`\nGAD updated: ${installed} -> ${latest}`);
      console.log(`Restart your runtime to pick up new commands.`);
      console.log(`Changelog: https://github.com/${repo}/blob/main/CHANGELOG.md`);
    },
  });
}

module.exports = { createUpdateCommand };
module.exports.register = () => ({ update: createUpdateCommand() });
