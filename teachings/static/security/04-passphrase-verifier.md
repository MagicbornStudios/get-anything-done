---
id: security-passphrase-verifier-01
title: Passphrase verifier — distinguish wrong-key from tampered-data
category: security
difficulty: intermediate
tags: [crypto, aead, error-handling, ux]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/secrets-store.cjs
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-aead-aad-01, security-fail-closed-01
---

# Passphrase verifier — distinguish wrong-key from tampered-data

You've implemented AEAD (see `security-aead-aad-01`). A user types a wrong passphrase. What error do you show?

The natural answer — "decryption failed" — is technically honest but useless. The user can't tell whether:

1. They mistyped the passphrase, or
2. Their bag was tampered with (or corrupted)

For (1) the fix is "try again." For (2) the fix is "restore from backup, investigate the machine." Same error message guides them toward the wrong response.

## Why AEAD alone can't distinguish

AEAD (AES-GCM, ChaCha20-Poly1305) gives you one failure mode: "auth tag didn't verify." It fires whenever the derived key doesn't match what was used to encrypt. That happens when:

- The passphrase is wrong → derived key is wrong
- The ciphertext was modified → tag doesn't verify
- The AAD doesn't match → tag doesn't verify
- The nonce was corrupted → tag doesn't verify

One symptom, four causes. Crypto alone cannot narrow it.

## The fix: a verifier slot

Add a known-plaintext entry to the envelope, encrypted under the same master key at envelope creation:

```js
// on envelope create:
const VERIFIER_PLAINTEXT = Buffer.from('gad-secrets-store-verifier-v1', 'utf8');
const verifier = encrypt(VERIFIER_PLAINTEXT, masterKey, { aad: `${projectId}|__verifier__|0` });
envelope.verifier = verifier;  // stored alongside the user keys
```

On unlock, attempt to decrypt the verifier FIRST with the candidate master key:

```js
try {
  const plaintext = decrypt(envelope.verifier, candidateKey, { aad: '…|__verifier__|0' });
  if (!plaintext.equals(VERIFIER_PLAINTEXT)) throw new Error('PASSPHRASE_INVALID');
  // Verifier decoded cleanly. Key is correct. Any later AEAD failure
  // on an actual key is real tampering, not user error.
} catch (e) {
  if (e.code === 'AEAD_FAIL') throw new Error('PASSPHRASE_INVALID');
  throw new Error('BAG_CORRUPT');
}
```

After the verifier checks out, any subsequent decrypt failure on an actual user key is attributable to **tampering or corruption**, not to the wrong passphrase. Clean error semantics at last.

## Why this works

The verifier is a **self-tested canary**. Its plaintext is constant across all bags (just a fixed string), so it isn't a secret — knowing it doesn't help an attacker. But its ciphertext is unique per bag because nonce + AAD + master key are all bag-specific. Matching the plaintext after decrypt proves the key is right. Mismatch → wrong key. Decrypt exception → wrong key. Every other AEAD failure later → tampered data.

## The pattern generalizes

Use a verifier slot any time you have:

- **One derived key encrypting multiple items**, AND
- **Two failure modes that must be user-distinguished** (wrong credential vs corrupted data)

Places it fits:
- Password-protected archives (zip, 7z — actually do this internally)
- Disk-encryption volumes (LUKS, FileVault — use verifier blocks)
- Keyed configuration stores (our BYOK case)
- End-to-end encrypted document stores

The close cousin is **bcrypt's self-verifying hash format**: the hash embeds its own parameters and cost such that `bcrypt.compare(password, hash)` always gives a clear yes/no, never "maybe something is wrong." A verifier slot does the same for symmetric bags.

## One extra AEAD op, big UX win

The cost is one AES-GCM decrypt (microseconds) on every unlock. The gain is the user can act on the error. That trade is always worth making.

## Takeaway

If your unlock path produces "AEAD failed" as its only error, you have a UX hole. Add a verifier slot at envelope creation, decrypt it first on unlock, and your error messages become diagnostic instead of merely truthful.
