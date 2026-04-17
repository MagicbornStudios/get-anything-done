# BYOK secrets design

> **Status:** normative spec for phase 60 implementation (tasks 60-02..60-08).
> **Source decisions:** gad-260 (original BYOK direction), gad-266 (A-H defaults
> accepted by operator 2026-04-17).
> **Source discussion:** `.planning/notes/phase-60-byok-discussion-2026-04-17.md`.
> **Last updated:** 2026-04-17 (task 60-01).

## 1. Purpose & scope

This document codifies the bring-your-own-key (BYOK) design for per-project
encrypted env storage. It is the authoritative contract that tasks 60-02
(`lib/secrets-store.cjs`), 60-03 (CLI family), 60-04 (`lib/scoped-spawn.cjs`),
60-05 (rotation/revocation), 60-06 (llm-from-scratch migration), 60-07
(project-editor tab), and 60-08 (landing-site surface) implement against.

**In scope:**
- Crypto primitives (AES-256-GCM + PBKDF2) and parameter choices.
- Master-key UX (keychain-first with passphrase fallback).
- On-disk envelope format at `.gad/secrets/<projectid>.enc`.
- CLI surface under `gad env {get, set, list, rotate, revoke}`.
- Scoped-spawn wrapper that merges project bag into child env without parent
  leakage.
- Additive rotation with configurable grace period and audit log.
- Browser-side (WebCrypto) decrypt for the landing-site surface.
- Module/file layout for downstream tasks.
- Error surfaces and operator-facing messages.
- Test strategy (unit + round-trip + rotation + migration).

**Out of scope — deferred explicitly:**
- macOS Keychain adapter (stubbed; real implementation when non-Windows demand lands).
- Linux secret-service adapter (stubbed; same).
- `--exclusive` flag on scoped-spawn (default merge behavior only; exclusive
  isolation deferred to a later iteration).
- Server-side KMS or per-user HSM (never — zero-knowledge server model per D).
- Phase split between local and cloud BYOK (task 60-08 waits on phase 51 auth
  transitively — no split per H).
- `CHANGELOG.md`-style key lifecycle surfaces beyond the audit jsonl.

## 2. Design decisions summary

| # | Choice | Rationale (1 line) |
|---|---|---|
| A | AES-256-GCM + **PBKDF2** 600k iter, 96-bit random nonce, 128-bit auth tag | AEAD + single KDF shared between Node and WebCrypto; no native deps. |
| B | OS keychain first, passphrase fallback; Windows Credential Manager adapter first | Frictionless daily use where keychain exists; passphrase covers headless/CI. |
| C | Versioned JSON envelope, per-key metadata, base64 binary fields | Human-inspectable, independent per-key nonces, `schemaVersion` reserves migration. |
| D | Browser-only WebCrypto decrypt; server stores opaque blob | Zero-knowledge server; matches "user owns their keys" framing. |
| E | Additive rotation, 7-day default grace, configurable 0-30 via `--grace-days` | Atomic; pending jobs decrypt old versions until grace expires. |
| F | `.gad/secrets/<projectid>.enc` at project root, auto-gitignored | Keys travel with the repo boundary; cross-project isolation. |
| G | Scoped-spawn wrapper merges project bag with parent env (default) | Child sees merged env; parent `process.env` never mutated. |
| H | Task 60-08 transitively depends on phase 51 auth; no phase split | 60-01..60-07 auth-free and land first; 60-08 waits. |

## 3. Cryptographic design

### 3.1 Primitive: AES-256-GCM

AES-256-GCM is an authenticated encryption with associated data (AEAD)
primitive. It gives confidentiality and integrity in one call — an adversary
who tampers with the ciphertext cannot produce output that decrypts cleanly.

| Parameter | Value | Why |
|---|---|---|
| Algorithm | `AES-256-GCM` | AEAD. Stdlib `crypto.createCipheriv('aes-256-gcm', ...)`. WebCrypto `{name: 'AES-GCM', length: 256}`. |
| Key length | 256 bits | Longest standard AES variant; matches PBKDF2 output length. |
| Nonce length | 96 bits (12 bytes) | GCM-recommended nonce size. Random per key, never reused within a bag. |
| Nonce source | `crypto.randomBytes(12)` / `crypto.getRandomValues(new Uint8Array(12))` | CSPRNG. |
| Auth tag length | 128 bits (16 bytes) | Max GCM tag. Stored adjacent to ciphertext in the envelope (not appended inline). |
| Associated data (AAD) | `projectId \| keyName \| version` (utf-8, pipe-separated) | Binds ciphertext to its slot. Tampering with envelope metadata fails decrypt. |

### 3.2 KDF: PBKDF2

PBKDF2 derives the file-encryption key from the master passphrase. Chosen over
scrypt (original advisor default) because WebCrypto's `subtle.deriveKey` supports
PBKDF2 but not scrypt — using PBKDF2 on both sides keeps the algorithm identical.

| Parameter | Value | Why |
|---|---|---|
| Algorithm | `PBKDF2` | Supported by both Node stdlib (`crypto.pbkdf2Sync`) and WebCrypto (`subtle.deriveKey`). |
| Hash | `SHA-256` | Industry default for PBKDF2 in 2026; WebCrypto requires explicit hash name. |
| Iterations | 600,000 | OWASP 2023+ guidance for PBKDF2-SHA256. ~300-500ms unlock cost on modern hardware. |
| Salt length | 128 bits (16 bytes) | Random per envelope. Stored in `kdfParams.saltB64`. |
| Derived key length | 256 bits (32 bytes) | Matches AES-256 key size. |

### 3.3 Nonce strategy

Each key entry gets a fresh 96-bit CSPRNG nonce at encrypt time, stored as
`nonceB64` in the envelope. No counter state on disk; regenerating a nonce on
every write is safe as long as the bit-width stays at 96 and the source is a
CSPRNG. Nonce reuse with the same key catastrophically breaks GCM, so the
envelope writer MUST generate a new nonce for every encrypt call — including
rotation writes.

