---
name: gad:eval-spawn
description: >-
  Kick off a GAD eval run from inside a Claude Code session by wrapping
  `gad eval run --execute` to get the JSON spec, then spawning a worktree-isolated
  subagent against that spec. This skill is the seam between the orchestrating
  session (plan/review) and the spawned builder session (execute) per decision
  forge-09. Use when the user asks to "spawn an eval run", "kick off an eval",
  or invokes /gad-eval-spawn. The skill writes a session marker under
  `.planning/.eval-runs/<run-id>.json` so the orchestrator can poll status and
  preserve outputs via `gad eval preserve` after the builder session completes.
argument-hint: <project> [--runtime claude-code] [--baseline HEAD]
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
workflow: workflows/eval-spawn.md
---

<objective>
Spawn an eval run in a worktree-isolated subagent. This skill is the plan/build
seam (decision forge-09): the orchestrating session plans and reviews, the
spawned session builds. The orchestrator stays in charge of preservation —
after the builder finishes, this skill preserves outputs via `gad eval preserve`
and marks the session complete.
</objective>

<process>

Parse from `$ARGUMENTS`:
- `<project>` (required, positional) — eval project name
- `--runtime <id>` (optional, default `claude-code`) — runtime driving the spawned agent
- `--baseline <sha>` (optional, default `HEAD`) — git baseline the worktree branches from (brownfield parents use the preserved spawn SHA here)

1. **Resolve the project:**
   ```bash
   gad eval list | grep -E "^\s*$PROJECT\b" || { echo "Eval project '$PROJECT' not found. Run 'gad eval list' to see available projects."; exit 1; }
   ```
   (`gad eval list` is multi-root aware as of task 42.4-12; if that work has not yet landed the default root `vendor/get-anything-done/evals/` is still used.)

2. **Generate the exec spec:**
   ```bash
   gad eval run --project "$PROJECT" --runtime "$RUNTIME" --baseline "$BASELINE" --execute
   ```
   This writes `evals/<project>/v<N>/EXEC.json` and also prints the JSON between
   `--- EXEC_JSON_START ---` / `--- EXEC_JSON_END ---` markers on stdout. Parse
   the JSON and capture: `project`, `version`, `runDir`, `prompt`, `promptFile`,
   `envVars`, `postSteps`. The `runId` for session-marker purposes is
   `<project>-<version>` (e.g. `escape-the-dungeon-v7`).

3. **Check for a stale session marker:**
   ```bash
   MARKER=".planning/.eval-runs/${PROJECT}-${VERSION}.json"
   if [ -f "$MARKER" ]; then
     echo "Run id $PROJECT-$VERSION already has a marker at $MARKER. Refusing to overwrite. Inspect, resolve, then delete the marker to retry."
     exit 1
   fi
   mkdir -p .planning/.eval-runs
   ```

4. **Create an isolated worktree:**
   ```bash
   WORKTREE_PATH=".claude/worktrees/agent-${PROJECT}-${VERSION}"
   git worktree add "$WORKTREE_PATH" "$BASELINE"
   ```
   Prefer `.claude/worktrees/agent-*` (already managed by `gad worktree list/clean`)
   over `mktemp` so the orchestrator can find the worktree later even across
   session boundaries.

5. **Write the session marker (status: running):**
   ```json
   {
     "runId": "escape-the-dungeon-v7",
     "project": "escape-the-dungeon",
     "version": "v7",
     "species": "gad",
     "generation": 7,
     "runtime": "claude-code",
     "baseline": "HEAD",
     "worktreePath": ".claude/worktrees/agent-escape-the-dungeon-v7",
     "runDir": "vendor/get-anything-done/evals/escape-the-dungeon/v7",
     "agentId": null,
     "startedAt": "2026-04-14T18:00:00Z",
     "status": "running"
   }
   ```
   Write this to `.planning/.eval-runs/<runId>.json`. The `species` / `generation`
   split follows the phase 43 vocabulary; until that rename lands, `version`
   (e.g. `v7`) is the authoritative field and `generation` is the numeric
   suffix.

6. **Spawn the builder subagent via the Agent tool:**
   Launch with:
   - `subagent_type: "general-purpose"` (or a runtime-specific type once they exist)
   - `isolation: "worktree"`
   - `cwd: <WORKTREE_PATH>`
   - `description: <agentDescription from EXEC.json>`
   - `prompt: <prompt from EXEC.json>` — already contains all GAD context,
     trace env vars, and post-steps. Do not rewrap it.
   - `env: <envVars from EXEC.json>` — `GAD_RUNTIME`, `GAD_EVAL_TRACE_DIR`,
     `GAD_LOG_DIR`, `GAD_EVAL_PROJECT`, `GAD_EVAL_VERSION`

   When the Agent call returns, capture the agent's final message / exit status
   and the token usage, then update the marker: set `agentId`, `endedAt`,
   `status: "agent-complete"`.

