'use strict';
/**
 * secrets-store.cjs — BYOK envelope management + public API.
 *
 * Normative spec: references/byok-design.md §4, §5, §6, §9, §12.
 * Task: 60-02. Decision: gad-266 (A-H defaults), gad-260 (original direction).
 *
 * Responsibilities:
 *   - Resolve project root from projectId → `<root>/.gad/secrets/<projectId>.enc`.
 *   - Acquire master key: keychain first, passphrase fallback.
 *   - Encrypt/decrypt via envelope.cjs helpers.
 *   - Enforce .gitignore (fail-closed on write failure — tip `security-fail-closed-01`).
 *   - Rotation + revocation + grace purge + audit log.
 *
 * Public API (see module.exports at bottom):
 *   get({ projectId, keyName, version?, scope?, passphrase? })
 *   set({ projectId, keyName, value, provider?, scope?, scopeBag?, passphrase? })
 *   list({ projectId, scope?, passphrase? })
 *   rotate({ projectId, keyName, newValue?, graceDays?, scope?, passphrase? })
 *   revoke({ projectId, keyName, version?, scope?, passphrase? })
 *   decryptAll({ projectId, scope?, passphrase? })    // used by scoped-spawn (60-04)
 *   listChain({ projectId, scopeChain, passphrase? })       // 60-07b
 *   decryptChain({ projectId, scopeChain, passphrase? })    // 60-07b
 *
 * Scope chain (60-07b, decision gad-268):
 *   - `scope` (or `scopeBag` on set()) addresses one envelope file. `null`
 *     / `undefined` / `''` means the planning bag at the legacy path
 *     `.gad/secrets/<projectId>.enc`. A non-empty scope nests the file:
 *     `.gad/secrets/<projectId>/<scope-path>.enc`.
 *   - Each scope has its own salt, master key, and keychain account
 *     (`<projectId>::<scope>` vs the legacy `<projectId>`). Envelopes are
 *     fully isolated — no cross-scope decryption is possible even if
 *     passphrases happen to match, because salts differ.
 *   - listChain/decryptChain orchestrate over a caller-supplied chain
 *     (most-specific → least-specific). Most-specific value wins; parents
 *     fill in missing keys; shadowed parent scopes are surfaced in
 *     `shadows[]` so the UI can show what's hidden.
 *
 * Test hooks:
 *   _setKeychainForTest(adapter)
 *   _setClockForTest(fn)
 *   _setProjectRootForTest(projectId, dir)    // skip filesystem walk for tests
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { SecretsStoreError } = require('./secrets-store-errors.cjs');
const kdf = require('./kdf.cjs');
const envelope = require('./envelope.cjs');
const keychain = require('./keychain/index.cjs');
const { readPassphraseFromTty } = require('./keychain/passphrase-fallback.cjs');

const KEYCHAIN_SERVICE = 'gad-secrets';

// ---------------------------------------------------------------------------
// Test hooks
// ---------------------------------------------------------------------------

/** @type {() => Date} */
let clock = () => new Date();

/** @type {Map<string, string>} */
const projectRootOverrides = new Map();

function now() { return clock(); }

function _setKeychainForTest(adapter) {
  keychain._setAdapterForTest(adapter);
}

function _setClockForTest(fn) {
  clock = typeof fn === 'function' ? fn : () => new Date();
}

function _setProjectRootForTest(projectId, dir) {
  if (dir === null || dir === undefined) projectRootOverrides.delete(projectId);
  else projectRootOverrides.set(projectId, dir);
}

// ---------------------------------------------------------------------------
// Project-root resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the repo root that owns `<projectId>`.
 *
 * Strategy mirrors lib/teachings-reader.cjs: walk up from CWD looking for
 * a `gad-config.toml`, `.planning/config.json`, or `planning-config.toml`.
 * We do NOT read those configs to confirm the projectId matches — the
 * caller asserts the projectId and we just use it as the filename key.
 * If no config is found, we fall back to CWD.
 *
 * Tests override this via `_setProjectRootForTest`.
 */
