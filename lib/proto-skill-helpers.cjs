// Proto-skill install helpers. Pure path/runtime helpers extracted from
// bin/gad.cjs. detectRuntimeIdentity is injected (caller already has it).

const fs = require('fs');
const os = require('os');
const path = require('path');

function protoSkillRelativePath(slug = '') {
  return path.posix.join('.planning', 'proto-skills', slug).replace(/\/$/, '');
}

function expandHomeDir(targetPath) {
  if (typeof targetPath !== 'string') return targetPath;
  if (targetPath === '~') return os.homedir();
  if (targetPath.startsWith('~/')) return path.join(os.homedir(), targetPath.slice(2));
  return targetPath;
}

function normalizeProtoSkillRuntime(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'claude' || normalized === 'claude-code') return 'claude';
  if (['codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity'].includes(normalized)) return normalized;
  return null;
}

function getProtoSkillRuntimeDirName(runtime) {
  if (runtime === 'copilot') return '.github';
  if (runtime === 'codex') return '.codex';
  if (runtime === 'cursor') return '.cursor';
  if (runtime === 'windsurf') return '.windsurf';
  if (runtime === 'augment') return '.augment';
  if (runtime === 'antigravity') return '.agent';
  return '.claude';
}

function getProtoSkillGlobalDir(runtime, explicitDir = '') {
  if (explicitDir) return path.resolve(expandHomeDir(explicitDir));
  const envMap = {
    claude: 'CLAUDE_CONFIG_DIR',
    codex: 'CODEX_HOME',
    cursor: 'CURSOR_CONFIG_DIR',
    windsurf: 'WINDSURF_CONFIG_DIR',
    augment: 'AUGMENT_CONFIG_DIR',
    copilot: 'COPILOT_CONFIG_DIR',
    antigravity: 'ANTIGRAVITY_CONFIG_DIR',
  };
  const envVar = envMap[runtime];
  if (envVar && process.env[envVar]) return path.resolve(expandHomeDir(process.env[envVar]));
  if (runtime === 'antigravity') return path.join(os.homedir(), '.gemini', 'antigravity');
  if (runtime && runtime !== 'claude') return path.join(os.homedir(), `.${runtime}`);
  return path.join(os.homedir(), '.claude');
}

function resolveProtoSkillInstallRuntimes(args, { detectRuntimeIdentity } = {}) {
  const all = ['claude', 'codex', 'cursor', 'windsurf', 'augment', 'copilot', 'antigravity'];
  const selected = args.all
    ? all.slice()
    : all.filter((r) => args[r]);
  if (selected.length > 0) return [...new Set(selected)];
  const detected = detectRuntimeIdentity
    ? normalizeProtoSkillRuntime(detectRuntimeIdentity().id)
    : null;
  if (detected) return [detected];
  console.error('No supported runtime selected for proto-skill install.');
  console.error('Pass one of: --claude --codex --cursor --windsurf --augment --copilot --antigravity --all');
  process.exit(1);
}

function installProtoSkillToRuntime(protoDir, slug, runtime, options = {}) {
  const isGlobal = Boolean(options.global);
  const baseDir = isGlobal
    ? getProtoSkillGlobalDir(runtime, options.configDir || '')
    : (options.configDir
      ? path.resolve(expandHomeDir(options.configDir))
      : path.join(process.cwd(), getProtoSkillRuntimeDirName(runtime)));
  const nativeDir = path.join(baseDir, 'skills', slug);
  const mirrorDir = path.join(baseDir, '.agents', 'skills', slug);
  fs.rmSync(nativeDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(nativeDir), { recursive: true });
  fs.cpSync(protoDir, nativeDir, { recursive: true });
  fs.rmSync(mirrorDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(mirrorDir), { recursive: true });
  fs.cpSync(protoDir, mirrorDir, { recursive: true });
  return { baseDir, nativeDir, mirrorDir };
}

module.exports = {
  protoSkillRelativePath,
  expandHomeDir,
  normalizeProtoSkillRuntime,
  getProtoSkillRuntimeDirName,
  getProtoSkillGlobalDir,
  resolveProtoSkillInstallRuntimes,
  installProtoSkillToRuntime,
};
