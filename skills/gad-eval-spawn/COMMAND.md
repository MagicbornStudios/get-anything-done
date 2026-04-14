---
name: gad:eval-spawn
description: Spawn a GAD eval run in a worktree-isolated subagent (plan/build seam per forge-09)
argument-hint: <project> [--runtime claude-code] [--baseline HEAD]
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<execution_context>
@skills/gad-eval-spawn/SKILL.md
</execution_context>

<objective>
Spawn a GAD eval run from inside a Claude Code session. Wraps
`gad eval run --project <name> --execute` to obtain an EXEC.json spec, creates a
worktree-isolated builder subagent against that spec, writes a session marker
under `.planning/.eval-runs/<run-id>.json`, and on completion preserves outputs
via `gad eval preserve` and cleans up the worktree.
</objective>

<process>

Follow the full procedure in `@skills/gad-eval-spawn/SKILL.md`. Summary:

1. Parse `<project>`, `--runtime` (default `claude-code`), `--baseline` (default `HEAD`) from `$ARGUMENTS`.
2. Run `gad eval run --project <project> --runtime <runtime> --baseline <baseline> --execute` and parse the EXEC.json from stdout (between `--- EXEC_JSON_START ---` / `--- EXEC_JSON_END ---`).
3. Refuse if `.planning/.eval-runs/<project>-<version>.json` already exists.
4. Create worktree at `.claude/worktrees/agent-<project>-<version>` from `--baseline`.
5. Write the session marker with `status: "running"`.
6. Spawn a `general-purpose` subagent with `isolation: "worktree"`, `cwd` = worktree path, prompt + env vars from EXEC.json.
7. On agent completion, run `gad eval preserve <project> <version> --from <worktree>` and update marker → `status: "preserved"`.
8. Run `gad worktree clean agent-<project>-<version>` and update marker → `status: "cleaned"`.
9. Report the run id, marker path, and final status.

</process>

<rules>
- Write the session marker BEFORE spawning the agent.
- Never skip `gad eval preserve` (decision gad-38).
- Never clean the worktree on failure paths — leave it for forensics.
- Never rewrap the prompt from EXEC.json — it's already fully hydrated.
- This skill is the plan/build seam (decision forge-09): orchestrator plans, spawned agent builds.
</rules>