function resolveProjectRoot(projectId) {
  if (projectRootOverrides.has(projectId)) return projectRootOverrides.get(projectId);

  const envOverride = process.env.GAD_PROJECT_ROOT;
  if (envOverride && fs.existsSync(envOverride)) return envOverride;

  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    const hasConfig =
      fs.existsSync(path.join(dir, 'gad-config.toml')) ||
      fs.existsSync(path.join(dir, '.planning', 'config.json')) ||
      fs.existsSync(path.join(dir, 'planning-config.toml'));
    if (hasConfig) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to CWD — callers can override via _setProjectRootForTest
  // or GAD_PROJECT_ROOT.
  return process.cwd();
}

/**
 * Validate a scope id and return its normalized form (or `null` for the
 * planning bag). 60-07b: scopes are forward-slash-separated path segments
 * matching `[A-Za-z0-9._-]+`. We reject leading/trailing slashes,
 * backslashes, empty segments, and `.` / `..` so a scope id can never
 * escape `.gad/secrets/<projectId>/`.
 *
 * @param {string|null|undefined} scope
 * @returns {string|null}
 */
function normalizeScope(scope) {
  if (scope === undefined || scope === null) return null;
  const s = String(scope).trim();
  if (!s) return null;
  if (s.startsWith('/') || s.endsWith('/')) {
    throw new SecretsStoreError('VALIDATION', `scope "${scope}" must not start or end with "/"`);
  }
  if (/\\/.test(s)) {
    throw new SecretsStoreError('VALIDATION', `scope "${scope}" must not contain backslashes`);
  }
  for (const part of s.split('/')) {
    if (!part || part === '.' || part === '..') {
      throw new SecretsStoreError('VALIDATION', `scope "${scope}" contains an invalid segment`);
    }
    if (!/^[A-Za-z0-9._-]+$/.test(part)) {
      throw new SecretsStoreError('VALIDATION', `scope segment "${part}" must match [A-Za-z0-9._-]+`);
    }
  }
  return s;
}

/**
 * Resolve the on-disk envelope path for a (projectId, scope?) pair.
 * Planning bag (no scope) keeps the legacy layout `.gad/secrets/<projectId>.enc`
 * so existing callers + on-disk fixtures keep working without a migration.
 * Scoped bags nest under `.gad/secrets/<projectId>/<scope-path>.enc` so the
 * planning file and per-eval files never collide.
 *
 * @param {string} projectId
 * @param {string|null} [scope]
 */
function envelopePath(projectId, scope) {
  const root = resolveProjectRoot(projectId);
  const norm = normalizeScope(scope);
  if (!norm) return path.join(root, '.gad', 'secrets', `${projectId}.enc`);
  const parts = norm.split('/');
  const last = parts.pop();
  return path.join(root, '.gad', 'secrets', projectId, ...parts, `${last}.enc`);
}

function auditPath(projectId, scope) {
  const root = resolveProjectRoot(projectId);
  const norm = normalizeScope(scope);
  if (!norm) return path.join(root, '.gad', 'secrets', `${projectId}.audit.jsonl`);
  const parts = norm.split('/');
  const last = parts.pop();
  return path.join(root, '.gad', 'secrets', projectId, ...parts, `${last}.audit.jsonl`);
}

function gitignorePath(projectId) {
  const root = resolveProjectRoot(projectId);
  return path.join(root, '.gitignore');
}

/**
 * Per-scope keychain account id. Planning bag uses the legacy `<projectId>`
 * account name (no migration needed). Scoped bags get `<projectId>::<scope>`
 * so each scope's master key lives in its own keychain entry. Operators
 * who clear one scope's passphrase don't affect siblings.
 */
function keychainAccount(projectId, scope) {
  const norm = normalizeScope(scope);
  return norm ? `${projectId}::${norm}` : projectId;
}

// ---------------------------------------------------------------------------
// Gitignore enforcement (fail-closed)
// ---------------------------------------------------------------------------

const GITIGNORE_MARKER = '# Added by gad env set — encrypted secrets never belong in git';
const GITIGNORE_LINE = '.gad/';

function gitignoreCoversSecrets(contents) {
  const lines = String(contents || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line === '.gad/' || line === '.gad' || line === '.gad/**' || line === '.gad/secrets/' || line === '.gad/secrets') {
      return true;
    }
  }
  return false;
}

/**
 * Ensure the project's .gitignore contains a `.gad/` rule. If it does not,
 * append one. Failure to write the gitignore aborts the enclosing operation
 * with GITIGNORE_WRITE_FAILED — see tip `security-fail-closed-01`.
 *
 * @param {string} projectId
 */
