// Install / packaged-executable / Claude-settings helpers extracted
// from bin/gad.cjs. Pure I/O and platform helpers.

const fs = require('fs');
const os = require('os');
const path = require('path');

const GAD_HOOK_MARKER = 'gad-trace-hook';

function getClaudeSettingsPath(isGlobal) {
  if (isGlobal) return path.join(os.homedir(), '.claude', 'settings.json');
  return path.join(process.cwd(), '.claude', 'settings.json');
}

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function writeJsonPretty(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function isPackagedExecutableRuntime() {
  return Boolean(process.env.GAD_PACKAGED_EXECUTABLE || process.env.GAD_PACKAGED_ROOT);
}

function getPackagedExecutablePath() {
  return process.env.GAD_PACKAGED_EXECUTABLE || process.execPath;
}

function getDefaultSelfInstallDir() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'Programs', 'gad', 'bin');
  }
  return path.join(os.homedir(), '.local', 'bin');
}

function updateWindowsUserPath(targetDir) {
  const { spawnSync } = require('child_process');
  const command = [
    `$target='${targetDir.replace(/'/g, "''")}';`,
    `$current=[Environment]::GetEnvironmentVariable('Path','User');`,
    `$parts=@();`,
    `if ($current) { $parts=$current.Split(';') | Where-Object { $_ -and $_.Trim() -ne '' }; }`,
    `if ($parts -notcontains $target) {`,
    `  $newPath = if ($current -and $current.Trim() -ne '') { "$current;$target" } else { $target };`,
    `  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User');`,
    `}`,
  ].join(' ');
  const result = spawnSync('powershell', ['-NoProfile', '-Command', command], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Failed to update user PATH.');
}

function stampSinkCompileNote(root, baseDir, sink, iso) {
  const planDir = path.join(baseDir, root.path, root.planningDir);
  const stateXml = path.join(planDir, 'STATE.xml');
  if (!fs.existsSync(stateXml)) return;
  try {
    let xml = fs.readFileSync(stateXml, 'utf8');
    const sinkPath = `${sink}/${root.id}/planning/`;
    const tag = `<sink-compiled sink="${sinkPath}" at="${iso}" />`;
    if (/<sink-compiled/.test(xml)) {
      xml = xml.replace(/<sink-compiled[^>]*\/>/, tag);
    } else {
      xml = xml.replace(/<\/state>/, `  ${tag}\n</state>`);
    }
    fs.writeFileSync(stateXml, xml);
  } catch { /* non-fatal */ }
}

function maybeGenerateDailyTip({ teachings, scriptDir }) {
  const today = teachings.isoDate();
  const [Y, M, D] = today.split('-');
  const teachingsDir = teachings.TEACHINGS_DIR;
  const todayFile = path.join(teachingsDir, 'generated', Y, M, `${D}.md`);
  if (fs.existsSync(todayFile)) return;
  if (!process.env.OPENAI_API_KEY) return;
  const scriptPath = path.join(scriptDir, 'generate-daily-tip.mjs');
  if (!fs.existsSync(scriptPath)) return;
  console.log(`[daily tip] generating today's teaching (${today}) ...`);
  const result = require('child_process').spawnSync(process.execPath, [scriptPath], {
    env: process.env, stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`[daily tip] generation failed (exit ${result.status}) — continuing without.`);
  }
  console.log('');
}

module.exports = {
  GAD_HOOK_MARKER,
  getClaudeSettingsPath, readJsonSafe, writeJsonPretty,
  isPackagedExecutableRuntime, getPackagedExecutablePath,
  getDefaultSelfInstallDir, updateWindowsUserPath,
  stampSinkCompileNote, maybeGenerateDailyTip,
};
