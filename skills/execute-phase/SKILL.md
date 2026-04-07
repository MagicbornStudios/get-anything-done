---
name: gad:execute-phase
description: Execute a planned phase by following PLAN.md tasks atomically — commit after each task, update planning docs, and run verify commands at each step. Use this skill when the user wants to execute a phase, start working on planned tasks, run through a phase autonomously, or continue execution of an in-progress phase. This is the autonomous execution skill — if the plan is solid and requirements are clear, Claude should be able to run this to completion without interruption. Requires gad:plan-phase to have been run first to produce a PLAN.md.
---

# Execute Phase

Execute all tasks in a planned phase, following PLAN.md atomically. Each task is a discrete unit: implement → verify → commit → update planning docs → next task.

The goal is uninterrupted execution from first task to phase close. If the kickoff and plan are solid, this should run to completion without needing to ask questions.

## Step 1: Bootstrap context

```bash
node vendor/get-anything-done/bin/gad.cjs snapshot --projectid <id>
```

This gives you state, roadmap, tasks, decisions, and file refs in one low-token command. Identify the current phase and its tasks from the snapshot output.

Then read the phase-specific plan:
1. `.planning/phases/<phase-id>/KICKOFF.md` — goal, scope, DoD, open questions
2. `.planning/phases/<phase-id>/PLAN.md` — task list, verify commands, dependencies

If no PLAN.md exists, stop: "Phase `<id>` has no plan. Run `gad:plan-phase` first."

If KICKOFF.md has unresolved open questions that affect execution, surface them before starting.

**Do NOT manually read STATE, ROADMAP, DECISIONS, or TASK-REGISTRY files** — the snapshot already gave you that. Pull individual files with `gad tasks`, `gad decisions`, etc. only if you need more detail on a specific item. If they're non-blocking, continue and note them.

## Step 2: Determine the starting point

Check task statuses in PLAN.md. Find the first task that is not `done`:
- `planned` — not started
- `active` — in progress (resume from here)
- `blocked` — surface the blocker before starting

If any task is `blocked`, report it: "Task `<id>` is blocked: `<reason>`. Resolve this before execution can continue."

Update STATE (XML or MD, whichever the project uses) to mark the phase as `active` with next-action describing the current task.

## Step 3: Execute tasks in order

For each task (respecting dependency order):

### 3a. Mark task active

In PLAN.md, change the task status from `planned` to `active`.

Update STATE next-action to reflect the active task.

### 3b. Implement the task

Do the actual work. Stay within the task's stated scope — don't refactor adjacent code, don't add features not listed. If you discover the task is larger than expected, implement the minimum needed to satisfy the task goal.

The snapshot already gave you decisions — check them for rules that apply to this task. If a decision exists that covers this area, follow it without relitigating.

Check ERRORS-AND-ATTEMPTS (if it exists) for any recorded failures in this area before choosing an approach.

### 3c. Run the verify command

Run the verify command from the task row. Examples:
- `pnpm test`
- `pnpm test && pnpm build`
- `pnpm exec tsc --noEmit`

**If verify passes:** continue to commit.

**If verify fails:**
1. Fix the issue (within the task's scope)
2. Run verify again
3. If still failing after 2 attempts: record the failure in ERRORS-AND-ATTEMPTS.md and surface it to the user — don't silently loop

### 3d. Commit

```bash
git add -p  # stage only the files touched by this task
git commit -m "<type>(<phase-id>): <task goal summary>"
```

Commit message types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

Example: `feat(app-auth-01): add JWT signing and verification helpers`

### 3e. Update planning docs

In PLAN.md, mark the task `done`.

In TASK-REGISTRY (XML or MD), find the matching task and mark it `done`.

In STATE (XML or MD), advance the next-action to the next task.

### 3f. Next task

Continue to the next task (3a). No pause between tasks unless a blocker is encountered.

## Step 4: Phase close

When all tasks are `done`, run the definition-of-done check:

Read the `definition-of-done` field from KICKOFF.md. For each criterion:
- Run any stated commands (tests, build)
- Verify observable conditions
- If anything fails, surface it — do not silently mark the phase done

**If DoD passes:**

0. Write or append to `.planning/VERIFICATION.md`:

```markdown
## Phase <phase-id>: <name>
- Build: PASS (exit 0)
- Tasks: N/N done
- State: current
```

Commit: `git commit -m "verify: phase <phase-id> verified"`

1. Write a brief SUMMARY.md in `.planning/phases/<phase-id>/SUMMARY.md`:

```markdown
## Summary: `<phase-id>`

**Completed:** <date>
**Goal achieved:** <restate the goal and confirm it's done>

## What was built
- [key things implemented]

## Decisions made
- [any new stable rules; add them to DECISIONS.md]

## Notes for next phase
- [anything the next phase should know]
```

2. Update ROADMAP (XML or MD): phase status → `done`

3. Update STATE (XML or MD): advance to next phase

4. Add any new decisions to DECISIONS (XML or MD)

5. Add any failed approaches to ERRORS-AND-ATTEMPTS (if it exists)

6. Commit:
```bash
git add .planning/
git commit -m "docs(<phase-id>): close phase"
```

**If DoD fails:**
Report exactly which criteria failed and what needs to be fixed. Do not mark the phase done.

## Step 5: Present outcome

```
Phase `<phase-id>` complete.

Tasks executed: N
Commits: N
Verify: all passed

Definition of done: [passed / N criteria failed]

Next: run gad:check-todos to find the next phase.
```

## Handling blockers during execution

If you hit something unexpected mid-execution:
- **Missing dependency** — a task depends on something that doesn't exist yet: record in ERRORS-AND-ATTEMPTS.md, surface to user
- **Scope creep** — the task turns out to require changes far outside its stated scope: do the minimum, note in SUMMARY.md what the follow-up task should address
- **Test infrastructure broken** — verify commands fail for reasons unrelated to this task: record the failure, surface before continuing

Never silently skip a verify step. If verify is broken, that's more important to surface than forward progress.

## Reference

- `references/commit-conventions.md` — commit message format and examples
