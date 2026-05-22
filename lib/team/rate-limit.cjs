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
 *
 * Runtime error taxonomy (GLOBAL-D-313, phase 75-11):
 *   8 classes: quota_soft, quota_hard_cap, auth_failed, network_error,
 *   malformed_argv, runtime_crash, output_unparseable, unknown.
 *   Use classifyRuntimeError(stderr, exitCode, runtimeId) to get a typed result.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PROVIDERS,
  providerSpec,
  runtimeAccountsPath,
  runtimeAccountStatePath,
  expandHomePath,
  loadRuntimeRegistry,
  loadRuntimeAccountState,
  saveRuntimeAccountState,
} = require('./accounts-registry.cjs');

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

function loadRuntimeAccounts(baseDir) {
  return loadRuntimeRegistry(baseDir);
}

function workerAccountDir(baseDir, runtime, workerId, label) {
  return path.join(
    baseDir,
    '.planning',
    'team',
    'workers',
    workerId || 'shared',
    'accounts',
    runtime,
    label,
  );
}

function runtimeProfileSpec(runtime, profileDir, canonicalFilename) {
  const xdgConfigHome = path.join(profileDir, '.config');
  const xdgDataHome = path.join(profileDir, '.local', 'share');
  if (runtime === 'codex-cli') {
    const codexHome = path.join(profileDir, '.codex');
    return {
      credentialPath: path.join(codexHome, canonicalFilename),
      env: {
        HOME: profileDir,
        USERPROFILE: profileDir,
        XDG_CONFIG_HOME: xdgConfigHome,
        CODEX_HOME: codexHome,
      },
    };
  }
  if (runtime === 'gemini-cli') {
    const geminiConfigDir = path.join(profileDir, '.gemini');
    return {
      credentialPath: path.join(geminiConfigDir, canonicalFilename),
      env: {
        HOME: profileDir,
        USERPROFILE: profileDir,
        XDG_CONFIG_HOME: xdgConfigHome,
        GEMINI_CONFIG_DIR: geminiConfigDir,
      },
    };
  }
  if (runtime === 'claude-code') {
    const claudeHome = path.join(profileDir, '.claude');
    return {
      credentialPath: path.join(claudeHome, canonicalFilename),
      env: {
        HOME: profileDir,
        USERPROFILE: profileDir,
        XDG_CONFIG_HOME: xdgConfigHome,
        CLAUDE_HOME: claudeHome,
      },
    };
  }
  if (runtime === 'opencode') {
    const opencodeHome = path.join(xdgDataHome, 'opencode');
    return {
      credentialPath: path.join(opencodeHome, canonicalFilename),
      env: {
        HOME: profileDir,
        USERPROFILE: profileDir,
        XDG_CONFIG_HOME: xdgConfigHome,
        XDG_DATA_HOME: xdgDataHome,
        OPENCODE_HOME: opencodeHome,
        OPENCODE_CONFIG_DIR: path.join(xdgConfigHome, 'opencode'),
      },
    };
  }
  return null;
}

function stageFileBackedAccount(baseDir, runtime, provider, account, parentEnv = process.env, options = {}) {
  const credentialRef = account && account.credential_ref;
  if (!credentialRef || credentialRef.kind !== 'file') return null;
  const sourcePath = expandHomePath(credentialRef.path, parentEnv);
  if (!fs.existsSync(sourcePath)) return null;
  const workerId = options.workerId || parentEnv.GAD_TEAM_WORKER_ID || '';
  const canonicalFilename =
    credentialRef.canonical_filename
    || providerSpec(provider).canonicalFilename
    || path.basename(sourcePath);
  const profileDir = workerAccountDir(baseDir, runtime, workerId, account.label);
  const profileSpec = runtimeProfileSpec(runtime, profileDir, canonicalFilename);
  if (profileSpec) {
    fs.mkdirSync(path.dirname(profileSpec.credentialPath), { recursive: true });
    fs.copyFileSync(sourcePath, profileSpec.credentialPath);
    return {
      source: 'file',
      usable: true,
      staged_file: profileSpec.credentialPath,
      env: {
        ...profileSpec.env,
        GAD_RUNTIME_ACCOUNT_LABEL: account.label,
        GAD_RUNTIME_ACCOUNT_FILE: profileSpec.credentialPath,
        GAD_RUNTIME_ACCOUNT_PROFILE_DIR: profileDir,
        GAD_RUNTIME_ACCOUNT_PROVIDER: provider,
      },
    };
  }
  return {
    source: 'file',
    usable: true,
    resolved_env_file: sourcePath,
    env: {
      GAD_RUNTIME_ACCOUNT_LABEL: account.label,
      GAD_RUNTIME_ACCOUNT_FILE: sourcePath,
      GAD_RUNTIME_ACCOUNT_PROVIDER: provider,
      GAD_RUNTIME_ACCOUNT_SOURCE_FILE: sourcePath,
      GAD_RUNTIME_ACCOUNT_CANONICAL_PATH: account.canonical_path || path.join(os.homedir(), PROVIDERS[provider].canonicalRelativePath),
    },
  };
}

