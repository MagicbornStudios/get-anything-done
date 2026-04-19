// Side-effects suppression + raw-argv flag helpers + per-process call logger
// extracted from bin/gad.cjs. Caller wires `findRepoRoot` (and the runtime
// detectors) so the helpers stay framework-agnostic.

const fs = require('fs');
const path = require('path');

const NO_SIDE_EFFECTS_FLAG = '--no-side-effects';
const NO_SIDE_EFFECTS_MARKER = '.gad-release-build';

function readRawFlagValue(flagName, argv) {
  const inline = argv.find((arg) => String(arg).startsWith(`${flagName}=`));
  if (inline) return String(inline).slice(flagName.length + 1);
  const idx = argv.indexOf(flagName);
  if (idx === -1 || idx + 1 >= argv.length) return '';
  const value = argv[idx + 1];
  if (!value || String(value).startsWith('--')) return '';
  return String(value);
}

function hasRawFlag(flagName, argv) {
  return argv.includes(flagName) || argv.some((arg) => String(arg).startsWith(`${flagName}=`));
}

function envFlagEnabled(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return false;
  return !['0', 'false', 'no', 'off'].includes(normalized);
}

/**
 * Build the side-effects + log-call helpers. `RAW_ARGV` and `findRepoRoot`
 * are captured at construction time; the rest are derived from environment.
 */
function createSideEffectsHelpers({ RAW_ARGV, findRepoRoot, detectRuntimeIdentity, detectAgentTelemetry }) {
  let _sideEffectsModeCache = null;

  function resolveSideEffectsMode() {
    if (_sideEffectsModeCache) return _sideEffectsModeCache;
    const reasons = [];
    if (hasRawFlag(NO_SIDE_EFFECTS_FLAG, RAW_ARGV)) reasons.push('flag');
    if (envFlagEnabled(process.env.GAD_NO_SIDE_EFFECTS)) reasons.push('env:GAD_NO_SIDE_EFFECTS');
    if (envFlagEnabled(process.env.GAD_RELEASE_BUILD)) reasons.push('env:GAD_RELEASE_BUILD');
    if (envFlagEnabled(process.env.GAD_NO_SIDE_EFFECTS_ACTIVE)) reasons.push('env:GAD_NO_SIDE_EFFECTS_ACTIVE');
    try {
      const repoRoot = findRepoRoot();
      if (repoRoot && fs.existsSync(path.join(repoRoot, NO_SIDE_EFFECTS_MARKER))) {
        reasons.push(`marker:${NO_SIDE_EFFECTS_MARKER}`);
      }
    } catch { /* non-fatal */ }
    _sideEffectsModeCache = { enabled: reasons.length > 0, reasons };
    return _sideEffectsModeCache;
  }

  function sideEffectsSuppressed() {
    return resolveSideEffectsMode().enabled;
  }

  const GAD_LOG_DIR = process.env.GAD_LOG_DIR || null;
  let _logDir = null;
  const _logStart = Date.now();
  const _logCmd = RAW_ARGV.slice(2).join(' ');

  function getLogDir() {
    if (sideEffectsSuppressed()) return null;
    if (_logDir) return _logDir;
    if (GAD_LOG_DIR) {
      _logDir = GAD_LOG_DIR;
    } else {
      try {
        const root = findRepoRoot();
        _logDir = path.join(root, '.planning', '.gad-log');
      } catch {
        return null;
      }
    }
    try { fs.mkdirSync(_logDir, { recursive: true }); } catch {}
    return _logDir;
  }

  function logCall(overrides = {}) {
    const dir = getLogDir();
    if (!dir) return;
    const entry = {
      ts: new Date().toISOString(),
      cmd: overrides.cmd || _logCmd,
      args: overrides.args || RAW_ARGV.slice(2),
      duration_ms: Date.now() - _logStart,
      exit: overrides.exit || 0,
      summary: overrides.summary || '',
      pid: process.pid,
      runtime: detectRuntimeIdentity(),
      agent: detectAgentTelemetry(),
    };
    const logFile = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`);
    try {
      fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch {}
  }

  return {
    resolveSideEffectsMode,
    sideEffectsSuppressed,
    getLogDir,
    logCall,
  };
}

module.exports = {
  NO_SIDE_EFFECTS_FLAG,
  NO_SIDE_EFFECTS_MARKER,
  readRawFlagValue,
  hasRawFlag,
  envFlagEnabled,
  createSideEffectsHelpers,
};
