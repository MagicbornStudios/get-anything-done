# Phase 63 — Discuss Round Output

**Phase:** 63 Agent/state/session hygiene
**Project:** get-anything-done
**Mode:** manual execution of `gad-discuss-phase` workflow (Skill tool invocability cached pre-unflag, could not invoke directly; executed by reading workflow + following its core logic)
**Date:** 2026-04-22
**Operator:** B2Gdevs

## Phase goal (from ROADMAP.xml, unchanged)

Consolidate scattered state/log writes across `.omx/`, `.planning/`, team-state, hud-state; land session-continuity contract so "let's continue" works without orientation cost; scaffold non-checked-in user settings (machine-name default + assigned soul); author canonical agent-lane manifest so parallel agents (claude/codex/cursor) have clear file ownership; wire daily tip + soul reference into session-open surface.

Driven by 2026-04-18 post-mortem: 3-agent parallel session lost ~15% of Claude turn to stash incident and ~20% to orientation-from-logs instead of handoff pickup.

**Depends on:** phase 60 (BYOK + scoped secrets).

---

## SCOPE ALIGNMENT FINDING — phase 63 is overloaded

Between 2026-04-20 and 2026-04-22 approximately 30 tasks were registered under phase 63. A re-read of the phase goal shows only a subset actually belongs there:

### IN-SCOPE (session-continuity + agent coordination)
| task | fits phase goal? |
|---|---|
| 63-13 — split STATE.xml next-action to per-session JSON | **yes** — session-continuity contract |
| 63-18 — dispatch-infra argv malformation on Windows bundled binary | **yes** — agent coordination / dispatch |
| 63-19 — worker-loop body-loading (claimHandoff returns string) — DONE | **yes** |
| 63-20 — drop AI-written heartbeat anti-pattern | **yes** — agent coordination |
| 63-21 — gad team Windows detached-spawn bug + status.json | **yes** — agent coordination / dispatch |
| 63-22 — GAD TUI workers liveness panel + subprocess watchdog | **yes** — session-open surface |
| 63-23 — TUI never refuses to start (stale router lockfile) | **yes** — session-open surface |
| 63-24 — per-project router scoping audit | **yes** — per-project infra |
| 63-25 — unified workspace TUI view across projects | **yes** — session-open surface |
| 63-26 — TUI ctrl+n title crash defensive fix | **yes** — session-open surface |
| 63-27 — TUI ctrl+n layout reflow fix | **yes** — session-open surface |
| 63-31 — PostToolUse Skill hook for auto-attribution | **borderline** — agent coordination (stamping) |
| 63-32 — snapshot per-phase recommended skills | **borderline** — session-open surface |

### OUT-OF-SCOPE (distribution / install / build)
| task | proposed home |
|---|---|
| 63-28 — plugin manifests for Claude/Cursor/Gemini/Codex/Opencode | **new phase (distribution + install architecture)** |
| 63-42 — GSD marketplace abandonment investigation | same |
| 63-43 — GitHub Releases pipeline end-to-end | same |
| 63-44 — install.js monolith refactor to one-file-one-concern | same |
| 63-47 — delete stale SEA + npx references — DONE | was cleanup, keep under 63 as close-out hygiene |
| 63-48 — wire gad-tui.exe into CI release workflow | new distribution phase |
| 63-49 — collapse Surface 1 install paths | new distribution phase |
| 63-50 — unify gad.exe + gad-tui.exe into single binary | new distribution phase |
| 63-51 — rename /gad-update → /gad-framework-update + /gad-cli-update | new distribution phase |
| 63-52 — unify v* vs desktop-v* tag convention | new distribution phase |
| 63-53 — retire TASK-REGISTRY.xml dual-write | **new phase (planning-schema hygiene)** or keep under 63 |
| 63-54 — `gad graph build` help text update — DONE | same (tiny task, could stay or move) |

