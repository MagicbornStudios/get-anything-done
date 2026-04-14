---
name: gad:eval-run
description: Run an eval project in an isolated git worktree
argument-hint: --project <name> [--baseline <sha>] [--agent <model>]
allowed-tools:
  - Read
  - Write
  - Bash
---

<execution_context>
@workflows/gad-eval-run.md
</execution_context>

<objective>
Execute a GAD eval project in an isolated git worktree. Each run gets its own
worktree, a timestamped output directory, and an agent stub invocation. The
worktree is cleaned up after the run. Results are saved in `evals/<name>/v<N>/`.
</objective>

<process>
Execute the eval-run workflow from @workflows/gad-eval-run.md. The steps below are the current CLI/worktree implementation details.

Parse from `$ARGUMENTS`:
- `--project <name>` (required)
- `--baseline <sha>` (optional, defaults to HEAD)
- `--agent <model>` (optional, defaults to configured default model)

1. **Validate project exists:**
   ```bash
   ls "evals/$PROJECT" 2>/dev/null || echo "NOT_FOUND"
   ```
   If not found: `Eval project '<name>' not found. Run \`gad eval list\` to see available projects.`

2. **Read project REQUIREMENTS.md:**
   ```bash
   cat "evals/$PROJECT/REQUIREMENTS.md"
   ```

3. **Compute next run number:**
   Count existing `evals/<name>/v*/` directories. Next = max + 1.

4. **Create git worktree:**
   ```bash
   BASELINE="${BASELINE:-HEAD}"
   WORKTREE_PATH=$(mktemp -d "/tmp/gad-eval-XXXXXX")
   git worktree add "$WORKTREE_PATH" "$BASELINE"
   ```

5. **Scaffold output directory:**
   ```bash
   mkdir -p "evals/$PROJECT/v$RUN_NUM"
   cat > "evals/$PROJECT/v$RUN_NUM/RUN.md" << EOF
   # Eval Run v$RUN_NUM

   project: $PROJECT
   baseline: $BASELINE
   started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   agent: $AGENT_MODEL
   status: running
   EOF
   ```

6. **Execute agent (stub):**
   In the worktree, run the eval agent:
   ```bash
   cd "$WORKTREE_PATH"
   # Stub: agent invocation goes here
   # Full implementation in gad-eval plan
   echo "STUB: agent run for $PROJECT" > "$WORKTREE_PATH/eval-output.txt"
   ```

7. **Collect results:**
   Copy relevant output files from worktree to `evals/<name>/v<N>/`:
   ```bash
   cp "$WORKTREE_PATH/eval-output.txt" "evals/$PROJECT/v$RUN_NUM/"
   ```

8. **Remove worktree:**
   ```bash
   git worktree remove --force "$WORKTREE_PATH"
   ```

9. **Update RUN.md with result:**
   Set `status: completed` and `ended: <timestamp>`.

10. **Summary:**
    ```
    ✓ Eval run complete

    Project:  $PROJECT
    Run:      v$RUN_NUM
    Baseline: $BASELINE
    Output:   evals/$PROJECT/v$RUN_NUM/
    ```

</process>

<rules>
- Always remove the worktree, even if the run fails (use trap in bash)
- Never modify files in the main worktree during an eval run
- If baseline SHA is invalid, abort before creating the worktree
</rules>