### 3.4 Auth-tag placement

Auth tag is stored as its own base64 field (`authTagB64`) alongside ciphertext,
not appended inline. This matches Node's `cipher.getAuthTag()` API cleanly and
avoids the "slice last 16 bytes" ambiguity at decrypt time.

### 3.5 Minimal encrypt/decrypt pseudocode

Encrypt (Node):

```js
// encryptKeyValue(projectId, keyName, version, plaintext, masterKey)
const nonce = crypto.randomBytes(12);
const aad = Buffer.from(`${projectId}|${keyName}|${version}`, 'utf8');
const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, nonce);
cipher.setAAD(aad);
const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const authTag = cipher.getAuthTag();
return {
  nonceB64: nonce.toString('base64'),
  ciphertextB64: ciphertext.toString('base64'),
  authTagB64: authTag.toString('base64'),
};
```

Decrypt (Node):

```js
// decryptKeyValue(projectId, keyName, version, entry, masterKey)
const nonce = Buffer.from(entry.nonceB64, 'base64');
const ciphertext = Buffer.from(entry.ciphertextB64, 'base64');
const authTag = Buffer.from(entry.authTagB64, 'base64');
const aad = Buffer.from(`${projectId}|${keyName}|${version}`, 'utf8');
const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, nonce);
decipher.setAAD(aad);
decipher.setAuthTag(authTag);
const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
return plaintext.toString('utf8');
```

Master-key derivation (Node):

```js
// deriveMasterKey(passphrase, saltB64)
const salt = Buffer.from(saltB64, 'base64');
return crypto.pbkdf2Sync(passphrase, salt, 600_000, 32, 'sha256');
```

The browser pathway uses WebCrypto — same algorithm, same iteration count, same
output length (see §10).

## 4. Master-key UX

### 4.1 Unlock flow (keychain available)

1. CLI command that needs to decrypt fires (`gad env get`, `gad env list`,
   scoped-spawn decrypt).
2. `lib/secrets-store.cjs` calls the platform keychain adapter
   (`lib/keychain/windows.cjs` on Windows).
3. Adapter looks up service name `gad-secrets` + account name `<projectid>`.
   Returns the 32-byte derived master key directly (base64-encoded in the
   keychain).
4. Secrets store reads envelope, decrypts the requested key(s) with the master
   key, returns plaintext to the caller.
5. Plaintext is held in the caller's scope only. Not cached in the parent
   process env. Not written to disk.

### 4.2 Unlock flow (passphrase fallback)

Triggered when the keychain adapter reports `KEYCHAIN_UNAVAILABLE` (no platform
support, headless/CI env, `--passphrase` flag forced), or `KEYCHAIN_LOCKED`
(keychain present but user rejected the unlock prompt).

1. Secrets store prompts for the passphrase on stdin (hidden input — no echo).
   TTY required; non-TTY passphrase mode fails with `PASSPHRASE_REQUIRED_NO_TTY`.
2. Passphrase + envelope-stored salt → `pbkdf2Sync(passphrase, salt, 600000, 32, 'sha256')`
   → 32-byte master key.
3. Master key used for that invocation only. Not persisted. Not cached to disk.
4. On first use after `gad env set`, the store offers to save the derived master
   key to the keychain for next time (prompt: "Save to OS keychain? [y/N]").
   Declining keeps passphrase-only mode; the envelope carries no hint either way.

### 4.3 Session-level caching

**Per-CLI-invocation** only. Decrypting once per CLI call is the contract —
after the Node process exits, the master key buffer goes out of scope and is
garbage-collected. No long-lived daemon, no cross-invocation cache.

Within a single invocation, if the same CLI command decrypts multiple keys
(e.g. `gad env list` iterates all keys), the master key is derived once and
reused across the loop. After the command returns, the buffer is zeroed
explicitly (`buffer.fill(0)`) and dropped.

### 4.4 Master-key derivation: two paths

| Path | How master key is produced | Where it lives |
|---|---|---|
| Keychain-first | On first `gad env set`, derive key from operator-supplied passphrase via PBKDF2, store the **derived key bytes** (not the passphrase) in the OS keychain. | OS keychain as base64 blob. |
| Passphrase fallback | On every invocation, re-derive from passphrase + envelope salt via PBKDF2. | Process memory only, for the duration of one CLI call. |

The envelope on disk stores only `kdfParams.saltB64` — both paths need the salt
to re-derive in case the keychain entry is lost or the operator switches
machines. The derived key in the keychain is a convenience; the envelope is
always re-derivable from passphrase + salt.

## 5. On-disk format

### 5.1 Schema (version 1)

```json
{
  "schemaVersion": 1,
  "projectId": "<projectid>",
  "createdAt": "<iso8601>",
  "cipher": "AES-256-GCM",
  "kdf": "PBKDF2",
  "kdfParams": {
    "hash": "SHA-256",
    "iterations": 600000,
    "saltB64": "<16-byte base64>",
    "keyLengthBits": 256
  },
  "verifier": {
    "nonceB64": "<12-byte base64>",
    "ciphertextB64": "<base64 — encrypts constant VERIFIER_PLAINTEXT>",
    "authTagB64": "<16-byte base64>"
  },
  "keys": {
    "<KEY_NAME>": {
      "currentVersion": <int>,
      "versions": {
        "<version-int>": {
          "nonceB64": "<12-byte base64>",
          "ciphertextB64": "<base64>",
          "authTagB64": "<16-byte base64>",
          "addedAt": "<iso8601>",
          "retiresAt": "<iso8601 | null>"
        }
      },
      "provider": "<string>",
      "scope": "<string>",
      "lastRotated": "<iso8601>"
    }
  }
}
```

