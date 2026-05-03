# Claude Code adapter

Phase 89-02 adds a Claude-side whiteboard emitter at `scripts/claude-session-emit.cjs`.
Because this repo's `.claude/settings.json` is gitignored, the committed workflow is:

1. Review this reference.
2. Run `node scripts/setup-claude-session-hooks.cjs` once in the repo root.
3. Let Claude Code fire the local project hooks from `.claude/settings.json`.

The emitter writes `.planning/.sessions/<id>/events.jsonl` in the 89-01 schema.

## Why this shape

Claude Code already exposes the hook lifecycle we need:

- `SessionStart` for per-session metadata
- `UserPromptSubmit` for the actual prompt/intent
- `PreToolUse` / `PostToolUse` / `PostToolUseFailure` for per-tool telemetry
- `SessionEnd` for the terminal summary

We still register `Stop` so the script sees turn boundaries, but `session-end` is only
emitted on `SessionEnd` to keep the JSONL stream schema-valid.

## Hook config

`scripts/setup-claude-session-hooks.cjs` merges these project-local entries into
`.claude/settings.json` without clobbering other hooks:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `PostToolUseFailure`
- `Stop`
- `SessionEnd`

The generated command points at the repo-local emitter with an absolute path, so the
hook still resolves from nested working directories and worktrees.

## Event model

The current adapter emits:

- `session-start`
- `step-start`
- `tool-call`
- `pressure-event`
- `attribution-link`
- `step-end`
- `session-end`

It does not synthesize `decomposition` yet. Claude's public hook surface gives us prompt
and tool lifecycle data, but not a stable explicit "planned child steps" payload.

## Session identity

- Preferred source: `CLAUDE_SESSION_ID` env if it already matches `s-YYYYMMDD-<uuid8>`.
- Fallback: a generated schema-valid id stored in a repo-local hook map keyed by
  `transcript_path` / Claude's raw `session_id`.

This keeps the committed schema stable even if Claude's native `session_id` shape differs.

## Intent capture

`SessionStart` fires before the first prompt exists, so the adapter stages session metadata
there and emits the actual `session-start` event on `UserPromptSubmit`, which provides the
prompt text. That keeps `session-start.intent` truthful instead of writing a placeholder.

## Privacy

- `tool-call.target` is always a path, URL, query, or truncated command summary.
- File contents are never written.
- `output_excerpt` stays opt-in behind `GAD_SESSION_TRACE_VERBOSE=1`.
- The scrubber redacts:
  - `.env`-style secret assignments
  - `Authorization:` headers
  - `Bearer ...`
  - `sk-ant-`, `sk-`, `cl-`, `ghp_`, `github_pat_`
  - Clerk env keys / token-like strings

## Fixture

Committed sample session:

- `vendor/get-anything-done/tests/fixtures/claude-session-sample.jsonl`

Regression coverage:

- `vendor/get-anything-done/tests/claude-session-emit.test.cjs`
