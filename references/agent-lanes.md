# Agent Lanes — file/directory ownership across parallel agent runtimes

**Canonical.** Every parallel agent runtime consults this file as ground truth
for what it may touch. Drift / silent cross-lane edits cost ~20% of multi-agent
turn time per the 2026-04-18 three-agent post-mortem. This document closes that.

Promoted from `.planning/notes/2026-04-18-agent-lane-manifest-draft.md` (task 63-04).

## Core principle

> **A file has exactly one primary lane owner. Cross-lane edits are the
> exception, announced via the handoff queue (task 60-09), never silent.**

Shared aggregate files (`TASK-REGISTRY.xml`, `STATE.xml`, `DECISIONS.xml`,
`ROADMAP.xml`) are always CLI-mediated — no agent edits them directly.

## Runtime lane table

| Runtime | Primary lane | Owns (allow globs) | Does NOT touch (deny globs) |
|---|---|---|---|
| **claude-code** | Planning, docs, snapshot, cross-cutting hygiene | `lib/snapshot-*`, `lib/narrative.cjs`, `lib/teachings-reader.cjs`, `lib/task-registry-writer.cjs` (read), `scripts/generate-daily-tip.mjs`, `references/**`, `docs/**`, `.planning/notes/**`, `SOUL.md`, `CLAUDE.md`, memory under `~/.claude/projects/*/memory/` | `bin/gad.cjs` (runtime sections), `lib/runtime-*`, `lib/secrets-*`, `lib/env-cli.cjs`, `lib/scoped-spawn.cjs` |
| **codex** | Runtime, CLI harness, verify, selection/pipeline | `bin/gad.cjs`, `bin/gad-config.cjs`, `bin/gad-tools.cjs`, `bin/gad-mcp.cjs`, `lib/runtime-*`, `tests/runtime-*`, `tests/verify-*`, `workflows/settings.md` | `lib/snapshot-*`, `lib/secrets-*`, `lib/env-cli.cjs`, site apps |
| **cursor** | BYOK/secrets, env plumbing, editor UI polish | `lib/secrets-*`, `lib/env-cli.cjs`, `lib/scoped-spawn.cjs`, `lib/keychain/**`, `lib/envelope.cjs`, `lib/kdf.cjs`, `tests/secrets-*`, `tests/env-cli*`, `tests/scoped-spawn*`, `references/byok-design.md`, React/TSX UI under `apps/portfolio/`, `site/` | `bin/gad.cjs`, `lib/runtime-*`, `lib/snapshot-*` |
| **gemini** | Research, cross-project synthesis, large-context docs passes, UI/site client work (pending explicit split with cursor) | `apps/**` (client apps), `site/**` content + copy, `docs/**`, `.planning/notes/**`, large-read summaries | `bin/gad.cjs` (runtime sections), `lib/runtime-*`, `lib/secrets-*`, `lib/env-cli.cjs`, `lib/snapshot-*`, `lib/handoffs.cjs` (read-only ok; mutations via CLI) |
| **opencode** | NEW (provisional, 2026-04-18) — narrative/docs hygiene, isolated new files only | `lib/narrative-linter.cjs` (NEW), `references/narrative-shape.md` (NEW), `references/soul-shape.md` (NEW), `tests/narrative-linter.test.cjs` (NEW), `.planning/notes/**` (own files only) | EVERYTHING under `bin/`, all of `lib/` except files explicitly listed above, `lib/runtime-*`, `lib/secrets-*`, `lib/snapshot-*`, `lib/handoffs.cjs`, `apps/**`, `site/**` until lane widens after first successful handoff |
| **general-purpose subagent** | Mechanical work dispatched by a primary | Scoped per invocation — inherits spawning agent's lane | Same deny list as spawning agent |

When a new runtime joins (e.g. OpenCode, another Gemini instance), add a
row here BEFORE it starts work. Start conservative on allow globs; widen
as the runtime proves reliable on a few handoffs.

If **gemini and cursor both target `site/**` / `apps/**`** work:
temporarily subdivide — gemini on copy + content + docs compile, cursor
on BYOK + interactive UI + editor surfaces. File cross-lane handoffs
freely instead of silent edits; collision playbook (below) handles
races.

## Shared-write protocols

Files multiple lanes append to:

| File | Protocol |
|---|---|
| `.planning/TASK-REGISTRY.xml` | **CLI-mediated only** — `gad tasks add / claim / release`. Never hand-edit. Gap: no `gad tasks update --goal` yet (filed 63-06). |
| `.planning/ROADMAP.xml` | **CLI-mediated only** — `gad phases add`. Gap: doesn't sync TASK-REGISTRY container (filed 63-06). |
| `.planning/STATE.xml` | **Primary owner:** active-lane agent. `next-action` belongs to whoever holds the session's active phase. Others propose via handoff queue or note — never direct edit. |
| `.planning/DECISIONS.xml` | **CLI-mediated** via `gad decisions add`. Any agent appends; none edit existing entries. |
| `.planning/.gad-log/*.jsonl` | **Append-only, automatic** — every agent's CLI calls write here. Safe. |
| `.planning/.trace-events.jsonl` | **Append-only, automatic** — hook-driven. Safe. |
| `.planning/.gad-agent-lanes.json` | **CLI-mediated** via `gad tasks claim / release`. Represents currently claimed tasks across all lanes. |
| `.planning/sessions/*.json` | **Per-file, one-writer** — each session owns its file. No shared writes. |
| `.planning/notes/*.md` | **Per-file, one-writer** — create a new file, don't edit others' notes. |
| `.planning/handoffs/{open,claimed,closed}/*.md` | **Per-file, one-writer on create; move-semantics on claim/complete** — `fs.rename` lifecycle (task 60-09). |

## Collision playbook

1. **Before editing a non-owned file:** file a handoff (60-09) with
   `estimated_context` + brief goal. Operator or lane owner responds.
2. **If two lanes race on a shared-write file:** CLI path wins (atomic
   tmp+rename in `task-registry-writer.cjs`). Hand-edit collisions → latest
   writer wins; earlier writer re-applies.
3. **If a lane blocks on another's in-flight work:** file a handoff with
   `priority: high`; do NOT spin-wait in the same session. Dispatch to a
   different task until the block clears.

## Session-start etiquette

Every primary agent, on session open:

1. Read this file (or the top-level `AGENT-LANES.md` pointer if present).
2. Read `SOUL.md` at repo root (if present) — assume the voice.
3. Run `gad startup --projectid <id>` — prints state / roadmap / tasks / decisions.
4. Run `gad handoffs list --mine-first` — surface unclaimed handoffs targeted at your
   runtime. Claim one that matches your lane before picking a task:
   `gad handoffs claim <id>` → move to `claimed/`, then work, then
   `gad handoffs complete <id>` when done. (Until snapshot integration
   lands, `gad startup` does NOT surface the queue — you must list it
   explicitly. Tracked in `.planning/notes/2026-04-18-handoff-snapshot-integration.md`.)
5. Do NOT run `gad log show` first (memory: `feedback_startup_first`).

Subagent dispatch MUST include: *"Your lane is X per `references/agent-lanes.md`"*
in the prompt header, so the subagent inherits the correct allow/deny set.

## Soul assignment (future, task 63-03)

Operator assigns souls per project per user in user settings:

```json
// ~/.claude/gad-user.json
{
  "displayName": "Operator",
  "assignedSouls": {
    "get-anything-done": "kael",
    "global": "kael",
    "llm-from-scratch": "orin"
  }
}
```

Agents read this on startup and assume the mapped soul's voice for that project.

## Open questions (tracked, not blocking)

1. Does `general-purpose-subagent` ever get a distinct lane, or always inherit?
   Current policy: always inherit. Revisit if subagent fleets grow their own
   stable ownership (e.g. a perpetual eval-runner).
2. When a cross-lane edit becomes promoted — i.e. claude-code permanently
   takes over a file cursor used to own — how do we record the move?
   Recommend: decision-log entry (`gad decisions add`) referencing both lanes
   and the new row in the table above.
3. Per-phase lane overrides: during phase 44.5 (Project Editor), cursor
   temporarily owns `apps/planning-app/` UI surfaces. Today: informal, called
   out in phase goals. If this becomes frequent, add an "active overrides"
   section here and date-stamp each override.

## Related docs

- `.planning/notes/2026-04-18-handoff-queue-design.md` — handoff directory schema (60-09)
- `.planning/notes/skill-lane-taxonomy-2026-04-18.md` — skill dev/prod/meta split (distinct axis)
- `references/communication-style.md` — SITREP register used across all lanes
