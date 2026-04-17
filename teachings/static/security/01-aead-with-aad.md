---
id: security-aead-aad-01
title: AEAD + AAD — pin your ciphertext to its context
category: security
difficulty: intermediate
tags: [crypto, aead, aes-gcm, defense-in-depth]
source: static
date: 2026-04-17
implementation: vendor/get-anything-done/references/byok-design.md
decisions: gad-266, gad-267
phases: get-anything-done:60
related: security-fail-closed-01, security-derive-dont-store-01
---

# AEAD + AAD — pin your ciphertext to its context

**AEAD** — Authenticated Encryption with Associated Data — is the modern default for symmetric encryption. AES-256-GCM, ChaCha20-Poly1305, and XSalsa20-Poly1305 are the common ones. AEAD gives you two guarantees in one primitive:

| guarantee | what it means |
|---|---|
| **confidentiality** | the ciphertext hides the plaintext |
| **integrity** | any tampering with the ciphertext is detected on decrypt |

That's table stakes. The **AAD** part — Associated Data — is the part most tutorials skip. And it's the one that saves you from slot-swap attacks.

## The slot-swap attack

You've got an encrypted bag with two keys:

```
OPENAI_API_KEY  -> {nonce_a, ciphertext_a, tag_a}
ANTHROPIC_API_KEY -> {nonce_b, ciphertext_b, tag_b}
```

Both are encrypted with the same master key (reasonable). An attacker who can write to the file but can't decrypt it does this:

```
OPENAI_API_KEY  -> {nonce_b, ciphertext_b, tag_b}   # swapped!
```

Your code asks for `OPENAI_API_KEY`, decryption succeeds (the auth tag is valid for ciphertext_b), and now your OpenAI client is sending requests with your Anthropic key. **The crypto is working. The logic is broken.**

## The fix: bind each ciphertext to its slot

AAD is extra bytes mixed into the auth tag but not encrypted. On decrypt, you must pass the same AAD — if it doesn't match, decryption fails.

```js
// encrypt
const aad = Buffer.from(`${projectId}|${keyName}|v${version}`, 'utf8');
cipher.setAAD(aad);
// ... encrypt, get tag ...

// decrypt (later, elsewhere)
const aad = Buffer.from(`${projectId}|${keyName}|v${version}`, 'utf8');
decipher.setAAD(aad);  // MUST match encryption-time value
decipher.setAuthTag(tag);
// throws if AAD doesn't match
```

Now when the attacker swaps ciphertext, decryption fails because the AAD expected is `llm-from-scratch|OPENAI_API_KEY|v1` but the tag was generated over `llm-from-scratch|ANTHROPIC_API_KEY|v1`.

## The pattern generalizes

Anywhere you store multiple ciphertexts under one key and look them up by name, bind the name into the AAD. Examples:
- Encrypted cookies — bind session id and cookie name
- Encrypted JWTs — bind issuer and audience
- Encrypted file storage — bind file path and owner id
- Encrypted config values — bind config key and env name

**Rule of thumb:** if two ciphertexts could ever be swapped by an attacker and produce a dangerous outcome, the AAD is your defense.

## Takeaway

AEAD protects the ciphertext. AAD protects its **location**. Always bind the context in which the ciphertext is meant to be decrypted — name, version, owner, scope — into the AAD. It's free (no extra bytes at rest if you reconstruct it at decrypt time) and it closes a class of attacks that the crypto alone can't see.
