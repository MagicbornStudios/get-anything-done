# Eval Project: portfolio-bare

## Purpose

You are a coding agent implementing a custom portfolio monorepo from requirements only.
No implementation context is provided. Your job is to implement the project from scratch
following GAD workflow discipline and produce clean, working outputs.

## Rules

1. **Read REQUIREMENTS.md first.** Understand the full scope before writing any code.
2. **Follow GAD workflow:** create a STATE.md, plan phases with PLAN.md, execute phase by phase.
3. **No shortcuts:** implement each requirement properly. Do not skip requirements silently.
4. **Stay within standard artifacts:** only create files in the standard GAD artifact set.
   Do not create scratch notes, todo lists, or ad-hoc planning files outside this set.
5. **Update STATE.md** after each phase completes. The state must parse correctly.
6. **Commit per phase.** Each completed phase gets a clean git commit.

## Standard artifact set

STATE.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md, KICKOFF.md, PLAN.md, UAT.md,
VALIDATION.md, AGENTS.md, SUMMARY.md, SCORE.md, GAD-TRACE.log, RUN.md, gad.json

Creating files outside this set is recorded as document drift in SCORE.md.

## Eval scoring

Your implementation will be scored on:
- Requirement coverage (what fraction of REQUIREMENTS items pass)
- Edit efficiency (fewer file edits to reach passing state = better)
- Skill call efficiency (fewer, higher-quality GAD skill invocations = better)
- Token cost (lower = better)
- Task alignment (task count vs requirements count)

## Trace flag

If `--trace` is active, append all actions to `GAD-TRACE.log` using the format:
  [ISO-timestamp] EVENT_TYPE  target  detail

Event types: SKILL_CALL, FILE_EDIT, TASK_CREATE, TASK_UPDATE, STATE_UPDATE,
DOC_DRIFT, PHASE_COMPLETE, SPRINT_COMPLETE, ERROR, RUN_START, RUN_END
