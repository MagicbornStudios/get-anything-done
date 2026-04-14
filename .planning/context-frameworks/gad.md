---
slug: gad
name: GAD (get-anything-done)
description: Content-driven framework with evolutionary skill generation. Ships the full skills, agents, and .planning/workflows catalogs plus the GAD loop. Decision gad-166 — GAD is content + emergent in one track; gad-179 — treated as one framework of many.
version: v1.1
extends: null
skills: [check-todos, task-checkpoint, debug, gad-debug, gad-discuss-phase, gad-plan-phase, gad-execute-phase, gad-verify-work, gad-list-phase-assumptions, gad-next, create-proto-skill, gad-evolution-evolve, gad-evolution-validator, gad-skill-creator, eval-report, write-feature-doc]
agents: [gad-planner, gad-executor, gad-debugger, gad-verifier, gad-doc-writer, gad-researcher]
workflows: [gad-loop, gad-discuss-plan-execute, gad-decide, gad-debug, gad-evolution, gad-findings]
canonicalProjects: [escape-the-dungeon, escape-the-dungeon-gad-emergent]
---

## Overview

GAD is a content-driven context framework with evolutionary skill
generation — decision gad-166. The framework ships a baseline content
set (skills, agents, workflows, CLI, references) AND an evolution loop
that generates new skills from observed pressure patterns. These two
things are one track, not separate conditions.

Per decision gad-179, GAD is one context framework of many in the
catalog — not the home team. The site is a playground for trying GAD
and other frameworks against problems; GAD happens to be the framework
we build and maintain, but the Brood Editor (phase 44.5) lets you
swap it for any registered framework on a per-project basis.

## What it ships

### Workflows (decision gad-172)

- **gad-loop** — snapshot → task → commit; the atomic unit of progress
- **gad-discuss-plan-execute** — phase-level discuss/plan/execute round
- **gad-decide** — pros/cons → recommend → commit for any open question
- **gad-debug** — scientific-method debugging with persisted session
- **gad-evolution** — pressure → candidate → proto-skill → promoted
- **gad-findings** — experiment → whitepaper → publish

### Core skills (excerpt)

`check-todos`, `task-checkpoint`, `gad-discuss-phase`, `gad-plan-phase`,
`gad-execute-phase`, `gad-verify-work`, `gad-list-phase-assumptions`,
`gad-next`, `debug`, `gad-debug`, `create-proto-skill` (decision
gad-168), `gad-evolution-evolve`, `gad-evolution-validator`,
`gad-skill-creator`, `eval-report`, `write-feature-doc`.

Full catalog on `/skills`.

### CLI surface

`gad snapshot`, `gad state`, `gad tasks`, `gad phases`, `gad decisions`,
`gad evolution status|validate|promote|discard`, `gad workflow
status|validate|promote|discard`, `gad eval run|verify|report`,
`gad verify`, plus workspace/worktree/sprint/sink commands.

## When to use it

- Long-horizon work where context compaction will happen mid-phase
- Multi-agent coordination via the agent roster
- Any project where process discipline and traceability matter more
  than raw iteration speed
- Self-improving projects where you want the framework to grow new
  skills from observed pressure

## Relationship to other frameworks

- **bare**: GAD is the opposite — rich baseline content + evolution.
  Bare is the control.
- **GSD**: GAD is a fork. See `/lineage`. Both inherit the
  discuss→plan→execute shape; GAD added XML planning, explicit task
  attribution, hydration metrics, and the evolution loop.
- **custom**: any GAD project that installs extra skills beyond the
  canonical GAD DNA is categorized as `custom` in the eval matrix
  (decision gad-164).

## Canonical comparison target

Escape the Dungeon (`escape-the-dungeon`) is the official
framework-comparison project per decision gad-164. Three species live
under that project — one bare, one gsd, one gad — with identical
requirements and tech stack. Every round of eval data flows into the
cross-framework lineage on `/lineage`.
