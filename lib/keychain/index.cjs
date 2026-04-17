'use strict';
/**
 * keychain/index.cjs — platform dispatcher.
 *
 * Routes `get/set/delete/isAvailable` calls to the correct adapter based on
 * process.platform. Exposes a test-only `_setAdapterForTest` hook used by
 * secrets-store unit tests (see tests/secrets-store.test.cjs); production
 * code never calls this override.
 *
 * Normative spec: references/byok-design.md §11, §13.2.
 *
 * Adapter interface:
 *   get(service, account)        -> Promise<Buffer|null>   null = not found
 *   set(service, account, bytes) -> Promise<void>
 *   delete(service, account)     -> Promise<void>
 *   isAvailable()                -> Promise<boolean>
 */

const { SecretsStoreError } = require('../secrets-store-errors.cjs');

const adapters = {
  win32: require('./windows.cjs'),
  darwin: require('./macos.cjs'),
  linux: require('./linux.cjs'),
};

/** @type {null | object} */
let override = null;

function current() {
  if (override) return override;
  const adapter = adapters[process.platform];
  if (!adapter) {
    // Unknown platform — return a synthetic "unavailable" adapter so the
    // caller falls through to passphrase mode cleanly.
    return {
      get: async () => { throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `no keychain adapter for platform ${process.platform}`); },
      set: async () => { throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `no keychain adapter for platform ${process.platform}`); },
      delete: async () => { throw new SecretsStoreError('KEYCHAIN_UNAVAILABLE', `no keychain adapter for platform ${process.platform}`); },
      isAvailable: async () => false,
    };
  }
  return adapter;
}

module.exports = {
  get: (service, account) => current().get(service, account),
  set: (service, account, bytes) => current().set(service, account, bytes),
  delete: (service, account) => current().delete(service, account),
  isAvailable: () => current().isAvailable(),

  /**
   * Test-only override hook. Pass a full adapter (or null to clear).
   * @param {object|null} adapter
   */
  _setAdapterForTest(adapter) {
    override = adapter;
  },
};
