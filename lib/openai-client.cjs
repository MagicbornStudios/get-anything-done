'use strict';
/**
 * openai-client.cjs — thin OpenAI client that resolves OPENAI_API_KEY via the
 * project's BYOK bag (bag-first) and falls back to process.env during the
 * migration cutover window (task 60-06).
 *
 * Normative spec: references/byok-design.md §14 (migration path for
 *                 llm-from-scratch).
 * Task: 60-06. Decisions: gad-266 (BYOK A-H defaults), gad-260 (BYOK direction),
 *                         llm-004 (teachings harvested from non-trivial work).
 *
 * Why this file exists:
 *   Consumers (tip generator, image generator, future inference pipelines) used
 *   to read `process.env.OPENAI_API_KEY` directly. That couples them to ambient
 *   shell state and bypasses the per-project encrypted bag added in 60-02..60-05.
 *   `createOpenAIClient` inverts the default: the key is pulled out of the
 *   project bag via `secrets-store.get({ projectId, keyName: 'OPENAI_API_KEY' })`,
 *   and only if that fails with a "no key / no bag yet" shape do we fall back
 *   to the env var — printing a deprecation warning that names the migration
 *   command. Security-critical errors (PASSPHRASE_INVALID, BAG_CORRUPT,
 *   KEYCHAIN_LOCKED) are NEVER swallowed: a wrong passphrase must NOT silently
 *   resolve to an ambient env key.
 *
 * Public API:
 *   createOpenAIClient({ store, fetchImpl, env, logger })
 *     returns { resolveApiKey({ projectId }), chat({ projectId, model, messages, options? }) }
 *   OpenAIClientError
 *   resolveApiKey is also exported stand-alone (createApiKeyResolver) so
 *   non-chat consumers (image generation, Responses API) can share the
 *   bag-first policy without pulling in the chat-completion machinery.
 *
 * Integration points:
 *   - Subagent dispatch via lib/scoped-spawn.cjs (task 60-04) ALREADY injects
 *     the project bag into the child env. Inside a scoped-spawn child, the
 *     env fallback path is authoritative and the warning is expected.
 *   - Callers that run in the MAIN session (no scoped-spawn wrapping) should
 *     resolve via the bag directly, which requires `store` to be wired with
 *     the real secrets-store module.
 *
 * Deprecation timeline:
 *   The env fallback is a migration convenience. Post-cutover (operator has
 *   run `gad env set OPENAI_API_KEY --projectid <id>` for every consumer
 *   project AND subagent dispatch uses scoped-spawn), the env branch becomes
 *   dead code. Follow-up todo:
 *     .planning/todos/2026-04-17-openai-client-env-fallback-removal.md
 *
 * Migration command for operators:
 *   gad env set OPENAI_API_KEY --projectid <id> --provider openai --scope model-api
 */

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

/** Stable error codes surfaced by createOpenAIClient. */
const OPENAI_CLIENT_CODES = new Set([
  'KEY_UNRESOLVED',      // neither bag nor env produced a usable key
  'HTTP_ERROR',          // OpenAI returned non-2xx; .httpStatus set
  'MALFORMED_RESPONSE',  // 2xx but body shape unexpected (no choices[0].message.content)
  'NETWORK_ERROR',       // fetch rejected (DNS, TLS, refused, aborted)
]);

