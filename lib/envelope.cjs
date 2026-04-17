'use strict';
/**
 * envelope.cjs — versioned JSON envelope serialize/deserialize + AEAD helpers.
 *
 * Normative spec: references/byok-design.md §3, §5.
 *
 * Envelope shape (schemaVersion 1):
 * {
 *   "schemaVersion": 1,
 *   "projectId": "<projectid>",
 *   "createdAt": "<iso8601>",
 *   "cipher": "AES-256-GCM",
 *   "kdf": "PBKDF2",
 *   "kdfParams": {
 *     "hash": "SHA-256",
 *     "iterations": 600000,
 *     "saltB64": "<b64>",
 *     "keyLengthBits": 256
 *   },
 *   "keys": {
 *     "<KEY_NAME>": {
 *       "currentVersion": <int>,
 *       "versions": { "<n>": { nonceB64, ciphertextB64, authTagB64, addedAt, retiresAt } },
 *       "provider": "<string>",
 *       "scope": "<string>",
 *       "lastRotated": "<iso8601>"
 *     }
 *   }
 * }
 *
 * AAD (associated data for GCM) is `projectId|keyName|version` — this binds
 * each ciphertext slot to its envelope position, so an attacker who swaps two
 * ciphertexts in the on-disk JSON cannot produce a clean decrypt. See tip
 * `security-aead-aad-01` and byok-design.md §3.1.
 */

const crypto = require('crypto');
const { PBKDF2_ITERATIONS, PBKDF2_HASH } = require('./kdf.cjs');
const { SecretsStoreError } = require('./secrets-store-errors.cjs');

const SCHEMA_VERSION = 1;
const CIPHER = 'AES-256-GCM';
const KDF = 'PBKDF2';
const KEY_LENGTH_BITS = 256;
const NONCE_BYTES = 12; // GCM-recommended 96-bit nonce
const AUTH_TAG_BYTES = 16; // GCM 128-bit tag

// Passphrase-verifier plaintext. Encrypting this fixed string under the
// master key at envelope creation gives us a way to distinguish "wrong
// passphrase" from "tampered specific slot" without ever trying to decrypt
// user data. Without this, AEAD auth failures on data slots are ambiguous
// (see §12 PASSPHRASE_INVALID vs BAG_CORRUPT). AAD for the verifier is
// `<projectId>|__verifier__|0` to keep it slot-bound like all other
// entries.
const VERIFIER_PLAINTEXT = 'gad-secrets-store-verifier-v1';
const VERIFIER_KEY_NAME = '__verifier__';
const VERIFIER_VERSION = 0;

/**
 * Build the AAD buffer for a (projectId, keyName, version) slot.
 * @param {string} projectId
 * @param {string} keyName
 * @param {number|string} version
 * @returns {Buffer}
 */
function buildAad(projectId, keyName, version) {
  return Buffer.from(`${projectId}|${keyName}|${version}`, 'utf8');
}

/**
 * Create a fresh envelope object for a new project.
 *
 * If `masterKey` is provided, a passphrase-verifier slot is embedded at
 * `verifier` — the secrets-store uses this to distinguish "wrong passphrase"
 * from "tampered data slot" during unlock. Envelopes without a verifier
 * (pre-v1 test fixtures) are still accepted by parseEnvelope; callers that
 * need the verifier guard must handle its absence.
 *
 * @param {string} projectId
 * @param {Buffer} salt — 16-byte salt (from kdf.generateSalt()).
 * @param {Date} [now]
 * @param {Buffer} [masterKey] — optional 32-byte derived key.
 * @returns {object} envelope
 */
function createEmptyEnvelope(projectId, salt, now, masterKey) {
  const ts = (now || new Date()).toISOString();
  const env = {
    schemaVersion: SCHEMA_VERSION,
    projectId,
    createdAt: ts,
    cipher: CIPHER,
    kdf: KDF,
    kdfParams: {
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      saltB64: salt.toString('base64'),
      keyLengthBits: KEY_LENGTH_BITS,
    },
    keys: {},
  };
  if (masterKey) {
    env.verifier = encryptVerifier(projectId, masterKey, now);
  }
  return env;
}

/**
 * Encrypt the passphrase-verifier plaintext under the master key.
 * Returns a version-entry-shaped object for consistency.
 */
function encryptVerifier(projectId, masterKey, now) {
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const aad = buildAad(projectId, VERIFIER_KEY_NAME, VERIFIER_VERSION);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(VERIFIER_PLAINTEXT, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    nonceB64: nonce.toString('base64'),
    ciphertextB64: ct.toString('base64'),
    authTagB64: tag.toString('base64'),
    addedAt: (now || new Date()).toISOString(),
  };
}

/**
 * Attempt to decrypt the verifier. Returns true if the masterKey produces
 * the expected plaintext; false otherwise. Throws only on malformed envelope.
 */
function verifyMasterKey(env, masterKey) {
  if (!env.verifier) return null; // no verifier available
  try {
    const nonce = Buffer.from(env.verifier.nonceB64, 'base64');
    const ct = Buffer.from(env.verifier.ciphertextB64, 'base64');
    const tag = Buffer.from(env.verifier.authTagB64, 'base64');
    const aad = buildAad(env.projectId, VERIFIER_KEY_NAME, VERIFIER_VERSION);
    const d = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    d.setAAD(aad);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]).toString('utf8');
    return pt === VERIFIER_PLAINTEXT;
  } catch (_) {
    return false;
  }
}

