---
id: h-2026-04-21T22-15-15-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: 63-17
created_at: 2026-04-21T22:15:15.931Z
created_by: unknown
claimed_by: team-w1
claimed_at: 2026-04-21T22:56:56.739Z
completed_at: 2026-04-21T22:59:06.696Z
priority: normal
estimated_context: mechanical
runtime_preference: codex-cli
---
# Close 3 CLI gaps surfaced 2026-04-21 from monorepo lane

Task: GAD-T-63-17

## Gap 1 — gad tasks show <id> [--projectid <id>]

Print the full body of one task from `.planning/tasks/<id>.json` (per-task JSON is canonical post-63-11). Today the dispatcher rejects `gad tasks show` with "Unknown command show" and the operator falls back to reading the JSON file by hand.

Pattern: `vendor/get-anything-done/bin/commands/tasks/list.cjs` is the reference. Each subcommand is a factory `function createTasks<X>Command(deps)` returning a `defineCommand(...)`. Wired in the tasks dispatcher (find it via `grep -n "createTasksListCommand\|subCommands" vendor/get-anything-done/bin/commands/tasks/`).

Add: `vendor/get-anything-done/bin/commands/tasks/show.cjs` exporting `createTasksShowCommand(deps)`. Args: `id` (positional, required), `--projectid` (default empty → use active session project), `--json` (default false). Reads `.planning/tasks/<id>.json` for the resolved project, pretty-prints fields. If the JSON file is missing, fall back to scanning TASK-REGISTRY.xml for the `<task id="...">` block (legacy projects).

Verify from monorepo root: `gad tasks show 05-07 --projectid global` prints the full multi-line goal of the VCS-extraction task.

## Gap 2 — gad errors --projectid <id> returns "No error attempts found" even when XML has entries

Repro: monorepo root has 22 entries in `.planning/ERRORS-AND-ATTEMPTS.xml` (date attribute 2026-04-21). `gad errors --projectid global` returns "No error attempts found".

Likely: the errors reader resolves the wrong path (e.g. only checks `vendor/get-anything-done/.planning/ERRORS-AND-ATTEMPTS.xml`, not the host monorepo's file when --projectid is global) OR the XML schema parser expects a different element name than `<entry>`.

Find the reader. Likely candidates: `lib/readers/errors-reader.cjs` or similar, or inline in `bin/commands/errors.cjs`. Confirm where the file gets read, fix the resolution to honor `--projectid` properly (global → monorepo root .planning, get-anything-done → vendor submodule .planning, others → projects/<id>/.planning).

Verify: `gad errors --projectid global` returns the 22 entries (id, date, summary, status).

## Gap 3 — gad blockers --projectid <id> returns "No blockers found" while OPEN entries exist

Same monorepo today has 2 entries with `status="open"` plus `blocks="<task-id>"` attribute:
  - gad-team-windows-detached-spawn-2026-04-21 (blocks 05-07)
  - highlight-on-child-missing-identified-wrapping-2026-04-21 (blocks 05-07-phase-3)

`gad blockers --projectid global` returns "No blockers found". Filter is missing the `status="open"` matcher OR the blockers source is something other than ERRORS-AND-ATTEMPTS.xml. Either way, the operator-visible expectation per CLAUDE.md is "errors at session open alongside snapshot — prior failures save hours" so the CLI must surface both errors AND the OPEN subset cheaply.

Verify: `gad blockers --projectid global` returns the 2 OPEN entries with summary + blocks-task.

## Cross-cutting

- All three are reads — no writes. Adding a new subcommand (Gap 1) and fixing two read-resolvers (Gaps 2/3).
- Smoke after each: `node bin/gad.cjs tasks show 05-07 --projectid global`, `node bin/gad.cjs errors --projectid global`, `node bin/gad.cjs blockers --projectid global` — run from monorepo root, not from inside the submodule.
- Add tests under `vendor/get-anything-done/tests/` parallel to existing readers/commands tests. At minimum: assert `tasks show <id>` outputs the goal text from a fixture JSON, and `errors --projectid X` reads from the host repo's .planning/ERRORS-AND-ATTEMPTS.xml when --projectid resolves to a host project.
- Lane: Codex per the hard split — Claude discusses/registers, Codex implements CLI.

## Out of scope

- Don't touch the bash.exe → node hooks port (separate handoff `h-2026-04-20T00-00-30-get-anything-done-63`).
- Don't touch the gad team Windows spawn fix (task 05-08 in the global registry — that's a different runtime/spawn lane).