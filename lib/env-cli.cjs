'use strict';
/**
 * env-cli.cjs — `gad env` CLI family (task 60-03).
 *
 * Normative spec: references/byok-design.md §7 (CLI surface) + §12 (errors).
 * Decisions: gad-260 (BYOK direction), gad-266 (A-H defaults), gad-267 (tip
 * harvest). Wraps lib/secrets-store.cjs (task 60-02 — do not touch).
 *
 * Design notes:
 *   - Value prompt (set/rotate): TTY → raw-mode echo-off prompt via the
 *     same helper the passphrase path uses. Non-TTY → read one line from
 *     stdin so pipes compose (`echo val | gad env set K --projectid P`).
 *   - Passphrase prompt: deferred to lib/keychain/passphrase-fallback.cjs
 *     (raw-mode, already implemented for 60-02). With `--passphrase`, the
 *     CLI prompts once and passes the buffer on every store call.
 *   - Error surface: map SecretsStoreError codes to §12 operator messages.
 *     All failures print "<CODE>: <message>" on stderr + exit 1.
 *   - Stdout discipline:
 *       get   → plaintext + newline. Nothing else.
 *       list  → table on stdout (or JSON array with --json).
 *       set / rotate / revoke → human confirmation on STDERR only.
 *       prompts → stderr.
 *
 * The module exports a `createEnvCli({ store, readPassphrase, stdin,
 * stderr, stdout, exit, confirm, now })` factory so tests can inject mocks.
 * The default `envCli` uses the real secrets-store + real TTY helpers.
 */

const readline = require('readline');

const defaultStore = require('./secrets-store.cjs');
const { readPassphraseFromTty } = require('./keychain/passphrase-fallback.cjs');
const { SecretsStoreError } = require('./secrets-store-errors.cjs');

// ---------------------------------------------------------------------------
// Error code → operator message (byok-design.md §12)
// ---------------------------------------------------------------------------

/**
 * Translate a known SecretsStoreError code into the exact operator-facing
 * message from task 60-03 spec. Unknown codes pass through verbatim.
 *
 * @param {string} code
 * @param {{ projectId?: string, keyName?: string, version?: number, file?: string }} ctx
 * @returns {string}
 */
function messageFor(code, ctx) {
  const { projectId = '<project>', keyName = '<key>', file } = ctx || {};
  switch (code) {
    case 'PASSPHRASE_INVALID':
      return 'Passphrase incorrect. Try again or use --passphrase if keychain is out of sync.';
    case 'PASSPHRASE_REQUIRED_NO_TTY':
      return 'Passphrase required but stdin is not a TTY. Run interactively or pre-populate the keychain.';
    case 'KEYCHAIN_UNAVAILABLE':
      return 'OS keychain not available on this platform. Re-run with --passphrase.';
    case 'KEYCHAIN_LOCKED':
      return 'OS keychain is locked. Unlock and retry.';
    case 'BAG_CORRUPT':
      return `Encrypted bag${file ? ` at ${file}` : ''} failed integrity check. Restore from backup and investigate.`;
    case 'KEY_NOT_FOUND':
      return `Key '${keyName}' not set for project '${projectId}'. Set it with: gad env set ${keyName} --projectid ${projectId}`;
    case 'KEY_EXPIRED':
      return `Key '${keyName}' expired — grace period has lapsed. Rotate: gad env rotate ${keyName}.`;
    case 'ROTATION_GRACE_EXPIRED':
      return 'Old key version already auto-purged. Rotate produced only the new version.';
    case 'GITIGNORE_WRITE_FAILED':
      return 'Refused to write secrets store because .gitignore could not be updated. Fix permissions on .gitignore and retry.';
    case 'PROJECT_NOT_FOUND':
      return `No planning root found for projectid=${projectId}. Run 'gad startup --projectid ${projectId}' or check gad-config.toml.`;
    case 'KEY_ALREADY_EXISTS':
      return `Key '${keyName}' is already set for project '${projectId}'. Use 'gad env rotate ${keyName} --projectid ${projectId}' to change its value.`;
    case 'GRACE_DAYS_OUT_OF_RANGE':
      return '--grace-days must be between 0 and 30.';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Stdin helpers — value prompt (TTY-echoless or piped-line)
// ---------------------------------------------------------------------------

/**
 * Read a value from the user for `set` / `rotate`.
 *
 * Contract:
 *   - If stdin is a TTY, call the injected `readPassphrase` helper with a
 *     value-specific label. The helper disables echo (raw mode) so the
 *     secret never hits the user's terminal scrollback.
 *   - If stdin is NOT a TTY (piped / redirected), read one line (up to
 *     newline). Trim trailing CR/LF and return. This is the
 *     `echo val | gad env set K` path documented in --help.
 *
 * Returned string is NOT zeroed — the store layer owns master-key buffer
 * wiping. The plaintext value is handed to the store which encrypts and
 * drops it; we accept the V8 string residue trade-off here (same as
 * existing 60-02 `set()` surface which takes a plain string).
 *
 * @param {object} deps
 * @param {typeof readPassphraseFromTty} deps.readPassphrase
 * @param {NodeJS.ReadStream} deps.stdin
 * @param {NodeJS.WriteStream} deps.stderr
 * @param {string} label
 * @returns {Promise<string>}
 */
async function readValue({ readPassphrase, stdin, stderr }, label) {
  if (stdin.isTTY) {
    const buf = await readPassphrase(label, { stdin, stdout: stderr });
    const s = buf.toString('utf8');
    // Best-effort zero (won't purge the derived JS string but keeps the
    // raw byte buffer from lingering).
    try { buf.fill(0); } catch (_) { /* ignore */ }
    return s;
  }
  // Piped stdin — read one line.
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: stdin });
    let resolved = false;
    rl.once('line', (line) => {
      resolved = true;
      rl.close();
      // Strip trailing CR that can ride on Windows pipes.
      const cleaned = line.endsWith('\r') ? line.slice(0, -1) : line;
      resolve(cleaned);
    });
    rl.once('close', () => {
      if (!resolved) reject(new Error('no value on stdin (piped input closed without a line)'));
    });
    rl.once('error', reject);
  });
}