7. **Preserve outputs (mandatory, decision gad-38):**
   ```bash
   gad eval preserve "$PROJECT" "$VERSION" --from "$WORKTREE_PATH"
   ```
   On success, update the marker: `status: "preserved"`, `preservedAt: <ts>`.
   On failure, leave the marker at `agent-complete` and report the error —
   do NOT clean up the worktree, the user may need to inspect it.

8. **Clean up the worktree:**
   ```bash
   gad worktree clean "agent-${PROJECT}-${VERSION}"
   ```
   Update the marker one last time: `status: "cleaned"`, `cleanedAt: <ts>`.

9. **Report:**
   ```
   ✓ Spawned eval run
     Project:    $PROJECT
     Version:    $VERSION
     Runtime:    $RUNTIME
     Baseline:   $BASELINE
     Worktree:   $WORKTREE_PATH
     Run dir:    $RUN_DIR
     Marker:     .planning/.eval-runs/$PROJECT-$VERSION.json
     Status:     preserved + cleaned
   ```

</process>

<failure_modes>
- **Spawn fails before the agent starts** — remove the session marker and
  `git worktree remove --force` the worktree. The `EXEC.json` and run dir stay
  in place; re-invoking `/gad-eval-spawn` will re-use the same `runId`, so you
  must either delete the existing `evals/<project>/v<N>/` or accept that the
  rerun will bump to `v<N+1>`.
- **Agent crashes mid-run** — mark the session `status: "agent-failed"`, leave
  the worktree in place for forensics, and surface the error to the user. Do
  NOT preserve — partial spawns pollute canonical paths.
- **Preserve fails** — mark `status: "preserve-failed"`, leave worktree intact,
  instruct the user to run `gad eval preserve` manually once they've fixed
  whatever the copy failure was.
- **Marker already exists** — refuse. A live run at the same `runId` means
  either a previous session is still going or a previous session crashed
  without cleanup. Let the user resolve manually.
- **`--execute` flag missing** — this skill depends on `gad eval run --execute`
  (already shipped). If the CLI doesn't recognize the flag, stop and tell the
  user to upgrade their GAD CLI rather than falling back to manual worktree
  plumbing.
</failure_modes>

<examples>
User: "Spawn an eval run for escape-the-dungeon."
Agent: invokes `/gad-eval-spawn escape-the-dungeon` → generates EXEC.json at
`evals/escape-the-dungeon/v7/EXEC.json`, creates worktree at
`.claude/worktrees/agent-escape-the-dungeon-v7`, writes marker at
`.planning/.eval-runs/escape-the-dungeon-v7.json`, spawns builder subagent with
the prompt from EXEC.json, on completion runs
`gad eval preserve escape-the-dungeon v7 --from .claude/worktrees/agent-escape-the-dungeon-v7`,
cleans the worktree, updates marker to `status: "cleaned"`.

User: "Kick off a brownfield run from the v6 spawn SHA."
Agent: `/gad-eval-spawn escape-the-dungeon --baseline <sha-of-v6-spawn>` — same
flow, worktree branches off the preserved v6 spawn.
</examples>

<rules>
- Always write the session marker BEFORE spawning the agent — if the agent call
  fails, the marker lets the orchestrator recover.
- Never skip `gad eval preserve` (decision gad-38). Preservation failures must
  stop cleanup.
- Never clean the worktree on failure paths — the operator needs it for forensics.
- Never wrap or rewrite the prompt from EXEC.json. It's already fully hydrated
  with GAD context, trace hooks, and post-steps.
- Do not set `GAD_RUNTIME` or trace env vars manually — use the values from
  `EXEC.json.envVars` so the CLI stays the single source of truth.
- `.planning/.eval-runs/` is transient runtime state. Do not commit markers.
</rules>

<related>
- `gad:eval-run` — generates the prompt and (without `--execute`) creates the
  worktree itself; this skill is the `--execute`-mode counterpart.
- `gad:eval-bootstrap` — older bootstrap flow that injects context without
  spawning.
- decision forge-09 — plan/build separation; this skill is the documented seam.
- decision gad-38 — eval preservation contract.
</related>
