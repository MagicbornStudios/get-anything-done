'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PROVIDERS = Object.freeze({
  codex: {
    canonicalRelativePath: path.join('.codex', 'auth.json'),
    canonicalFilename: 'auth.json',
    runtime: 'codex-cli',
    credentialType: 'oauth-file',
    loginCmd: ['codex', ['login']],
  },
  gemini: {
    canonicalRelativePath: path.join('.gemini', 'oauth_creds.json'),
    canonicalFilename: 'oauth_creds.json',
    runtime: 'gemini-cli',
    credentialType: 'oauth-file',
    loginCmd: ['gemini', ['login']],
  },
  claude: {
    canonicalRelativePath: path.join('.claude', '.credentials.json'),
    canonicalFilename: '.credentials.json',
    runtime: 'claude-code',
    credentialType: 'oauth-file',
    loginCmd: ['claude', ['login']],
  },
  opencode: {
    canonicalRelativePath: path.join('.local', 'share', 'opencode', 'auth.json'),
    canonicalFilename: 'auth.json',
    runtime: 'opencode',
    credentialType: 'oauth-file',
    loginCmd: ['opencode', ['auth', 'login']],
  },
});

const RUNTIME_PROVIDER_DEFAULTS = Object.freeze({
  'codex-cli': 'codex',
  'gemini-cli': 'gemini',
  'claude-code': 'claude',
  'cursor-cli': 'cursor',
  opencode: 'opencode',
});

const ACCOUNT_STATUSES = new Set(['active', 'paused', 'rate-limited', 'error']);

function expandHomePath(p, env = process.env) {
  if (!p || typeof p !== 'string') return p;
  const home = resolveHomeDir(env);
  if (p === '~') return home;
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(home, p.slice(2));
  return p;
}