/**
 * Read a single line of y/n confirmation from a TTY. Used by `revoke`
 * without `--force`. Never echoless (the answer is not secret).
 *
 * @param {object} deps
 * @param {NodeJS.ReadStream} deps.stdin
 * @param {NodeJS.WriteStream} deps.stderr
 * @param {string} label
 * @returns {Promise<boolean>}
 */
async function readYesNo({ stdin, stderr }, label) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stderr, terminal: true });
    rl.question(label, (answer) => {
      rl.close();
      const a = String(answer || '').trim().toLowerCase();
      resolve(a === 'y' || a === 'yes');
    });
  });
}

// ---------------------------------------------------------------------------
// Passphrase acquisition (once per invocation)
// ---------------------------------------------------------------------------

/**
 * Factory for a "read the passphrase at most once" helper. Behavior:
 *   - First call: prompts via the injected `readPassphrase`, stores the
 *     resulting Buffer.
 *   - Subsequent calls: returns the cached Buffer.
 *   - After the command returns, the caller should zero the buffer via
 *     the returned `zero()` handle (best-effort).
 *
 * The passphrase is needed when `--passphrase` was passed (force mode) or
 * when the store throws KEYCHAIN_UNAVAILABLE/KEYCHAIN_LOCKED and we retry.
 * 60-02's secrets-store.acquire() already handles the retry internally, so
 * the caller just needs to decide whether to PRE-populate the passphrase
 * (force mode) or let the store prompt on its own (keychain path).
 */
