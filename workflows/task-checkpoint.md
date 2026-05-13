# gad:task-checkpoint

Verifies that the agent updated planning docs for the completed task before moving to the next one. This is the enforcement mechanism for per-task discipline (gad-21).

## When to use

- Between tasks during phase execution
- After completing any task, before starting the next
- Called automatically by execute-phase workflow

## What it checks

Use `gad query "task <task-id>"` and `gad state` to check task and state status (decision gad-202). Fallback: read `.planning/TASK-REGISTRY.xml` and `.planning/STATE.xml` directly. Then verify:

### 1. Previous task is marked done

```
Check: TASK-REGISTRY.xml contains a task with the completed task's id AND status="done"
Pass: task exists with status="done"
Fail: task still shows status="in-progress" or status="planned"
```

If fail: **Stop. Update TASK-REGISTRY.xml to mark the task done before continuing.**

### 2. Derived next-action is current

```
Check: `gad state --projectid <id> --full` shows a next-action that points at the NEXT task or phase, not the completed one
Pass: derived next-action references upcoming work
Fail: derived next-action still describes the task that was just completed, or has no fresh state-log / task / phase-goal source
```

If fail: **Stop. Run `gad state log "<text>" --tags "<phase-id>" --projectid <id>` to record the new state.** Snapshot/state derive next-action from the latest tagged state-log entry first, then the lowest-numbered planned task, then the active phase goal. Activity still belongs in TASK-REGISTRY `<resolution>`.

### 3. Code compiles (if applicable)

```
Check: Run the project's build/typecheck command if one exists
Pass: zero errors
Fail: compilation errors
```

If fail: **Stop. Fix compilation errors before moving to the next task.**

### 4. Changes are committed

```
Check: git status shows no uncommitted changes to planning docs or source files
Pass: working tree clean (or only untracked files)
Fail: modified files not committed
```

If fail: **Stop. Commit with the task id in the message.**

## Output

After all checks pass:

```
✓ Checkpoint passed for task [task-id]
  - TASK-REGISTRY: task marked done
  - State: derived next-action updated
  - Build: clean
  - Git: committed

Proceeding to next task: [next-task-id] — [next-task-goal]
```

## How execute-phase uses this

The execute-phase workflow inserts this checkpoint between every task:

```
for each task in phase:
  1. Mark task in-progress
  2. Implement task
  3. Mark task done + log fresh state
  4. Commit
  5. >>> RUN CHECKPOINT <<<
  6. If checkpoint fails → fix before continuing
  7. Proceed to next task
```

## Why this matters

Eval v2 showed 34 tasks completed with 0 per-task commits and 0 state updates. The agent batched everything at the end. This checkpoint prevents that by making step 5 a hard gate.
