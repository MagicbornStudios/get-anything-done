---
id: h-2026-05-13T14-03-07-get-anything-done-75
projectid: get-anything-done
phase: 75
task_id: GAD-T-75-27
created_at: 2026-05-13T14:03:07.049Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: design
risk: safe
time: deep
surface: local
runtime_preference: claude-code
runtime_fallbacks: ["codex-cli","gemini-cli"]
---
# Windows runtime multiplexer — kill console popups permanently

## Background
Operator 2026-05-13 reported "constant Windows process popups". Audit (monorepo CLAUDE.md context, vendor lib/runtime-launch.cjs:88 onward) traces the dominant source to `launchRuntimeInNewShellWindows` — every `gad runtime launch` without `--same-shell` spawns a detached PowerShell with `-NoExit` and `windowsHide:false`. Surgical env override shipped (1ea28407 submodule, c30c81b5 monorepo) but the design is still per-runtime-detached-window.

## Goal
Replace the detached-PowerShell-per-runtime pattern with a long-lived multiplexer: one parent process owns all runtime children via piped stdio (Windows ConPTY where interactive output is needed; plain pipes otherwise). The dispatcher and `gad team` workers already use windowsHide:true, so this primarily affects `gad runtime launch` and any other one-off dispatch path.

## Reference: apps/desk already solves this for terminals
`apps/desk/src-tauri/src/pty.rs` wraps `portable-pty` which on Windows uses ConPTY. Multi-tab terminals coexist invisibly inside one Tauri window. Same primitive applies: a `gad runtime mux` daemon could own N ConPTY children and expose them via a local socket / named pipe for status + IO.

## Acceptance gate
- [ ] Design doc landed at `vendor/get-anything-done/.planning/notes/<date>-runtime-multiplexer-design.md` covering: process tree, IPC channel, lifecycle (start/restart/cleanup), session attach/detach UX, fallback for non-Windows.
- [ ] `lib/runtime-launch.cjs` updated to delegate to the multiplexer when available; `launchRuntimeInNewShellWindows` becomes a legacy fallback (deprecation comment, not deleted).
- [ ] Smoke: dispatch a codex + gemini + opencode runtime concurrently → zero new console windows on Windows. Output still reaches caller (visible to operator via attach command or via apps/desk panel).
- [ ] No regression in `gad team` workers (they already use windowsHide:true via lib/team/spawn.cjs).
- [ ] One short note added to vendor CLAUDE.md or AGENTS.md explaining the new path.

## Out of scope
- Cross-platform (mac/linux) — POSIX shells don't have this problem, target Windows only.
- apps/desk integration UI — that's a downstream phase (184 has 'process manager' bullet already).
- Replacing `gad team` worker model — workers stay as-is.

## Notes for the lane
The operator framed it as 'tmux for Windows'. Conceptually right. Implementation likely: `lib/runtime-mux/` package + `gad runtime mux start|status|attach|stop` CLI. Heartbeat + auto-respawn similar to `gad team dispatcher`.