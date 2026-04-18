---
id: h-2026-04-18T18-19-51-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: 63-06
created_at: 2026-04-18T18:19:51.942Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: low
estimated_context: mechanical
runtime_preference: codex
---
# CLI gaps surfaced during phase 63 work (follow-up for codex)

## Gaps

1. **`gad decisions show <id>`** — does not exist. Only `gad decisions list [--id <id>]` which truncates to a summary row. Forces grepping DECISIONS.xml when reading full decision bodies. Add a `show` subcommand mirroring the pattern from `gad handoffs show` (lib/handoffs.cjs:readHandoff) — reads lib/decisions-reader.cjs and prints the full `<decision>` element contents.

2. **`gad tasks release --done --skill <x>`** silently drops the `--skill` flag — the task registry ends up with no `skill=` attribute on the completed task. Either: (a) remove the flag from the CLI surface if we're not going to honor it; or (b) wire it through to the TASK-REGISTRY writer so it lands on the task element. The AGENTS.md loop spec (GAD-D-104) says attribution is mandatory; CLI should match.

Low priority — neither blocks work. Lower the bar on the next round of CLI hygiene.