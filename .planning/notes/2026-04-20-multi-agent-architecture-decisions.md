# Multi-agent architecture decisions — 2026-04-20

**Context:** One-day conversation 2026-04-20 where we (operator + claude-code) designed
the multi-agent orchestration system end-to-end. Decisions captured here so they
survive context compaction. All decisions flagged **D** are operator-ratified.

## D1 — Orchestration happens through `gad team`, never OMX CLI

Absorb OMX team/worker/mailbox pattern into gad. Rebrand under `.planning/team/`.
Never write `.omx/`. Never call `omx` CLI. All multi-agent actions surface as
`gad team <subcommand>`.

OMX vendored source stays at `vendor/claw-code/vendor/oh-my-codex/` as reference;
the MCP servers (state/memory/code-intel/trace/wiki) remain useful and stay
installed via `~/.codex/config.toml` until gad grows equivalent replacements.
Duplicate OMX skills in runtime `.claude/skills/` etc. already removed.

**See:** `.planning/notes/2026-04-20-gad-team-mailbox-design.md` for the full
team mailbox design.

## D2 — Handoffs are the atomic work lock. Task "claim" gets dropped.

`fs.rename(open/x.md → claimed/x.md)` is OS-atomic → only one worker wins the
rename when two race. That's the real serialization point. Work cannot
duplicate across workers.

Task-level pre-claim (today's `gad tasks claim <id>` which writes attribution
into TASK-REGISTRY.xml) is metadata, not a lock. It was solving the wrong
problem. **Drop pre-claim; keep post-completion attribution.** When a worker
finishes a handoff, it stamps `agent="team-wN" skill="..." runtime="..."` into
the task record. No race window: only one worker can finish a given task
because the handoff already serialized the work.

Consequence: we lose "who is currently working on X" from the registry. That
information now lives in `gad team status` (which worker is busy, on what
ref). The registry only records completions.

## D3 — Migrate TASK-REGISTRY.xml to per-task files

Single-file XML is the structural problem behind every multi-agent race. Per-file
layout (like `.planning/handoffs/` already uses) eliminates the races by design.

**Target:** `.planning/tasks/<task-id>.json` (or .md with frontmatter — to be
decided during implementation). Each file owns one task's full state.

**Migration is phased, safe to revert at each step:**

1. **Dual-write:** `gad tasks add/update` writes to BOTH TASK-REGISTRY.xml and
   per-task files. `graph-extractor.cjs` reads from both; per-task files win on
   conflict. No reader breaks.
2. **Reader cutover:** update `apps/planning-app/lib/planning-data.ts` and
   `site/scripts/build-site-data.mjs` to read via graph.json (already the right
   abstraction) instead of direct XML parse.
3. **Retire XML:** drop the dual-write, keep TASK-REGISTRY.xml as read-only
   legacy for one or two releases, then delete.

**graph.json remains the query surface.** It's already what planning-app's
graph panel and site's publishing pipeline consume. The XMLs are the write-
friction-dressed-as-source-of-truth. Per-task files + graph.json = clean.

## D4 — STATE.xml `<next-action>` moves to per-session file

`<state-log>` is append-only in practice — those writes are atomic enough for
multi-agent at typical churn rates. Keep it.

`<next-action>` gets overwritten every update — last-write-wins race. Move it
to `.planning/sessions/<session-id>.json::next_action` so it's per-agent. When
you want "what's the team's next move," derive from the most-recent session's
next_action, or from the dispatcher's log.

## D5 — DECISIONS / ERRORS / REQUIREMENTS / ROADMAP stay as single files

| File | Rationale |
|---|---|
| DECISIONS.xml | Append-only over time, 2092 lines, rarely edited after creation. O_APPEND is safe for line-sized writes. |
| ERRORS-AND-ATTEMPTS.xml | 58 lines, low churn. Not worth refactoring. |
| REQUIREMENTS.xml | Low churn. Not yet decided whether it's still canonical — audit later. |
| ROADMAP.xml | 439 lines, used by graph-extractor for phase structure. Audit whether we still need it as a central file vs reading from `.planning/phases/<id>/KICKOFF.md`. Not a today fix. |