### OUT-OF-SCOPE (skills catalog cleanup) — MANY OF THESE ARE DONE
| task | home |
|---|---|
| 63-29 — skills audit — DONE | belongs under **phase 42.5 or new skills-hygiene phase** |
| 63-33 — re-verify COLLAPSE verdicts — DONE | same |
| 63-34 — superpowers deep review — DONE | same (or distribution phase) |
| 63-35 — fold gad-cleanup → gad-complete-milestone — DONE | skills-hygiene |
| 63-36 — delete gad-migrate-schema — DONE | skills-hygiene |
| 63-37 — keep gad-milestone umbrella (dispatcher) | skills-hygiene |
| 63-38 — rename gad-eval-spawn → gad-generation-spawn — DONE | skills-hygiene |
| 63-39 — fold gad-pause/resume-work into gad-handoffs — DONE | skills-hygiene |
| 63-40 — vocabulary refresh pass — DONE | skills-hygiene |
| 63-41 — delete gad-auto-conventions — DONE | skills-hygiene |
| 63-45 — extend `gad tasks update` flags | **infra/CLI (own phase or 63-ish)** |
| 63-46 — install/update review — DONE | supersedes / feeds distribution phase |

---

## PROPOSED PHASE SPLIT

| proposed phase | scope | tasks |
|---|---|---|
| **Phase 63** (keep, unchanged goal) | agent/state/session hygiene | 63-13, 63-18, 63-20, 63-21, 63-22, 63-23, 63-24, 63-25, 63-26, 63-27, 63-31, 63-32 |
| **Phase 65** (new) — "Distribution + install architecture" | plugin manifests, GitHub Releases pipeline, install.js refactor, unify binaries, /gad-update split, tag convention | 63-28, 63-42, 63-43, 63-44, 63-48, 63-49, 63-50, 63-51, 63-52 |
| **Phase 42.5** (new) or under existing 42.4 — "Skills catalog hygiene" | audit, re-verify, folds, renames, vocabulary refresh | 63-29, 63-33, 63-34, 63-35, 63-36, 63-37, 63-38, 63-39, 63-40, 63-41 (most DONE) |
| **Phase 66** (new) or absorb into 63 — "Planning-schema hygiene" | retire XML dual-write, schema migrations | 63-53, 63-54 |

---

## GRAY AREAS FOR PHASE 63 (actual in-scope decisions to capture)

These are decisions the operator needs to weigh in on before planning phase 63. Each has recommended defaults — operator can accept or override.

### G1 — State-write consolidation target

Today state is scattered across:
- `.omx/state/current-task-baseline.json`
- `.omx/state/hud-state.json`
- `.omx/state/notify-hook-state.json`
- `.omx/state/ralph-state.json`
- `.omx/state/skill-active-state.json`
- `.omx/state/team-state.json`
- `.omx/state/tmux-hook-state.json`
- `.planning/sessions/s-*.json`
- `.planning/team/supervisor.log.jsonl`
- `.planning/team/dispatcher.log.jsonl`
- `.planning/team/workers/<w>/log.jsonl`
- `.planning/.trace-events.jsonl`
- `.planning/.gad-log/*.jsonl`

**Decision:** consolidate into `.planning/session-state/<session-id>.json` OR keep decoupled with a unified READ surface (`gad state show` pulls from all of them) OR move all OMX state into `.planning/.omx/` under the planning root?

**Recommended default:** keep storage decoupled (OMX owns its files, gad team owns its files), but add a unified `gad state inspect` command that renders a dashboard across all sources. Rationale: OMX is a separate tool per memory `project_omx_is_operators_tool` and shouldn't be forcibly merged.

### G2 — Session-continuity contract

When an agent returns to a session (explicit `gad startup --session <id>` OR a fresh `gad startup` after context compact), they need to pick up without re-orienting from logs. What minimum state brings them back?

**Options:**
- (A) `.planning/sessions/<id>.json::next_action` field — plain text next step. Agent reads, proceeds.
- (B) A `.planning/sessions/<id>/HANDOFF.md` sibling file with structured pickup (current task id, branch, open questions, last tool call).
- (C) Rely on handoff queue — every session break writes a handoff, every session start claims one.

**Recommended default:** (A) + (C). Next-action is the 1-line orienting hook; handoff queue is the durable work-transfer. No new HANDOFF.md file.

### G3 — Agent-lane manifest shape + location

