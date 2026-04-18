# Interactive `gad` TUI — discuss-phase seed (2026-04-18)

Operator intent, captured end-of-S20 for the next planning pass:

> "I really just need these agents to be on subprocesses and able to
> communicate back to their main agent. This whole CLI thing I have been
> wanting really is just an interactive entrypoint for the gad cli that
> is similar to all these other coding agent clis. Gemini and opencode
> having the best looking ones — just opencode has issues with windows
> stuff. The `mb_cli_framework` has TUI and if we can just get a new
> interactive face for the gad CLI and able to use other coding agent
> runtimes when I want to and manage the auth that would be good."

## What it is

A TUI shell invoked as `gad` (no subcommand, or `gad tui`) that gives the
operator a unified interactive face for:

- The existing `gad` planning CLI (startup / snapshot / handoffs / tasks / tip)
- Runtime dispatch — spawn claude / codex / cursor / gemini / opencode
  subprocesses under a single shell, pipe their output into TUI panes
- Auth — per-runtime login flows (claude login, codex auth, etc.) handled
  once, persisted to `~/.gad/user.json` or per-runtime config
- Multiple-instance safe — another terminal can run `gad` at the same time
  without locking the first

## Why

Today the operator bounces between 5+ terminal windows to run 3+ runtimes
plus the gad planning CLI. State lives in each terminal's scrollback.
Auth breaks silently across machines. OpenCode's Windows TUI is
particularly rough. A single GAD TUI that owns the dispatch, auth, and
view surface is the unification layer.

## Stack

- **TUI primitives**: `mb_cli_framework` (projectid `mb-cli-framework` per
  CLAUDE.md common ids). Already maintained in this monorepo.
- **Runtime adapters**: one subprocess manager per runtime. Each adapter
  exposes start/stop/send-prompt/read-output.
- **Auth**: wrap the runtime's native auth flow; persist tokens via
  BYOK subsystem (60-02 envelope encryption, 60-07b scoped bags).
- **State bridge**: `lib/handoffs.cjs` + `lib/user-settings.cjs` already
  give cross-session coordination. TUI reads same queue.

## Non-obvious constraints

1. **Non-blocking multi-terminal** — TUI must not take a file lock on
   `.planning/handoffs/` or `.planning/STATE.xml`. All writes via existing
   CLI-mediated paths (atomic tmp+rename). Already true in current code —
   don't regress.

2. **Windows first-class** — OpenCode's TUI fails on Windows. Whatever
   primitives mb_cli_framework uses must work cleanly in Git Bash, Windows
   Terminal, VS Code integrated terminal, and Cursor's integrated terminal.
   No ANSI-only assumptions.

3. **Runtime process tree** — subprocesses should NOT inherit ambient env.
   Route through `lib/scoped-spawn.cjs` (cursor's lane) so BYOK keys
   resolve per-scope, not from the operator's shell env.

4. **Standard view** — each runtime's output normalized to a shared
   message shape: `{ts, runtime, role, text, tool_calls?}`. The TUI renders
   the shared shape; per-runtime quirks (Claude's thinking blocks, Codex's
   shell echoes, etc.) are adapter concerns.

5. **Auth surface** — operator may want to rotate a key without killing
   running agents. Auth changes should propagate to new spawns only.
   Current running subprocesses keep their injected env.

## Dependencies (existing)

- `lib/handoffs.cjs` ✓ (60-09)
- `lib/user-settings.cjs` ✓ (63-03)
- `lib/scoped-spawn.cjs` ✓ (cursor-owned; used by scoped BYOK)
- BYOK encryption ✓ (60-02)
- mb_cli_framework TUI primitives — exists as separate project; needs
  review to confirm it has the widgets this needs (pane split, streaming
  text, input prompt, modal, status bar).

## Dependencies (need)

- Per-runtime adapters (claude, codex, cursor, gemini, opencode)
- Auth flow wrappers
- Subprocess lifecycle manager (start/stop/restart/stream)
- TUI pane layout — at minimum: status bar, runtime picker, conversation
  stream, input, handoff list / pickup shortcut

## Risks / open questions

- mb_cli_framework's current Windows story — does it use any libraries
  that break on Windows terminals?
- Runtime auth persistence — each runtime stores tokens differently
  (Claude uses keychain, Codex uses OAuth device flow, etc.). Unifying
  is non-trivial.
- How does the TUI compose with existing `gad startup` / `gad snapshot`
  output — pager pane, separate tab, status line?
- Does the TUI itself count as a "runtime" for lane purposes, or is it
  runtime-agnostic infrastructure?

## Proposed next step

Operator runs `gad discuss-phase --projectid get-anything-done` against
this note, with planner agent walking the eight open questions above,
producing `PLAN.md` with phased delivery:

- Phase 64.1: TUI primitive inventory (what does mb_cli_framework already
  ship?)
- Phase 64.2: Single-runtime spike (just Claude) proving the adapter +
  subprocess pattern
- Phase 64.3: Multi-runtime + auth unification
- Phase 64.4: Handoff queue + startup integration (the TUI becomes the
  native viewer for the handoff system already built)

Don't start phase 64 execution until discuss-phase closes its open
questions — implementation order is gated on mb_cli_framework's current
capability surface.

## When this phase opens

File as `gad phases add 64 --title "Interactive gad TUI entry point"
--goal "..."` on operator approval. This note becomes the discuss-phase
input document.
