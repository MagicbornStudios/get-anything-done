# BYOK / per-project encrypted env phase (decision gad-260)

**Source:** 2026-04-17 session 4 — BYOK direction set

Implement per-project encrypted env storage.

Sub-items to resolve in the phase plan:
1. Crypto primitive: libsodium sealed-box vs AES-256-GCM+scrypt. Pick one, justify.
2. Master-key UX: passphrase prompt vs OS keychain (Keychain/CredMgr/secret-service). Default to OS keychain with passphrase fallback.
3. Store format + layout: .gad/secrets/<projectid>.enc (gitignored). Schema: versioned, per-key metadata (last-rotated, scope, provider).
4. CLI: gad env get/set/rotate/list --projectid X. Scoped spawn wrapper so subagents inherit without process-wide leak.
5. Project-editor BYOK tab UI: paste-field, test-call validation, save, redact on display.
6. Landing-site project-dashboard surface: auth-gated, same BYOK tab for cloud projects. Decrypt in browser via WebCrypto OR server-side with per-user KMS — decide.
7. Key rotation + revocation flow.
8. Migration path: OPENAI_API_KEY for llm-from-scratch tip-gen moves into its encrypted bag.
