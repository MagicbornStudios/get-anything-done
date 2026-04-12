#!/usr/bin/env node
// gsd-hook-version: {{GAD_VERSION}}
// Check for GAD updates in background, write result to cache
// Called by SessionStart hook - runs once per session

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const homeDir = os.homedir();
const cwd = process.cwd();

// Detect runtime config directory (supports Claude, OpenCode, Gemini)
// Respects CLAUDE_CONFIG_DIR for custom config directory setups
function detectConfigDir(baseDir) {
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  if (envDir && fs.existsSync(path.join(envDir, 'get-anything-done', 'VERSION'))) {
    return envDir;
  }
  for (const dir of ['.config/opencode', '.opencode', '.gemini', '.claude']) {
    if (fs.existsSync(path.join(baseDir, dir, 'get-anything-done', 'VERSION'))) {
      return path.join(baseDir, dir);
    }
  }
  return envDir || path.join(baseDir, '.claude');
}

const globalConfigDir = detectConfigDir(homeDir);
const projectConfigDir = detectConfigDir(cwd);
const cacheDir = path.join(homeDir, '.cache', 'gad');
const cacheFile = path.join(cacheDir, 'gad-update-check.json');

const projectVersionFile = path.join(projectConfigDir, 'get-anything-done', 'VERSION');
const globalVersionFile = path.join(globalConfigDir, 'get-anything-done', 'VERSION');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const path = require('path');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  let installed = '0.0.0';
  let configDir = '';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(projectVersionFile));
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
      configDir = path.dirname(path.dirname(globalVersionFile));
    }
  } catch (e) {}

  let staleHooks = [];
  if (configDir) {
    const hooksDir = path.join(configDir, 'hooks');
    try {
      if (fs.existsSync(hooksDir)) {
        const hookFiles = fs.readdirSync(hooksDir).filter(f => f.startsWith('gsd-') && f.endsWith('.js'));
        for (const hookFile of hookFiles) {
          try {
            const content = fs.readFileSync(path.join(hooksDir, hookFile), 'utf8');
            const versionMatch = content.match(/\\/\\/ gsd-hook-version:\\s*(.+)/);
            if (versionMatch) {
              const hookVersion = versionMatch[1].trim();
              if (hookVersion !== installed && !hookVersion.includes('{{')) {
                staleHooks.push({ file: hookFile, hookVersion, installedVersion: installed });
              }
            } else {
              staleHooks.push({ file: hookFile, hookVersion: 'unknown', installedVersion: installed });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  let latest = null;
  try {
    latest = execSync('npm view get-anything-done version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000),
    stale_hooks: staleHooks.length > 0 ? staleHooks : undefined
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
  stdio: 'ignore',
  windowsHide: true,
  detached: true
});

child.unref();
