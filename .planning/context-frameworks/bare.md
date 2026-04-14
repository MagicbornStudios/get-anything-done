---
slug: bare
name: Bare
description: No framework content — a project starts empty and the agent reads only requirements. The control condition for framework-comparison evals. Decision gad-164 matrix baseline.
version: 1.0.0
skills: []
agents: []
workflows: []
canonicalProjects: [escape-the-dungeon-bare]
---

## Overview

Bare is the **control condition** for the framework comparison matrix
(decision gad-164). A project on the bare framework ships nothing: no
installed skills, no agent roster, no authored workflows, no planning
artifacts. The agent is given a requirements doc and whatever tech
stack the project targets — and nothing else.

## Why it exists

Bare is what we measure every other framework against. When GAD or GSD
produces a better outcome, we can point to specific framework content
that made the difference; when bare wins (which it has, see findings
2026-04-08-round-3), we know the framework is adding overhead without
proportional value.

## What a bare project contains

- The target tech stack (kaplay, phaser, three, etc.)
- A `REQUIREMENTS.md` file describing what to build
- Nothing else — no `.planning/`, no `skills/`, no `agents/`, no
  `workflows/`

## When to use it

- Running framework-comparison evals against a new target tech stack
- Establishing a baseline for a new eval project before installing a
  framework on top
- Testing whether a specific framework feature actually improves
  outcomes on a given domain

## What it doesn't support

- No workflow conformance tracking (no authored workflows to diff
  against)
- No persistent state across context compaction (no STATE.xml to
  re-hydrate from)
- No task attribution (no TASK-REGISTRY.xml)
- No decision log
- Bare is intentionally minimal — adding any of the above turns it
  into a `custom` condition per decision gad-164.
