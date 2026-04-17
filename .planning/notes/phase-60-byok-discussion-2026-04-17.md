# Phase 60 (BYOK) — discussion / advisor-mode recommendations

**Status:** draft for operator review — flip any recommendation by replying with the question letter + preferred answer
**Date:** 2026-04-17
**Ties into:** decision gad-260, todo 2026-04-17-byok-secrets-phase.md, phase 60 task 60-01
**Next:** once operator signs off, 60-01 produces `vendor/get-anything-done/references/byok-design.md` that codifies these choices as the authoritative spec

---

## A. Crypto primitive — **recommend AES-256-GCM + scrypt KDF**

**Choice:** use Node stdlib `crypto` module exclusively. AES-256-GCM for symmetric encryption of the keys bag. `scrypt` for deriving the file-encryption key from the master passphrase (when keychain is unavailable — see B).

**Why over libsodium sealed-box:**
- Zero native deps. Our CLI ships as a SEA binary; native modules (`sodium-native`, `@napi-rs/*`) break the SEA packaging story and force per-platform rebuilds. Stdlib crypto is already baked into every Node we can target.
- AEAD (authenticated encryption with associated data) gets us confidentiality + integrity in one primitive.
- Both primitives are explicitly documented by Node (`crypto.createCipheriv`, `crypto.scryptSync`) — no library-version drift risk.

**Tradeoff:** more ceremony than libsodium — we pick scrypt params, choose nonce strategy, enforce auth-tag verification. But that's one-time design work; runtime ergonomics are identical.

