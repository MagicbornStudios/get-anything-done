'use strict';
/**
 * scoped-spawn.cjs — per-project BYOK env injection for child processes (task 60-04).
 *
 * Normative spec: references/byok-design.md §8 (scoped-spawn wrapper).
 * Decisions: gad-266 G (merge default; --exclusive deferred),
 *            gad-263 (offload policy — downstream consumer),
 *            gad-260 (BYOK direction).
 *
 * Contract (§8.1):
 *   scopedSpawn({ projectId, command, args, options, keyNames?, requireBag? })
 *
 * Behavior (§8.2-§8.4):
 *   1. Decrypt the project bag. If `keyNames` is provided, fetch only those
 *      keys via `store.get`. Otherwise enumerate via `store.list` and fetch
 *      each current-version value with `store.get`.
 *   2. Merge `childEnv = { ...process.env, ...projectEnv }`. Project keys
 *      OVERRIDE parent env on name collision — the project bag is authoritative
 *      for that project (gad-266 G).
 *   3. Inject `GAD_PROJECT_ID=<projectId>` so downstream subagent code can
 *      route to the right bag (byok-design §14 step 3).
 *   4. Call `childProcess.spawn(command, args, { ...options, env: childEnv })`.
 *      Parent `process.env` is NEVER mutated.
 *   5. Drop references to the projectEnv plaintext. V8 strings are immutable
 *      so we cannot truly zero them; the spec-limit is documented.
 *   6. Return the ChildProcess handle. Caller owns lifecycle (stdio/exit/timeout).
 *
 * Public API — factory pattern per tip `gad-framework-testable-cli-01`:
 *   createScopedSpawner({ store, childProcess, now })  → { spawn }
 *   scopedSpawn(opts)                                   convenience bound to real deps
 *   ScopedSpawnError                                    class w/ .code
 *
 * NOTE: `--exclusive` (parent-env-stripped child env) is deferred per gad-266 G.
 * See byok-design.md §15 follow-up #4. Do NOT add it here without a new decision.
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/** Stable error codes surfaced by scopedSpawn. */
const SCOPED_SPAWN_CODES = new Set([
  'PROJECT_NOT_FOUND',  // requireBag=true and the project has no envelope
  'DECRYPT_FAILED',     // any store error during list/get (PASSPHRASE_INVALID, BAG_CORRUPT, etc.)
  'SPAWN_FAILED',       // childProcess.spawn threw synchronously
]);

class ScopedSpawnError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ cause?: Error, projectId?: string, command?: string }} [details]
   */
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'ScopedSpawnError';
    this.code = code;
    if (details.cause !== undefined) this.cause = details.cause;
    if (details.projectId !== undefined) this.projectId = details.projectId;
    if (details.command !== undefined) this.command = details.command;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect "project has no envelope yet" failure from a SecretsStoreError.
 * 60-02's `acquire()` throws PROJECT_NOT_FOUND when `.gad/secrets/<id>.enc`
 * is missing — different from KEY_NOT_FOUND ("envelope exists, key absent").
 * Callers branch on PROJECT_NOT_FOUND only; KEY_NOT_FOUND is left to bubble
 * as DECRYPT_FAILED.
 *
 * Per todo 2026-04-17-secrets-store-project-not-found-split: code-only
 * detection. The historical message-regex fallback was removed once 60-02
 * adopted the split (commit landing this todo).
 *
 * @param {Error} err
 * @returns {boolean}
 */
function isMissingEnvelope(err) {
  if (!err) return false;
  return err.code === 'PROJECT_NOT_FOUND';
}

/**
 * Decrypt the set of keys the caller asked for (or all current-version keys
 * in the bag). Returns a plain `{ KEY: plaintext }` map.
 *
 * Any non-missing-envelope failure is rewrapped as DECRYPT_FAILED with the
 * original error on `.cause`.
 *
 * @param {object} deps
 * @param {object} deps.store — lib/secrets-store.cjs or a mock.
 * @param {string} projectId
 * @param {string[]|undefined} keyNames
 * @param {boolean} requireBag
 * @returns {Promise<{ projectEnv: Record<string,string>, missingEnvelope: boolean }>}
 */
async function collectProjectEnv({ store, projectId, keyNames, requireBag }) {
  const projectEnv = {};

  // Resolve which keys to fetch.
  let targetKeys;
  if (Array.isArray(keyNames)) {
    targetKeys = keyNames.slice();
  } else {
    // Enumerate via store.list — this is the only place we probe the envelope
    // shape to discover the full set. If the bag doesn't exist, list throws.
    try {
      const rows = await store.list({ projectId });
      targetKeys = (rows || []).map((r) => r.keyName);
    } catch (err) {
      if (isMissingEnvelope(err)) {
        if (requireBag) {
          throw new ScopedSpawnError(
            'PROJECT_NOT_FOUND',
            `no secrets bag for project "${projectId}"`,
            { cause: err, projectId },
          );
        }
        return { projectEnv, missingEnvelope: true };
      }
      throw new ScopedSpawnError(
        'DECRYPT_FAILED',
        `could not enumerate keys for project "${projectId}": ${err.message}`,
        { cause: err, projectId },
      );
    }
  }

  // Fetch each key. Missing-envelope during explicit-keyNames mode also
  // routes to PROJECT_NOT_FOUND / empty-bag per requireBag.
  for (const keyName of targetKeys) {
    try {
      const value = await store.get({ projectId, keyName });
      projectEnv[keyName] = String(value);
    } catch (err) {
      if (isMissingEnvelope(err)) {
        if (requireBag) {
          throw new ScopedSpawnError(
            'PROJECT_NOT_FOUND',
            `no secrets bag for project "${projectId}"`,
            { cause: err, projectId },
          );
        }
        return { projectEnv: {}, missingEnvelope: true };
      }
      throw new ScopedSpawnError(
        'DECRYPT_FAILED',
        `could not decrypt "${keyName}" for project "${projectId}": ${err.message}`,
        { cause: err, projectId },
      );
    }
  }

  return { projectEnv, missingEnvelope: false };
}