function ensureGitignore(projectId) {
  const p = gitignorePath(projectId);
  let existing = '';
  let existed = false;
  try {
    if (fs.existsSync(p)) {
      existed = true;
      existing = fs.readFileSync(p, 'utf8');
    }
  } catch (e) {
    throw new SecretsStoreError(
      'GITIGNORE_WRITE_FAILED',
      `could not read ${p}: ${e.message}`,
      { path: p, projectId },
    );
  }
  if (gitignoreCoversSecrets(existing)) return;
  const trailingNewline = existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  const prefix = existing.length === 0 ? '' : '\n';
  const appended = `${existing}${trailingNewline}${prefix}${GITIGNORE_MARKER}\n${GITIGNORE_LINE}\n`;
  try {
    fs.writeFileSync(p, appended, { flag: 'w' });
  } catch (e) {
    throw new SecretsStoreError(
      'GITIGNORE_WRITE_FAILED',
      `could not ${existed ? 'update' : 'create'} ${p}: ${e.message}. Fix permissions manually and retry.`,
      { path: p, projectId },
    );
  }
}

// ---------------------------------------------------------------------------
// Envelope read/write
// ---------------------------------------------------------------------------

function readEnvelopeFromDisk(projectId, scope) {
  const p = envelopePath(projectId, scope);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8');
  return envelope.parseEnvelope(raw);
}

function writeEnvelopeToDisk(projectId, scope, env) {
  const p = envelopePath(projectId, scope);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, envelope.serializeEnvelope(env), { mode: 0o600 });
}

function appendAudit(projectId, scope, event) {
  const p = auditPath(projectId, scope);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(event) + '\n', { mode: 0o600 });
}

// ---------------------------------------------------------------------------
// Master-key acquisition
// ---------------------------------------------------------------------------

/**
 * Load or create the envelope + derive master key.
 *
 * Returns { env, masterKey, createdEmpty }. `masterKey` is a Buffer the
 * caller should zero when done (best-effort).
 *
 * Path A (keychain available + hit):
 *   - Read envelope from disk (must exist — keychain without envelope is
 *     meaningless, it would decrypt nothing).
 *   - Fetch derived key bytes from keychain.
 * Path B (keychain miss / unavailable / --passphrase forced):
 *   - If envelope exists: read it, grab salt, prompt for passphrase,
 *     PBKDF2-derive master key. Zero passphrase buffer.
 *   - If envelope does not exist: for a `set` call we need to create one.
 *     Prompt for passphrase (the user is choosing it NOW). Generate salt.
 *     Derive. Persist the derived key into the keychain (if available) for
 *     next time.
 *
 * @param {object} args
 * @param {string} args.projectId
 * @param {boolean} [args.allowCreate=false] — true for set(); false for get/list/rotate/revoke.
 * @param {string|Buffer} [args.passphrase] — bypass prompt (tests + scripted flows).
 * @param {boolean} [args.forcePassphrase=false] — skip keychain even if present.
 * @returns {Promise<{env: object, masterKey: Buffer, createdEmpty: boolean}>}
 */
