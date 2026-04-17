'use strict';
/**
 * keychain/passphrase-fallback.cjs — TTY passphrase reader with no echo.
 *
 * Normative spec: references/byok-design.md §4.2.
 *
 * Contract:
 *   - Reads from process.stdin (TTY required).
 *   - Echoes nothing, not even masking characters (keeps terminal scrollback
 *     clean; shoulder-surfers can't see length either).
 *   - Trims trailing newline.
 *   - Returns a Buffer so the caller can `fill(0)` after derive.
 *   - Throws SecretsStoreError('PASSPHRASE_REQUIRED_NO_TTY') if stdin is
 *     not a TTY — refusing is the fail-closed behavior (otherwise a
 *     headless run would silently hang reading from a pipe that never sends
 *     a newline).
 */

const { SecretsStoreError } = require('../secrets-store-errors.cjs');

/**
 * @param {string} [prompt]
 * @param {object} [opts]
 * @param {NodeJS.ReadStream} [opts.stdin] — injectable for tests.
 * @param {NodeJS.WriteStream} [opts.stdout]
 * @returns {Promise<Buffer>}
 */
function readPassphraseFromTty(prompt, opts) {
  const stdin = (opts && opts.stdin) || process.stdin;
  const stdout = (opts && opts.stdout) || process.stderr;
  const label = prompt || 'Master passphrase: ';

  if (!stdin.isTTY) {
    return Promise.reject(
      new SecretsStoreError('PASSPHRASE_REQUIRED_NO_TTY', 'stdin is not a TTY; cannot prompt for passphrase')
    );
  }

  return new Promise((resolve, reject) => {
    stdout.write(label);
    const chunks = [];
    const wasRaw = stdin.isRaw === true;
    try {
      stdin.setRawMode(true);
    } catch (e) {
      return reject(new SecretsStoreError('PASSPHRASE_REQUIRED_NO_TTY', `setRawMode failed: ${e.message}`));
    }
    stdin.resume();

    const onData = (data) => {
      // data is a Buffer when in raw mode.
      for (const byte of data) {
        if (byte === 0x03) { // Ctrl-C
          cleanup();
          stdout.write('\n');
          return reject(new SecretsStoreError('PASSPHRASE_INVALID', 'passphrase prompt cancelled'));
        }
        if (byte === 0x0d || byte === 0x0a) { // Enter (CR or LF)
          cleanup();
          stdout.write('\n');
          return resolve(Buffer.from(chunks));
        }
        if (byte === 0x7f || byte === 0x08) { // backspace / DEL
          if (chunks.length > 0) chunks.pop();
          continue;
        }
        chunks.push(byte);
      }
    };

    function cleanup() {
      stdin.removeListener('data', onData);
      try { stdin.setRawMode(wasRaw); } catch (_) { /* ignore */ }
      stdin.pause();
    }

    stdin.on('data', onData);
  });
}

module.exports = { readPassphraseFromTty };
