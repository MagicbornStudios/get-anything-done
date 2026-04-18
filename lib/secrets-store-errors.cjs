'use strict';
/**
 * secrets-store-errors.cjs — named error class for the BYOK module.
 *
 * Normative spec: references/byok-design.md §12.
 *
 * Factored out to its own module so envelope.cjs, kdf.cjs, keychain/*.cjs,
 * and secrets-store.cjs can all throw without circular requires.
 */

/** @type {Set<string>} */
const KNOWN_CODES = new Set([
  'PASSPHRASE_INVALID',
  'PASSPHRASE_REQUIRED_NO_TTY',
  'KEYCHAIN_UNAVAILABLE',
  'KEYCHAIN_LOCKED',
  'BAG_CORRUPT',
  'KEY_NOT_FOUND',
  'KEY_EXPIRED',
  'ROTATION_GRACE_EXPIRED',
  'GITIGNORE_WRITE_FAILED',
  'PROJECT_NOT_FOUND',
  'KEY_ALREADY_EXISTS',
  'GRACE_DAYS_OUT_OF_RANGE',
  // 60-07b: scope-name validation (path traversal, illegal segments, etc.).
  // Companion store env-defaults-store.cjs reuses the same code so the UI
  // can render one error class for both surfaces.
  'VALIDATION',
]);

class SecretsStoreError extends Error {
  /**
   * @param {string} code — stable error code (see KNOWN_CODES above).
   * @param {string} message — operator-facing message.
   * @param {object} [details] — optional structured context for UI.
   */
  constructor(code, message, details) {
    super(`${code}: ${message}`);
    this.name = 'SecretsStoreError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

module.exports = { SecretsStoreError, KNOWN_CODES };