**Proposed params:** scrypt N=2^15 (32768), r=8, p=1 → ~100ms on modern hardware, acceptable for master-unlock frequency. 96-bit random nonce per key (random — not counter — so we don't need nonce-state on disk). 128-bit auth tag.

---

## B. Master-key UX — **recommend OS keychain with passphrase fallback**

**Choice:** try the OS keychain first; prompt for a passphrase only when keychain is unavailable or the user opts out.

**Why:**
- Keychain auto-unlocks on user login → zero-friction daily use. Operator runs `gad env get` and the call just works.
- Passphrase fallback covers headless environments (CI, docker, SSH-without-keychain).
- Starting with keychain-first means the common case is frictionless; power users can force passphrase mode with `--passphrase` flag.

**Platform adapters:**

| platform | mechanism |
|---|---|
| Windows | Credential Manager via `CryptProtectData` DPAPI (stdlib, no deps) or PowerShell shell-out |
| macOS | `/usr/bin/security add-generic-password / find-generic-password` |
| Linux | secret-service via `secret-tool` binary (common on gnome/kde), passphrase fallback on bare servers |

**Staged delivery:** Windows adapter first (operator's platform). macOS + Linux when a real need lands. Passphrase fallback is enough of a safety net that we're not blocking non-Windows use.

---

## C. On-disk format — **recommend versioned JSON envelope**

Proposed shape at `.gad/secrets/<projectid>.enc`:

```json
{
  "schemaVersion": 1,
  "projectId": "llm-from-scratch",
  "createdAt": "2026-04-17T21:30:00Z",
  "cipher": "AES-256-GCM",
  "kdf": "scrypt",
  "kdfParams": { "N": 32768, "r": 8, "p": 1, "saltB64": "..." },
  "keys": {
    "OPENAI_API_KEY": {
      "nonceB64": "...",
      "ciphertextB64": "...",
      "authTagB64": "...",
      "addedAt": "2026-04-17T21:30:00Z",
      "lastRotated": "2026-04-17T21:30:00Z",
      "provider": "openai",
      "scope": "model-api"
    }
  }
}
```

**Why JSON:**
- Human-inspectable structure. Operators can diff envelopes over time to see which keys rotated without decrypting anything.
- Per-key nonce + auth-tag → independent encryption per key, no cascade on rotation.
- `schemaVersion` field reserves the right to migrate format.
- Per-key metadata (`provider`, `scope`, `lastRotated`) supports the CLI `gad env list` display without decryption.

**Tradeoff:** JSON is ~2-3× larger than a packed binary format. Negligible for BYOK scale (dozens of keys).

**Value encoding:** base64 for nonce, ciphertext, auth tag, and salt. Node's `Buffer.toString('base64')` + `Buffer.from(s, 'base64')` round-trips cleanly.

---

## D. Site-side strategy — **recommend browser-only WebCrypto decrypt**

**Choice:** the server stores the encrypted envelope as an opaque blob and NEVER holds the master passphrase or plaintext keys. Landing-site BYOK tab enters the master passphrase in the browser, derives the file key via WebCrypto's `PBKDF2` or `deriveKey`, decrypts locally, displays/uses locally.

**Why over server-side KMS:**
- Zero-knowledge storage — server compromise does not leak keys or master passphrase.
- Simpler server model: just an opaque blob per user per project. No KMS provisioning, no per-user HSM cost.
- Aligned with "user owns their keys" framing — matches BYOK ideology.

**Tradeoffs:**
- Server-side rendering can't access keys. Any server-executed action needing a key (e.g., hypothetical cron that calls an LLM on the user's behalf) has to be client-triggered. For the current roadmap — llm-from-scratch runs locally, no server-side automation — this is fine.
- Passphrase lives in browser `sessionStorage` only (cleared on tab close). User re-enters passphrase on each browser session. Acceptable friction given the trust model.

**Note on WebCrypto / Node parity:** WebCrypto supports AES-GCM natively. It does NOT support scrypt directly; it does support PBKDF2. We have two options:
- (i) Use PBKDF2 for the KDF so browser + CLI use the same algorithm. Param differences from scrypt but still secure at high iteration count.
- (ii) Use scrypt in Node and PBKDF2 in browser, re-derive per platform. Complex.

**Sub-recommendation:** go with (i) — PBKDF2 with 600k iterations everywhere. Same KDF both sides, simpler implementation.

*If you pick PBKDF2, update recommendation A accordingly.*

---

## E. Rotation model — **recommend additive with 7-day grace period**

**Choice:** `gad env rotate KEY --projectid X` adds a new version alongside the old, bumps `currentVersion` pointer for that key. Old version stays available for decrypting old ciphertext for 7 days, then auto-purges on next CLI invocation.

**Why over in-place replacement:**
- Atomic — no moment where the decrypt-old-encrypt-new path fails mid-rotation and corrupts the bag.
- If a scheduled subagent run references the old key version (cache, queue, pending job), it still decrypts until grace period expires.

**Extended shape:**

```json
"keys": {
  "OPENAI_API_KEY": {
    "currentVersion": 2,
    "versions": {
      "1": { "nonceB64": "...", "ciphertextB64": "...", "authTagB64": "...", "addedAt": "...", "retiresAt": "2026-04-24T..." },
      "2": { "nonceB64": "...", "ciphertextB64": "...", "authTagB64": "...", "addedAt": "2026-04-17T..." }
    },
    "provider": "openai",
    "scope": "model-api"
  }
}
```

**Grace period configurable** via `gad env rotate KEY --grace-days 14 --projectid X` (default 7, min 0 for instant, max 30).

---

## F. `.gad/` location — **recommend project root, gitignored**

**Choice:** encrypted bag lives at `<project-root>/.gad/secrets/<projectid>.enc`. `.gad/` gets added to the project's `.gitignore` automatically by `gad env set` first-use (if not already present).

**Why project-root over user-profile:**
- Keys travel with the project boundary, not the user profile. Two checkouts of the same project on the same machine share the same `.gad/secrets/` location because the path is repo-relative.
- Isolation — a compromise of one project's bag doesn't touch another project's bag.

**For cloud projects** (phase 60 task 60-08): the server-side encrypted blob is the source of truth; local `.gad/secrets/` becomes a cache that re-syncs on browser decrypt success.

**Name collision note:** the SEA runtime already uses `~/.gad/runtime/`. That's user-profile scope. The project-scope `.gad/` is a different directory at a different location. Same name, different scope — don't confuse them.

---

## G. Scoped spawn — confirm model

**Choice (no alternative to flip):** the scoped-spawn wrapper decrypts the project bag into a `childEnv` object, merges with `process.env`, and passes to `spawn()` as `env: childEnv`. Parent `process.env` is NEVER mutated. Child sees the merged env; parent stays clean.

Implication: once a subagent spawn returns, the keys are gone from memory (GC-reachable only inside the short-lived child). Parent session never holds them.

**Confirm or flip:** do you want the child to inherit the merged env (project keys + operator's existing env), or the project bag exclusively (stricter isolation, operator-env explicitly not forwarded)? Default answer: merge.

---

## H. Auth dependency for task 60-08 (landing-site BYOK surface)

**Flagging for the operator:** task 60-08 (landing-site project-dashboard BYOK surface) is auth-gated. Current roadmap has phase 51 scaffolding auth (Clerk + Supabase). Phase 60 depends on 59; 60-08 additionally depends on 51.

**Options:**
1. Accept the transitive dep — 60-08 just waits for 51. Everything else in phase 60 (tasks 60-01..60-07) is auth-free and lands on the local CLI side.
2. Split phase 60: 60a = local-only BYOK (tasks 60-01..60-07), 60b = cloud/landing BYOK (task 60-08). 60b depends on 51.
3. Descope 60-08 — never do cloud-side BYOK, keep BYOK local-only forever.

**Recommendation:** option 1. Phase 60 ships the full design including the cloud surface; 60-08 is just the last task and waits. No new phases needed.

---

## Summary of asks

Reply with letters + any flips. Defaults stand if you just say "go."

| # | default recommendation |
|---|---|
| A | AES-256-GCM + scrypt (or PBKDF2 if you pick D-i) |
| B | OS keychain first, passphrase fallback; Windows adapter first |
| C | versioned JSON envelope, per-key metadata |
| D | browser-only WebCrypto decrypt; PBKDF2 KDF for browser/CLI parity |
| E | additive rotation with 7-day grace period |
| F | `.gad/secrets/<projectid>.enc` at project root, auto-gitignored |
| G | scoped spawn merges project bag with parent env (not exclusive) |
| H | option 1 — 60-08 waits on phase 51 auth; no phase split needed |

Once confirmed, task 60-01 becomes: write `references/byok-design.md` codifying A-H + module structure + error surfaces + test strategy. That unblocks 60-02 implementation.