function resolveHomeDir(env = process.env) {
  return env.HOME || env.USERPROFILE || os.homedir();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function stripBom(text) {
  return typeof text === 'string' ? text.replace(/^\uFEFF/, '') : text;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(stripBom(fs.readFileSync(filePath, 'utf8')));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function runtimeAccountsPath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-accounts.json');
}

function runtimeAccountStatePath(baseDir) {
  return path.join(baseDir, '.planning', 'team', 'runtime-account-state.json');
}

function registryRootDir(env = process.env) {
  return path.join(resolveHomeDir(env), '.gad-credentials');
}

function registryPath(env = process.env) {
  return path.join(registryRootDir(env), 'registry.json');
}

function providerSpec(provider) {
  const spec = PROVIDERS[provider];
  if (!spec) {
    throw new Error(`Unknown provider: ${provider}. Known providers: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return spec;
}

function canonicalPathForProvider(provider, env = process.env) {
  const spec = providerSpec(provider);
  return path.join(resolveHomeDir(env), spec.canonicalRelativePath);
}

function storedPathForProvider(provider, label, env = process.env) {
  const canonical = canonicalPathForProvider(provider, env);
  const ext = path.extname(canonical) || '.json';
  return path.join(registryRootDir(env), `${provider}-${label}${ext}`);
}

function normalizeAccountRecord(provider, rawAccount, nowIso) {
  if (!rawAccount || typeof rawAccount !== 'object') return null;
  const label = String(rawAccount.label || '').trim();
  if (!label) return null;
  const status = ACCOUNT_STATUSES.has(rawAccount.status) ? rawAccount.status : 'active';
  const credentialRef = normalizeCredentialRef(provider, rawAccount);
  return {
    label,
    type: rawAccount.type || inferCredentialType(provider, credentialRef),
    credential_ref: credentialRef,
    status,
    current_quota: rawAccount.current_quota || null,
    reset_at: rawAccount.reset_at || null,
    last_used_at: rawAccount.last_used_at || null,
    added_at: rawAccount.added_at || rawAccount.captured_at || nowIso,
    last_polled_at: rawAccount.last_polled_at || null,
    last_error: rawAccount.last_error || null,
    canonical_path: rawAccount.canonical_path || canonicalPathForProvider(provider),
    stored_path: rawAccount.stored_path || (
      credentialRef && credentialRef.kind === 'file'
        ? credentialRef.path
        : null
    ),
  };
}

function normalizeCredentialRef(provider, rawAccount) {
  if (rawAccount.credential_ref && typeof rawAccount.credential_ref === 'object') {
    return rawAccount.credential_ref;
  }
  if (rawAccount.env_file || rawAccount.stored_path) {
    return {
      kind: 'file',
      path: rawAccount.stored_path || rawAccount.env_file,
      canonical_filename: providerSpec(provider).canonicalFilename,
    };
  }
  if (rawAccount.env_var) {
    return {
      kind: 'env_var',
      name: rawAccount.env_var,
    };
  }
  return null;
}

function inferCredentialType(provider, credentialRef) {
  if (!credentialRef || credentialRef.kind !== 'file') return 'env-var';
  return providerSpec(provider).credentialType || 'oauth-file';
}

function emptyRuntimeRegistryEntry(runtime) {
  return {
    provider: RUNTIME_PROVIDER_DEFAULTS[runtime] || runtime,
    accounts: [],
  };
}

function normalizeRuntimeRegistry(rawRegistry) {
  const normalized = {};
  const nowIso = new Date().toISOString();
  const source = rawRegistry && typeof rawRegistry === 'object' ? rawRegistry : {};
  for (const [runtime, rawEntry] of Object.entries(source)) {
    if (Array.isArray(rawEntry)) {
      const provider = RUNTIME_PROVIDER_DEFAULTS[runtime] || runtime;
      normalized[runtime] = {
        provider,
        accounts: rawEntry
          .map((account) => normalizeAccountRecord(provider, account, nowIso))
          .filter(Boolean),
      };
      continue;
    }
    if (!rawEntry || typeof rawEntry !== 'object') continue;
    const provider = rawEntry.provider || RUNTIME_PROVIDER_DEFAULTS[runtime] || runtime;
    const rawAccounts = Array.isArray(rawEntry.accounts) ? rawEntry.accounts : [];
    normalized[runtime] = {
      provider,
      accounts: rawAccounts
        .map((account) => normalizeAccountRecord(provider, account, nowIso))
        .filter(Boolean),
    };
  }
  return normalized;
}

function loadRuntimeRegistry(baseDir) {
  return normalizeRuntimeRegistry(readJson(runtimeAccountsPath(baseDir), {}));
}

function saveRuntimeRegistry(baseDir, registry) {
  writeJson(runtimeAccountsPath(baseDir), normalizeRuntimeRegistry(registry));
}

function loadRuntimeAccountState(baseDir) {
  return readJson(runtimeAccountStatePath(baseDir), {});
}

function saveRuntimeAccountState(baseDir, state) {
  writeJson(runtimeAccountStatePath(baseDir), state || {});
}

function loadGlobalRegistry(env = process.env) {
  const loaded = readJson(registryPath(env), { accounts: [] });
  const accounts = Array.isArray(loaded && loaded.accounts) ? loaded.accounts : [];
  return { accounts };
}

function saveGlobalRegistry(registry, env = process.env) {
  writeJson(registryPath(env), {
    accounts: Array.isArray(registry && registry.accounts) ? registry.accounts : [],
  });
}

function listGlobalAccounts(provider = '', env = process.env) {
  const registry = loadGlobalRegistry(env);
  return registry.accounts.filter((account) => !provider || account.provider === provider);
}

function upsertRuntimeAccount(baseDir, runtime, provider, accountRecord) {
  const registry = loadRuntimeRegistry(baseDir);
  const entry = registry[runtime] || emptyRuntimeRegistryEntry(runtime);
  entry.provider = provider;
  entry.accounts = (entry.accounts || []).filter((account) => account.label !== accountRecord.label);
  entry.accounts.push(accountRecord);
  registry[runtime] = entry;
  saveRuntimeRegistry(baseDir, registry);
  return registry[runtime];
}

function upsertGlobalAccount(provider, account, env = process.env) {
  const registry = loadGlobalRegistry(env);
  registry.accounts = registry.accounts.filter(
    (existing) => !(existing.provider === provider && existing.label === account.label),
  );
  registry.accounts.push(account);
  saveGlobalRegistry(registry, env);
  return account;
}

function captureAccount({
  baseDir,
  provider,
  label,
  sourceFile = '',
  env = process.env,
}) {
  const spec = providerSpec(provider);
  const canonicalPath = canonicalPathForProvider(provider, env);
  const resolvedSource = expandHomePath(sourceFile || canonicalPath, env);
  if (!fs.existsSync(resolvedSource)) {
    throw new Error(`No credential file found at ${resolvedSource}. Log in first or pass --credential-file.`);
  }
  const storedPath = storedPathForProvider(provider, label, env);
  ensureDir(path.dirname(storedPath));
  fs.copyFileSync(resolvedSource, storedPath);
  const nowIso = new Date().toISOString();
  const globalRecord = {
    provider,
    label,
    captured_at: nowIso,
    canonical_path: canonicalPath,
    stored_path: storedPath,
    status: 'active',
    quota_state: null,
    last_used_at: null,
    last_error: null,
  };
  upsertGlobalAccount(provider, globalRecord, env);
  const runtime = spec.runtime;
  const runtimeRecord = normalizeAccountRecord(provider, {
    label,
    type: spec.credentialType,
    credential_ref: {
      kind: 'file',
      path: storedPath,
      canonical_filename: spec.canonicalFilename,
    },
    status: 'active',
    current_quota: null,
    last_used_at: null,
    added_at: nowIso,
    last_error: null,
    canonical_path: canonicalPath,
    stored_path: storedPath,
  }, nowIso);
  upsertRuntimeAccount(baseDir, runtime, provider, runtimeRecord);
  return runtimeRecord;
}

function findRuntimeEntryForProvider(baseDir, provider) {
  const registry = loadRuntimeRegistry(baseDir);
  return Object.entries(registry).find(([, entry]) => entry && entry.provider === provider) || null;
}

function resolveAccountEntry(baseDir, provider, label) {
  const runtimeHit = findRuntimeEntryForProvider(baseDir, provider);
  if (!runtimeHit) return null;
  const [runtime, entry] = runtimeHit;
  const account = (entry.accounts || []).find((candidate) => candidate.label === label);
  if (!account) return null;
  return { runtime, provider, entry, account };
}

function copyProviderAccountToCanonical(provider, account, env = process.env) {
  const credentialRef = account && account.credential_ref;
  if (!credentialRef || credentialRef.kind !== 'file') {
    throw new Error(`Account ${provider}:${account ? account.label : '(missing)'} is not file-backed.`);
  }
  const sourcePath = expandHomePath(credentialRef.path, env);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Stored credential missing at ${sourcePath}`);
  }
  const destinationPath = canonicalPathForProvider(provider, env);
  ensureDir(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

function markRuntimeActiveAccount(baseDir, runtime, account, reason = 'manual-use') {
  const state = loadRuntimeAccountState(baseDir);
  const entry = {
    label: account.label,
    current_index: account.index,
    provider: account.provider || null,
    selected_at: new Date().toISOString(),
    reason,
  };
  state[runtime] = entry;
  saveRuntimeAccountState(baseDir, state);
  return entry;
}

function setAccountStatus(baseDir, provider, label, status) {
  if (!ACCOUNT_STATUSES.has(status)) {
    throw new Error(`Unsupported account status: ${status}`);
  }
  const registry = loadRuntimeRegistry(baseDir);
  let updated = null;
  for (const entry of Object.values(registry)) {
    if (!entry || entry.provider !== provider) continue;
    entry.accounts = (entry.accounts || []).map((account) => {
      if (account.label !== label) return account;
      updated = { ...account, status };
      return updated;
    });
  }
  if (!updated) {
    throw new Error(`Account not found: ${provider}:${label}`);
  }
  saveRuntimeRegistry(baseDir, registry);
  return updated;
}

/**
 * Persist rate-limit / quota observations onto an account record (110-06).
 *
 * Called by the worker loop when a runtime invocation comes back with a
 * classified quota_soft / quota_hard_cap error. Writes:
 *   - status (default 'rate-limited')
 *   - last_error  (string)
 *   - current_quota = { reset_at, observed_at, error_class, reason_text }
 *   - reset_at  (top-level, mirrors current_quota.reset_at so account-poller
 *     can flip back to 'active' once the timestamp passes).
 *
 * Tolerant: if provider/label do not resolve to a known account, returns
 * null instead of throwing (workers shouldn't crash because a stale
 * label is in flight).
 *
 * @param {string} baseDir
 * @param {string} provider
 * @param {string} label
 * @param {{
 *   status?: 'active'|'paused'|'rate-limited'|'error',
 *   last_error?: string,
 *   reset_at?: string|null,   // ISO timestamp when access should be restored
 *   error_class?: string,     // taxonomy class from classifyRuntimeError
 *   reason_text?: string,
 *   cooldown_ms?: number|null,
 * }} observation
 * @returns {object|null} updated account record, or null if not found
 */
function recordAccountQuotaState(baseDir, provider, label, observation = {}) {
  if (!provider || !label) return null;
  const registry = loadRuntimeRegistry(baseDir);
  let updated = null;
  const nowIso = new Date().toISOString();
  const status = observation.status || 'rate-limited';
  if (!ACCOUNT_STATUSES.has(status)) {
    throw new Error(`Unsupported account status: ${status}`);
  }
  const resetAt = observation.reset_at || null;
  const currentQuota = {
    reset_at: resetAt,
    observed_at: nowIso,
    error_class: observation.error_class || null,
    reason_text: observation.reason_text || null,
    cooldown_ms: observation.cooldown_ms != null ? observation.cooldown_ms : null,
  };
  for (const entry of Object.values(registry)) {
    if (!entry || entry.provider !== provider) continue;
    entry.accounts = (entry.accounts || []).map((account) => {
      if (account.label !== label) return account;
      updated = {
        ...account,
        status,
        last_error: observation.last_error || currentQuota.reason_text || account.last_error || null,
        current_quota: currentQuota,
        reset_at: resetAt,
        last_used_at: account.last_used_at || nowIso,
      };
      return updated;
    });
  }
  if (!updated) return null;
  saveRuntimeRegistry(baseDir, registry);
  return updated;
}

function removeAccount(baseDir, provider, label, env = process.env) {
  const registry = loadRuntimeRegistry(baseDir);
  let removed = null;
  for (const entry of Object.values(registry)) {
    if (!entry || entry.provider !== provider) continue;
    entry.accounts = (entry.accounts || []).filter((account) => {
      const match = account.label === label;
      if (match) removed = account;
      return !match;
    });
  }
  if (!removed) {
    throw new Error(`Account not found: ${provider}:${label}`);
  }
  saveRuntimeRegistry(baseDir, registry);

  const globalRegistry = loadGlobalRegistry(env);
  globalRegistry.accounts = globalRegistry.accounts.filter(
    (account) => !(account.provider === provider && account.label === label),
  );
  saveGlobalRegistry(globalRegistry, env);

  return removed;
}

function runProviderLogin(provider, env = process.env) {
  const spec = providerSpec(provider);
  const result = spawnSync(spec.loginCmd[0], spec.loginCmd[1], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${spec.loginCmd[0]} login exited with status ${result.status}`);
  }
}

module.exports = {
  PROVIDERS,
  RUNTIME_PROVIDER_DEFAULTS,
  expandHomePath,
  resolveHomeDir,
  runtimeAccountsPath,
  runtimeAccountStatePath,
  registryRootDir,
  registryPath,
  providerSpec,
  canonicalPathForProvider,
  storedPathForProvider,
  normalizeRuntimeRegistry,
  loadRuntimeRegistry,
  saveRuntimeRegistry,
  loadRuntimeAccountState,
  saveRuntimeAccountState,
  loadGlobalRegistry,
  saveGlobalRegistry,
  listGlobalAccounts,
  upsertRuntimeAccount,
  captureAccount,
  resolveAccountEntry,
  copyProviderAccountToCanonical,
  markRuntimeActiveAccount,
  setAccountStatus,
  recordAccountQuotaState,
  removeAccount,
  runProviderLogin,
};
