'use strict';
/**
 * keychain/macos.cjs — STUB adapter.
 *
 * Real macOS Keychain integration deferred until first non-Windows operator
 * lands (see references/byok-design.md §15 follow-up 2). All methods throw
 * KEYCHAIN_UNAVAILABLE so the secrets-store falls through to the passphrase
 * path.
 *
 * When promoted to a real adapter, shell out to `security add-generic-password
 * -U -s <service> -a <account> -w <b64>` for set and
 * `security find-generic-password -s <service> -a <account> -w` for get;
 * delete uses `security delete-generic-password`.
 */

const { SecretsStoreError } = require('../secrets-store-errors.cjs');

const MSG = 'macOS keychain adapter not yet implemented; pass --passphrase to use passphrase fallback';

async function get() {
  throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', MSG);
}

async function set() {
  throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', MSG);
}

async function del() {
  throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', MSG);
}

async function isAvailable() {
  return false;
}

module.exports = { get, set, delete: del, isAvailable };
