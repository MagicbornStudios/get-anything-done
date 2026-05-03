# Codex CLI adapter

Phase 89-03 adds a Codex-side whiteboard emitter at `scripts/codex-session-emit.cjs`.
It wraps the team worker's normal `codex exec` path, reads the prompt from stdin,
passes child stdout/stderr through unchanged, and writes
`.planning/.sessions/<id>/events.jsonl` in the 89-01 schema.

## Why this shape

Codex team workers already run through a stdin pipe:

`cat <prompt-file> | codex exec -c features.codex_hooks=false -c notify=[] --skip-git-repo-check --dangerously-bypass-approvals-and-sandbox`

The adapter preserves that contract. When `GAD_SESSION_TELEMETRY=1` is set, the
team subprocess swaps the raw `codex exec ...` command for
`node scripts/codex-session-emit.cjs`, and the wrapper spawns Codex with the same
runtime command under the hood. When the env var is unset, there is no behavior
change and no telemetry overhead.

## Entry points

- Team worker opt-in: `GAD_SESSION_TELEMETRY=1 node vendor/get-anything-done/bin/gad.cjs team work ...`
- Direct wrapper: `cat prompt.md | node scripts/codex-session-emit.cjs`
- Test override: `cat prompt.md | node scripts/codex-session-emit.cjs -- node -e "<synthetic child>"`

## Event model

The current adapter emits:

- `session-start`
- `step-start`
- `tool-call`
- `pressure-event`
- `attribution-link`
- `step-end`
- `session-end`

It does not synthesize `decomposition` yet. Codex's worker-facing stderr gives us
stable tool-activity breadcrumbs (`exec`, `patch: completed`, `diff --git`,
router/tool errors), but not a durable planned-children surface.

## Pattern mapping

- `exec` + following command line -> tool-call
  - `Get-Content` / `cat` / `type` -> `Read`
  - `rg` / `grep` / `findstr` -> `Grep`
  - everything else -> `Bash`
- `patch: completed` + next file path -> `Edit`
- `diff --git a/... b/...` -> `Edit`
- `ERROR codex_core::tools::router: error=Exit code: ...` -> failed tool-call +
  `pressure-event`
- `gad ... handoffs complete`, `gad tasks stamp`, `gad decisions add`,
  `gad state log`, `gad note add` detected inside command lines ->
  `attribution-link`

## Privacy

- Child stdout/stderr are forwarded unchanged to preserve the worker UX.
- Telemetry payloads are scrubbed before write:
  - `.env`-style `KEY=value` secrets
  - `Authorization:` headers
  - `Bearer ...`
  - `sk-ant-`, `sk-`, `cl-`, `ghp_`, `github_pat_` prefixes
- `tool-call.target` stores only a path or command summary, never file contents.

## Fixture

Committed sample session:

- `vendor/get-anything-done/tests/fixtures/codex-session-sample.jsonl`

Regression coverage:

- `vendor/get-anything-done/tests/codex-session-emit.test.cjs`