### 5.2 Field reference

| Field | Type | Required | Meaning |
|---|---|---|---|
| `schemaVersion` | int | yes | Envelope format version. Today: `1`. Migration path reserved. |
| `projectId` | string | yes | Matches the filename `.gad/secrets/<projectid>.enc`. Binds envelope to project. |
| `createdAt` | ISO8601 | yes | First write timestamp. |
| `cipher` | string | yes | Algorithm identifier. Today: `"AES-256-GCM"`. |
| `kdf` | string | yes | KDF identifier. Today: `"PBKDF2"`. |
| `kdfParams.hash` | string | yes | `"SHA-256"`. |
| `kdfParams.iterations` | int | yes | `600000`. Readable so CLI can detect and upgrade. |
| `kdfParams.saltB64` | string | yes | Envelope-level salt. Never changes without full re-encrypt. |
| `kdfParams.keyLengthBits` | int | yes | `256`. |
| `keys` | object | yes | Map of KEY_NAME → key entry. Empty on fresh envelope. |
| `keys.<X>.currentVersion` | int | yes | Active version for this key. Rotations bump this pointer. |
| `keys.<X>.versions` | object | yes | Map of version (stringified int) → version entry. |
| `keys.<X>.versions.<v>.nonceB64` | string | yes | Per-version unique nonce. |
| `keys.<X>.versions.<v>.ciphertextB64` | string | yes | Encrypted value. |
| `keys.<X>.versions.<v>.authTagB64` | string | yes | GCM auth tag. |
| `keys.<X>.versions.<v>.addedAt` | ISO8601 | yes | Version write timestamp. |
| `keys.<X>.versions.<v>.retiresAt` | ISO8601 \| null | yes | When this version auto-purges. `null` for the current version. |
| `keys.<X>.provider` | string | no | Free-text provider label (e.g. `"openai"`, `"anthropic"`, `"replicate"`). |
| `keys.<X>.scope` | string | no | Free-text scope label (e.g. `"model-api"`, `"image-gen"`, `"telemetry"`). |
| `keys.<X>.lastRotated` | ISO8601 | yes | Updated on rotation; equals `addedAt` of current version. |
| `verifier` | object | yes (new) | Passphrase-verifier slot (see §5.4). Added during 60-02 implementation to distinguish `PASSPHRASE_INVALID` from `BAG_CORRUPT` per §12 error contract. Legacy envelopes without this field skip the gate (backward-compat). |

### 5.4 Passphrase verifier slot

AEAD alone produces a single failure symptom — "auth tag verify failed" — which can mean *wrong passphrase*, *tampered ciphertext*, *corrupted nonce*, or *AAD mismatch*. §12 requires distinguishing `PASSPHRASE_INVALID` from `BAG_CORRUPT` for operator experience.

**Mechanism:** at envelope creation, encrypt a fixed known plaintext (`VERIFIER_PLAINTEXT = "gad-secrets-store-verifier-v1"`) under the master key and store the resulting ciphertext + auth tag + nonce in `envelope.verifier`. AAD for the verifier is `<projectId>|__verifier__|0` (parallels the per-key AAD convention from §3.3 to prevent cross-bag verifier swap).

**Unlock flow:**

1. Derive candidate master key from passphrase (or read from keychain).
2. Attempt to decrypt `envelope.verifier` with the candidate key + fixed AAD.
3. If decrypt fails → throw `PASSPHRASE_INVALID`. (User mistyped or keychain drift.)
4. If decrypt succeeds but plaintext doesn't match `VERIFIER_PLAINTEXT` → throw `PASSPHRASE_INVALID`. (Key derivation was right but something else is wrong; safest to treat as auth failure.)
5. If decrypt succeeds and plaintext matches → master key is correct. Any subsequent AEAD failure on a user key is `BAG_CORRUPT`, not passphrase.

**Cost:** one AES-GCM decrypt per unlock (~microseconds). The UX win is clean error routing — operators see "wrong passphrase, try again" vs "envelope corrupted, restore backup" and can act.

**Backward compat:** envelopes written before this addition have no `verifier` field. On unlock, a missing field skips the gate (same behavior as before — first key decrypt doubles as verifier). New envelopes always include it. Migration to add the field to legacy envelopes happens lazily on the next `set`/`rotate`.

**See also:** teachings tip `security-passphrase-verifier-01` generalizes the pattern beyond BYOK.

### 5.3 Concrete example — two keys, one rotated

```json
{
  "schemaVersion": 1,
  "projectId": "llm-from-scratch",
  "createdAt": "2026-04-17T21:30:00Z",
  "cipher": "AES-256-GCM",
  "kdf": "PBKDF2",
  "kdfParams": {
    "hash": "SHA-256",
    "iterations": 600000,
    "saltB64": "qXfZT1mPEXaP5y5ukHwO7A==",
    "keyLengthBits": 256
  },
  "keys": {
    "OPENAI_API_KEY": {
      "currentVersion": 2,
      "versions": {
        "1": {
          "nonceB64": "DmLsA91VQW4vCqbX",
          "ciphertextB64": "rq3jH+9o2M0p...",
          "authTagB64": "Xk7bFvqZ5SmRoHcN1t3kLQ==",
          "addedAt": "2026-04-10T14:02:11Z",
          "retiresAt": "2026-04-24T21:30:00Z"
        },
        "2": {
          "nonceB64": "t9HcE0LvBn8fYXWq",
          "ciphertextB64": "G12oN+wqHg4k...",
          "authTagB64": "Vn6aEurX4TkQnGbM0s2jKQ==",
          "addedAt": "2026-04-17T21:30:00Z",
          "retiresAt": null
        }
      },
      "provider": "openai",
      "scope": "model-api",
      "lastRotated": "2026-04-17T21:30:00Z"
    },
    "REPLICATE_API_TOKEN": {
      "currentVersion": 1,
      "versions": {
        "1": {
          "nonceB64": "PqOxN2sZ9fKa8dWm",
          "ciphertextB64": "HkQw+91vT5p4...",
          "authTagB64": "Qr8mE0cYvKpZw6L4a7TjQg==",
          "addedAt": "2026-04-17T21:34:12Z",
          "retiresAt": null
        }
      },
      "provider": "replicate",
      "scope": "image-gen",
      "lastRotated": "2026-04-17T21:34:12Z"
    }
  }
}
```

