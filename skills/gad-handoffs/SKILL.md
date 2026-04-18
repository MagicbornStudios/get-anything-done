---
name: gad-handoffs
description: >-
  Work-stealing handoff queue across parallel agent runtimes. Use whenever you
  need to hand off work to another agent (different runtime / different lane / next
  session), pick up assigned work on session open, or check what's waiting. Per-file
  directory layout under .planning/handoffs/{open,claimed,closed}/, atomic fs.rename
  lifecycle, every gad CLI call is safe against concurrent agents. Required reading
  for every session start; supersedes the old .continue-here.md pattern.
lane: dev
allowed-tools:
  - Bash
---

# gad-handoffs

Canonical workflow for the `gad handoffs` CLI family (shipped 2026-04-18, task
60-09). Every agent in every runtime consults this skill when they need to
either produce a handoff (pause / cross-lane request / end-of-session) or
consume one (session-start pickup / reassignment).

## When to use

| Moment | Direction | Reach for |
|---|---|---|
| Session open | Consume | `gad handoffs list --mine-first` as step 2 of the daily workflow |
| Pausing mid-work | Produce | `gad handoffs create` with a self-contained body |
| Touching a file outside your lane | Produce | `gad handoffs create --runtime-preference <owning-lane>` |
| Reassigning stalled work to another agent | Produce | same |
| Context exhaustion near auto-compact | Produce | write the handoff BEFORE compaction so future-you has the state |

## When NOT to use

- A task you'll finish in the same session — just do it. Handoffs are for work
  that crosses an agent / session / lane boundary.
- Architectural decisions — those go in `DECISIONS.xml` via `gad decisions add`.
- Design sketches that aren't action items — those go in `.planning/notes/`.
- Purely internal state (e.g. "what's the current test count") — that goes in
  `STATE.xml` next-action or the task registry, not the queue.

## The five verbs

```sh
gad handoffs list [--unclaimed|--claimed|--closed|--all] [--projectid <id>] [--mine-first] [--json]
gad handoffs show <id>
gad handoffs claim <id> [--agent <name>]
gad handoffs complete <id>
gad handoffs create --projectid <id> --phase <N> --task-id <t> \
  --priority <low|normal|high> --context <mechanical|reasoning> \
  [--runtime-preference <claude-code|codex|cursor>] \
  --body "<self-contained instructions>"
```

`list` defaults to the `open` bucket. `--mine-first` sorts by matching
`runtime_preference` so a codex agent sees codex-targeted handoffs first.
`--json` emits `[]` when empty (needed for shell gating in hooks).

## Lifecycle

```
open/     ─ gad handoffs claim ────> claimed/ ─ gad handoffs complete ─> closed/
  │                                     │                                   │
  │ created by `gad handoffs create`    │ owner works it                    │ audit trail
  │ or author's own fs.rename           │                                   │
```

Transitions are `fs.renameSync` — atomic on both POSIX and Windows on the
same filesystem. No lock file. The directory listing IS the index.

## Writing a good handoff body

Self-contained. The claiming agent should never need to come back to you
(the author) for scope. Minimum elements:

1. **Context pointers** — which references/notes/decisions explain why.
2. **What to do** — numbered steps, with file paths.
3. **Constraints** — lane deny lists, avoided patterns, external blockers.
4. **Acceptance** — how the claimant knows they're done.
5. **When done** — literal CLI command to close (`gad handoffs complete <id>`).

If the body is over ~150 lines, the work probably deserves a proper phase
(`gad phases add`) and the handoff points at that phase instead. Handoff
bodies are transient; phase goals are canonical.

## Frontmatter fields

Set by `gad handoffs create`, readable in every listing:

| field | meaning |
|---|---|
| `id` | `h-<ISO-timestamp>-<projectid>-<phase>` (generated) |
| `projectid` | scoping — which planning root this touches |
| `phase` | phase id (string — supports decimals like `42.4`) |
| `task_id` | optional — existing TASK-REGISTRY task id this refines |
| `priority` | `low` / `normal` / `high` — only `high` should break other work |
| `estimated_context` | `mechanical` (Haiku-doable) / `reasoning` (Opus-worth) |
| `runtime_preference` | target lane — `claude-code` / `codex` / `cursor` / empty for any |
| `created_by` / `claimed_by` | runtime + agent id (auto-filled) |
| `created_at` / `claimed_at` / `completed_at` | ISO timestamps |

## Interaction with TASK-REGISTRY.xml

Handoffs are **intent**, tasks are **commitments**. Typical relationship:

- Task 63-02 sits in TASK-REGISTRY as the canonical commitment.
- One or more handoffs reference it via `task_id=63-02` to pass specific
  sub-work between lanes.
- When the handoff is closed, the task may also close (via
  `gad tasks release <id> --done`) if the handoff was the last piece.

Never put the handoff body content in TASK-REGISTRY goal — goals are
long-lived summaries, not action queues.

## Cross-lane protocol

If you need a file outside your lane (per `references/agent-lanes.md`),
**do not silently edit it**. File a handoff:

```sh
gad handoffs create \
  --projectid get-anything-done \
  --phase <N> --task-id <id> \
  --priority normal --context reasoning \
  --runtime-preference <owning-lane> \
  --body "$(cat <<'EOF'
# Short title

## Before you start
- Read `references/agent-lanes.md` — you are on the <owning-lane> lane.
- Relevant files: <paths>

## Implementation
1. ...
2. ...

## Acceptance
- ...

## When done
gad handoffs complete <this-id>
EOF
)"
```

Keep your own lane's work moving; the target lane drains the queue on
their next session.

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Hook shows "Unclaimed handoffs" but count is garbled | Installed binary predates 60-09; text output bleeds into JSON parse | Upgrade when 44-38 ships |
| `gad handoffs list --json` prints help instead of `[]` | Same — stale binary | Same |
| Two agents both try to claim the same handoff | Race between `list` and `claim` | The second `claim` errors `ALREADY_CLAIMED` — no state corruption |
| Claimed handoff abandoned (agent dead) | No TTL enforcement today | Manually `fs.rename` back to `open/` or `gad handoffs list --claimed` and re-file |

## Related

- `references/agent-lanes.md` — which lane owns what, when cross-lane is OK
- `references/communication-style.md` — SITREP register for handoff bodies
- `.planning/notes/2026-04-18-handoff-queue-design.md` — original design doc
- `.planning/notes/2026-04-18-handoff-snapshot-integration.md` — pending snapshot surface
- `skills/gad-pause-work` — alias that wraps `gad handoffs create` for the "ending work" moment