function normalizeRuntimeAccount(baseDir, runtime, provider, rawAccount, parentEnv = process.env, options = {}) {
  if (!rawAccount || typeof rawAccount !== 'object') return null;
  const label = rawAccount.label || 'account';
  const status = rawAccount.status || 'active';
  if (status !== 'active') {
    return {
      label,
      provider,
      status,
      usable: false,
      env: {},
    };
  }
  const credentialRef = rawAccount.credential_ref;
  if (credentialRef && credentialRef.kind === 'file') {
    const staged = stageFileBackedAccount(baseDir, runtime, provider, rawAccount, parentEnv, options);
    if (!staged) {
      return {
        label,
        provider,
        status,
        usable: false,
        env: {},
      };
    }
    return {
      ...rawAccount,
      label,
      provider,
      status,
      usable: true,
      env: staged.env,
      source: staged.source,
      staged_file: staged.staged_file || null,
    };
  }
  if (credentialRef && credentialRef.kind === 'env_var') {
    const envValue = parentEnv[credentialRef.name];
    return {
      ...rawAccount,
      label,
      provider,
      status,
      usable: typeof envValue === 'string' && envValue.length > 0,
      env: typeof envValue === 'string' && envValue.length > 0 ? {
        [credentialRef.name]: envValue,
        GAD_RUNTIME_ACCOUNT_LABEL: label,
        GAD_RUNTIME_ACCOUNT_VAR: credentialRef.name,
        GAD_RUNTIME_ACCOUNT_PROVIDER: provider,
      } : {},
      source: 'env_var',
      env_var: credentialRef.name,
    };
  }
  return {
    ...rawAccount,
    label,
    provider,
    status,
    usable: false,
    env: {},
  };
}

function listRuntimeAccounts(baseDir, runtime, parentEnv = process.env, options = {}) {
  const registry = loadRuntimeAccounts(baseDir);
  const entry = registry[runtime];
  const provider = entry && entry.provider ? entry.provider : null;
  const rawAccounts = Array.isArray(entry && entry.accounts) ? entry.accounts : [];
  return rawAccounts
    .map((account) => normalizeRuntimeAccount(baseDir, runtime, provider, account, parentEnv, options))
    .filter(Boolean);
}

function activeRuntimeAccountIndex(baseDir, runtime, accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return -1;
  const state = loadRuntimeAccountState(baseDir);
  const entry = state[runtime];
  if (entry && entry.label) {
    const labelIdx = accounts.findIndex((account) => account.label === entry.label);
    if (labelIdx >= 0) return labelIdx;
  }
  const idx = Number(entry && entry.current_index);
  if (Number.isInteger(idx) && idx >= 0 && idx < accounts.length) return idx;
  return 0;
}

function getActiveRuntimeAccount(baseDir, runtime, parentEnv = process.env, options = {}) {
  const accounts = listRuntimeAccounts(baseDir, runtime, parentEnv, options);
  if (accounts.length === 0) return null;
  const idx = activeRuntimeAccountIndex(baseDir, runtime, accounts);
  const account = accounts[idx];
  if (!account || !account.usable) return null;
  return { ...account, index: idx };
}

