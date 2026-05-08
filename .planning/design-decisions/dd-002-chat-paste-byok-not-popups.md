---
id: dd-002
title: "Stop spawning gad ask popups; use chat-paste BYOK"
problem: "gad ask was spawning a native OS dialog or terminal popup for every credential prompt, breaking non-interactive CI/agent sessions and annoying power users who already have keys."
reasoning: "Popups are anti-pattern for headless and agent contexts. The operator uses Kael (apps/desktop) as the primary BYOK surface; agent sessions already run with credentials in env vars. The popup path was added before the BYOK wiring existed — it is now dead weight."
fix: "Removed gad ask popup invocations from the curator and credential-check paths. Credential resolution falls back gracefully to env var absence (no-op / skip-push) rather than interrupting the process."
principle: "Never spawn interactive UI from a daemon or agent-driven CLI path. Prefer graceful degradation (skip-if-no-creds) over blocking prompts."
refs: ["GLOBAL-D-322","vendor/get-anything-done/bin/commands/ask.cjs","vendor/get-anything-done/lib/datasets/remote-supabase.cjs"]
status: live
created_at: 2026-05-08T00:00:00Z
---

# Stop spawning gad ask popups; use chat-paste BYOK

## Problem

`gad ask` was triggering a native dialog (or pty prompt) during daemon tick when credentials
were absent. In agent/CI contexts there is no tty — the spawn hung or produced garbled output.
Even in interactive terminals it was disruptive: the curator daemon would block mid-tick waiting
for user input while unrelated work was proceeding.

## Reasoning

The BYOK surface (Kael desktop + encrypted env vars) is now the canonical credential entry path
(decision GLOBAL-D-xxx). The `gad ask` popup predates that wiring and has no place in daemon-
or agent-driven code paths. Credentials either exist in the environment or they don't — the
correct response to absence is a logged skip, not a blocking prompt.

## Fix

- `lib/datasets/curator.cjs`: `auto-push` mode checks `hasCredentials()` from each remote
  module; if neither returns true, logs a one-time skip notice and continues without push.
- `bin/commands/ask.cjs`: interactive path gated behind an explicit `--interactive` flag;
  non-interactive callers get an empty/null response instead of a prompt.

## Related

- Decision GLOBAL-D-322 (design-decisions corpus)
- `vendor/get-anything-done/bin/commands/ask.cjs`
- `vendor/get-anything-done/lib/datasets/remote-supabase.cjs`