## 6. Storage location + gitignore

### 6.1 Path convention

Encrypted envelope lives at:

```
<project-root>/.gad/secrets/<projectid>.enc
```

Where `<project-root>` is the directory containing the project's `.planning/`
directory (its planning root, per `references/project-shape.md`). `<projectid>`
matches the planning-root's project id (the same id passed to `gad snapshot
--projectid`).

Audit log (see §9) lives alongside:

```
<project-root>/.gad/secrets/<projectid>.audit.jsonl
```

### 6.2 Gitignore enforcement

On first `gad env set <KEY> --projectid <id>`, the secrets store:

1. Locates the project root (walk up from CWD until `.planning/` + matching
   `projectId` found, or use `gad-config.toml`'s `[[planning.roots]]`).
2. Reads `<project-root>/.gitignore` (or creates it if missing).
3. If `.gad/` is not already listed (exact-match line or prefix pattern),
   appends:

   ```
   # Added by gad env set — encrypted secrets never belong in git
   .gad/
   ```

4. If the write fails, errors out with `GITIGNORE_WRITE_FAILED` and refuses to
   write the envelope. No silent fallback — refusing to proceed is safer than
   committing a plaintext-adjacent file.

Subsequent invocations check but do not re-append (idempotent).

### 6.3 Relationship to runtime `~/.gad/`

Important: there are **two different `.gad/` directories** with different scopes.

| Path | Scope | Contents | Who writes |
|---|---|---|---|
| `~/.gad/runtime/` | User profile | SEA binary unpack, shared runtime cache | SEA binary at first run |
| `<project-root>/.gad/secrets/` | Project root | Encrypted envelopes, audit logs | `gad env` CLI family |

Same prefix, different scope. The user-profile `~/.gad/runtime/` is shared
across every project the operator touches on that machine. The project-root
`.gad/secrets/` is specific to one project and travels with the repo boundary.
Do not confuse them. Neither writes into the other's tree.

## 7. CLI surface

All commands require master-key unlock before any envelope operation. `--projectid`
is required on every command (no implicit "current project" — the operator is
always explicit about which bag they're touching).

### 7.1 `gad env get`

```
gad env get <KEY> --projectid <id> [--version <n>] [--passphrase]
```

| Flag | Default | Meaning |
|---|---|---|
| `<KEY>` | (required) | Key name to decrypt and print. |
| `--projectid <id>` | (required) | Which project's bag to read. |
| `--version <n>` | current | Decrypt a specific version (valid within grace period). |
| `--passphrase` | off | Force passphrase prompt even if keychain available. |

Prints plaintext value to stdout. Nothing else. Non-zero exit on any error.
Does NOT log the value to the audit log (reads are high-frequency; logging
every read creates noise and is itself a small leak vector).

### 7.2 `gad env set`

```
gad env set <KEY> --projectid <id> [--provider <name>] [--scope <name>] [--passphrase]
```

| Flag | Default | Meaning |
|---|---|---|
| `<KEY>` | (required) | Key name to set. Uppercase-underscore convention (e.g. `OPENAI_API_KEY`). |
| `--projectid <id>` | (required) | Which project's bag to write into. |
| `--provider <name>` | `""` | Optional free-text provider label. |
| `--scope <name>` | `""` | Optional free-text scope label. |
| `--passphrase` | off | Force passphrase prompt. |

**Never reads the value from argv.** Prompts stdin (hidden/echoless input), so
the plaintext never enters shell history, process listings, or the parent
shell's scrollback. Creates the envelope file + `.gad/secrets/` dir + gitignore
entry on first use.

Writes an `envset` event to the audit log.

### 7.3 `gad env list`

```
gad env list --projectid <id> [--json] [--passphrase]
```

Prints a table of keys + metadata. **Never prints values.** Master-key unlock
is still required because the metadata includes `lastRotated` and version info
that the envelope already exposes plaintext — but the unlock gate confirms the
caller has bag access before listing contents.

Default output:

```
KEY                  VERSION  PROVIDER   SCOPE        LAST ROTATED
OPENAI_API_KEY       2        openai     model-api    2026-04-17
REPLICATE_API_TOKEN  1        replicate  image-gen    2026-04-17
```

`--json` emits the full metadata block (no ciphertext fields) for tooling.

### 7.4 `gad env rotate`

```
gad env rotate <KEY> --projectid <id> [--grace-days <n>] [--passphrase]
```

| Flag | Default | Meaning |
|---|---|---|
| `<KEY>` | (required) | Key to rotate. Must exist. |
| `--projectid <id>` | (required) | Which project's bag. |
| `--grace-days <n>` | 7 | Grace period for old version. Range 0-30. `0` = instant purge. |
| `--passphrase` | off | Force passphrase prompt. |

Prompts for new value on stdin. Appends a new version, bumps `currentVersion`,
sets old version's `retiresAt = now + grace-days`. Writes `envrotate` audit
event.

### 7.5 `gad env revoke`

```
gad env revoke <KEY> --projectid <id> [--version <n>] [--passphrase]
```

| Flag | Default | Meaning |
|---|---|---|
| `<KEY>` | (required) | Key to revoke. |
| `--projectid <id>` | (required) | Which project's bag. |
| `--version <n>` | all versions | Revoke a specific version; omit to remove the key entirely. |
| `--passphrase` | off | Force passphrase prompt. |

Removes version(s) from the envelope immediately (no grace). Writes `envrevoke`
audit event with the revoked version numbers. If all versions removed, the key
entry is deleted from `keys` map entirely.

## 8. Scoped-spawn wrapper

### 8.1 Contract

`lib/scoped-spawn.cjs` exports:

```js
function scopedSpawn({ projectId, command, args, options }) { /* ... */ }
```

| Input | Type | Meaning |
|---|---|---|
| `projectId` | string | Project whose env bag to decrypt and merge. |
| `command` | string | Child executable (e.g. `node`, `python`, `gad`). |
| `args` | string[] | Child argv. |
| `options` | object | Passthrough to `child_process.spawn`, except `env` is managed internally. |

### 8.2 Behavior

1. Call `secretsStore.decryptAll(projectId)` to get `{ KEY1: 'value1', KEY2: 'value2' }`.
2. Build `childEnv = { ...process.env, ...projectBag }`. Project bag **overrides**
   same-named parent vars (operator expectation: setting a key in the project
   means it wins over any ambient shell export).
3. Call `child_process.spawn(command, args, { ...options, env: childEnv })`.
4. `process.env` is **never mutated**. The parent session's env stays clean.
5. Return the spawn handle. Caller wires stdio and exit handling.
6. On child exit (any reason), `childEnv` goes out of scope and is
   garbage-collected. No explicit zero-out — Node does not guarantee
   buffer-pool wiping, so treat this as best-effort. Post-child-exit, plaintext
   is no longer reachable from parent memory.

### 8.3 Exit/cleanup handling

- If `secretsStore.decryptAll` fails (any named error from §12), `scopedSpawn`
  throws without ever calling `spawn`. Parent env never saw the keys.
- If the child dies (signal or non-zero exit), `scopedSpawn` propagates the
  exit code/signal to its caller. It does not retry the child automatically —
  retry policy belongs to the caller.
- Parent SIGINT forwards to child. When the child exits, parent does NOT
  re-expose any keys.

### 8.4 `--exclusive` flag — deferred

A future flag would swap step 2 to `childEnv = { ...projectBag }` (project-only,
no parent env). Left out of phase 60 — default merge covers the known use
cases. When a real need for exclusive isolation lands, add the flag; the
envelope format needs no change.

## 9. Rotation + revocation

### 9.1 Rotation state machine

```
   [no key]  --set-->  [v1 current, no retired]
       ^                      |
       |                   rotate
       |                      v
       |            [v2 current, v1 retired, retiresAt=now+grace]
       |                      |
   revoke all             grace expires
       |                      v
       |            [v2 current, v1 auto-purged on next invocation]
       |                      |
       |                   rotate
       |                      v
       |            [v3 current, v2 retired, retiresAt=now+grace]
       ...