function rotateRuntimeAccount(baseDir, runtime, attemptedIndexesOrEnv = process.env, maybeParentEnv = process.env, maybeOptions = {}) {
  const attemptedIndexes = Array.isArray(attemptedIndexesOrEnv) ? attemptedIndexesOrEnv : [];
  const parentEnv = Array.isArray(attemptedIndexesOrEnv) ? maybeParentEnv : attemptedIndexesOrEnv;
  const options = Array.isArray(attemptedIndexesOrEnv) ? maybeOptions : maybeParentEnv;
  const normalizedOptions = options && typeof options === 'object' ? options : {};
  const accounts = listRuntimeAccounts(baseDir, runtime, parentEnv, normalizedOptions);
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
      provider: nextAccount.provider || null,
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

/**
 * Returns the path to the runtime cooldown file.
 * Kept for test assertions only — production code never writes or reads this file.
 * @param {string} baseDir
 * @returns {string}
 */
function cooldownPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-cooldown.json');
}

// ---------------------------------------------------------------------------
// Runtime error taxonomy (GLOBAL-D-313 / GAD-T-75-11)
// ---------------------------------------------------------------------------

/**
 * Parse a human-readable cooldown duration from stderr text.
 * Returns milliseconds or null if not parseable.
 *
 * Supports:
 *   "Your quota will reset after 13h55m22s"   → 50122000
 *   "try again at 14:30"                       → local-tz timestamp delta
 *   "Retry-After: 300"                         → 300000
 */
function parseCooldown(text) {
  if (!text || typeof text !== 'string') return null;

  // "Xh Ym Zs" duration format (e.g. "13h55m22s", "2h0m0s", "0h15m0s", "13h55m22s.")
  const durationRe = /(\d+)h\s*(\d+)m\s*(\d+)s/i;
  const durMatch = text.match(durationRe);
  if (durMatch) {
    const hours = parseInt(durMatch[1], 10);
    const minutes = parseInt(durMatch[2], 10);
    const seconds = parseInt(durMatch[3], 10);
    const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
    if (ms > 0) return ms;
  }

  // "Retry-After: <seconds>" HTTP header style
  const retryAfterRe = /retry[-_]after[:\s]+(\d+)/i;
  const raMatch = text.match(retryAfterRe);
  if (raMatch) {
    const secs = parseInt(raMatch[1], 10);
    if (secs > 0) return secs * 1000;
  }

  // "try again at HH:MM" — local-tz clock time
  const tryAgainRe = /try again at (\d{1,2}):(\d{2})/i;
  const taMatch = text.match(tryAgainRe);
  if (taMatch) {
    const now = new Date();
    const targetH = parseInt(taMatch[1], 10);
    const targetM = parseInt(taMatch[2], 10);
    const target = new Date(now);
    target.setHours(targetH, targetM, 0, 0);
    // If the time has already passed today, add a day
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const delta = target.getTime() - now.getTime();
    if (delta > 0) return delta;
  }

  return null;
}

/**
 * 8-class runtime error taxonomy (GLOBAL-D-313).
 *
 * @param {string} stderr
 * @param {number|null} exitCode
 * @param {string|null} runtimeId  - e.g. 'gemini-cli', 'codex-cli'
 * @returns {{ class: string, cooldown_ms: number|null, cooldown_until: number|null, reason_text: string }}
 */
