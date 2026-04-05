# AGENTS.md — portfolio-bare eval project

This is an **evaluation project**. It contains only planning docs and requirements — no application code. You are being evaluated on how well you plan and execute the phases described in `REQUIREMENTS.md`.

## What you must do

1. Read `REQUIREMENTS.md` fully before doing anything else.
2. Run `gad session new [--fresh]` to start a tracked session. Use `--fresh` if you have NOT read any prior planning context for this project.
3. Plan phases following the GAD `gad:plan-phase` skill.
4. Execute tasks following the GAD `gad:execute-phase` skill.
5. Keep `STATE.xml`, `TASK-REGISTRY.xml`, and `ROADMAP.xml` up to date after every task.
6. Run `gad eval trace write` at the end of each session.

## Context mode — your responsibility

When you run `gad session new`, declare whether this is a fresh start:

```sh
gad session new --fresh      # you have read NO prior planning state
gad session new              # you loaded context before this session (default: loaded)
```

This is on the honor system. If you declare fresh but actually loaded context, the eval report will show inflated fresh-context scores — which defeats the purpose of the eval.

## Loop steps

```
read requirements
  → plan phases (gad:plan-phase)
    → execute tasks (gad:execute-phase)
      → verify (gad:verify-work)
        → close session (gad session close)
          → write trace (gad eval trace write)
```

## What is being measured

See `gad eval trace report --project portfolio-bare` after runs complete.
The report shows which tasks were completed, at what context mode, and how they compare to the reference solution.

## Do not

- Do not create application code (this is a planning-only project)
- Do not read planning docs from other projects in this repo
- Do not skip `gad session new` — the session is how context_mode gets recorded
