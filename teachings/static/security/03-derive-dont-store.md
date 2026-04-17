---
id: security-derive-dont-store-01
title: Derive, don't store — keep the secret one step away from disk
category: security
difficulty: intermediate
tags: [crypto, kdf, keychain, derived-keys, defense-in-depth]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/references/byok-design.md
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-aead-aad-01, security-fail-closed-01
---

# Derive, don't store — keep the secret one step away from disk

Your BYOK store unlocks via a **master key** — the key that encrypts every other key in the bag. Where does that master key come from? Two options:

```
passphrase -------> KDF (PBKDF2, scrypt, argon2) ------> derivedKey -------> AES-GCM
   (in head)                                              (in memory)
```

The derived key is what AES actually uses. The passphrase is what the human types.

## The naive approach — store the passphrase in the keychain

Keychain (Windows Credential Manager, macOS Keychain, Linux secret-service) is designed to hold secrets that unlock when the user is logged in. First pass, it's tempting to:

1. User enters passphrase on first `gad env set`
2. Store passphrase in keychain under "gad-master-passphrase"
3. On next use: read passphrase from keychain, run KDF, get derived key

**Why it's wrong:** the passphrase is the most-sensitive credential in the system. Anyone who extracts it — keychain dump, malware with user-level access, an incident-response scrape — gets the key to every project's bag. And they get it in the form the human uses across other systems. (Humans reuse passphrases. You know they do.)

## The fix — store the derived key, never the passphrase

Only run the KDF once, on first unlock. Then:

1. User enters passphrase
2. Run KDF → `derivedKey` (32 bytes of entropy)
3. **Store `derivedKey`** in keychain under `gad-master-derivedkey-<projectid>`
4. Zero out `passphrase` in memory immediately (`buffer.fill(0)`)
5. On next use: read `derivedKey` from keychain, use directly

## Why this is strictly better

- **Keychain dump ≠ passphrase leak.** Attacker gets `derivedKey`, which is specific to this project and can't be reused elsewhere. They never see what the human typed.
- **Cross-project isolation.** Keychain entries are per-projectId. Compromise of one derived key doesn't give access to another project's bag.
- **Rotation is cheap.** Rotating the master key means: re-derive from a new passphrase, replace the keychain entry, re-encrypt the bag. The human's passphrase is never the long-lived identifier.
- **KDF cost is paid once.** PBKDF2 at 600k iterations or scrypt at N=32768 takes ~100ms. Doing it on every unlock is a tax; deriving once and caching is free.

## The generalized rule

Whenever you have a **human-memorable credential** and a **machine-usable credential** you derive from it, store the derived one. The human-memorable one exists to bootstrap the derived one, and should be discarded after bootstrap.

Examples:
- Password → hashed password in database (you never store the password)
- OAuth authorization code → access token (code is single-use, gone)
- TOTP shared secret → wait, that one DOES get stored; but it's 160 bits of random, not a human memory, so the rule doesn't apply
- Recovery phrase → wallet private key (phrase is the boot, key is the runtime)

## What to zero

When you're done with the plaintext passphrase, overwrite the buffer. In Node:

```js
const passphrase = Buffer.from(inputString, 'utf8');
const derivedKey = crypto.pbkdf2Sync(passphrase, salt, 600_000, 32, 'sha256');
passphrase.fill(0);   // overwrite plaintext passphrase
// derivedKey lives on; passphrase is now 32 zero bytes.
```

JavaScript's GC doesn't guarantee timely cleanup, but explicit zero-out gets the bytes gone from your working buffer. That's the best the runtime allows.

## Takeaway

The passphrase is bootstrap material. The derived key is the actual secret. Only ever store the derived key — and zero the passphrase buffer the moment you're done with it. The higher up the chain you keep the human-memorable credential, the bigger your blast radius on a single compromise.