async function acquire({ projectId, scope, allowCreate = false, passphrase: providedPassphrase, forcePassphrase = false }) {
  const norm = normalizeScope(scope);
  const account = keychainAccount(projectId, norm);
  let env = readEnvelopeFromDisk(projectId, norm);
  let createdEmpty = false;

  // Case: no envelope yet.
  if (!env) {
    if (!allowCreate) {
      // PROJECT_NOT_FOUND vs KEY_NOT_FOUND distinction (todo
      // 2026-04-17-secrets-store-project-not-found-split): "no envelope on
      // disk" is the project-bag-absent case. KEY_NOT_FOUND stays reserved
      // for "envelope exists, key absent". Callers branch on err.code only —
      // do not regex the message.
      throw new SecretsStoreError('PROJECT_NOT_FOUND', `no envelope for project "${projectId}"${norm ? ` scope "${norm}"` : ''} at ${envelopePath(projectId, norm)}`);
    }
    // Create: generate salt, derive master key (from passphrase), write
    // envelope with no keys yet. Gitignore enforcement happens in caller
    // (`set`) BEFORE we write the envelope. Here we just produce the
    // master key + in-memory envelope and defer persistence.
    const salt = kdf.generateSalt();
    createdEmpty = true;

    const masterKey = await deriveFromPassphrase({
      salt,
      providedPassphrase,
      promptLabel: norm
        ? `Choose a master passphrase for ${projectId} / ${norm}: `
        : 'Choose a master passphrase (used to unlock this project bag): ',
    });
    // Build envelope with the verifier slot seeded by this master key.
    env = envelope.createEmptyEnvelope(projectId, salt, now(), masterKey);
    return { env, masterKey, createdEmpty, scope: norm };
  }

  // Case: envelope exists.
  const salt = Buffer.from(env.kdfParams.saltB64, 'base64');

  // Path A — try keychain first, unless --passphrase forced.
  if (!forcePassphrase && providedPassphrase === undefined) {
    try {
      if (await keychain.isAvailable()) {
        const cached = await keychain.get(KEYCHAIN_SERVICE, account);
        if (cached && cached.length === 32) {
          // Verifier gate: the passphrase-verifier slot decrypts only under
          // the correct master key. If it fails, the cached key is stale
          // (e.g. envelope re-created under a new passphrase) and we fall
          // through to the passphrase prompt.
          if (envelope.verifyMasterKey(env, cached)) {
            return { env, masterKey: cached, createdEmpty, scope: norm };
          }
        }
      }
    } catch (e) {
      if (e instanceof SecretsStoreError && e.code === 'KEYCHAIN_LOCKED') {
        // surface — user rejected the unlock prompt
        throw e;
      }
      // Any other keychain failure is soft — fall through to passphrase.
    }
  }

  // Path B — passphrase.
  const masterKey = await deriveFromPassphrase({
    salt,
    providedPassphrase,
    promptLabel: norm ? `Master passphrase for ${projectId} / ${norm}: ` : 'Master passphrase: ',
  });

  // Validate via the passphrase-verifier slot. The verifier decrypts iff
  // the master key is correct — disambiguates PASSPHRASE_INVALID from
  // BAG_CORRUPT (tampering on a specific data slot). Envelopes without a
  // verifier (legacy fixtures) skip the check and defer to the operation.
  if (env.verifier && envelope.verifyMasterKey(env, masterKey) === false) {
    kdf.zeroBuffer(masterKey);
    throw new SecretsStoreError('PASSPHRASE_INVALID', 'master passphrase did not decrypt the envelope');
  }

  return { env, masterKey, createdEmpty, scope: norm };
}

async function deriveFromPassphrase({ salt, providedPassphrase, promptLabel }) {
  let passBuf;
  let owned = false;
  if (providedPassphrase !== undefined && providedPassphrase !== null) {
    passBuf = Buffer.isBuffer(providedPassphrase)
      ? Buffer.from(providedPassphrase)
      : Buffer.from(String(providedPassphrase), 'utf8');
    owned = true;
  } else {
    passBuf = await readPassphraseFromTty(promptLabel);
    owned = true;
  }
  try {
    return kdf.deriveMasterKey(passBuf, salt);
  } finally {
    if (owned) kdf.zeroBuffer(passBuf);
  }
}

// ---------------------------------------------------------------------------
// Grace-period purge (runs on every operation before returning control)
// ---------------------------------------------------------------------------

/**
 * Remove versions whose retiresAt is in the past. Mutates `env` in place.
 * Writes an `envpurge` audit event for each removed version. Returns true
 * if any version was purged (caller writes envelope back in that case).
 */
