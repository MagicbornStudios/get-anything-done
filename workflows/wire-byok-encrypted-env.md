# wire-byok-encrypted-env — workflow

Per-project BYOK (bring your own key) encrypted env requires three
load-bearing pieces: an at-rest store with OS-keychain-backed master
keys, a CLI surface that never echoes plaintext, and a scoped spawn
wrapper that decrypts only into the child process. Phase 60 shipped 13
tasks across the store, scope chain, audit log, and UI surfaces.

## When to use

- A project needs API keys (OpenAI, Anthropic, etc.) without committing
  them to .env files.
- Multi-project monorepo where each project should have isolated key
  scope.
- An agent runtime (subagent dispatcher) needs to inherit keys at spawn
  without leaking into the parent process.

## When NOT to use

- For non-sensitive env defaults (use `lib/env-defaults-store.cjs` —
  plain JSON, no encryption).
- For shared org-wide keys (use the cloud KMS path, not the per-project
  envelope).
- For ephemeral session env (just set inline; encryption adds friction
  for no audit value).

## Steps

1. Author the design doc first (per 60-01) resolving:
   - **Crypto primitive**: libsodium sealed-box vs AES-256-GCM with
     scrypt KDF. Document the choice with rationale.
   - **Master-key UX**: OS keychain-first (Windows Credential Manager,
     macOS Keychain, Linux secret-service) with passphrase fallback when
     keychain is unavailable.
   - **On-disk format**: JSON envelope with version, salt, nonce,
     per-key metadata (last-rotated, scope, provider).
   - **Rotation model**: in-place vs additive.
   - **Site-side strategy**: browser-only WebCrypto decrypt vs
     server-side per-user KMS.
2. Implement `lib/secrets-store.cjs` (per 60-02):
   - Envelope path: `.gad/secrets/<projectid>.enc` (no scope) or
     `.gad/secrets/<projectid>/<scope-path>.enc` (scoped per 60-07b).
   - Three keychain adapters: windows-credential-manager,
     macos-keychain, linux-secret-service.
   - `.gad/` added to repo-level .gitignore on first write.
   - Mock keychain adapter for tests.
3. CLI family (per 60-03 + 60-05a):
   - `gad env get <KEY> --projectid` — never echoes plaintext to stdout
     unless `--show` is passed.
   - `gad env set <KEY> --projectid` — reads value from prompt, not argv,
     to avoid shell history.
   - `gad env list --projectid` — keys + metadata, never values.
   - `gad env rotate <KEY> --projectid` — generate new, re-encrypt,
     zero-out old buffer.
   - `gad env revoke <KEY> --projectid` — remove + audit-log event.
   - `gad env audit <projectid> [--since ISO] [--limit N]`
   - `gad env purge <projectid> [--as-of ISO] [--dry-run]`
4. Scoped spawn wrapper (per 60-04):
   - `lib/scoped-spawn.cjs` takes `projectId + child command`.
   - Decrypts that project's env bag.
   - Merges into child `process.env` ONLY for the child; parent stays
     untouched.
   - Subagent dispatch uses this wrapper.
5. Scope chain (per 60-07b):
   - Resolution order: `species > eval > planning`.
   - `listChain` / `decryptChain` walk most-specific → least, marking
     shadowed parents in `shadows[]`.
   - Per-scope master keys (`projectId::scope`) so each scope's master
     is independent.
   - Backward-compatible: no-scope = legacy planning bag.
6. Audit log:
   - Append-only at `.gad/secrets/<projectid>.audit.jsonl`.
   - Records: envset, envrotate, envrevoke, envpurge.
   - Gitignored.
7. Project-editor BYOK tab (per 60-07):
   - Lives in local-dev project-editor (NODE_ENV=development gate).
   - Renders current keys redacted (last 4 chars only).
   - Add-key form with paste + provider picker + test-call validation.
   - Rotate / revoke actions.
   - Calls `gad env` CLI via dev-server command bridge OR direct route
     (for mutating ops, prefer direct route to avoid stdin-pipe
     plaintext exposure).
8. Cloud BYOK surface (per 60-08):
   - Auth-gated, post planning-app split.
   - Same key-management UI as local but for cloud projects.
   - Decryption per design doc (browser WebCrypto or server KMS).
9. Error code split (per 60-10):
   - `PROJECT_NOT_FOUND` for missing envelope on disk.
   - `KEY_NOT_FOUND` for envelope-exists-but-key-absent.
   - Avoid substring-match anti-pattern in callers.
10. Server-context safety (per 60-07b note 6):
    - Honor `GAD_NO_TTY_PROMPT=1` in passphrase fallback to refuse
      interactive prompts.
    - Set `process.env.GAD_NO_TTY_PROMPT="1"` at module load in any
      Next.js dev API route that imports the store.

## Guardrails

- Never log plaintext values. Audit log records key names + verbs only.
- `gad env set` reads from prompt, not argv — argv ends up in shell
  history files.
- Migration from global env (e.g. moving `OPENAI_API_KEY` from
  `process.env` to a project bag) requires cutover docs in
  `references/byok-design.md §Migration`.
- BYOK UI should never have a "show all keys" button. Last 4 chars only,
  one at a time, with explicit click.
- Keychain adapter failures must fall back to the passphrase prompt;
  never fall back to plaintext storage.

## Failure modes

- **Subagent missing OPENAI_API_KEY despite project having it.** Confirm
  the spawn used `lib/scoped-spawn.cjs` and not raw `child_process.spawn`.
- **Audit log missing entries.** Mutating operations bypassed the
  store API. All paths (CLI + dev API route + UI) must go through
  `lib/secrets-lifecycle.cjs`.
- **Passphrase prompt hangs in Next.js dev server.** `GAD_NO_TTY_PROMPT`
  not set. Set at module load in every API route that imports the store.
- **Scope chain shows wrong parent.** `species > eval > planning` is the
  fixed order; never reverse it.
- **Envelope corruption.** Atomic writes via temp file + `fs.rename`.

## Reference

- Decisions gad-260, gad-268.
- Phase 60 tasks 60-01..60-10.
- `lib/secrets-store.cjs`, `lib/secrets-lifecycle.cjs`,
  `lib/scoped-spawn.cjs`, `lib/env-defaults-store.cjs`,
  `lib/env-cli.cjs`, `lib/keychain/passphrase-fallback.cjs`,
  `lib/secrets-store-errors.cjs`.
- `references/byok-design.md` (in vendor/get-anything-done).
