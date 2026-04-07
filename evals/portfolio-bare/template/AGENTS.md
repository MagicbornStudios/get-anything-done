# Agent guide — Portfolio Bare (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## The loop (mandatory)

1. **Pick one task** from `.planning/TASK-REGISTRY.xml` (status=planned)
2. **Mark it in-progress** in TASK-REGISTRY.xml before starting work
3. **Implement it**
4. **Mark it done** in TASK-REGISTRY.xml
5. **Update STATE.xml** — set `next-action` to describe what comes next
6. **Commit** with a message referencing the task id (e.g. "feat: 01-02 install dependencies")
7. **Repeat** from step 1

## After completing each phase (all tasks done)

**Verify the phase before moving on.** Write `.planning/VERIFICATION.md` (append each phase):

```markdown
## Phase [X]: [Name]
- Build: PASS/FAIL (run the build command)
- Tasks: [N]/[N] done
- State: current (next-action points to next phase)
```

Then commit: `git commit -m "verify: phase [X] verified"`

This is mandatory — your skill accuracy score depends on it.

## Before you start coding

1. Read `REQUIREMENTS.md` (in eval root, one level up from template/) — what you're building
2. Plan phases in `.planning/ROADMAP.xml`
3. Create tasks in `.planning/TASK-REGISTRY.xml` for your first phase
4. Update `.planning/STATE.xml` with current-phase and status

## Per-task checklist (MANDATORY before next task)

- [ ] TASK-REGISTRY.xml: previous task marked `done`
- [ ] STATE.xml: `next-action` updated  
- [ ] Code works (build/lint/test as applicable)
- [ ] Committed with task id in message

## After first implementation phase

Create `.planning/CONVENTIONS.md` documenting the patterns you established.

## Decisions during work

Capture architectural choices in `.planning/DECISIONS.xml`:
```xml
<decision id="pb-01">
  <title>Short title</title>
  <summary>What and why</summary>
  <impact>How this affects future work</impact>
</decision>
```

## What NOT to do

- Do NOT skip TASK-REGISTRY.xml updates — your trace depends on them
- Do NOT batch all planning updates at the end — update PER TASK
- Do NOT code without planning first
- Do NOT create files outside the standard artifact set without reason

## Scoring

Your work is scored on PLANNING DISCIPLINE (per-task updates, task-id commits, STATE.xml updates, CONVENTIONS.md), not just whether the code works.
