---
name: gad:generation-spawn
description: Spawn a GAD generation in a worktree-isolated subagent (plan/build seam per forge-09)
argument-hint: <species> [--runtime claude-code] [--baseline HEAD]
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<execution_context>
@skills/gad-generation-spawn/SKILL.md
</execution_context>

<objective>
Spawn a GAD generation from inside a Claude Code session. Wraps
`gad generation spawn --species <name> --execute` to obtain an EXEC.json spec,
creates a worktree-isolated builder subagent against that spec, writes a session
marker under `.planning/.generation-runs/<run-id>.json`, and on completion
preserves outputs via `gad generation preserve` and cleans up the worktree.
</objective>

<process>

Follow the full procedure in `@skills/gad-generation-spawn/SKILL.md`. Summary:

1. Parse `<species>`, `--runtime` (default `claude-code`), `--baseline` (default `HEAD`) from `$ARGUMENTS`.
2. Run `gad generation spawn --species <species> --runtime <runtime> --baseline <baseline> --execute` and parse the EXEC.json from stdout (between `--- EXEC_JSON_START ---` / `--- EXEC_JSON_END ---`).
3. Refuse if `.planning/.generation-runs/<species>-<version>.json` already exists.
4. Create worktree at `.claude/worktrees/agent-<species>-<version>` from `--baseline`.
5. Write the session marker with `status: "running"`.
6. Spawn a `general-purpose` subagent with `isolation: "worktree"`, `cwd` = worktree path, prompt + env vars from EXEC.json.
7. On agent completion, run `gad generation preserve <species> <version> --from <worktree>` and update marker — `status: "preserved"`.
8. Run `gad worktree clean agent-<species>-<version>` and update marker — `status: "cleaned"`.
9. Report the run id, marker path, and final status.

</process>

<rules>
- Write the session marker BEFORE spawning the agent.
- Never skip `gad generation preserve` (decision gad-38).
- Never clean the worktree on failure paths — leave it for forensics.
- Never rewrap the prompt from EXEC.json — it's already fully hydrated.
- This skill is the plan/build seam (decision forge-09): orchestrator plans, spawned agent builds.
</rules>
