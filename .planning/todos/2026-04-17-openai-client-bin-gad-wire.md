# Follow-up — wire createOpenAIClient into bin/gad.cjs tip-gen + image-gen paths

**Source:** task 60-06 (2026-04-17 session). Library layer landed at
`vendor/get-anything-done/lib/openai-client.cjs`; callers in `bin/gad.cjs` are
still on raw `process.env.OPENAI_API_KEY` because another subagent held
concurrent edit rights to `bin/gad.cjs` during 60-06 and the main session split
the work.

## Consumers to migrate

| Location (bin/gad.cjs) | What it does today | Migration |
|---|---|---|
| `maybeGenerateDailyTip()` around line 10549 | Gates daily-tip gen on `process.env.OPENAI_API_KEY` then spawns `scripts/generate-daily-tip.mjs` with inherited env. | Replace the `process.env.OPENAI_API_KEY` gate with a `scopedSpawn` call that injects the `get-anything-done` project bag into the child. Gate on whether the bag has the key OR fall back to the env check for the cutover window. |
| `tipGenerateCmd` around line 14463 | Same gate, invoked from `gad tip generate` subcommand. | Same as above. |
| `evolutionImagesGenerate` around line 11635 | Reads `apiKey = process.env.OPENAI_API_KEY` and posts to `https://api.openai.com/v1/images/generations`. | Wire directly via `createOpenAIClient`-style helper — add an `images()` method to `lib/openai-client.cjs` OR ship a sibling `images` helper that shares `createApiKeyResolver`. Preserve `--env-file` behavior. |

## Acceptance

- `gad tip generate` works with an empty shell (`env -i gad tip generate --projectid get-anything-done`) provided the bag has `OPENAI_API_KEY`.
- `gad evolution images generate` works the same way (or gracefully skips if neither bag nor env has a key).
- Running any of these with NO key in bag AND no env var prints the same `KEY_UNRESOLVED` message that `createApiKeyResolver` emits — naming the `gad env set` command.
- Wrong-passphrase or `BAG_CORRUPT` on the bag aborts the CLI command with the security error, does NOT silently fall back to env.
- Deprecation-warn log is visible when the env fallback is taken (operator sees the migration hint).

## References

- `vendor/get-anything-done/lib/openai-client.cjs` — library landed in 60-06.
- `vendor/get-anything-done/lib/scoped-spawn.cjs` — 60-04 wrapper for subagent dispatch paths.
- `vendor/get-anything-done/references/byok-design.md` §14 — migration spec.
- `vendor/get-anything-done/.planning/TASK-REGISTRY.xml` task 60-06 — completion notes.

## Estimate

~45-90 min. Three call sites, straightforward delta per site, plus one extra
test for the `images()` helper if that method is added.
