---
id: security-surgical-aead-mutation-01
title: Mutate the envelope, not the crypto — surgical edits on AEAD-protected stores
category: security
difficulty: advanced
tags: [crypto, aead, aes-gcm, envelope, performance, defense-in-depth]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/lib/secrets-lifecycle.cjs
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-aead-aad-01, security-passphrase-verifier-01
---

# Mutate the envelope, not the crypto — surgical edits on AEAD-protected stores

You've stored many secrets inside one envelope file, each independently encrypted with its own nonce + auth tag + AAD (see `security-aead-aad-01`). The envelope looks like:

```json
{
  "kdf": {...},
  "verifier": {...},
  "keys": {
    "OPENAI_API_KEY": {
      "currentVersion": 2,
      "versions": {
        "1": { "nonceB64": "...", "ciphertextB64": "...", "authTagB64": "...", "retiresAt": "2026-04-10T..." },
        "2": { "nonceB64": "...", "ciphertextB64": "...", "authTagB64": "...", "retiresAt": null }
      }
    }
  }
}
```

Version 1 has expired its grace period. You need to purge it. Instinct: unlock the master key, re-encrypt version 2, rebuild the envelope. A full crypto round-trip.

**That is unnecessary and wasteful.** You can delete the entry as a **plain JSON edit** and the remaining ciphertext is still valid.

## Why the plain-JSON edit is safe

Each version is its own AEAD ciphertext sealed with its own nonce + tag. The crypto does not know or care about other entries in the envelope. The only invariants that need to hold:

1. `envelope.keys[keyName].currentVersion` must still point at a version that exists in the map.
2. The remaining versions must retain their `{nonceB64, ciphertextB64, authTagB64}` fields unchanged.
3. The AAD strategy (`projectId|keyName|version`) must continue to match at decrypt time — which it does, because version numbers don't change when a different version is deleted.

None of those require the master key. None require re-encryption. You're doing structural cleanup on the container, not touching the payload.

## The operation in code

```js
function purgeVersion(envelope, keyName, versionToPurge) {
  const key = envelope.keys[keyName];
  if (!key) throw new Error('KEY_NOT_FOUND');
  if (String(versionToPurge) === String(key.currentVersion)) {
    throw new Error('REFUSE_PURGE_CURRENT');  // invariant 1
  }
  delete key.versions[String(versionToPurge)];
  return envelope;
}
```

Then serialize + atomic-rename onto disk. The master key is not involved. The KDF is not invoked. No PBKDF2 round. The operation is milliseconds, not the ~100ms of a key derivation.

## Why this matters — three angles

**Performance.** Purging 50 expired versions across a bag of 200 keys is 50 JSON deletions + one atomic write. The re-encrypt approach would be 150 PBKDF2 rounds (one per surviving key, if you're paranoid about rotating) or one derive + 150 AES-GCM encrypts. Both are wasteful.

**Attack surface.** Every time the master key leaves the keychain, touches memory, or gets passed into a function, it's exposure. The best master key is one that is unlocked rarely and for short windows. Surgical JSON mutation needs the master key ZERO times for purge operations.

**Audit simplicity.** The audit event for a purge records what was deleted. If you re-encrypt, you also have to record "everything re-encrypted even though nothing else changed" which muddies the log.

## When you DO need a full re-encrypt

Genuine master-key rotation. If the master key itself changes, every ciphertext in the envelope is sealed against a key the new master doesn't know. Then you must:
1. Decrypt every version with the old key (N AEAD decrypts).
2. Re-encrypt with the new key (N AEAD encrypts + one KDF round for the new key).
3. Write the updated envelope + new `kdfParams`.

But that's master-key rotation, not value rotation and not purge. For everything EXCEPT master-key rotation, stay surgical.

## The generalized rule

**When your format has independently-sealed slots, cleanup operations on the slot MAP do not require the sealing key.** The crypto is on the slot CONTENTS. The structure around them is plain data.

Applies to:
- Password-manager vaults (delete an entry)
- Session-token stores (revoke a session)
- Encrypted document chunks (drop an obsolete chunk)
- Log-of-encrypted-events stores (compact by dropping old events)

It does NOT apply to whole-file encryption schemes where the entire file is one ciphertext — those need a full decrypt-edit-encrypt round.

## Takeaway

Per-slot AEAD gives you structural independence. Use it. Purging, reordering, or pruning entries is a plain JSON edit — no key unlock, no re-encryption, no round trip. Reach for the master key only when the crypto itself needs to change, not when the container shape does.
