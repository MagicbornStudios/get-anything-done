'use strict';
/**
 * lib/team/rate-limit.cjs - detect runtime rate-limit signals + manage cooldown.
 *
 * Patterns to detect from stderr / stdout:
 *   - codex-cli   : "You've hit your usage limit", "Upgrade to Pro"
 *   - gemini-cli  : "exhausted your capacity on this model", "quota will reset",
 *                   "RESOURCE_EXHAUSTED", "429"
 *   - cursor-cli  : "rate limit", "exceeded", "402", "429"
 *   - opencode    : "rate limit", "429", "quota"
 *   - generic     : "rate limit", "rate-limited", "429"
 *
 * When detected, the worker should:
 *   1. NOT mark the handoff failed (it should go back to open/ for another runtime).
 *   2. Rotate to another configured account for the same runtime if available.
 *   3. Park the runtime in cooldown for cooldownMs only after accounts are exhausted.
 *   4. Continue the worker loop with the next available runtime per the
 *      fallback chain in `.planning/team/runtime-fallbacks.json`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const RATE_LIMIT_PATTERNS = [
  /You've hit your usage limit/i,
  /usage limit/i,
  /Upgrade to Pro/i,
  /exhausted your capacity on this model/i,
  /quota will reset/i,
  /RESOURCE_EXHAUSTED/i,
  /Quota exceeded/i,
  /Plan limit reached/i,
  /\b429\b/,
  /rate[\s-]?limit/i,
  /Too Many Requests/i,
];

function isRateLimited(stderr, stdout) {
  const haystack = `${stderr || ''}\n${stdout || ''}`;
  return RATE_LIMIT_PATTERNS.some((re) => re.test(haystack));
}

function cooldownPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-cooldown.json');
}

function runtimeAccountsPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-accounts.json');
}

function runtimeAccountStatePath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-account-state.json');
}

function loadCooldown(baseDir) {
  try {
    const raw = fs.readFileSync(cooldownPath(baseDir), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCooldown(baseDir, registry) {
  const p = cooldownPath(baseDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(registry, null, 2) + '\n', 'utf8');
}

function expandHomePath(p) {
  if (!p || typeof p !== 'string') return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function loadRuntimeAccounts(baseDir) {
  try {
    const raw = fs.readFileSync(runtimeAccountsPath(baseDir), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadRuntimeAccountState(baseDir) {
  try {
    const raw = fs.readFileSync(runtimeAccountStatePath(baseDir), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveRuntimeAccountState(baseDir, state) {
  const p = runtimeAccountStatePath(baseDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function runtimeEnvFileKey(runtime) {
  if (runtime === 'codex-cli') return 'CODEX_HOME';
  if (runtime === 'gemini-cli') return 'GEMINI_CONFIG_DIR';
  return null;
}

function normalizeRuntimeAccount(runtime, rawAccount, parentEnv = process.env) {
  if (!rawAccount || typeof rawAccount !== 'object') return null;
  const label = rawAccount.label || 'account';
  if (rawAccount.env_file) {
    const envFile = expandHomePath(rawAccount.env_file);
    const envKey = runtimeEnvFileKey(runtime);
    return {
      label,
      env_file: rawAccount.env_file,
      resolved_env_file: envFile,
      source: 'env_file',
      usable: !!envKey && fs.existsSync(envFile),
      env: envKey ? {
        [envKey]: path.dirname(envFile),
        GAD_RUNTIME_ACCOUNT_LABEL: label,
        GAD_RUNTIME_ACCOUNT_FILE: envFile,
      } : {},
    };
  }
  if (rawAccount.env_var) {
    const envValue = parentEnv[rawAccount.env_var];
    return {
      label,
      env_var: rawAccount.env_var,
      source: 'env_var',
      usable: typeof envValue === 'string' && envValue.length > 0,
      env: typeof envValue === 'string' && envValue.length > 0 ? {
        [rawAccount.env_var]: envValue,
        GAD_RUNTIME_ACCOUNT_LABEL: label,
        GAD_RUNTIME_ACCOUNT_VAR: rawAccount.env_var,
      } : {},
    };
  }
  return null;
}

function listRuntimeAccounts(baseDir, runtime, parentEnv = process.env) {
  const registry = loadRuntimeAccounts(baseDir);
  const rawAccounts = Array.isArray(registry[runtime]) ? registry[runtime] : [];
  return rawAccounts
    .map((account) => normalizeRuntimeAccount(runtime, account, parentEnv))
    .filter(Boolean);
}

function activeRuntimeAccountIndex(baseDir, runtime, accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return -1;
  const state = loadRuntimeAccountState(baseDir);
  const entry = state[runtime];
  const idx = Number(entry && entry.current_index);
  if (Number.isInteger(idx) && idx >= 0 && idx < accounts.length) return idx;
  return 0;
}

function getActiveRuntimeAccount(baseDir, runtime, parentEnv = process.env) {
  const accounts = listRuntimeAccounts(baseDir, runtime, parentEnv);
  if (accounts.length === 0) return null;
  const idx = activeRuntimeAccountIndex(baseDir, runtime, accounts);
  const account = accounts[idx];
  if (!account || !account.usable) return null;
  return { ...account, index: idx };
}

function rotateRuntimeAccount(baseDir, runtime, attemptedIndexesOrEnv = process.env, maybeParentEnv = process.env) {
  const attemptedIndexes = Array.isArray(attemptedIndexesOrEnv) ? attemptedIndexesOrEnv : [];
  const parentEnv = Array.isArray(attemptedIndexesOrEnv) ? maybeParentEnv : attemptedIndexesOrEnv;
  const accounts = listRuntimeAccounts(baseDir, runtime, parentEnv);
  if (accounts.length === 0) return null;
  const currentIdx = activeRuntimeAccountIndex(baseDir, runtime, accounts);
  const attempted = new Set(
    attemptedIndexes
      .map((idx) => Number(idx))
      .filter((idx) => Number.isInteger(idx) && idx >= 0),
  );
  for (let step = 1; step < accounts.length; step += 1) {
    const nextIdx = (currentIdx + step) % accounts.length;
    if (attempted.has(nextIdx)) continue;
    const nextAccount = accounts[nextIdx];
    if (!nextAccount || !nextAccount.usable) continue;
    const state = loadRuntimeAccountState(baseDir);
    state[runtime] = {
      current_index: nextIdx,
      label: nextAccount.label,
      rotated_at: new Date().toISOString(),
    };
    saveRuntimeAccountState(baseDir, state);
    return {
      ...nextAccount,
      index: nextIdx,
      previous_index: currentIdx,
      previous_label: accounts[currentIdx] ? accounts[currentIdx].label : null,
    };
  }
  return null;
}

function parkRuntime(baseDir, runtime, cooldownMs = 15 * 60 * 1000) {
  const reg = loadCooldown(baseDir);
  reg[runtime] = {
    until: Date.now() + cooldownMs,
    parked_at: new Date().toISOString(),
  };
  saveCooldown(baseDir, reg);
  return reg[runtime];
}

function isParked(baseDir, runtime) {
  const reg = loadCooldown(baseDir);
  const entry = reg[runtime];
  if (!entry) return false;
  if (Date.now() > entry.until) {
    delete reg[runtime];
    saveCooldown(baseDir, reg);
    return false;
  }
  return true;
}

function loadFallbackChain(baseDir, primary) {
  const p = path.join(baseDir, '.planning', 'team', 'runtime-fallbacks.json');
  let chains = null;
  try {
    chains = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    chains = {
      'codex-cli': ['gemini-cli', 'cursor-cli', 'opencode'],
      'gemini-cli': ['codex-cli', 'cursor-cli', 'opencode'],
      'cursor-cli': ['codex-cli', 'gemini-cli', 'opencode'],
      opencode: ['gemini-cli', 'codex-cli', 'cursor-cli'],
    };
  }
  return chains[primary] || [];
}

function nextAvailableRuntime(baseDir, primary) {
  if (!isParked(baseDir, primary)) return primary;
  const chain = loadFallbackChain(baseDir, primary);
  for (const candidate of chain) {
    if (!isParked(baseDir, candidate)) return candidate;
  }
  return null;
}

module.exports = {
  isRateLimited,
  parkRuntime,
  isParked,
  nextAvailableRuntime,
  loadFallbackChain,
  cooldownPath,
  runtimeAccountsPath,
  runtimeAccountStatePath,
  loadRuntimeAccounts,
  loadRuntimeAccountState,
  saveRuntimeAccountState,
  listRuntimeAccounts,
  getActiveRuntimeAccount,
  rotateRuntimeAccount,
  normalizeRuntimeAccount,
  expandHomePath,
  RATE_LIMIT_PATTERNS,
};
