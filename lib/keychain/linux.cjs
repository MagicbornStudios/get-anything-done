'use strict';
/**
 * keychain/linux.cjs — STUB adapter.
 *
 * Real Linux secret-service (gnome-keyring / KDE KWallet via libsecret)
 * deferred until first non-Windows operator lands (see
 * references/byok-design.md §15 follow-up 2). All methods throw
 * KEYCHAIN_UNAVAILABLE so the secrets-store falls through to the passphrase
 * path.
 *
 * When promoted to a real adapter, shell out to `secret-tool` (part of
 * libsecret-tools) or use dbus-next to talk to the secret-service API
 * directly. `secret-tool store --label="gad" service <service> account
 * <account>` reads from stdin; `secret-tool lookup service <service>
 * account <account>` reads back.
 */

const { SecretsStoreError } = require('../secrets-store-errors.cjs');

const MSG = 'Linux keychain adapter not yet implemented; pass --passphrase to use passphrase fallback';

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
