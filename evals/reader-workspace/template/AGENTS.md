# Agent guide -- Reader Workspace (eval project)

**You are inside a GAD eval.** Follow this loop exactly. Your work is being traced.

## The loop (mandatory)

1. **Pick one task** from `.planning/TASK-REGISTRY.xml` (status=planned)
2. **Mark it in-progress** in TASK-REGISTRY.xml before starting work
3. **Implement it**
4. **Mark it done** in TASK-REGISTRY.xml
5. **Update STATE.xml** -- set `next-action` to describe what comes next
6. **Commit** with a message referencing the task id (e.g. "feat: 01-02 implement reading store")
7. **Repeat** from step 1

## Before you start coding

1. Read `.planning/REQUIREMENTS.xml` -- the full feature spec (51 success criteria)
2. Read `.planning/DECISIONS.xml` -- architectural decisions you should follow
3. Read `.planning/CONVENTIONS.md` -- coding patterns to adhere to
4. Read `.planning/ROADMAP.xml` -- the 12-phase implementation plan
5. Plan your first phase in `.planning/TASK-REGISTRY.xml`
6. Update `.planning/STATE.xml` with current-phase and status

## Per-task checklist (MANDATORY before next task)

- [ ] TASK-REGISTRY.xml: previous task marked `done`
- [ ] STATE.xml: `next-action` updated
- [ ] Code works (build/lint/test as applicable)
- [ ] Committed with task id in message

## After first implementation phase

Create `.planning/CONVENTIONS.md` additions documenting any NEW patterns you established
beyond what was already documented.

## Decisions during work

Capture any new architectural choices in `.planning/DECISIONS.xml`:
```xml
<decision id="impl-01">
  <title>Short title</title>
  <summary>What and why</summary>
  <impact>How this affects future work</impact>
</decision>
```

## Key architecture notes

- **React package structure:** This is a library, not an app. Export components and stores
  from a public index.ts with sub-path export (`./reader`).
- **Zustand stores:** Always use persist + immer for persisted stores. Include legacy
  key migration in the custom storage adapter.
- **UI primitives:** Build your own lightweight Button, Card, Badge, etc. Do NOT install
  shadcn/ui -- create minimal equivalents.
- **Chrome theme:** All styling flows through a single theme object mapping slot names to
  Tailwind class strings.
- **Annotations:** Three persistence layers merge (IndexedDB local, EPUB embedded, remote
  adapter). Conflict resolution is last-write-wins by timestamp.
- **EpubViewer:** Lazy-loaded. Custom sepia theme. Supports paginated and scrolled modes.

## What NOT to do

- Do NOT skip TASK-REGISTRY.xml updates -- your trace depends on them
- Do NOT batch all planning updates at the end -- update PER TASK
- Do NOT code without planning first
- Do NOT import from shadcn/ui or Radix -- build lightweight primitives
- Do NOT copy code from any external source -- implement from the requirements spec
- Do NOT create files outside the standard artifact set without reason

## Scoring

Your work is scored on:
1. **Requirement coverage** (40%) -- how many of the 51 success criteria are met
2. **Architecture alignment** (25%) -- do your decisions match the reference decisions
3. **State hygiene** (20%) -- per-task updates, task-id commits, STATE.xml accuracy
4. **Convention adherence** (15%) -- file naming, store patterns, import patterns
