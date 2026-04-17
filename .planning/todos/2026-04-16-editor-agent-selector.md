# Multi-agent selector in the editor

**Date captured**: 2026-04-16
**Decision**: gad-228
**Related**: gad-170 (editor local-dev), gad-28 (TRACE.json runtime), gad-224 (contributor model)

## The idea

Operators typically have multiple coding agents installed locally (Claude Code,
OpenAI Codex, OpenCode, etc.). The Project Editor / Brood Editor must expose
a selector so the operator can pick which CLI runs a generation.

## Detection

On editor mount, run presence checks for known CLIs:

| Agent | Presence check |
|---|---|
| claude-code | `which claude` / `claude --version` |
| codex | `which codex` / `codex --version` |
| opencode | `which opencode` / `opencode --version` |
| cursor-agent | `which cursor-agent` |
| (future) | add as GAD starts supporting them |

Cache result per editor session. Disabled options are rendered greyed-out
with "not installed" tooltip.

## Selection precedence

1. Editor-level override (dropdown selection) — highest.
2. `gad-config.toml` `[editor].default_agent` — fallback.
3. Hardcoded default: `claude-code` if available, else first-available.

Selected agent is recorded on `TRACE.json.runtime` so cross-agent comparison
downstream is unambiguous (gad-28 supports this already).

## Wiring

1. UI: `site/app/projects/edit/[id]/GenerationRunner.tsx` gets a dropdown
   above the "Spawn generation" button.
2. Dev-server command bridge (per gad-170): accept `runtime=<cli>` and
   translate to the correct shell invocation. For example:
    - `runtime=claude-code` → `claude --dangerously-skip-permissions -p "$PROMPT"`
    - `runtime=codex` → `codex exec "$PROMPT"`
    - `runtime=opencode` → `opencode run "$PROMPT"`
   Actual shapes TBD — each runtime has its own invocation quirks.
3. Runtime detection is a server-side API (`/api/dev/runtimes`) so the
   dropdown doesn't need to shell from the browser.

## Scope boundaries

- The selector affects `gad spawn` and generation-producing commands only.
  Snapshot / query / other CLI calls run under the project's own Node
  runtime regardless.
- Selector is dev-only (gad-170). Production `/projects/[...id]` has no
  generation-runner.
- Does NOT affect the contributor model (gad-224) in this todo — that's
  its own lane (users contribute via their OWN agent in their own env).

## Dependencies

- gad-170 dev-server command bridge (exists).
- 44.5 editor surface (in progress).
- Per-runtime invocation shape research — needs one pass per CLI.