```

**Invariants:**
- Exactly one version has `retiresAt: null` per key (the current version).
- All non-current versions have `retiresAt` in the past or future.
- `currentVersion` always points at a version in `versions`.

### 9.2 Grace-period purge algorithm

Runs on every CLI invocation that touches the envelope (read or write), before
returning control to the caller:

```
for key in envelope.keys:
  for version in key.versions:
    if version.retiresAt and version.retiresAt < now:
      delete key.versions[version]
      write_audit_event('envpurge', { key, version })
  if key.versions is empty:
    delete envelope.keys[key]
```

Purge is write-amplifying (envelope rewrite on purge). Frequency cap: at most
once per CLI invocation. If `gad env list` purged something, the next `gad env
get` on the same bag reads the already-purged envelope and does no further
writes.

### 9.3 Revocation event semantics

Revocation is **immediate and unconditional**. Unlike rotation, no grace — the
version(s) are removed from the envelope in the same write. Use cases:
- Compromised key (emergency).
- Operator wants to drop a provider entirely (cleanup).

Revocation is distinct from rotation: rotation adds a new version and retires
the old one with grace; revocation just removes. A common post-incident
sequence is `gad env revoke <KEY>` + `gad env set <KEY>` to force a fresh
v1 with no grace window.

### 9.4 Audit log

Location: `<project-root>/.gad/secrets/<projectid>.audit.jsonl` (same dir as
envelope, also gitignored via the `.gad/` blanket rule).

Append-only JSONL. One event per line. Schema:

```json
{"ts": "2026-04-17T21:30:00Z", "event": "envset", "key": "OPENAI_API_KEY", "version": 1, "provider": "openai", "scope": "model-api"}
{"ts": "2026-04-17T22:15:00Z", "event": "envrotate", "key": "OPENAI_API_KEY", "newVersion": 2, "retiredVersion": 1, "graceDays": 7}
{"ts": "2026-04-24T21:30:00Z", "event": "envpurge", "key": "OPENAI_API_KEY", "version": 1}
{"ts": "2026-04-25T09:00:00Z", "event": "envrevoke", "key": "REPLICATE_API_TOKEN", "versions": [1]}
```

| Event | When | Fields |
|---|---|---|
| `envset` | `gad env set` wrote a new key (v1) or new version via set-on-existing (error — set refuses if key exists). | `ts, event, key, version, provider, scope` |
| `envrotate` | `gad env rotate` succeeded. | `ts, event, key, newVersion, retiredVersion, graceDays` |
| `envpurge` | Auto-purge on grace expiry. | `ts, event, key, version` |
| `envrevoke` | `gad env revoke` succeeded. | `ts, event, key, versions` (array — may be single element or all) |

**Not logged:** `envget` (read operations). Reads are high-frequency and logging
them creates privacy noise without meaningful audit value.

## 10. Browser-side (WebCrypto)

The landing-site BYOK tab (task 60-08) decrypts entirely in the browser. The
server stores the encrypted envelope as an opaque blob and never sees the master
passphrase or any plaintext key.

### 10.1 Flow

1. Operator navigates to project dashboard → BYOK tab. Auth-gated by phase 51
   Clerk session (the transitive H dependency).
2. UI renders "Unlock vault" form. Operator enters master passphrase.
3. Browser fetches the opaque envelope blob from the server:
   `GET /api/projects/<projectid>/byok/envelope` → JSON envelope body.
4. Client derives the master key:

   ```js
   const passphraseKey = await crypto.subtle.importKey(
     'raw',
     new TextEncoder().encode(passphrase),
     'PBKDF2',
     false,
     ['deriveKey'],
   );
   const masterKey = await crypto.subtle.deriveKey(
     {
       name: 'PBKDF2',
       salt: base64ToBytes(envelope.kdfParams.saltB64),
       iterations: envelope.kdfParams.iterations,  // 600000
       hash: envelope.kdfParams.hash,              // 'SHA-256'
     },
     passphraseKey,
     { name: 'AES-GCM', length: 256 },
     false,
     ['decrypt'],
   );
   ```

5. For each key displayed in the UI, decrypt on demand:

   ```js
   const plaintext = await crypto.subtle.decrypt(
     {
       name: 'AES-GCM',
       iv: base64ToBytes(entry.nonceB64),
       additionalData: new TextEncoder().encode(`${projectId}|${keyName}|${version}`),
       tagLength: 128,
     },
     masterKey,
     base64ToBytes(entry.ciphertextB64 + entry.authTagB64),  // concat per WebCrypto convention
   );
   ```

   Note: WebCrypto expects ciphertext + auth-tag concatenated as a single
   buffer. Node's `createDecipheriv` takes them separately. The browser
   helper must concat; the Node helper keeps them split. Envelope format
   stores them separately (§5) so both consumers read cleanly.

6. Plaintext held in `sessionStorage` as `gad-byok-plaintext-<projectid>`
   (JSON map of KEY → value). Cleared automatically on tab close because
   `sessionStorage` is tab-scoped.
7. On tab close / logout: `sessionStorage.removeItem('gad-byok-plaintext-<projectid>')`.
   Master key derivation object (`CryptoKey`) is non-extractable (`extractable: false`)
   so it cannot be exported to JS-readable bytes.

### 10.2 Non-goals (explicit)

- **No server-side plaintext.** The server never sees the passphrase, the
  derived master key, or any decrypted value. Server routes touching
  `/api/projects/<id>/byok/` handle only opaque envelope JSON.
- **No HTTP transit of plaintext.** Values are decrypted client-side only.
  The `POST envelope` update route (for `set/rotate/revoke` from the browser)
  accepts only re-encrypted envelope bodies produced by the client.
- **No cross-tab sharing.** `sessionStorage` is tab-scoped by design. Each
  browser tab that needs the values enters the passphrase once per tab.
- **No "remember me".** The passphrase is not persisted in `localStorage`,
  cookies, or any indexed storage. Every new browser session re-enters.

## 11. Module + file layout

Downstream tasks create these files exactly. Paths are repo-relative to
`C:/Users/benja/Documents/custom_portfolio` (the monorepo root). All vendor
paths assume the submodule at `vendor/get-anything-done/` is the framework
checkout.

| Path | Task | Purpose |
|---|---|---|
| `vendor/get-anything-done/lib/secrets-store.cjs` | 60-02 | Envelope read/write, encrypt/decrypt helpers, purge, master-key acquisition. Public API used by CLI + scoped-spawn. |
| `vendor/get-anything-done/lib/keychain/windows.cjs` | 60-02 | Windows Credential Manager adapter. Real implementation. PowerShell shell-out or `wincred` equivalent. |
| `vendor/get-anything-done/lib/keychain/macos.cjs` | 60-02 | Stub. Throws `KEYCHAIN_UNAVAILABLE`. Real implementation deferred. |
| `vendor/get-anything-done/lib/keychain/linux.cjs` | 60-02 | Stub. Throws `KEYCHAIN_UNAVAILABLE`. Real implementation deferred. |
| `vendor/get-anything-done/lib/keychain/index.cjs` | 60-02 | Platform-dispatch: `process.platform` → adapter. Exports `get`, `set`, `delete`, `isAvailable`. |
| `vendor/get-anything-done/lib/scoped-spawn.cjs` | 60-04 | `scopedSpawn({ projectId, command, args, options })` per §8. |
| `vendor/get-anything-done/bin/gad.cjs` | 60-03 | Extend the existing command router with the `env` subcommand family (`get/set/list/rotate/revoke`). Five new handlers route to secrets-store. |
| `vendor/get-anything-done/tests/secrets-store.test.cjs` | 60-02 | Unit tests: mock keychain, round-trip, rotation, audit log. |
| `vendor/get-anything-done/tests/scoped-spawn.test.cjs` | 60-04 | Unit tests: env merge, parent isolation, error propagation. |
| `apps/planning-app/components/byok/` | 60-07 | Project-editor BYOK tab UI. Tab renders key list + add/rotate/revoke actions. Calls CLI via dev-server command bridge. |
| (TBD site-side helpers) | 60-08 | WebCrypto helpers for the landing-site surface. **Open decision:** path TBD during task 60-08 — candidates are `apps/site/lib/byok-webcrypto.ts` or a shared `packages/byok-crypto/` workspace if both planning-app and landing-site need the same code. Flagged in §15. |

**No new CLI binary.** Everything is a subcommand under the existing `gad`
binary. `gad env --help` discovers the family.

## 12. Error surfaces + operator experience

Named failure modes. Each one has a stable code (used by error messages and
tests), a one-line user message, and a one-line remediation hint. CLI prints
`<CODE>: <message>` on stderr and exits non-zero. Scoped-spawn and secrets-store
throw `Error` subclasses with `.code` set.

| Code | User message | Remediation |
|---|---|---|
| `PASSPHRASE_INVALID` | "Master passphrase did not decrypt the envelope." | "Re-enter the passphrase. If forgotten, envelope is unrecoverable — delete `.gad/secrets/<id>.enc` and re-add keys." |
| `PASSPHRASE_REQUIRED_NO_TTY` | "Passphrase required but stdin is not a TTY." | "Run interactively, or pre-populate the keychain so passphrase prompt is skipped." |
| `KEYCHAIN_UNAVAILABLE` | "OS keychain not supported on this platform." | "Use `--passphrase` flag or set up a platform keychain adapter." |
| `KEYCHAIN_LOCKED` | "OS keychain rejected the unlock request." | "Unlock the OS keychain via system settings, then retry. Or force passphrase with `--passphrase`." |
| `BAG_CORRUPT` | "Envelope at `.gad/secrets/<id>.enc` is malformed or tampered." | "Inspect the file; if unrecoverable, delete and re-run `gad env set` for each key." |
| `KEY_NOT_FOUND` | "Key `<NAME>` is not set for project `<id>`." | "Run `gad env list --projectid <id>` to see available keys, or `gad env set <NAME>` to add it." |
| `KEY_EXPIRED` | "Version `<n>` of key `<NAME>` has been purged past grace period." | "Use `--version <current>` or `gad env rotate <NAME>` to refresh." |
| `ROTATION_GRACE_EXPIRED` | "Requested version retired on `<date>` and was auto-purged." | "Switch to the current version, or re-set the key if the old value is still needed." |
| `GITIGNORE_WRITE_FAILED` | "Could not add `.gad/` to `<project-root>/.gitignore`." | "Check filesystem permissions; fix manually then retry `gad env set`." |
| `PROJECT_NOT_FOUND` | "No planning root found for `projectid=<id>`." | "Run `gad startup --projectid <id>` or check `gad-config.toml` `[[planning.roots]]`." |
| `KEY_ALREADY_EXISTS` | "Key `<NAME>` is already set for project `<id>`." | "Use `gad env rotate <NAME>` to update the value; `gad env set` is add-only." |
| `GRACE_DAYS_OUT_OF_RANGE` | "`--grace-days` must be between 0 and 30." | "Re-run with a value in range." |

**Operator experience principles:**
- Every error message names the projectId and the file path. No ambiguous
  "something went wrong".
- Remediation hints are always actionable (a concrete CLI command or a file to
  check).
- Failures fail closed — never silently degrade to unencrypted or unlocked
  behavior.

## 13. Test strategy

### 13.1 Unit tests (run in CI)

Located at `vendor/get-anything-done/tests/`. Use Node's built-in `node:test`
runner (matches existing test harness in `tests/canonical-skill-records.test.cjs`).

| Test file | Covers |
|---|---|
| `tests/secrets-store.test.cjs` | Envelope read/write, encrypt/decrypt round-trip, PBKDF2 derivation correctness, audit-log append, purge algorithm. |
| `tests/secrets-store-rotation.test.cjs` | Rotate → decrypt old within grace → decrypt old after grace fails with `ROTATION_GRACE_EXPIRED` → rotate again → third-gen current. |
| `tests/secrets-store-errors.test.cjs` | Every named error code fires under its documented condition. |
| `tests/scoped-spawn.test.cjs` | `childEnv` contains project keys; `process.env` stays clean; child exit propagates; decrypt failure prevents spawn. |
| `tests/keychain-mock.test.cjs` | Mock keychain adapter passes through correctly; unavailability triggers passphrase fallback. |

### 13.2 Mock keychain adapter

A fake adapter at `tests/helpers/mock-keychain.cjs` implements the same
interface (`get/set/delete/isAvailable`) with an in-memory map. Injected via a
test-only module-replacement hook in `lib/keychain/index.cjs`:

```js
// lib/keychain/index.cjs (sketch)
const adapters = {
  win32: require('./windows'),
  darwin: require('./macos'),
  linux: require('./linux'),
};
let override = null;
module.exports = {
  _setAdapterForTest(adapter) { override = adapter; },  // tests only
  get: (account) => (override || adapters[process.platform]).get(account),
  // ...
};
```

### 13.3 Integration tests (local-only, not CI)

Real-keychain tests live under `tests/integration/` and are excluded from CI.
Documented in `tests/integration/README.md`. Run locally via
`node --test tests/integration/keychain-windows.test.cjs` on Windows boxes.

Rationale: real keychain mutates user state. CI runners do not have persistent
credential stores or GUI unlock prompts. Keep CI tests keychain-free.

### 13.4 Migration test

`tests/migration-llm-from-scratch.test.cjs` simulates the task 60-06 migration:

1. Set `process.env.OPENAI_API_KEY = 'sk-test-fixture'`.
2. Call `gad env set OPENAI_API_KEY --projectid llm-from-scratch` (programmatic
   equivalent in-process, no shell).
3. Unset `process.env.OPENAI_API_KEY`.
4. `scopedSpawn({ projectId: 'llm-from-scratch', command: 'node', args: ['-e',
   'console.log(process.env.OPENAI_API_KEY)'] })`.
5. Assert child stdout === `'sk-test-fixture\n'`.
6. Assert parent `process.env.OPENAI_API_KEY` is `undefined` throughout.

### 13.5 Envelope fixture

`tests/fixtures/envelope-v1.json` — a canonical v1 envelope encrypted under a
known test passphrase (`test-passphrase-never-use-in-prod`). Enables
deterministic decrypt tests and cross-language verification (same ciphertext
must round-trip in both Node and WebCrypto helpers).

## 14. Migration path for llm-from-scratch

Task 60-06 migrates `llm-from-scratch`'s `OPENAI_API_KEY` from ambient
`process.env` into its encrypted project bag. Concrete steps:

**Step 1 — operator sets the key once.**

```
gad env set OPENAI_API_KEY --projectid llm-from-scratch --provider openai --scope model-api
```

Operator pastes the key at the (echoless) prompt. Envelope written to
`projects/llm-from-scratch/.gad/secrets/llm-from-scratch.enc`. `.gad/` appended
to `projects/llm-from-scratch/.gitignore`. `envset` row added to audit log.

Operator can now delete `OPENAI_API_KEY` from shell profile (`.bashrc`,
`.zshrc`, Windows user env) — the key lives in the encrypted bag.

**Step 2 — daily-subagent dispatch uses scoped-spawn.**

Phase 59 task 59-07 dispatches daily subagents for llm-from-scratch. After
60-04 ships, that dispatch path wraps the child launch:

```js
// (sketch — task 59-07 uses this)
const { scopedSpawn } = require('vendor/get-anything-done/lib/scoped-spawn.cjs');

