# Cursor adapter

Phase 89-04 adds a Cursor-side whiteboard emitter at `scripts/cursor-session-emit.cjs`.
It sits in front of the normal Cursor runtime command, proxies child stdio unchanged, and writes
`.planning/.sessions/<id>/events.jsonl` in the 89-01 schema.

## Why this shape

Cursor exposes clean headless flags (`--print --output-format json|stream-json`) but its
stream payload is not documented as a stable external contract. The adapter therefore uses
two rules:

1. Treat child stdio as the source stream and never mutate it.
2. Parse only the tool metadata Cursor already emits consistently inside that stream:
   `tool_name`, `tool_input`, `tool_output`, `tool_use_id`, `error_message`,
   `failure_type`, and `duration`.

That keeps the wrapper useful even if message-level formatting shifts.

The adapter mirrors the Codex opt-in path from 89-03: when `GAD_SESSION_TELEMETRY=1` is
set, the team runtime wraps the normal Cursor command with
`node scripts/cursor-session-emit.cjs -- ...`. When the env var is unset, workers call the
raw runtime command directly and incur no telemetry overhead.

## Entry points

- Team worker opt-in: `GAD_SESSION_TELEMETRY=1 node vendor/get-anything-done/bin/gad.cjs team work ...`
- Direct wrapper: `cat prompt.md | node scripts/cursor-session-emit.cjs -- node scripts/gad-cursor-trial.mjs -- --print --output-format json`
- Raw runtime path (no telemetry): `node scripts/gad-cursor-trial.mjs -- --print --output-format json`

`gad-cursor-trial.mjs` is the no-overhead launcher: it resolves the packaged/local
`cursor-agent`, loads repo-root env, and executes the headless command directly. The
telemetry wrapper is layered around that launcher only when the env gate is enabled.

## Event model

The current adapter emits:

- `session-start`
- `step-start`
- `tool-call`
- `pressure-event` for failed tool invocations
- `attribution-link` when a Bash tool command matches a `gad` durable-write command
- `step-end`
- `session-end`

It deliberately does **not** synthesize decomposition trees yet. Cursor's headless JSON
stream gives us tool metadata reliably, but not a stable planned-children event the way the
schema's `decomposition` kind wants.

## Attribution inference

The adapter watches Bash-like tool inputs for durable GAD writes:

- `gad tasks stamp <id>` -> `task-stamp`
- `gad decisions add <id>` -> `decision-add`
- `gad handoffs complete <id>` -> `handoff-complete`
- `gad state log` -> `state-log`
- `gad note add <slug>` -> `note-add`

The emitted `artifact_id` is taken directly from the command line token.

## Privacy

- `tool-call.target` is always a path-ish string or a truncated command summary.
- File contents are never written.
- `output_excerpt` remains opt-in behind `GAD_SESSION_TRACE_VERBOSE=1`.
- Secret-like material is scrubbed before excerpt emission.

## Fixture

Committed sample session:

- `vendor/get-anything-done/tests/fixtures/cursor-session-sample.jsonl`

Regression coverage:

- `vendor/get-anything-done/tests/cursor-session-emit.test.cjs`