// ---------------------------------------------------------------------------
// Factory + default instance
// ---------------------------------------------------------------------------

/**
 * Build a scoped-spawn instance bound to the given deps. Tests inject a mock
 * store + mock childProcess; production wires real modules.
 *
 * @param {object} deps
 * @param {object} deps.store — must expose async get({projectId,keyName}) + list({projectId}).
 * @param {object} deps.childProcess — must expose spawn(command, args, options).
 * @param {() => number} [deps.now] — unused today, reserved for future audit hooks.
 */
function createScopedSpawner({ store, childProcess, now = () => Date.now() } = {}) {
  if (!store || typeof store.get !== 'function' || typeof store.list !== 'function') {
    throw new TypeError('createScopedSpawner: store must expose get() and list()');
  }
  if (!childProcess || typeof childProcess.spawn !== 'function') {
    throw new TypeError('createScopedSpawner: childProcess must expose spawn()');
  }

  /**
   * Spawn a child with the project's BYOK bag merged into its env.
   *
   * @param {object} opts
   * @param {string} opts.projectId
   * @param {string} opts.command
   * @param {string[]} [opts.args]
   * @param {object} [opts.options] — passthrough to childProcess.spawn except `env`.
   * @param {string[]} [opts.keyNames] — subset of keys to inject. Default: all.
   * @param {boolean} [opts.requireBag=false] — throw PROJECT_NOT_FOUND if missing.
   * @returns {Promise<import('child_process').ChildProcess>}
   */
  async function spawn({ projectId, command, args = [], options = {}, keyNames, requireBag = false }) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('scopedSpawn: projectId is required and must be a non-empty string');
    }
    if (typeof command !== 'string' || !command) {
      throw new TypeError('scopedSpawn: command is required and must be a non-empty string');
    }
    // `now` is held for future audit-log hooks (e.g. spawn events per §8).
    // Touch it here so linters do not flag the unused dep.
    void now;

    // Step 1 — decrypt.
    const { projectEnv } = await collectProjectEnv({ store, projectId, keyNames, requireBag });

    // Step 2 + 3 — merge + inject GAD_PROJECT_ID.
    // Spread order: parent env first, project bag second so project wins on
    // collision (gad-266 G). GAD_PROJECT_ID last so the project bag cannot
    // accidentally shadow it — the project id is authoritative from the caller.
    const childEnv = {
      ...process.env,
      ...projectEnv,
      GAD_PROJECT_ID: projectId,
    };

    // Step 4 — spawn. Parent process.env is untouched; we only built a new
    // plain object. The options spread ensures callers can still pass `cwd`,
    // `stdio`, `shell`, etc. without us clobbering them — but `env` is ours.
    const spawnOptions = { ...options, env: childEnv };
    let child;
    try {
      child = childProcess.spawn(command, args, spawnOptions);
    } catch (err) {
      throw new ScopedSpawnError(
        'SPAWN_FAILED',
        `childProcess.spawn("${command}") threw synchronously: ${err.message}`,
        { cause: err, projectId, command },
      );
    }

    // Step 5 — drop references. V8 strings are immutable so we cannot zero
    // them in place; the best we can do is let the projectEnv object go out
    // of scope at function return. We null out every property to free the
    // references inside `projectEnv` immediately. The store layer owns
    // master-key-buffer wiping.
    for (const k of Object.keys(projectEnv)) projectEnv[k] = null;

    // Step 6 — hand off.
    return child;
  }

  return { spawn };
}

// ---------------------------------------------------------------------------
// Default export (real deps)
// ---------------------------------------------------------------------------

// Lazy-require so test harnesses can load this module without triggering the
// real child_process module resolution order. In practice child_process is a
// builtin so the import is essentially free, but this pattern matches env-cli.
const defaultStore = require('./secrets-store.cjs');
const defaultChildProcess = require('child_process');

const defaultSpawner = createScopedSpawner({
  store: defaultStore,
  childProcess: defaultChildProcess,
  now: () => Date.now(),
});

/**
 * Convenience wrapper — bound to the real secrets-store + real child_process.
 * @param {Parameters<ReturnType<typeof createScopedSpawner>['spawn']>[0]} opts
 */
function scopedSpawn(opts) { return defaultSpawner.spawn(opts); }

module.exports = {
  createScopedSpawner,
  scopedSpawn,
  ScopedSpawnError,
  SCOPED_SPAWN_CODES,
};