function classifyRuntimeError(stderr, exitCode, runtimeId) {
  const text = stderr || '';

  // --- runtime_crash (Windows PTY, segfault, EMFILE, etc.) ---
  // Must come BEFORE quota checks so PTY errors aren't mis-classified.
  // EMFILE / ENFILE: gemini-cli walks Rust target/ or node_modules/ and hits the
  // OS open-file-descriptor limit. This is a local resource error, NOT a quota
  // cap — no cooldown should be written and the worker should retry without
  // rotating the account.
  if (
    /AttachConsole failed/i.test(text) ||
    /conpty/i.test(text) ||
    /EMFILE[:\s]/i.test(text) ||
    /ENFILE[:\s]/i.test(text) ||
    /too many open files/i.test(text) ||
    exitCode === 139 ||
    (typeof exitCode === 'number' && exitCode < 0)
  ) {
    return { class: 'runtime_crash', cooldown_ms: null, cooldown_until: null, reason_text: 'runtime_crash: Windows PTY failure, signal crash, or EMFILE (too many open files — add ignore globs to exclude target/node_modules)' };
  }

  // --- auth_failed ---
  if (
    /AUTH(_| )?(EXPIRED|MISSING|INVALID)/i.test(text) ||
    /401 Unauthorized/i.test(text) ||
    /Invalid API key/i.test(text) ||
    /authentication (failed|error)/i.test(text)
  ) {
    return { class: 'auth_failed', cooldown_ms: null, cooldown_until: null, reason_text: 'auth_failed: credentials expired or missing' };
  }

  // --- malformed_argv ---
  if (
    exitCode === 2 && (
      /Unknown (option|argument)/i.test(text) ||
      /missing required/i.test(text) ||
      /unexpected argument/i.test(text)
    )
  ) {
    return { class: 'malformed_argv', cooldown_ms: null, cooldown_until: null, reason_text: 'malformed_argv: adapter bug — unknown option or missing required arg' };
  }

  // --- network_error ---
  if (
    /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(text) ||
    /getaddrinfo/i.test(text)
  ) {
    return { class: 'network_error', cooldown_ms: null, cooldown_until: null, reason_text: 'network_error: transient connectivity failure' };
  }

  // --- output_unparseable ---
  // "[object Object]" in stderr without quota/rate-limit signals indicates a
  // runtime that serialized a JS object to string — adapter bug, not quota.
  // Must be checked BEFORE quota patterns because it can share a stderr buffer.
  if (/\[object Object\]/i.test(text) && !/exhausted your capacity|quota will reset|RESOURCE_EXHAUSTED|rateLimitExceeded|MODEL_CAPACITY_EXHAUSTED|No capacity available/i.test(text)) {
    return { class: 'output_unparseable', cooldown_ms: null, cooldown_until: null, reason_text: 'output_unparseable: [object Object] in stderr — adapter serialization bug' };
  }
  // Also handle exit 0 with no stderr — caller can pass empty text; that case
  // stays as unknown unless other signals match.

  // --- quota_soft (extractable cooldown, model-capacity exhausted) ---
  if (
    /exhausted your capacity/i.test(text) ||
    /quota will reset/i.test(text) ||
    /RESOURCE_EXHAUSTED/i.test(text) ||
    /MODEL_CAPACITY_EXHAUSTED/i.test(text) ||
    /rateLimitExceeded/i.test(text) ||
    /No capacity available/i.test(text) ||
    /\b429\b/.test(text)
  ) {
    const ms = parseCooldown(text);
    const until = ms != null ? Date.now() + ms : null;
    return {
      class: 'quota_soft',
      cooldown_ms: ms,
      cooldown_until: until,
      reason_text: 'quota_soft: model capacity exhausted — retry after cooldown',
    };
  }

  // --- quota_hard_cap (billing/plan limits, no extractable cooldown) ---
  if (
    /Plan limit reached/i.test(text) ||
    /Upgrade to Pro/i.test(text) ||
    /usage limit/i.test(text) ||
    /You've hit your usage limit/i.test(text) ||
    /try again at/i.test(text) ||
    /rate[\s-]?limit/i.test(text) ||
    /Too Many Requests/i.test(text) ||
    /Quota exceeded/i.test(text)
  ) {
    return {
      class: 'quota_hard_cap',
      cooldown_ms: 4 * 60 * 60 * 1000, // 4h default
      cooldown_until: Date.now() + 4 * 60 * 60 * 1000,
      reason_text: 'quota_hard_cap: billing/plan cap — operator must rotate or upgrade',
    };
  }

  // --- unknown (default) ---
  return { class: 'unknown', cooldown_ms: null, cooldown_until: null, reason_text: 'unknown: unclassified error — surface stderr tail for human triage' };
}

// Back-compat shim for callers that referenced the parking system before
// 7cc0733e dropped it (95-10). Parking is gone — cooldown is always 0.
// status.cjs:278 still imports this; remove the import there in a future
// pass and then this stub can go. Keep the export so existing builds work.
function getCooldownRemainingMs(_baseDir, _runtime) {
  return 0;
}

module.exports = {
  isRateLimited,
  isHardUsageCap,
  isHandoffExhausted,
  isHandoffExhaustedForRuntime,
  isHandoffExhaustedForRuntimes,
  loadGlobalFallbacks,
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
  cooldownPath,
  getCooldownRemainingMs,
  RATE_LIMIT_PATTERNS,
  HARD_USAGE_CAP_PATTERNS,
  MAX_RATE_LIMIT_RETRIES,
  // Taxonomy (GLOBAL-D-313 / GAD-T-75-11)
  classifyRuntimeError,
  parseCooldown,
};
