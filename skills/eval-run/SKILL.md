---
name: gad:eval-run
description: Run a GAD evaluation against a bare project with context mode, planning, execution, and trace output
---

# gad:eval-run

An eval run is a normal GAD planning+execution session with one addition: you declare your context mode up front, and you write a trace at the end. Everything else follows the standard loop.

## When to use this skill

- You are working in a bare eval project (only `.planning/` + requirements, no app code)
- The user says "run the eval", "start fresh", "start an eval session"
- The project's `planning-config.toml` has an `[eval]` section

## Step 1 — Declare context mode

Before reading anything else, decide: **did you load prior planning context for this project before this session?**

- **Fresh**: you opened this directory cold. You have not read STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, or DECISIONS.xml from this project in any prior message.
- **Loaded**: you ran `gad context`, read planning files, or resumed a prior session before starting this one.

```sh
gad session new --fresh     # cold start — no prior context
gad session new             # context was loaded before this session
```

This is self-reported. The eval report will show which tasks were done at which mode. If you declare fresh but actually loaded context, the comparison is meaningless — you are the only one who knows.

## Step 2 — Read requirements

```sh
# Read the requirements file — this is your only input
cat REQUIREMENTS.md
# or for a structured view:
gad context --json
```

Do not read STATE.xml, ROADMAP.xml, or TASK-REGISTRY.xml yet if this is a fresh session. Those files are empty at the start of a fresh eval.

## Step 3 — Plan phases

Follow the `gad:plan-phase` skill for each phase:

1. Read requirements, identify phase boundaries
2. Write phase goals to ROADMAP.xml
3. Break each phase into tasks, write to TASK-REGISTRY.xml
4. Update STATE.xml with current phase and next-action

Each task in TASK-REGISTRY.xml must record:
```xml
<task id="01-01" status="planned" context-mode="fresh">
  <goal>...</goal>
</task>
```

The `context-mode` attribute on each task inherits from the session's `contextMode`. Read it from the session:
```sh
gad session list --json   # check contextMode field
```

## Step 4 — Execute tasks

Follow the `gad:execute-phase` skill for each task:

1. Mark task `in-progress` in TASK-REGISTRY.xml
2. Do the work (planning doc updates in this eval, not code)
3. Mark task `done`
4. Update STATE.xml next-action

Since this is a planning-only project, "doing the work" means:
- Filling in ROADMAP.xml phase details
- Writing DECISIONS.xml entries for choices made
- Keeping STATE.xml accurate

## Step 5 — Verify

After each phase, run:
```sh
gad eval run --project portfolio-bare
```

This checks your planning docs against the reference solution in `evals/portfolio-bare/REQUIREMENTS.md`. It scores: requirement coverage, task alignment, state hygiene.

## Step 6 — Write trace and close session

At the end of the session:

```sh
gad eval trace write --project portfolio-bare
gad session close <session-id>
```

The trace captures what you did, what context mode you used, and how it compares to prior runs.

## What the eval measures

After multiple runs (some fresh, some loaded), `gad eval trace report --project portfolio-bare` shows:

- **context_delta**: did loaded-context sessions produce better planning outcomes than fresh sessions?
- **task_alignment**: did your phases and tasks match the reference structure?
- **state_hygiene**: did STATE.xml stay accurate throughout?

The goal is NOT to get a high score on a single run. The goal is to accumulate enough fresh vs loaded runs that the comparison is statistically meaningful.