## D6 — `gad snapshot` is the single orientation command; deprecate `gad startup`

startup today is essentially `snapshot --create-session`. We fold session
creation into snapshot (auto-create on first call of the day if no session
exists). startup becomes a documented alias for backward compatibility but the
canonical command is `gad snapshot --projectid <id>`.

**Snapshot's role clarified:**
- ✅ Cold-start context injection for a fresh agent session (primary use)
- ✅ Subagent / worker initial orientation (same reason)
- ✅ LLM training dataset (llm-from-scratch research)
- ❌ Live status refresh for the operator in an active conversation (use dashboard / gad-tui)

Operator comment: "I was using it like a Ralph Wiggum loop thing." That's the
wrong use — it didn't give new info between calls. The dashboard / TUI panel
is the right tool for live monitoring.

## D7 — Team worker loop: no .omx/, fs.watch for low-latency dispatch

Worker self-claim on idle tick (default 2s) handles most cases. For sub-second
handoff pickup, a separate `gad team dispatcher` daemon watches
`.planning/handoffs/open/` via `fs.watch` and assigns new handoffs to
mailboxes based on lane match + least-load. Latency ≤ 100ms on file-create.

Dispatcher is optional — if not running, workers still self-claim, just with
≤ 2s latency. The daemon is for operator convenience (and later, LLM training
signals on dispatch decisions).

## D8 — Per-worker runtime via `workers_spec`

A team can have mixed runtimes. `workers_spec: [{id, role, lane, runtime,
runtime_cmd}, …]` in `config.json`. Operator saves reusable shapes as
profiles (`.planning/team/profiles/<name>.json`), loads via
`gad team start --profile <name>`.

Runtime resolution precedence: env (`GAD_TEAM_RUNTIME_CMD`) > per-worker
runtime_cmd > team runtime_cmd > per-worker runtime default > team runtime
default.

## D9 — Lanes in both handoffs and worker spec

Workers declare `lane: "frontend"` etc. Handoffs can declare
`lane: "frontend"` in frontmatter. Self-claim + dispatch both filter via
`matchesLane(worker.lane, handoff.lane)`:
- worker.lane null → accepts anything
- handoff.lane null → any worker
- both set → case-insensitive equality

Lane vocabulary is free-form. Composes with existing
`references/agent-lanes.md` without coupling.

## D10 — One file = one concern, at both lib and command level

Enforced in M3.1 extraction:
- `lib/team/{paths,io,config,status,mailbox,lanes,profiles,lock,spawn,subprocess,prompt,worker-loop,dispatcher}.cjs` — each ≤ 150 LOC
- `bin/commands/team/{start,stop,status,enqueue,dispatch,work,tail,restart,profile}.cjs` — each ≤ 150 LOC
- `bin/commands/team.cjs` — thin aggregator, ≤ 50 LOC

New features go into their own files. Merge-conflict surface minimized for
parallel agent edits.

---

## Snapshot of current state (commit-ordered)

| Commit | Delivered |
|---|---|
| vendor `d4fd7195` | M1 — CLI skeleton, mailbox protocol, context autopause branch |
| vendor `dbb03236` | M2 — real spawn, worker loop, tail, restart |
| vendor `(current)` | M3.1-5 — extraction + profiles + per-worker runtime + lane filtering |
| vendor (pending) | M3.6 — dispatcher daemon with fs.watch |
| vendor (pending) | M3.7 — gad-tui Team panel |
| (tracked but deferred) | Per-task files migration (D3), STATE split (D4), startup deprecation (D6) |

## What a morning looks like after M3.6/M3.7

```
# Terminal 1 — main conversation with Claude
claude

# Terminal 2 — team mission control
gad tui                              # launches gad-tui with team panel active
  > /team start --profile default    # spawns workers, dispatcher daemon auto-starts
  > (watch the live log streams, hit `r` to restart a worker, etc.)
```

That's the full boot. Everything else is the team working on handoffs you
file naturally in Terminal 1.
