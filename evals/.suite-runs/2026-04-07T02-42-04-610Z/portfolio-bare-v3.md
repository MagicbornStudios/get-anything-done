# Eval: portfolio-bare v3


You are running a GAD eval. Follow the loop defined in AGENTS.md. Your work is being traced.


## AGENTS.md (follow this exactly)

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


## REQUIREMENTS.md (eval overview)

# Eval: portfolio-bare

**Project:** Custom Portfolio (MagicbornStudios)
**Source:** Stripped from portfolio's `.planning/` planning state and requirements

## Goal

Validate that a GAD agent can correctly plan and execute phases for the portfolio
monorepo given only a bare requirements spec. This eval measures:

1. **Plan accuracy** — does the agent's phase plan match the human-authored plan?
2. **Execution fidelity** — do agent-executed tasks produce the expected outputs?
3. **State hygiene** — does STATE.md stay clean and accurate after each phase?
4. **Token efficiency** — total tokens consumed vs. baseline human-guided run

## Requirements

### Project type
Turborepo monorepo with Next.js portfolio app, content docs, vendor submodules.

### Stack
- Next.js 15, React, TypeScript, Tailwind CSS
- Payload CMS for content
- pnpm workspaces
- Vercel deployment

### Active milestone
M2: GAD Foundation — make GAD self-contained, monorepo-aware, eval-capable.

### Phase sequence expected
1. Install/dependency layer (GAD package.json, install.js)
2. Command prefix rename (gsd: → gad:)
3. planning-config.toml support
4. Net-new CLI commands (workspace sync/add, docs compile, migrate-schema, eval)
5. README + CHANGELOG

## Success criteria

| Criterion | Pass threshold |
|-----------|----------------|
| Phase plan matches | ≥ 80% structural overlap with reference plan |
| All tasks executed | 100% (no silent skips) |
| STATE.md valid | Parses correctly after each phase |
| Tokens per phase | ≤ 1.2× baseline |

## Baseline

Run against HEAD of `MagicbornStudios/get-anything-done` at the start of M2.

## Notes

- The portfolio's actual `planning-config.toml` is the canonical config input
- Strip all existing PLAN.md/SUMMARY.md files before each run (bare start)
- Agent should produce equivalent planning docs from requirements alone


## DECISIONS.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<decisions>
  <!-- Decisions captured by the agent during planning and execution. -->
</decisions>
```

## ROADMAP.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roadmap>
  <!-- Phases are planned by the agent from REQUIREMENTS.md.
       This file starts empty — the agent creates phases from scratch. -->
</roadmap>
```

## STATE.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state>
  <current-phase></current-phase>
  <current-plan></current-plan>
  <milestone></milestone>
  <status>not-started</status>
  <next-action>Read REQUIREMENTS.md and begin planning phase 01.</next-action>
  <last-updated></last-updated>
</state>
```


## Instructions


1. Copy the .planning/ directory from the template into your working directory

2. Implement the project following the ROADMAP.xml phases

3. For EACH task: update TASK-REGISTRY.xml, update STATE.xml, commit with task ID

4. Follow CONVENTIONS.md patterns and DECISIONS.xml architecture

5. When complete: all phases done, build passes, planning docs current