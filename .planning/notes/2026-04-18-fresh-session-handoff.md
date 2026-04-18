# Fresh-session handoff — 2026-04-18

Operator is ending the day tired. Tomorrow's agent should start here.

## Orient in 60 seconds

```sh
gad startup --projectid get-anything-done
```

Do NOT run `gad log show` or do any exploratory grep first. Snapshot
gives you state + roadmap + tasks + decisions in one call. See
memory `feedback_startup_first`.

## What shipped in session S18–S19

Three commits in vendor, one bump in monorepo:

| Commit | Scope |
|---|---|
| `d3cfce1` | 60-05a — `gad env audit` + `gad env purge` + auto-purge preflight on `gad start`. New `lib/startup-purge.cjs`. |
| `661fe95` | 59-09 planning docs — task-registry + STATE updates for the drawer timeline (TSX was in the monorepo). |
| `c6c1b11` | 59-10 — `gad tasks add/promote/stalled` + `gad next` + `lib/task-registry-writer.cjs`. CLI efficiency cluster. |
| (monorepo) `d18a65c` | 59-09 — `apps/planning-app/app/my-projects/SubagentRunHistory.tsx` flesh-out + two todos. |
| (monorepo) `d1a72c8` | Bump get-anything-done submodule pointer. |

Phase 59 CLOSED. New CLI surface available via `node vendor/get-anything-done/bin/gad.cjs …` (installed `gad.exe` is still v1.33.0 pre-ea1ad32).

## First action of the day — operator hand

Operator needs to run this themselves (binary write to
`%LOCALAPPDATA%\Programs\gad\bin\gad.exe`):

```sh
cd vendor/get-anything-done && gad install
gad --version  # expect v1.33.x with narrative + env audit/purge + tasks add in USAGE
```

Agent should ask / confirm this is done before exercising the new CLI.

## Then pick one of three tracks

### Track 1 — 60-07 Project Editor BYOK tab
Phase 44.5 entry point. Operator's stated focus. Uses the `gad env`
family shipped in 60-05a (dev-server command bridge). Local-dev only,
NODE_ENV=development gate.

### Track 2 — drain the todo backlog
45 todos in `vendor/get-anything-done/.planning/todos/` never became
tasks. Now that `gad tasks promote` exists, walk them and either
promote to a real task or archive as decisions / cancellations. One
pass at a time, operator-in-loop.

### Track 3 — phase 42.4 Context Framework as catalog type
Sprint 9 head task. Introduces `ContextFramework` as a first-class
catalog content type alongside skills/agents/commands/workflows/tech-stacks.

## Hygiene reminders (pinned to memory, but stated here once)

- **Parallel agents active** on runtime substrate / CLI harness /
  skill promotion. Unexpected changes in vendor tree are likely the
  other agent's WIP — verify before "fixing." Memory:
  `project_parallel_agent_work`.
- **602 pre-existing test failures** in vendor — spawn / agent-skills
  / codex / worktree-cleanup clusters — are the other agent's WIP,
  NOT mine. Run surgical tests (`node --test tests/<my-file>`), never
  the full suite unless specifically validating a regression.
- **No ScheduleWakeup in active sessions** — use Monitor or
  run_in_background Bash. ScheduleWakeup produced stale self-prompts
  twice this session.
- **Offload to cheaper models** — default Haiku/Sonnet for subagent
  dispatch + mechanical work. Opus only for genuine reasoning.

## Outstanding todos at monorepo root

- `.planning/todos/2026-04-18-trace-events-volume-audit.md` — verbose
  schema, uncertain consumer value. Agent-doable audit task.
- `.planning/todos/2026-04-18-gad-tasks-add-cli-gap.md` — RESOLVED by
  59-10 this session but the file still sits in /todos. Can be
  archived / deleted.
- `.planning/todos/2026-04-18-retire-vendor-repub-builder.md` —
  gated on upstream v0.1.0 tag + book consumer verification.
  Operator-driven.
- `.planning/todos/2026-04-18-runtime-substrate-integration.md` —
  parallel agent's file. Do not touch without coordination.
- `.planning/todos/2026-04-17-context-hygiene-cursor-skills.md` —
  verification-side todo (operator tests in fresh Cursor instance).

## Soul check

Active soul is Kael of Tarro (CLAUDE.md). Issue / Carry / Return /
Reconcile maps onto the GAD loop. SOUL.md is a pointer — do not
auto-load the narrative body into coding sessions.