function purgeExpired(projectId, scope, env) {
  const t = now();
  let purged = false;
  const emptyKeys = [];
  for (const [keyName, entry] of Object.entries(env.keys || {})) {
    const versions = entry.versions || {};
    for (const [vStr, ver] of Object.entries(versions)) {
      if (ver.retiresAt && new Date(ver.retiresAt).getTime() < t.getTime()) {
        delete versions[vStr];
        appendAudit(projectId, scope, { ts: t.toISOString(), event: 'envpurge', key: keyName, version: Number(vStr) });
        purged = true;
      }
    }
    if (Object.keys(versions).length === 0) emptyKeys.push(keyName);
  }
  for (const k of emptyKeys) delete env.keys[k];
  return purged;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function get({ projectId, keyName, version, scope, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  requireString('keyName', keyName);
  const ctx = await acquire({ projectId, scope, allowCreate: false, passphrase, forcePassphrase });
  try {
    const purged = purgeExpired(projectId, ctx.scope, ctx.env);
    if (purged) writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    const entry = ctx.env.keys[keyName];
    if (!entry) throw new SecretsStoreError('KEY_NOT_FOUND', `key "${keyName}" not set for project "${projectId}"`);
    const targetVersion = version === undefined ? entry.currentVersion : Number(version);
    const ver = entry.versions && entry.versions[String(targetVersion)];
    if (!ver) {
      if (version !== undefined) {
        throw new SecretsStoreError('ROTATION_GRACE_EXPIRED', `version ${targetVersion} of key "${keyName}" is not available (purged or never existed)`);
      }
      throw new SecretsStoreError('BAG_CORRUPT', `currentVersion ${targetVersion} missing from versions map`);
    }
    if (ver.retiresAt && new Date(ver.retiresAt).getTime() < now().getTime()) {
      throw new SecretsStoreError('KEY_EXPIRED', `version ${targetVersion} of key "${keyName}" retired on ${ver.retiresAt}`);
    }
    return envelope.decryptValue({ projectId, keyName, version: targetVersion, entry: ver, masterKey: ctx.masterKey });
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

async function set({ projectId, keyName, value, provider = '', scope = '', scopeBag, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  requireString('keyName', keyName);
  if (value === undefined || value === null) {
    throw new SecretsStoreError('KEY_NOT_FOUND', 'set() requires a value (CLI layer prompts stdin and passes it in)');
  }
  // GITIGNORE-FIRST, FAIL-CLOSED.
  //
  // Per byok-design.md §6.2 + tip `security-fail-closed-01`, we enforce
  // gitignore BEFORE touching `.gad/secrets/`. If the gitignore write
  // fails, no secrets file is created — the operator gets a clear error
  // and the on-disk state is unchanged.
  ensureGitignore(projectId);

  // 60-07b: `scopeBag` addresses the envelope file (which on-disk bag the
  // ciphertext lands in). `scope` is row metadata stored alongside each
  // entry. They're orthogonal — a UI can write into the planning bag and
  // still tag the row with provider/scope info, OR explicitly write into
  // an eval/species bag via scopeBag.
  const ctx = await acquire({ projectId, scope: scopeBag, allowCreate: true, passphrase, forcePassphrase });
  try {
    const purged = purgeExpired(projectId, ctx.scope, ctx.env);
    if (ctx.env.keys[keyName]) {
      throw new SecretsStoreError('KEY_ALREADY_EXISTS', `key "${keyName}" already set for project "${projectId}"${ctx.scope ? ` scope "${ctx.scope}"` : ''}; use rotate() to change`);
    }
    const version = 1;
    const verEntry = envelope.encryptValue({
      projectId,
      keyName,
      version,
      plaintext: value,
      masterKey: ctx.masterKey,
      now: now(),
      retiresAt: null,
    });
    ctx.env.keys[keyName] = {
      currentVersion: version,
      versions: { [String(version)]: verEntry },
      provider: String(provider || ''),
      scope: String(scope || ''),
      lastRotated: verEntry.addedAt,
    };
    writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    appendAudit(projectId, ctx.scope, {
      ts: now().toISOString(),
      event: 'envset',
      key: keyName,
      version,
      provider: String(provider || ''),
      scope: String(scope || ''),
      scopeBag: ctx.scope || null,
    });
    // Offer-to-save: if the envelope was just created AND keychain is
    // available, persist the derived key for next time. We do this
    // unconditionally on first-set when keychain works — the whole point
    // of the keychain path is to avoid re-prompting. If the operator wanted
    // passphrase-only, they would have passed --passphrase which sets
    // forcePassphrase and short-circuits this path.
    if (ctx.createdEmpty || purged) {
      try {
        if (await keychain.isAvailable()) {
          await keychain.set(KEYCHAIN_SERVICE, keychainAccount(projectId, ctx.scope), ctx.masterKey);
        }
      } catch (_) {
        // Soft-fail — the envelope is already written. Next call will
        // fall back to passphrase.
      }
    }
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

async function list({ projectId, scope, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  const ctx = await acquire({ projectId, scope, allowCreate: false, passphrase, forcePassphrase });
  try {
    const purged = purgeExpired(projectId, ctx.scope, ctx.env);
    if (purged) writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    const out = [];
    for (const [keyName, entry] of Object.entries(ctx.env.keys || {})) {
      out.push({
        keyName,
        provider: entry.provider || '',
        scope: entry.scope || '',
        scopeBag: ctx.scope || null,
        lastRotated: entry.lastRotated,
        currentVersion: entry.currentVersion,
      });
    }
    return out;
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

/**
 * Walk a scope chain (most-specific → least-specific) and return one row
 * per unique keyName. Most-specific scope wins; parent scopes that supplied
 * the same keyName are listed in `shadows[]` so the UI can surface them.
 *
 * 60-07b. The chain is caller-defined — typically `[species, eval, null]`.
 * `null`/empty in the chain means the planning bag.
 *
 * Behavior: PROJECT_NOT_FOUND on any individual scope is treated as "no
 * rows from that scope" (envelopes are sparse — most scopes don't exist
 * for any given project). Other errors propagate.
 */
async function listChain({ projectId, scopeChain, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  if (!Array.isArray(scopeChain) || scopeChain.length === 0) {
    throw new SecretsStoreError('VALIDATION', 'scopeChain is required and must be a non-empty array');
  }
  const winners = new Map();
  const shadowsByKey = new Map();
  for (const rawScope of scopeChain) {
    const norm = normalizeScope(rawScope);
    let rows;
    try {
      rows = await list({ projectId, scope: norm, passphrase, forcePassphrase });
    } catch (e) {
      if (e instanceof SecretsStoreError && e.code === 'PROJECT_NOT_FOUND') {
        continue;
      }
      throw e;
    }
    for (const r of rows) {
      if (winners.has(r.keyName)) {
        if (!shadowsByKey.has(r.keyName)) shadowsByKey.set(r.keyName, []);
        shadowsByKey.get(r.keyName).push(norm);
      } else {
        winners.set(r.keyName, r);
      }
    }
  }
  return [...winners.values()].map((r) => ({ ...r, shadows: shadowsByKey.get(r.keyName) || [] }));
}

async function rotate({ projectId, keyName, newValue, graceDays = 7, scope, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  requireString('keyName', keyName);
  if (typeof graceDays !== 'number' || !Number.isFinite(graceDays) || graceDays < 0 || graceDays > 30) {
    throw new SecretsStoreError('GRACE_DAYS_OUT_OF_RANGE', `graceDays ${graceDays} not in 0..30`);
  }
  if (newValue === undefined || newValue === null) {
    throw new SecretsStoreError('KEY_NOT_FOUND', 'rotate() requires newValue (CLI layer prompts stdin and passes it in)');
  }
  const ctx = await acquire({ projectId, scope, allowCreate: false, passphrase, forcePassphrase });
  try {
    purgeExpired(projectId, ctx.scope, ctx.env);
    const entry = ctx.env.keys[keyName];
    if (!entry) throw new SecretsStoreError('KEY_NOT_FOUND', `key "${keyName}" not set for project "${projectId}"${ctx.scope ? ` scope "${ctx.scope}"` : ''}`);
    const oldVersion = entry.currentVersion;
    const newVersion = oldVersion + 1;
    const t = now();
    const retiresAt = graceDays === 0
      ? new Date(t.getTime() - 1).toISOString() // immediate — next purge cycle will remove
      : new Date(t.getTime() + graceDays * 24 * 3600 * 1000).toISOString();
    // Mark old as retired.
    const oldVer = entry.versions[String(oldVersion)];
    if (oldVer) oldVer.retiresAt = retiresAt;
    // Write new version.
    entry.versions[String(newVersion)] = envelope.encryptValue({
      projectId,
      keyName,
      version: newVersion,
      plaintext: newValue,
      masterKey: ctx.masterKey,
      now: t,
      retiresAt: null,
    });
    entry.currentVersion = newVersion;
    entry.lastRotated = entry.versions[String(newVersion)].addedAt;
    // If graceDays === 0, purge immediately.
    if (graceDays === 0) purgeExpired(projectId, ctx.scope, ctx.env);
    writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    appendAudit(projectId, ctx.scope, {
      ts: t.toISOString(),
      event: 'envrotate',
      key: keyName,
      newVersion,
      retiredVersion: oldVersion,
      graceDays,
      scopeBag: ctx.scope || null,
    });
    return { oldVersion, newVersion };
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

async function revoke({ projectId, keyName, version, scope, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  requireString('keyName', keyName);
  const ctx = await acquire({ projectId, scope, allowCreate: false, passphrase, forcePassphrase });
  try {
    purgeExpired(projectId, ctx.scope, ctx.env);
    const entry = ctx.env.keys[keyName];
    if (!entry) throw new SecretsStoreError('KEY_NOT_FOUND', `key "${keyName}" not set for project "${projectId}"${ctx.scope ? ` scope "${ctx.scope}"` : ''}`);
    const removedVersions = [];
    if (version === undefined) {
      // Remove the entire key.
      for (const v of Object.keys(entry.versions || {})) removedVersions.push(Number(v));
      delete ctx.env.keys[keyName];
    } else {
      const v = Number(version);
      if (!entry.versions || !entry.versions[String(v)]) {
        throw new SecretsStoreError('KEY_NOT_FOUND', `version ${v} of key "${keyName}" not found`);
      }
      delete entry.versions[String(v)];
      removedVersions.push(v);
      if (Object.keys(entry.versions).length === 0) {
        delete ctx.env.keys[keyName];
      } else if (v === entry.currentVersion) {
        // Pick the highest remaining version as the new current.
        const remaining = Object.keys(entry.versions).map(Number).sort((a, b) => b - a);
        entry.currentVersion = remaining[0];
        // And clear its retiresAt (it is now the head).
        entry.versions[String(remaining[0])].retiresAt = null;
      }
    }
    writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    appendAudit(projectId, ctx.scope, {
      ts: now().toISOString(),
      event: 'envrevoke',
      key: keyName,
      versions: removedVersions,
      scopeBag: ctx.scope || null,
    });
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

/**
 * Used by scoped-spawn (task 60-04). Decrypts every current-version key
 * and returns a flat `{ KEY_NAME: 'plaintext' }` map. NEVER logs.
 */
async function decryptAll({ projectId, scope, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  const ctx = await acquire({ projectId, scope, allowCreate: false, passphrase, forcePassphrase });
  try {
    const purged = purgeExpired(projectId, ctx.scope, ctx.env);
    if (purged) writeEnvelopeToDisk(projectId, ctx.scope, ctx.env);
    const out = {};
    for (const [keyName, entry] of Object.entries(ctx.env.keys || {})) {
      const v = entry.currentVersion;
      const ver = entry.versions[String(v)];
      if (!ver) continue;
      out[keyName] = envelope.decryptValue({ projectId, keyName, version: v, entry: ver, masterKey: ctx.masterKey });
    }
    return out;
  } finally {
    kdf.zeroBuffer(ctx.masterKey);
  }
}

/**
 * Walk a scope chain and return a flat `{ KEY: plaintext }` map, with the
 * most-specific scope's value winning for any key set in multiple scopes.
 * Used by /api/dev/secrets routes (60-07b) to derive last-four tails for
 * the editor without leaking the full chain to the wire.
 *
 * Like listChain: PROJECT_NOT_FOUND on individual scopes is swallowed
 * (sparse envelopes); other errors propagate.
 */
async function decryptChain({ projectId, scopeChain, passphrase, forcePassphrase }) {
  requireString('projectId', projectId);
  if (!Array.isArray(scopeChain) || scopeChain.length === 0) {
    throw new SecretsStoreError('VALIDATION', 'scopeChain is required and must be a non-empty array');
  }
  const out = {};
  for (const rawScope of scopeChain) {
    const norm = normalizeScope(rawScope);
    let bag;
    try {
      bag = await decryptAll({ projectId, scope: norm, passphrase, forcePassphrase });
    } catch (e) {
      if (e instanceof SecretsStoreError && e.code === 'PROJECT_NOT_FOUND') continue;
      throw e;
    }
    for (const [k, v] of Object.entries(bag)) {
      // Most-specific wins → don't overwrite once set.
      if (!(k in out)) out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireString(name, val) {
  if (typeof val !== 'string' || !val) {
    throw new SecretsStoreError('KEY_NOT_FOUND', `${name} is required and must be a non-empty string`);
  }
}

module.exports = {
  get,
  set,
  list,
  listChain,
  rotate,
  revoke,
  decryptAll,
  decryptChain,
  // Errors + constants (for CLI layer and tests).
  SecretsStoreError,
  KEYCHAIN_SERVICE,
  // Paths + scope helpers (exposed for introspection / tests).
  envelopePath,
  auditPath,
  gitignorePath,
  normalizeScope,
  keychainAccount,
  // Test hooks.
  _setKeychainForTest,
  _setClockForTest,
  _setProjectRootForTest,
};
