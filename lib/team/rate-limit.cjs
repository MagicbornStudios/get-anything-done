'use strict';
/**
 * lib/team/rate-limit.cjs - detect runtime rate-limit signals + manage runtime account state.
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
 *   3. Requeue the handoff so another worker/runtime can try it.
 *   4. Stop retrying once the per-handoff retry budget is exhausted.
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

// Subset of rate-limit signals that indicate hours-long account caps.
// Still useful for telemetry even after runtime parking is retired.
const HARD_USAGE_CAP_PATTERNS = [
  /You've hit your usage limit/i,
  /Upgrade to Pro/i,
  /Plan limit reached/i,
  /try again at/i,
];

function isHardUsageCap(stderr, stdout) {
  const haystack = `${stderr || ''}\n${stdout || ''}`;
  return HARD_USAGE_CAP_PATTERNS.some((re) => re.test(haystack));
}

// Per-handoff retry filter. Workers should NOT re-self-claim a handoff
// that has already bounced N times for rate-limit reasons — eventually
// the operator needs to rotate accounts or pick a different runtime,
// and the worker hammering it just burns log space.
const MAX_RATE_LIMIT_RETRIES = 3;

function isHandoffExhausted(handoffFrontmatter) {
  if (!handoffFrontmatter || typeof handoffFrontmatter !== 'object') return false;
  const history = handoffFrontmatter.unclaim_history;
  if (!Array.isArray(history)) return false;
  const rateLimitCount = history.filter(
    (entry) => entry && entry.reason === 'rate-limit',
  ).length;
  return rateLimitCount >= MAX_RATE_LIMIT_RETRIES;
}

// Per-runtime retry filter. Counts ONLY rate-limit unclaims attributable
// to the same runtime. A handoff that bounced 3x off gemini-cli is still
// eligible for codex-cli / opencode / etc.
//
// Runtime attribution per entry, in order of preference:
//   1. entry.runtime  — explicit runtime field (forward-compatible).
//   2. options.byToRuntime(entry.by)  — map worker id ("team-w2") → runtime
//      via current team config. Stable while worker config is stable.
//   3. otherwise inert (don't count toward any runtime's cap).
//
// Legacy entries without a runtime field AND without a byToRuntime mapper
// are treated as inert — they predate per-runtime tracking and shouldn't
// permanently lock fresh runtimes out. The legacy global safety net stays
// available via isHandoffExhausted() for callers that need it.
function isHandoffExhaustedForRuntime(handoffFrontmatter, runtime, options = {}) {
  if (!handoffFrontmatter || typeof handoffFrontmatter !== 'object') return false;
  if (!runtime) return isHandoffExhausted(handoffFrontmatter);
  const history = handoffFrontmatter.unclaim_history;
  if (!Array.isArray(history)) return false;
  const byToRuntime = typeof options.byToRuntime === 'function' ? options.byToRuntime : null;
  const rateLimitCount = history.filter((entry) => {
    if (!entry || entry.reason !== 'rate-limit') return false;
    if (entry.runtime) return entry.runtime === runtime;
    if (byToRuntime && entry.by) return byToRuntime(entry.by) === runtime;
    return false;
  }).length;
  return rateLimitCount >= MAX_RATE_LIMIT_RETRIES;
}

// Team-level exhaustion: handoff is exhausted only if EVERY configured
// runtime has already hit its per-runtime cap. Used by the dispatcher,
// which routes to whichever worker fits — if any single runtime in the
// team still has retries left, the handoff is dispatchable.
function isHandoffExhaustedForRuntimes(handoffFrontmatter, runtimes, options = {}) {
  if (!Array.isArray(runtimes) || runtimes.length === 0) {
    return isHandoffExhausted(handoffFrontmatter);
  }
  return runtimes.every((rt) => isHandoffExhaustedForRuntime(handoffFrontmatter, rt, options));
}

function runtimeAccountsPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-accounts.json');
}

function runtimeAccountStatePath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-account-state.json');
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

function loadGlobalFallbacks(baseDir) {
  const p = path.join(baseDir, '.planning', 'team', 'runtime-fallbacks.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {
      'codex-cli': ['gemini-cli', 'cursor-cli', 'opencode'],
      'gemini-cli': ['codex-cli', 'cursor-cli', 'opencode'],
      'cursor-cli': ['codex-cli', 'gemini-cli', 'opencode'],
      opencode: ['gemini-cli', 'codex-cli', 'cursor-cli'],
      'claude-code': ['codex-cli', 'gemini-cli', 'cursor-cli'],
    };
  }
}

function loadFallbackChain(baseDir, primary, handoffFrontmatter) {
  if (handoffFrontmatter && Array.isArray(handoffFrontmatter.runtime_fallbacks)) {
    return handoffFrontmatter.runtime_fallbacks.slice();
  }
  const chains = loadGlobalFallbacks(baseDir);
  return Array.isArray(chains[primary]) ? chains[primary].slice() : [];
}

function cooldownPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-cooldown.json');
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

function nextAvailableRuntime(baseDir, primary, handoffFrontmatter) {
  if (!isParked(baseDir, primary)) return primary;
  const chain = loadFallbackChain(baseDir, primary, handoffFrontmatter);
  for (const candidate of chain) {
    if (!isParked(baseDir, candidate)) return candidate;
  }
  return null;
}

function parkingEnabled(env = process.env) {
  return env.GAD_ENABLE_RUNTIME_PARKING === '1';
}

function suggestedCooldownMs(stderr, stdout) {
  return isHardUsageCap(stderr, stdout) ? 4 * 60 * 60 * 1000 : 15 * 60 * 1000;
}

module.exports = {
  isRateLimited,
  isHardUsageCap,
  suggestedCooldownMs,
  isHandoffExhausted,
  isHandoffExhaustedForRuntime,
  isHandoffExhaustedForRuntimes,
  loadGlobalFallbacks,
  loadFallbackChain,
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
  parkingEnabled,
  parkRuntime,
  isParked,
  nextAvailableRuntime,
  loadCooldown,
  cooldownPath,
  suggestedCooldownMs,
  RATE_LIMIT_PATTERNS,
  HARD_USAGE_CAP_PATTERNS,
  MAX_RATE_LIMIT_RETRIES,
};
