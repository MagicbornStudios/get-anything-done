# Remove env-fallback in lib/openai-client.cjs after cutover verified

**Source:** 2026-04-17 S17 — 60-06 migration cutover

lib/openai-client.cjs (task 60-06) resolves OPENAI_API_KEY bag-first, process.env-fallback with deprecation warn. This is the cutover window — operator migrates each project's key into the encrypted bag via 'gad env set OPENAI_API_KEY --projectid <id>'.

After cutover:
  1. llm-from-scratch has its key in .gad/secrets/llm-from-scratch.enc (primary case driving 60-06)
  2. Daily-tip generator (scripts/generate-daily-tip.mjs) verified resolving via bag
  3. Three bin/gad.cjs consumers wired through createOpenAIClient (see todo 2026-04-17-openai-client-bin-gad-wire.md)

When all three confirmed:
  - Delete the env-fallback branch in resolveApiKey
  - Keep the KEY_UNRESOLVED error but make it FIRST-LINE — no warning precedes it
  - Update tests (drop env-hit tests, add env-only should-fail tests)
  - Update byok-design.md §14 migration cutover window section to reflect the cutover as done
  - Announce in a commit message: cutover complete

Not urgent — cutover is a feature, not a bug. Fold into phase 60 closeout or file as 60-09.
