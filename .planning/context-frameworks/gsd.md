---
slug: gsd
name: GSD (get-shit-done)
description: The upstream framework GAD forked from — ships planning docs, 18 specialized agents, progressive-disclosure skills, and the discuss→plan→execute loop. Reviewed continuously as a living comparison target per decision gad-165.
version: upstream-main
skills: []
agents: []
workflows: []
canonicalProjects: [escape-the-dungeon-gsd]
---

## Overview

GSD (get-shit-done) is the upstream framework GAD was forked from. It
ships a full planning discipline (STATE.md, DECISIONS.md, roadmap),
an 18-agent roster with specialized roles (researcher, planner,
executor, verifier, debugger, etc.), a progressive-disclosure skill
system, and the discuss→plan→execute loop that GAD inherited.

We treat GSD as a **living comparison target** per decision gad-165,
not just historical inspiration. The upstream mirror lives in
`tmp/get-shit-done/` and we review it periodically to spot features
worth porting (or features deliberately left out).

## Relationship to GAD

GAD is a fork of GSD — the lineage is captured on `/lineage`. GAD has
diverged in several ways:

- **Markdown → XML planning artifacts** (GAD uses TASK-REGISTRY.xml,
  STATE.xml, DECISIONS.xml, ROADMAP.xml — structured data for CLI
  parsing)
- **Explicit `skill` / `agent` / `type` attribution** on every task
  (decision gad-104) so the self-eval pipeline can compute
  workflow_conformance
- **Evolution loop** (candidate → proto-skill → promoted) for
  self-improving the skill catalog (phase 42)
- **Hydration metrics** for tracking context overhead (decision gad-163)
- **Scope-tagged trace events** so framework-comparison evals can
  measure GAD's own trace discipline without cross-contamination
  (decision gad-175)

## Upstream bundle (placeholder)

Populated by a future task that walks the tmp/get-shit-done/ mirror
and extracts its skills/agents/commands into this framework's bundle.
Until then, the GSD condition in evals is implemented by copying the
upstream template into a bare project.

## When to use it

- Comparison-axis evals where you want to measure "framework but not
  GAD specifically"
- Testing whether GAD's divergences from upstream are net positive
- Demonstrating lineage to new contributors who want to understand
  how GAD relates to the upstream ecosystem