class OpenAIClientError extends Error {
  /**
   * @param {string} code — stable code from OPENAI_CLIENT_CODES.
   * @param {string} message — operator-facing message (MUST NOT include the key).
   * @param {{ cause?: Error, httpStatus?: number }} [options]
   */
  constructor(code, message, options = {}) {
    super(message, { cause: options.cause });
    this.name = 'OpenAIClientError';
    this.code = code;
    if (options.httpStatus !== undefined) this.httpStatus = options.httpStatus;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Classify a secrets-store error as "bag miss we can fall through" vs "security
 * failure we must propagate". The fall-through shapes are:
 *   - SecretsStoreError code=KEY_NOT_FOUND
 *   - SecretsStoreError code=PROJECT_NOT_FOUND
 *   - Legacy / non-coded errors whose message matches the envelope-missing
 *     pattern (defensive — see 60-04 disambiguation tip).
 *
 * Security failures that MUST propagate:
 *   - PASSPHRASE_INVALID (wrong passphrase — do NOT silently use env key)
 *   - BAG_CORRUPT
 *   - KEYCHAIN_LOCKED
 *   - KEYCHAIN_UNAVAILABLE (refuse to fall through on a locked/broken OS
 *     keychain — operator should be told explicitly)
 *   - Any unrecognized error — fail closed.
 */
function isBagMiss(err) {
  if (!err) return false;
  if (err.code === 'KEY_NOT_FOUND') return true;
  if (err.code === 'PROJECT_NOT_FOUND') return true;
  // Some legacy call sites throw plain Error with message shape. Match the
  // envelope-missing pattern that secrets-store emits:
  //   "no envelope for project <id> at .gad/secrets/<id>.enc"
  // and the key-not-found message so we behave predictably if a consumer
  // wraps the store.
  if (!err.code && typeof err.message === 'string') {
    if (/no envelope for project/i.test(err.message)) return true;
    if (/KEY_NOT_FOUND/i.test(err.message)) return true;
  }
  return false;
}

function defaultLogger() {
  return {
    warn: (...a) => console.warn(...a),
    info: () => {},
    error: (...a) => console.error(...a),
  };
}

// ---------------------------------------------------------------------------
// Key resolution (extracted so non-chat consumers can reuse it)
// ---------------------------------------------------------------------------

/**
 * Build a bag-first / env-fallback key resolver bound to the given deps.
 *
 * @param {object} deps
 * @param {object} deps.store  — exposes async get({ projectId, keyName }).
 * @param {object} deps.env    — env-like object (test injects {}; prod passes process.env).
 * @param {object} deps.logger — exposes warn(), info(), error().
 * @returns {(args: { projectId: string }) => Promise<string>}
 */
function createApiKeyResolver({ store, env, logger }) {
  if (!store || typeof store.get !== 'function') {
    throw new TypeError('createApiKeyResolver: store must expose async get()');
  }
  if (!env || typeof env !== 'object') {
    throw new TypeError('createApiKeyResolver: env must be an object');
  }
  const log = logger || defaultLogger();

  return async function resolveApiKey({ projectId }) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('resolveApiKey: projectId is required and must be a non-empty string');
    }

    // --- 1) Bag-first ----------------------------------------------------
    try {
      const bagValue = await store.get({ projectId, keyName: 'OPENAI_API_KEY' });
      if (typeof bagValue === 'string' && bagValue.length > 0) {
        return bagValue;
      }
      // Fall-through: store returned a falsy value. Treat as bag miss and
      // consult env.
    } catch (err) {
      if (!isBagMiss(err)) {
        // PASSPHRASE_INVALID, BAG_CORRUPT, KEYCHAIN_LOCKED, etc. MUST NOT
        // silently fall through to process.env — that would mask a security
        // failure (wrong passphrase resolving as ambient key).
        throw err;
      }
      // bag miss — fall through to env
    }

    // --- 2) Env fallback (deprecated — cutover window per §14) ----------
    const envKey = env.OPENAI_API_KEY;
    if (typeof envKey === 'string' && envKey.length > 0) {
      log.warn(
        `OPENAI_API_KEY resolved from process.env for project '${projectId}'. ` +
        `This path is deprecated; migrate with: ` +
        `gad env set OPENAI_API_KEY --projectid ${projectId}`
      );
      return envKey;
    }

    // --- 3) Unresolved --------------------------------------------------
    throw new OpenAIClientError(
      'KEY_UNRESOLVED',
      `OPENAI_API_KEY not set for project '${projectId}'. ` +
      `Run: gad env set OPENAI_API_KEY --projectid ${projectId}`
    );
  };
}

// ---------------------------------------------------------------------------
// Chat-completion call
// ---------------------------------------------------------------------------

const CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Build an OpenAI client bound to the given deps. Default behavior reads the
 * project bag via the injected store, with process.env fallback during the
 * cutover window.
 *
 * @param {object} [deps]
 * @param {object} [deps.store]      — secrets-store shaped { async get({projectId,keyName}) }.
 *                                    Required UNLESS caller only wants resolveApiKey-free flows
 *                                    (they still need a store for the bag path).
 * @param {Function} [deps.fetchImpl] — fetch-like. Defaults to globalThis.fetch (Node 22+).
 * @param {object} [deps.env]         — env map. Defaults to process.env.
 * @param {object} [deps.logger]      — { warn, info, error }. Defaults to console-backed logger.
 * @returns {{ resolveApiKey, chat }}
 */
function createOpenAIClient({ store, fetchImpl, env, logger } = {}) {
  const resolvedEnv = env || process.env;
  const resolvedLogger = logger || defaultLogger();
  const resolvedFetch = fetchImpl || (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined);
  if (typeof resolvedFetch !== 'function') {
    throw new TypeError(
      'createOpenAIClient: fetchImpl not provided and globalThis.fetch is missing. ' +
      'Node 18+ has global fetch; older runtimes must pass fetchImpl explicitly.'
    );
  }
  if (!store || typeof store.get !== 'function') {
    throw new TypeError('createOpenAIClient: store must expose async get({projectId,keyName})');
  }

  const resolveApiKey = createApiKeyResolver({ store, env: resolvedEnv, logger: resolvedLogger });

  /**
   * Post a chat-completion request. Returns { content, raw } where `content`
   * is the assistant message text and `raw` is the parsed JSON body.
   *
   * @param {object} args
   * @param {string} args.projectId
   * @param {string} args.model
   * @param {Array<{role: string, content: string}>} args.messages
   * @param {object} [args.options] — merged into the request body (temperature, max_tokens, etc.).
   * @returns {Promise<{ content: string, raw: object }>}
   */
  async function chat({ projectId, model, messages, options = {} }) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new TypeError('chat: projectId is required and must be a non-empty string');
    }
    if (typeof model !== 'string' || !model) {
      throw new TypeError('chat: model is required and must be a non-empty string');
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new TypeError('chat: messages is required and must be a non-empty array');
    }

    const apiKey = await resolveApiKey({ projectId });

    const body = JSON.stringify({ model, messages, ...options });

    let res;
    try {
      res = await resolvedFetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
      });
    } catch (err) {
      throw new OpenAIClientError(
        'NETWORK_ERROR',
        `fetch to ${CHAT_URL} failed: ${err && err.message ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!res.ok) {
      // Read the body as text for the .cause — avoid assuming JSON.
      let bodyText = '';
      try { bodyText = await res.text(); } catch { /* ignore */ }
      const cause = new Error(
        `HTTP ${res.status} from ${CHAT_URL}: ${bodyText.slice(0, 500)}`
      );
      throw new OpenAIClientError(
        'HTTP_ERROR',
        `OpenAI chat-completion returned HTTP ${res.status}`,
        { cause, httpStatus: res.status },
      );
    }

    let parsed;
    try {
      parsed = await res.json();
    } catch (err) {
      throw new OpenAIClientError(
        'MALFORMED_RESPONSE',
        `OpenAI chat-completion returned a 2xx response that was not valid JSON: ${err && err.message ? err.message : String(err)}`,
        { cause: err },
      );
    }

    const content =
      parsed &&
      parsed.choices &&
      parsed.choices[0] &&
      parsed.choices[0].message &&
      typeof parsed.choices[0].message.content === 'string'
        ? parsed.choices[0].message.content
        : null;

    if (content === null) {
      throw new OpenAIClientError(
        'MALFORMED_RESPONSE',
        'OpenAI chat-completion response missing choices[0].message.content',
      );
    }

    return { content, raw: parsed };
  }

  return { resolveApiKey, chat };
}

module.exports = {
  createOpenAIClient,
  createApiKeyResolver,
  OpenAIClientError,
  OPENAI_CLIENT_CODES,
  // Exposed for tests + downstream consumers that want to match the same
  // bag-miss classification without duplicating the rule.
  _isBagMissForTest: isBagMiss,
};
