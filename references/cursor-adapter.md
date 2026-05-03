# Cursor adapter

Phase 89-04 adds a Cursor-side whiteboard emitter at `scripts/cursor-session-emit.mjs`.
It sits in front of `cursor-agent`, proxies the child stdio unchanged, and writes
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

## Entry points

- Direct wrapper: `node scripts/cursor-session-emit.mjs --projectid global --intent "..." -- cursor-agent ...`
- Normal GAD path: `node scripts/gad-cursor-trial.mjs -- ...`

`gad-cursor-trial.mjs` now delegates to the emitter and passes the resolved Cursor binary
plus the headless prompt args through unchanged.

## Event model

The current adapter emits:

- `session-start`
- `step-start`
- `tool-call`
- `pressure-event` for failed tool invocations
- `attribution-link` when a Bash tool command matches a `gad` durable-write command
- `step-end`
- `session-end`

It deliberately does **not** synthesize decomposition trees yet. Cursor's public headless
surface gives us tool metadata reliably, but not a stable "planned children" event the way
the schema's `decomposition` kind wants. A future upgrade can add that once Cursor exposes
it cleanly.

## Attribution inference

The adapter watches Bash-like tool inputs for durable GAD writes:

- `gad tasks stamp <id>` -> `task-stamp`
- `gad decisions add <id>` -> `decision-add`
- `gad handoffs complete <id>` -> `handoff-complete`
- `gad note add <slug>` -> `note-add`

The emitted `artifact_id` is taken directly from the command line token.

## Privacy

- `tool-call.target` is always a path-ish string or a truncated command summary.
- File contents are never written.
- `output_excerpt` remains opt-in behind `GAD_SESSION_TRACE_VERBOSE=1`.
- Secret-like material is scrubbed before excerpt emission.

## Fixture

Committed sample session:

- `vendor/get-anything-done/tests/fixtures/cursor-session.sample.jsonl`

Regression coverage:

- `vendor/get-anything-done/tests/cursor-session-emit.test.cjs`