/**
 * Encrypt a plaintext value into a version-entry object.
 *
 * @param {object} args
 * @param {string} args.projectId
 * @param {string} args.keyName
 * @param {number} args.version
 * @param {string} args.plaintext — utf-8 value.
 * @param {Buffer} args.masterKey — 32-byte derived key.
 * @param {Date} [args.now]
 * @param {string|null} [args.retiresAt] — ISO8601 or null.
 * @returns {{nonceB64:string, ciphertextB64:string, authTagB64:string, addedAt:string, retiresAt:(string|null)}}
 */
function encryptValue({ projectId, keyName, version, plaintext, masterKey, now, retiresAt = null }) {
  if (!(masterKey instanceof Buffer) || masterKey.length !== 32) {
    throw new SecretsStoreError('BAG_CORRUPT', 'encryptValue: masterKey must be a 32-byte Buffer');
  }
  const nonce = crypto.randomBytes(NONCE_BYTES);
  const aad = buildAad(projectId, keyName, version);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    nonceB64: nonce.toString('base64'),
    ciphertextB64: ciphertext.toString('base64'),
    authTagB64: authTag.toString('base64'),
    addedAt: (now || new Date()).toISOString(),
    retiresAt: retiresAt,
  };
}

/**
 * Decrypt a version-entry object back to the plaintext utf-8 string.
 *
 * Throws `SecretsStoreError('BAG_CORRUPT')` on:
 *   - auth-tag mismatch (ciphertext tampered)
 *   - AAD mismatch (slot-swap — attacker swapped entries in the envelope)
 *   - key-length mismatch, nonce-length mismatch, base64 decode failure
 *
 * @param {object} args
 * @param {string} args.projectId
 * @param {string} args.keyName
 * @param {number} args.version
 * @param {object} args.entry — version entry from envelope.
 * @param {Buffer} args.masterKey — 32-byte derived key.
 * @returns {string}
 */
function decryptValue({ projectId, keyName, version, entry, masterKey }) {
  if (!(masterKey instanceof Buffer) || masterKey.length !== 32) {
    throw new SecretsStoreError('BAG_CORRUPT', 'decryptValue: masterKey must be a 32-byte Buffer');
  }
  let nonce;
  let ciphertext;
  let authTag;
  try {
    nonce = Buffer.from(String(entry.nonceB64 || ''), 'base64');
    ciphertext = Buffer.from(String(entry.ciphertextB64 || ''), 'base64');
    authTag = Buffer.from(String(entry.authTagB64 || ''), 'base64');
  } catch (e) {
    throw new SecretsStoreError('BAG_CORRUPT', `envelope entry base64 decode failed: ${e.message}`);
  }
  if (nonce.length !== NONCE_BYTES) {
    throw new SecretsStoreError('BAG_CORRUPT', `nonce length ${nonce.length} !== ${NONCE_BYTES}`);
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new SecretsStoreError('BAG_CORRUPT', `authTag length ${authTag.length} !== ${AUTH_TAG_BYTES}`);
  }
  const aad = buildAad(projectId, keyName, version);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf8');
  } catch (e) {
    // Node throws 'Unsupported state or unable to authenticate data' on auth
    // failure — both tampering and AAD mismatch land here. Map both to
    // BAG_CORRUPT so callers have a single error to catch.
    throw new SecretsStoreError('BAG_CORRUPT', `envelope decrypt failed (auth/AAD): ${e.message}`);
  }
}

/**
 * Serialize an envelope to the canonical JSON form written to disk.
 * Pretty-printed with 2-space indent + trailing newline for human diff.
 * @param {object} envelope
 * @returns {string}
 */
function serializeEnvelope(envelope) {
  validateEnvelopeShape(envelope);
  return JSON.stringify(envelope, null, 2) + '\n';
}

/**
 * Parse an envelope from disk and validate shape.
 * @param {string|Buffer} raw
 * @returns {object}
 */
function parseEnvelope(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw));
  } catch (e) {
    throw new SecretsStoreError('BAG_CORRUPT', `envelope JSON parse failed: ${e.message}`);
  }
  validateEnvelopeShape(parsed);
  return parsed;
}

function validateEnvelopeShape(env) {
  if (!env || typeof env !== 'object') {
    throw new SecretsStoreError('BAG_CORRUPT', 'envelope is not an object');
  }
  if (env.schemaVersion !== SCHEMA_VERSION) {
    throw new SecretsStoreError('BAG_CORRUPT', `unsupported schemaVersion ${env.schemaVersion}`);
  }
  if (typeof env.projectId !== 'string' || !env.projectId) {
    throw new SecretsStoreError('BAG_CORRUPT', 'envelope.projectId missing');
  }
  if (env.cipher !== CIPHER) {
    throw new SecretsStoreError('BAG_CORRUPT', `unsupported cipher ${env.cipher}`);
  }
  if (env.kdf !== KDF) {
    throw new SecretsStoreError('BAG_CORRUPT', `unsupported kdf ${env.kdf}`);
  }
  if (!env.kdfParams || typeof env.kdfParams.saltB64 !== 'string') {
    throw new SecretsStoreError('BAG_CORRUPT', 'envelope.kdfParams.saltB64 missing');
  }
  if (!env.keys || typeof env.keys !== 'object') {
    throw new SecretsStoreError('BAG_CORRUPT', 'envelope.keys missing');
  }
}

module.exports = {
  SCHEMA_VERSION,
  CIPHER,
  KDF,
  KEY_LENGTH_BITS,
  NONCE_BYTES,
  AUTH_TAG_BYTES,
  VERIFIER_PLAINTEXT,
  VERIFIER_KEY_NAME,
  VERIFIER_VERSION,
  buildAad,
  createEmptyEnvelope,
  encryptValue,
  decryptValue,
  encryptVerifier,
  verifyMasterKey,
  serializeEnvelope,
  parseEnvelope,
};
