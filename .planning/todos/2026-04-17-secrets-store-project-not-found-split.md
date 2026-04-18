# Split KEY_NOT_FOUND vs PROJECT_NOT_FOUND at secrets-store boundary

**Source:** 2026-04-17 S15 — scoped-spawn 60-04 workaround surfaced it

In lib/secrets-store.cjs (task 60-02), both 'no envelope file for this project' and 'envelope exists but this specific key is absent' currently throw KEY_NOT_FOUND with different messages. This forces downstream callers (lib/scoped-spawn.cjs in 60-04) to substring-match the message to disambiguate — a known antipattern (errors should branch on code, not message shape).

Fix: split at the secrets-store source:
  - PROJECT_NOT_FOUND — no .gad/secrets/<projectid>.enc exists
  - KEY_NOT_FOUND    — envelope exists, key absent

Then scoped-spawn.cjs drops its isMissingEnvelope() helper and branches on code directly.

Impact:
  - Breaking change in secrets-store error codes. Only internal callers today (env-cli + scoped-spawn) — low blast radius.
  - Update SECRETS_STORE_CODES Set.
  - Update env-cli messageFor to cover both codes (the 'initial state' soft-swallow in list becomes clearer — only PROJECT_NOT_FOUND triggers the empty-bag path).
  - Update byok-design.md §12 error surface table.
  - Add a test in tests/secrets-store.test.cjs confirming the split.

Not urgent — workaround is stable. Pick up before phase 60 ships externally or when someone adds a third caller of secrets-store.get.