const child = scopedSpawn({
  projectId: 'llm-from-scratch',
  command: 'claude',
  args: ['--file', promptPath],
  options: { stdio: 'inherit', cwd: projectRoot },
});
```

The child Claude process receives `OPENAI_API_KEY` (and any other keys in the
bag) in its env. Parent dispatch process never saw the plaintext.

**Step 3 — teachings tip-gen drops the env dependency.**

`gad tip generate` (and any other offload path per gad-263) currently reads
`process.env.OPENAI_API_KEY`. Post-migration:

```js
// before
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY required');

// after
const { secretsStore } = require('vendor/get-anything-done/lib/secrets-store.cjs');
const apiKey = await secretsStore.get({ projectId, keyName: 'OPENAI_API_KEY' });
if (!apiKey) throw new Error(`OPENAI_API_KEY not set for project ${projectId}. Run: gad env set OPENAI_API_KEY --projectid ${projectId}`);
```

The `projectId` comes from the call site (which project is this tip being
generated for?). Tip-gen invoked from a subagent context reads
`GAD_PROJECT_ID` env var that scoped-spawn already populates.

**Backward compat window:** during the migration phase, tip-gen accepts either
path — bag-first, env fallback. After 60-06 verification, the env fallback is
removed entirely.

**Acceptance criterion:** after migration, running `gad tip generate --projectid
llm-from-scratch` with an empty shell (`env -i`) works. The key comes
exclusively from the encrypted bag.

## 15. Open follow-ups

These surfaced while drafting the spec and are not yet tracked tasks. Each
needs its own todo capture or a task registry entry.

1. **Site-side WebCrypto helper location (task 60-08).** TBD whether the
   browser-side decrypt helpers live in `apps/site/lib/byok-webcrypto.ts`, in
   `apps/planning-app/lib/byok-webcrypto.ts`, or in a shared
   `packages/byok-crypto/` workspace. Decision should fall out of whether both
   planning-app (60-07) and landing-site (60-08) reuse the same client code. If
   both do, workspace package. If only landing-site uses WebCrypto (because
   planning-app is local-dev and shells out to the CLI), app-local is fine.
   **Flag for task 60-08 kickoff.**

2. **macOS + Linux keychain adapter trigger.** Stubs throw `KEYCHAIN_UNAVAILABLE`
   so non-Windows users fall through to passphrase mode. Needs an explicit
   roadmap entry (maybe phase 60.1) documenting when to promote the stubs to
   real adapters. Candidate trigger: first non-Windows operator shipped.
   **Flag as todo.**

3. **Envelope schema versioning migration path.** `schemaVersion: 1` is in the
   format today. There's no code yet that reads v1 and writes v2. When the
   first format change lands, the secrets-store needs a migration module.
   **Flag as todo — revisit when schema v2 is proposed.**

4. **`--exclusive` flag on scoped-spawn.** Deferred in §8.4. If a real isolation
   need arises (e.g. running untrusted child in a stripped env), add the flag +
   one line of behavior. **Flag as todo — not blocking 60-04.**

5. **Audit log retention / rotation.** The audit log is append-only with no
   cap. Long-lived projects will accumulate events. Decide when (at what size?
   after what date?) to rotate `<projectid>.audit.jsonl` to
   `<projectid>.audit.YYYY-MM.jsonl`. **Flag as todo — not urgent until a
   project crosses ~10 MB audit log.**

6. **Browser-side "re-seal" flow.** The landing-site surface (60-08) must be
   able to write back updated envelopes (on set/rotate/revoke from the
   browser). That means the browser re-encrypts the whole envelope with the
   existing master key and POSTs the opaque blob to the server. Spec this when
   task 60-08 starts — the core primitives (derive key, encrypt) are already in
   §10, but the "full envelope re-seal" write path wants its own
   minor-spec-pass. **Flag for task 60-08 kickoff.**

7. **Provider test-call validation.** Phase 60 task goal for 60-07 mentions a
   "test call" button that validates a pasted key by making a provider API
   call. That is a separate spec (per-provider validation endpoint + rate
   limiting + error surface). Not codified here. **Flag as todo for task 60-07
   kickoff.**

8. **Cross-machine envelope portability.** Today an operator on two machines
   who wants the same bag on both must re-run `gad env set` on each. Envelope
   sync (via the planning-app cloud surface once 60-08 lands) is implicit in D
   but not explicitly stepped through. **Flag as todo — revisit after 60-08.**

## References

- Decision gad-260 — per-project BYOK env storage (original direction).
- Decision gad-266 — operator accepted A-H defaults (2026-04-17).
- Discussion note `.planning/notes/phase-60-byok-discussion-2026-04-17.md`.
- Roadmap phase 60 — scope statement.
- Task registry `TASK-REGISTRY.xml` phase 60 — tasks 60-01 through 60-08.
- Decision gad-263 — offload policy (downstream consumer of BYOK).
- `references/project-shape.md` — planning root convention (where `.gad/` lives relative to `.planning/`).
