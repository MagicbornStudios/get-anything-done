# Agent Lane Manifest — draft (task 63-04) — 2026-04-18

This is the **first pass** proposal for file/directory ownership across parallel agent runtimes. Operator reviews, edits, and promotes to `references/agent-lanes.md` (or repo-root `AGENT-LANES.md`) as canonical.

Driven by the 2026-04-18 three-agent post-mortem (Claude snapshot work, Codex runtime+verify, Cursor BYOK error-split) which showed ~20% of multi-agent turn time lost to attribution confusion and orientation-from-logs.

## Core principle

> **A file has exactly one primary lane owner. Cross-lane edits are the exception, announced via handoff queue (60-09), never silent.**

Shared aggregate files (TASK-REGISTRY.xml, STATE.xml) are always CLI-mediated — no agent edits them directly.

## Runtime lane table

| Runtime | Primary lane | Owns (allow globs) | Touches NOT (deny globs) |
|---|---|---|---|
| **claude-code** | Planning, docs, snapshot, cross-cutting hygiene | `lib/snapshot-*`, `lib/narrative.cjs`, `lib/teachings-reader.cjs`, `lib/task-registry-writer.cjs` (read), `scripts/generate-daily-tip.mjs`, `references/**`, `docs/**`, `.planning/notes/**`, `SOUL.md`, `CLAUDE.md`, all memory under `~/.claude/projects/*/memory/` | `bin/gad.cjs` (runtime sections), `lib/runtime-*`, `lib/secrets-*`, `lib/env-cli.cjs`, `lib/scoped-spawn.cjs` |
| **codex** | Runtime, CLI harness, verify, selection/pipeline | `bin/gad.cjs`, `bin/gad-config.cjs`, `bin/gad-tools.cjs`, `bin/gad-mcp.cjs`, `lib/runtime-*`, `tests/runtime-*`, `tests/verify-*`, `workflows/settings.md` | `lib/snapshot-*`, `lib/secrets-*`, `lib/env-cli.cjs`, site apps |
| **cursor** | BYOK/secrets, env plumbing, editor UI polish | `lib/secrets-*`, `lib/env-cli.cjs`, `lib/scoped-spawn.cjs`, `lib/keychain/**`, `lib/envelope.cjs`, `lib/kdf.cjs`, `tests/secrets-*`, `tests/env-cli*`, `tests/scoped-spawn*`, `references/byok-design.md`, React/TSX UI surfaces under `apps/portfolio/` + `site/` | `bin/gad.cjs`, `lib/runtime-*`, `lib/snapshot-*` |
| **general-purpose subagent** | Bulk mechanical tasks dispatched by any primary | Scoped per invocation — lane inherited from spawning agent | Same deny list as spawning agent |

## Shared-write protocols

Files multiple lanes append to:

| File | Protocol |
|---|---|
| `.planning/TASK-REGISTRY.xml` | **CLI-mediated only** — `gad tasks add / claim / release`. Never hand-edit. Gap: no `gad tasks update --goal` yet (filed 63-06). |
| `.planning/ROADMAP.xml` | **CLI-mediated only** — `gad phases add`. Gap: doesn't sync TASK-REGISTRY (filed 63-06). |
| `.planning/STATE.xml` | **Primary owner:** active-lane agent. `next-action` belongs to whoever currently holds the session's active phase. Others do NOT edit — they propose via handoff queue or note. |
| `.planning/DECISIONS.xml` | **CLI-mediated** via `gad decisions add`. Any agent can add; none can edit existing. |
| `.planning/.gad-log/*.jsonl` | **Append-only, automatic** — every agent's CLI calls write here. Safe. |
| `.planning/.trace-events.jsonl` | **Append-only, automatic** — hook-driven. Safe. |
| `.planning/.gad-agent-lanes.json` | **CLI-mediated** via `gad tasks claim / release`. File represents current claimed-task state across all lanes. |
| `.planning/sessions/*.json` | **Per-file, one-writer** — each session owns its own file. No shared writes. |
| `.planning/notes/*.md` | **Per-file, one-writer** — create new file, don't edit others' notes. |
| `.planning/handoffs/open/*.md` (future 60-09) | **Per-file, one-writer on create; move-semantics on claim/complete** — fs.rename lifecycle. |

## Collision playbook

1. **Before editing a non-owned file:** announce in a handoff (60-09) with `estimated_context` + brief goal. Operator or lane owner responds.
2. **If two lanes race on a shared-write file:** the CLI path wins (atomic tmp+rename in `task-registry-writer.cjs`). If hand-edits collide, the latest writer wins; earlier writer must re-apply.
3. **If a lane blocks on another's in-flight work:** file a handoff with `priority: high`; do NOT wait in the same session. Dispatch to a different task until unblocked.

## Session-start etiquette

Every primary agent, on session open:

1. Read this manifest (or the promoted canonical).
2. Read `SOUL.md` at repo root (if present) — assume the voice.
3. Run `gad startup --projectid <id>` (or `gad start` per phase 59) — picks up handoffs, last-active project, user settings.
4. Do NOT run `gad log show` first (memory: `feedback_startup_first`).

## Soul assignment (future, via 63-03)

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

Agent reads this on startup and assumes the mapped soul's voice for that project.

## Open questions (for operator review)

1. Should `general-purpose-subagent` have a distinct lane or always inherit? (Draft proposes inherit.)
2. How do we handle a 4th runtime arrival (e.g. Gemini, OpenCode)? — recommend: assign a lane, document deny/allow, update manifest.
3. When does a cross-lane edit become "promoted" — i.e. Claude keeps a file Cursor used to own? — recommend: PR-style announcement in decisions log.
4. Do we want per-phase lane overrides? E.g. during phase 44.5 (editor), Cursor temporarily owns `apps/planning-app/`.

## Promotion path

Once operator approves + edits:
- Move this file to `references/agent-lanes.md` (framework-canonical) OR repo-root `AGENT-LANES.md` (monorepo-wide).
- Link from `CLAUDE.md` mandatory-read on session start.
- Same pointer in AGENTS.md / opencode.md / codex config when/if those runtimes arrive.
- Every subagent dispatch includes "Your lane is X per `references/agent-lanes.md`" in the prompt header.
