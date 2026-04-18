# 63-02 session-continuity implementation plan — 2026-04-18

Ready to execute immediately after 60-09 (handoff queue CLI) lands.
Goal: `<1 tool call to restored context` on session open.

## Inputs available

| Source | What it gives us | Status |
|---|---|---|
| `lib/user-settings.cjs` (63-03) | lastActiveProjectid, displayName, assignedSouls | DONE |
| `lib/handoffs.cjs` + `gad handoffs` CLI (60-09) | list/claim/complete/show/create + mine-first filter | in flight |
| `~/.claude/hooks/gad-session-state.sh` (63-05) | SessionStart hook emitting soul + teaching | DONE |
| `gad startup`, `gad snapshot` (existing) | full context bundle given a projectid | DONE |

## Five moving parts (verbatim from 63-02 goal)

| # | Contract | Where it lives |
|---|---|---|
| a | Claude session pause writes handoff file | `gad handoffs create` (60-09) or direct author-written `.md` |
| b | User settings stores last-active-projectid | `setLastActiveProjectid` (63-03) |
| c | Session open auto-invokes `gad handoffs list --unclaimed --mine-first` + `gad snapshot --projectid <last-active>` | `gad start` command or SessionStart hook |
| d | If exactly one unclaimed handoff matches runtime, auto-claim | `gad start` logic |
| e | SessionStart hook surfaces "N unclaimed handoffs — /pickup to resume" | `~/.claude/hooks/gad-session-state.sh` |

## Execution steps (after 60-09 lands)

1. **Extend `gad startup` (or add `gad start`)** — Codex lane, bin/gad.cjs:
   - Read `lastActiveProjectid` via `require('../lib/user-settings.cjs').getLastActiveProjectid()`
   - If `args.projectid` not supplied, fall back to lastActiveProjectid
   - At end: persist current projectid via `setLastActiveProjectid(resolvedProjectid)`
   - Call `listHandoffs({ bucket: 'open', projectid: resolvedProjectid, mineFirst: true, runtime })` at end
   - If exactly one handoff matches runtime preference (e.g. `claude-code`), emit: `Auto-claim candidate: <handoff-id> — run: gad handoffs claim <id>`
   - If zero matches, emit nothing special
   - If 2+, emit the count

2. **Extend SessionStart hook** — claude-code lane, `~/.claude/hooks/gad-session-state.sh`:
   - After the soul/teaching lines, if `gad handoffs list --unclaimed --projectid <x> --mine-first --json` exists, emit one line per matching handoff (cap 3, with `+N more` overflow).
   - Stay <15 lines total output.
   - Gate: only if `command -v gad` AND `gad handoffs --help >/dev/null 2>&1` (so stale binaries stay silent).

3. **Add `gad pause-work` / `gad session pause`** — existing skill at `skills/gad-pause-work/` — wire up to call `createHandoff()` with operator-supplied goal + current phase/task. Lives in a new subcommand or as a shell-out from the skill methodology.

4. **Integration test** — `tests/session-continuity.test.cjs`:
   - Seed a fake `~/.gad/user.json` with `lastActiveProjectid: 'x'`
   - Seed `.planning/handoffs/open/h-foo.md` with matching runtime
   - Assert: `gad startup` without `--projectid` resolves to 'x', emits "1 unclaimed handoff", auto-claim pointer visible
   - Assert: after second `gad startup`, `lastActiveProjectid` still 'x' (idempotent)

## Split ownership

Per agent-lanes.md:

| Step | Primary owner | Rationale |
|---|---|---|
| 1 (gad startup extension) | codex | bin/gad.cjs runtime + startup is codex lane |
| 2 (SessionStart hook) | claude-code | `~/.claude/hooks/` is claude-code lane |
| 3 (gad pause-work CLI) | codex | bin/gad.cjs subcommand — codex lane |
| 4 (integration test) | claude-code | test surface across both, sits on modules claude-code owns |

Claude-code files a handoff against steps 1 and 3 for Codex to pick up, rather than cross-lane editing.

## Metrics

Baseline 2026-04-18: ~35% of Claude turn on orientation (archaeology + /gsd:update + projectid guessing). Target: 1 tool call (`gad startup` with no args) → full context, auto-surfaced pickup pointer.

## Open questions

1. Should `gad startup` auto-run `gad handoffs claim` when exactly one matches (d), or just *surface* the claim pointer? Safer: surface only, let operator/agent run claim. Auto-claim races with other idle agents.
2. How is runtime detected? `process.env.GAD_RUNTIME` set by install.js per runtime, or inferred from cwd `.claude/` vs `.codex/` vs `.cursor/`? Today: runtime-detect already exists in `lib/runtime-detect.cjs` (codex lane) — use it.
3. Session-pause auto-write on context exhaustion: today manual. Could wire `gad-context-monitor.js` hook to autowrite when context >80%. Deferred — separate task.
