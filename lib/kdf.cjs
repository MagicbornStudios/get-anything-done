'use strict';
/**
 * kdf.cjs — PBKDF2-SHA-256 wrapper used by secrets-store.
 *
 * Normative spec: references/byok-design.md §3.2.
 *   - Algorithm: PBKDF2
 *   - Hash: SHA-256
 *   - Iterations: 600_000 (OWASP 2023+)
 *   - Derived key length: 32 bytes (AES-256 key)
 *   - Salt length: 16 bytes (stored base64 in envelope.kdfParams.saltB64)
 *
 * Zero-trust contract: callers MUST zero the passphrase buffer after
 * deriveMasterKey returns. We do not zero it here because the passphrase
 * buffer may live in caller scope for prompt/confirm retries; the caller
 * owns the lifecycle. See `zeroBuffer` helper for the recommended call
 * at the top of the finally-block in prompt code.
 */

const crypto = require('crypto');

const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'sha256';
const DERIVED_KEY_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

/**
 * Generate a fresh CSPRNG salt for a new envelope.
 * @returns {Buffer} 16-byte salt.
 */
function generateSalt() {
  return crypto.randomBytes(SALT_LENGTH_BYTES);
}

/**
 * Derive the 32-byte AES-256 master key from a passphrase + salt.
 *
 * Matches WebCrypto `subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256',
 * iterations: 600000 }, ...)` bit-for-bit — the browser decrypt path
 * must use identical parameters. See byok-design.md §10.
 *
 * @param {string | Buffer} passphrase — utf-8 string or buffer.
 * @param {Buffer} salt — 16-byte salt.
 * @param {object} [opts]
 * @param {number} [opts.iterations] — override iterations (for tests only).
 * @returns {Buffer} 32-byte derived key.
 */
function deriveMasterKey(passphrase, salt, opts) {
  const iterations = (opts && opts.iterations) || PBKDF2_ITERATIONS;
  if (!(salt instanceof Buffer) || salt.length !== SALT_LENGTH_BYTES) {
    throw new Error(`deriveMasterKey: salt must be a ${SALT_LENGTH_BYTES}-byte Buffer`);
  }
  const passBuf = Buffer.isBuffer(passphrase) ? passphrase : Buffer.from(String(passphrase), 'utf8');
  return crypto.pbkdf2Sync(passBuf, salt, iterations, DERIVED_KEY_LENGTH_BYTES, PBKDF2_HASH);
}

/**
 * Best-effort wipe of a Buffer's contents.
 *
 * Node's GC does not guarantee buffer-pool scrubbing, so this is a hygiene
 * measure — an attacker with post-process memory dump capabilities may still
 * recover bytes. But holding plaintext passphrases in buffers any longer
 * than needed is strictly worse, so we scrub.
 *
 * @param {Buffer} buf
 */
function zeroBuffer(buf) {
  if (buf && typeof buf.fill === 'function') buf.fill(0);
}

module.exports = {
  PBKDF2_ITERATIONS,
  PBKDF2_HASH,
  DERIVED_KEY_LENGTH_BYTES,
  SALT_LENGTH_BYTES,
  generateSalt,
  deriveMasterKey,
  zeroBuffer,
};
