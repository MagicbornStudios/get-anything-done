# GAD Eval Framework

Knowledge and methodology skills cannot be evaluated purely by trigger detection.
This framework evaluates GAD skills by running them against known requirements on
versioned benchmark projects and measuring outcome quality.

## Why

The `skill-creator` eval loop detects if Claude fires a skill. This works for action
skills (scripts/templates Claude cannot reconstruct). It fails for knowledge/methodology
skills — Claude answers from training and never triggers them. All GAD planning skills
are methodology skills.

This framework tests the **output**, not the trigger:
- Did the agent implement what the requirements asked?
- Did it follow the GAD workflow correctly?
- How much drift from baseline?

## Eval project structure

```
evals/
├── portfolio-bare/           <- portfolio requirements as eval project
│   ├── REQUIREMENTS.md       <- requirements only, no implementation
│   ├── AGENTS.md             <- eval project instructions for coding agent
│   ├── gad.json              <- eval project config (flags as eval)
│   ├── v1/                   <- versioned run
│   │   ├── GAD-TRACE.log     <- trace of all actions (--trace flag)
│   │   ├── SCORE.md          <- computed scores
│   │   └── RUN.md            <- run metadata
│   ├── v2/
│   └── baseline/             <- frozen reference run (v1 or designated)
└── README.md                 <- this file
```

## CLI commands

```
gad eval list                              # list projects + run history
gad eval run --project <name>              # run eval in git worktree
gad eval score --project <name>            # compute SCORE.md from latest run
gad eval score --project <name> --version v2  # score specific version
gad eval diff v1 v2 --project <name>       # diff two run score files
```

## Run isolation

Each `gad eval run` creates a git worktree so the agent starts from a clean repo state:

```
gad eval run --project portfolio-bare

-> git worktree add /tmp/gad-eval-portfolio-bare-<ts> HEAD
-> agent runs in worktree
-> output written to evals/portfolio-bare/v<N>/ in main repo
-> git worktree remove
```

## TRACE format

`GAD-TRACE.log` is written when `trace: true` in gad.json. Format:

```
[2026-04-03T14:23:01Z] SKILL_CALL       gad:plan-phase  phase=portfolio-01
[2026-04-03T14:23:45Z] FILE_EDIT        apps/portfolio/app/layout.tsx  +42/-8
[2026-04-03T14:24:02Z] TASK_CREATE      portfolio-01-01  "Add root layout with auth shell"
[2026-04-03T14:24:15Z] STATE_UPDATE     current_phase=portfolio-01  status=planning
[2026-04-03T14:25:03Z] SKILL_CALL       gad:execute-phase  phase=portfolio-01
[2026-04-03T14:31:00Z] DOC_DRIFT        DETECTED  file=.planning/scratch.md  reason=outside_standard_artifacts
```

Fields: `timestamp`, `event_type`, `target`, `detail`.

## RUN.md format

Required fields for `gad eval score` to compute metrics:

```markdown
# Eval Run v1

project: portfolio-bare
baseline: HEAD
started: 2026-04-03T14:00:00Z
ended: 2026-04-03T16:30:00Z
status: completed
gad_version: 1.32.0
edit_count: 142
skill_calls: 34
total_tokens: 284000
task_count: 47
requirement_coverage: 0.78
```

## Adding an eval project

1. Create `evals/<project-name>/REQUIREMENTS.md` — requirements only, no implementation
2. Create `evals/<project-name>/AGENTS.md` — eval instructions for coding agent
3. Create `evals/<project-name>/gad.json` — config with `"type": "eval"`
4. Run `gad eval list` to verify it appears
5. Run `gad eval run --project <project-name>` to start first run (becomes baseline)
