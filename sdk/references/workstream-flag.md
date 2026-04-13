# Workstream Flag (`--ws`)

> Status: deferred upstream review. The shipped `gad-tools` surface does not currently implement `workstream` commands or a live `--ws` routing contract. Treat this file as a review note, not as an active operator reference.

## Current GAD truth

- `gad-tools workstream ...` is not implemented in the current GAD CLI.
- Workflow and site references must not imply that workstreams are usable today.
- Any future workstream support must be reviewed against upstream `get-shit-done` first, then reintroduced deliberately.

## What upstream GSD built

Upstream `get-shit-done` uses `.planning/workstreams/<name>/` to isolate:

- `STATE`
- `ROADMAP`
- `REQUIREMENTS`
- `phases/`

while keeping shared files like `PROJECT`, `config`, `milestones`, and `codebase` at the root `.planning/`.

The upstream implementation also supports:

- flat-mode fallback when no workstreams exist
- migration from flat mode into namespaced mode
- active-workstream selection
- progress/status across workstreams
- path validation around workstream names
- session-scoped active pointers in tests and SDK code

## Why GAD has not adopted it yet

Workstreams are promising, but they affect too many core surfaces to add casually:

- multi-root planning
- eval preservation
- runtime tracing
- site reporting
- milestone completion rules

GAD needs a simpler adoption plan than upstream's full workstream surface. Until that review is done, flat planning remains the only supported mode.

## If workstreams return later

The likely minimum contract to reconsider is:

1. backward-compatible flat mode
2. explicit migration from flat planning
3. per-session active workstream selection
4. clear site/eval/reporting behavior
5. security validation on workstream names and paths