function makePassphraseGate({ readPassphrase, stdin, stderr }) {
  let cached = null;
  return {
    async read() {
      if (cached) return cached;
      cached = await readPassphrase('Master passphrase: ', { stdin, stdout: stderr });
      return cached;
    },
    zero() {
      if (cached) {
        try { cached.fill(0); } catch (_) { /* ignore */ }
        cached = null;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Error wrapper — every handler runs inside this
// ---------------------------------------------------------------------------

/**
 * Runs `fn()`. Catches SecretsStoreError, prints "<CODE>: <message>" on
 * stderr, and exits non-zero. Also catches plain Errors with a generic
 * "Error: <msg>" + exit 1.
 */
async function guarded({ stderr, exit, ctxBuilder }, fn) {
  try {
    await fn();
  } catch (e) {
    const ctx = ctxBuilder ? ctxBuilder() : {};
    if (e instanceof SecretsStoreError) {
      const msg = messageFor(e.code, ctx) || e.message;
      stderr.write(`${e.code}: ${msg}\n`);
      exit(1);
      return;
    }
    stderr.write(`Error: ${e && e.message ? e.message : String(e)}\n`);
    exit(1);
  }
}

// ---------------------------------------------------------------------------
// Handlers (the meat)
// ---------------------------------------------------------------------------

/**
 * Build the set of `gad env <verb>` handlers bound to the given deps. The
 * `bin/gad.cjs` router calls `handlers.get({...})` etc. with parsed args.
 *
 * @param {object} [deps]
 * @param {object} [deps.store] — lib/secrets-store.cjs or a mock.
 * @param {Function} [deps.readPassphrase]
 * @param {NodeJS.ReadStream} [deps.stdin]
 * @param {NodeJS.WriteStream} [deps.stdout]
 * @param {NodeJS.WriteStream} [deps.stderr]
 * @param {(code: number) => void} [deps.exit]
 * @param {(label: string) => Promise<boolean>} [deps.confirm]
 */
function createEnvCli(deps = {}) {
  const store = deps.store || defaultStore;
  const readPassphrase = deps.readPassphrase || readPassphraseFromTty;
  const stdin = deps.stdin || process.stdin;
  const stdout = deps.stdout || process.stdout;
  const stderr = deps.stderr || process.stderr;
  const exit = deps.exit || ((c) => process.exit(c));
  const confirm = deps.confirm || ((label) => readYesNo({ stdin, stderr }, label));

  const passGateDeps = { readPassphrase, stdin, stderr };

  // ------------------ common: resolve passphrase (if forced) ------------------
  async function maybePassphrase(flags) {
    if (!flags.passphrase) return undefined;
    const gate = makePassphraseGate(passGateDeps);
    const buf = await gate.read();
    // Return the buffer; caller is responsible for zeroing via `gate.zero()`.
    // We attach it so the wrapper can clean up.
    buf.__zero = () => gate.zero();
    return buf;
  }

  async function withPass(flags, handler) {
    const pass = await maybePassphrase(flags);
    try {
      return await handler(pass);
    } finally {
      if (pass && pass.__zero) pass.__zero();
    }
  }

  // ---------- get ----------
  async function getCmd({ keyName, projectid, version, passphrase }) {
    await guarded(
      { stderr, exit, ctxBuilder: () => ({ projectId: projectid, keyName, version }) },
      async () => {
        await withPass({ passphrase }, async (pass) => {
          const value = await store.get({
            projectId: projectid,
            keyName,
            version,
            passphrase: pass,
            forcePassphrase: !!passphrase,
          });
          stdout.write(`${value}\n`);
        });
      },
    );
  }

  // ---------- set ----------
  async function setCmd({ keyName, projectid, provider, scope, passphrase }) {
    await guarded(
      { stderr, exit, ctxBuilder: () => ({ projectId: projectid, keyName }) },
      async () => {
        const value = await readValue(
          { readPassphrase, stdin, stderr },
          `Value for ${keyName}: `,
        );
        if (!value) {
          stderr.write('Error: empty value — refusing to store an empty secret.\n');
          exit(1);
          return;
        }
        await withPass({ passphrase }, async (pass) => {
          await store.set({
            projectId: projectid,
            keyName,
            value,
            provider: provider || '',
            scope: scope || '',
            passphrase: pass,
            forcePassphrase: !!passphrase,
          });
          stderr.write(`Stored ${keyName} (v1) for project ${projectid}.\n`);
        });
      },
    );
  }

  // ---------- list ----------
  async function listCmd({ projectid, json, passphrase }) {
    await guarded(
      { stderr, exit, ctxBuilder: () => ({ projectId: projectid }) },
      async () => {
        await withPass({ passphrase }, async (pass) => {
          let rows;
          try {
            rows = await store.list({
              projectId: projectid,
              passphrase: pass,
              forcePassphrase: !!passphrase,
            });
          } catch (e) {
            // Empty project — no envelope yet — is not an error for list.
            // secrets-store.acquire() throws KEY_NOT_FOUND with an
            // "no envelope for project" message in that specific case.
            if (e instanceof SecretsStoreError && e.code === 'KEY_NOT_FOUND'
                && /no envelope for project/i.test(e.message)) {
              rows = [];
            } else {
              throw e;
            }
          }
          if (json) {
            stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
            return;
          }
          if (rows.length === 0) {
            stdout.write(`0 keys set for project ${projectid}.\n`);
            return;
          }
          // Compact table (byok-design §7.3). Never prints values.
          stdout.write(renderListTable(rows));
        });
      },
    );
  }

  // ---------- rotate ----------
  async function rotateCmd({ keyName, projectid, graceDays, passphrase }) {
    await guarded(
      { stderr, exit, ctxBuilder: () => ({ projectId: projectid, keyName }) },
      async () => {
        const g = graceDays === undefined || graceDays === null || graceDays === ''
          ? 7
          : Number(graceDays);
        if (!Number.isFinite(g) || g < 0 || g > 30) {
          stderr.write('GRACE_DAYS_OUT_OF_RANGE: --grace-days must be between 0 and 30.\n');
          exit(1);
          return;
        }
        const newValue = await readValue(
          { readPassphrase, stdin, stderr },
          `New value for ${keyName}: `,
        );
        if (!newValue) {
          stderr.write('Error: empty value — refusing to rotate to an empty secret.\n');
          exit(1);
          return;
        }
        await withPass({ passphrase }, async (pass) => {
          const { oldVersion, newVersion } = await store.rotate({
            projectId: projectid,
            keyName,
            newValue,
            graceDays: g,
            passphrase: pass,
            forcePassphrase: !!passphrase,
          });
          stderr.write(
            `Rotated ${keyName} for project ${projectid}: v${oldVersion} → v${newVersion} (grace ${g}d).\n`,
          );
        });
      },
    );
  }

  // ---------- revoke ----------
  async function revokeCmd({ keyName, projectid, version, force, passphrase }) {
    await guarded(
      { stderr, exit, ctxBuilder: () => ({ projectId: projectid, keyName, version }) },
      async () => {
        if (!force) {
          const scope = version === undefined
            ? `ALL versions of '${keyName}'`
            : `version ${version} of '${keyName}'`;
          const ok = await confirm(`Revoke ${scope} for project ${projectid}? [y/N] `);
          if (!ok) {
            stderr.write('Aborted — nothing revoked.\n');
            return;
          }
        }
        await withPass({ passphrase }, async (pass) => {
          await store.revoke({
            projectId: projectid,
            keyName,
            version,
            passphrase: pass,
            forcePassphrase: !!passphrase,
          });
          const scope = version === undefined ? 'all versions' : `version ${version}`;
          stderr.write(`Revoked ${scope} of ${keyName} for project ${projectid}.\n`);
        });
      },
    );
  }

  return { getCmd, setCmd, listCmd, rotateCmd, revokeCmd };
}

// ---------------------------------------------------------------------------
// Table renderer — keeps the CLI router free of formatting concerns
// ---------------------------------------------------------------------------

function renderListTable(rows) {
  // Columns per byok-design §7.3: KEY VERSION PROVIDER SCOPE LAST ROTATED
  const headers = ['KEY', 'VERSION', 'PROVIDER', 'SCOPE', 'LAST ROTATED'];
  const data = rows.map((r) => [
    r.keyName,
    String(r.currentVersion),
    r.provider || '',
    r.scope || '',
    shortDate(r.lastRotated),
  ]);
  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const row of data) if (row[i].length > w) w = row[i].length;
    return w;
  });
  const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
  const lines = [];
  lines.push(headers.map((h, i) => pad(h, widths[i])).join('  '));
  for (const row of data) {
    lines.push(row.map((c, i) => pad(c, widths[i])).join('  '));
  }
  return `${lines.join('\n')}\n`;
}

function shortDate(iso) {
  if (!iso) return '';
  // ISO → YYYY-MM-DD. Defensive: if already short, keep it.
  const s = String(iso);
  const match = s.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : s;
}

module.exports = {
  createEnvCli,
  messageFor,
  renderListTable,
  // Exposed for unit tests:
  _readValue: readValue,
  _readYesNo: readYesNo,
};