Per 2026-04-18 post-mortem, parallel agents stepped on each other. Need a canonical "who edits what" doc.

**Options:**
- (A) `AGENTS.md` at repo root declares lanes (claude = planning, codex = TUI+CLI, cursor = UI). Referenced by every runtime's session-open hook.
- (B) Per-agent manifest files: `.agents/claude.lane.md`, `.agents/codex.lane.md`, etc.
- (C) Single `vendor/get-anything-done/references/agent-lanes.md` (already exists per CLAUDE.md) with file-ownership matrix.

**Recommended default:** (C) + cross-ref from AGENTS.md at repo root. `references/agent-lanes.md` is the canonical — just ensure it's up to date and AGENTS.md at root points to it.

### G4 — User settings scaffold location

Settings that vary per operator machine (machine name, active soul, per-runtime preferences) — where do they live?

**Options:**
- (A) `~/.gad/settings.toml` — user-global, applies across all projects
- (B) `.gad/settings.local.json` at repo root — per-project, gitignored
- (C) Both — global defaults at (A), per-project overrides at (B)

**Recommended default:** (C). Global `~/.gad/settings.toml` for user identity (machine name, assigned soul, model profile defaults); project-local `.gad/settings.local.json` for per-project overrides (active runtime for this repo, project-specific soul swap). Gitignore the local one.

### G5 — Daily tip + soul reference wiring

`gad startup` / `gad snapshot` should surface the day's teaching + active soul. Where do they fire?

**Options:**
- (A) SessionStart hook (Claude Code / Cursor) reads gad teachings + SOUL.md and injects into prompt.
- (B) `gad startup` CLI command prints them verbatim at the top of session-open output.
- (C) Both — hook injects (for agent context), CLI prints (for operator visibility).

**Recommended default:** (C). Hook for agent context injection; CLI print for operator visibility on session open.

### G6 — `.omx/` directory ownership

`.omx/` is the operator's oh-my-codex workflow layer (per memory `project_omx_is_operators_tool`). Gad shouldn't write there directly.

**Decision:** confirm `.omx/` is read-only for gad + claude-code lane; only OMX and codex runtimes may write there. Add a gad guardrail: `gad state log` refuses to write anything under `.omx/`.

**Recommended default:** yes, enforce read-only for non-codex agents.

---

## DEFERRED IDEAS (surfaced during discuss but out of scope)

Operator may want to split these into their own phases:
- **Phase 65** distribution/install architecture — 9 tasks pending
- **Phase 42.5** skills catalog hygiene close-out — most tasks DONE this session, a few remain
- **Phase 66** planning-schema hygiene — XML retirement, schema migrations
- **Rubrics/scoring discussion** — flagged 2026-04-22, never had its own discuss round — separate phase

---

## SUCCESS CRITERIA FOR PHASE 63

Phase 63 is done when:
1. `gad startup --session <id>` brings an agent to a working state in < 5 tool calls (no "read 10 files to orient")
2. Three parallel agents (claude / codex / cursor) can work on the same repo simultaneously without file conflicts — verified by actually running the scenario
3. `gad state inspect` renders a unified view of session + team + omx state
4. `gad startup` output includes daily tip + active soul reference (per G5)
5. Per-operator settings load cleanly from `~/.gad/settings.toml` + `.gad/settings.local.json`
6. TUI bugs 63-23/26/27 resolved; TUI launches reliably
7. Team dispatch bug 63-21 resolved; `gad team start` works on Windows with non-cwd projectids
8. Handoff + resume protocol (absorbed from gad-pause/resume-work into gad-handoffs) is the ONE canonical session-break mechanism — no `.continue-here` anywhere

---

## NEXT STEPS (operator action)

Before planning can begin, operator needs to:

1. **Confirm or override the phase split** — most important decision. Does distribution go to phase 65? Skills hygiene to 42.5? Or keep it all under 63?
2. **Answer G1–G6** — defaults shown, override if different intent.
3. **Decide on rubrics/scoring thread** — separate phase (e.g. phase 67) or fold into an existing one?

Once answered, `gad plan-phase 63` can run against a correctly-scoped task list.
