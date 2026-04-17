# Roadmap artifact — keep, fold into workflows, or kill?

**Date**: 2026-04-16
**Status**: **RESOLVED 2026-04-16 — Option D (demote, drop gauge) via decision gad-229.** B and C remain viable long-term restructures and this note is kept as the durable record for the future phase that revisits them.
**Related decisions**: gad-226 (planning artifacts as gauges), gad-229 (this resolution)

## The question

In the gauge model (gad-226), four of the five artifacts have clear semantic
meaning:

| Artifact | Means |
|---|---|
| Decisions | Direction |
| Tasks | Implementation detail |
| Requirements | What to build |
| Notes | Exploration / open questions |
| **Roadmap** | **???** |

The operator flagged roadmap's meaning as unclear and asked whether it should
be removed as a first-class artifact or folded into workflows.

## What ROADMAP.xml currently carries

- Phase ID, title, status, goal — per-phase metadata
- Dependency graph between phases (`depends="X,Y"`)
- Sprint window — which phases are "in-sprint" at a given moment
- Milestone grouping

TASK-REGISTRY.xml references phases by ID. Tasks belong to phases. Phase
metadata lives in ROADMAP.xml; task detail lives in TASK-REGISTRY.xml.

## Candidate interpretations for a roadmap gauge

If roadmap stays as an artifact, possible semantic mappings:

| Candidate | What the gauge measures | Sweet spot / imbalance |
|---|---|---|
| **Sequencing** | Depth of phased structure (how many phases deep is the plan) | Too few = no horizon; too many = over-planned futurism |
| **Horizon** | How far ahead the agent is looking vs the current sprint | Healthy when current-sprint depth ≈ 3-5 and future-phase depth ≪ |
| **Readiness** | Fraction of phases with non-empty goals + dependencies wired | High = well-formed plan; low = placeholder shells |
| **Velocity** | Phases done per unit time vs phases added | Net-positive = shipping; net-negative = scope creep |

None of these feel as crisp as "decisions = direction" or "requirements = what to build."

## Options

### Option A — keep roadmap as its own artifact + gauge (horizon meter)

Pros: no migration cost; roadmap is already wired everywhere; agents rely on
`gad phases` output. Cons: weakest gauge semantic of the five; user flagged it
as unclear.

### Option B — fold roadmap phases into task metadata, kill ROADMAP.xml

Phase becomes a tag on tasks. Phase metadata (title, goal, status) synthesized
from the first task in a phase, or lifted onto a lightweight phase-index file.

Pros: reduces artifact count from 5 → 4; eliminates the unclear gauge.
Cons: breaking schema change; `gad phases` + planning graph + snapshot all
need rewires; phase-level decision cross-references break.

### Option C — reframe roadmap as a **workflow instance**

A phase = an instance of a "plan-build-ship" workflow. The workflow is the
generic pattern; the roadmap is the set of active instances. This matches the
user's "integrated within our workflows" hint. The roadmap as an ARTIFACT
disappears; what's left is a workflows view that shows running/completed
workflow instances.

Pros: unifies "how we work" (workflows) with "what we're working on" (roadmap
instances). Conceptually elegant. Cons: workflows today are methodology docs
(gad-loop, gad-discuss-plan-execute, etc.) — not instance-aware. This would
require a new "workflow instance" concept, schema, and UI.

### Option D — demote roadmap: keep the artifact, drop the gauge

Roadmap still exists as an agent-consumable planning input, but does NOT get
a gauge in the human-facing editor. The five-gauge set becomes a four-gauge
set (decisions, tasks, requirements, notes). Simplest split between "what
agents need" and "what humans watch."

Pros: no breaking change; clean gauge semantics. Cons: arbitrary-feeling — why
does this artifact get no gauge?

## Recommended direction (my take — not yet decided)

Option D for the immediate next step. Rationale: any of B or C require
schema/tooling migration that won't happen this sprint, and the user has
pending higher-priority work (editor gauges, listing visibility, agent
selector). Demote roadmap from the gauge set now, keep ROADMAP.xml as
agent input, and come back to B/C in a discuss-phase when the gauge UI is
shipped and we can see whether roadmap actually adds operator-facing value.

Option C is the most interesting long-term direction — it would collapse a
concept rather than add one. Worth exploring in a separate phase once
workflow instances are a shape we actually need.

## What to do with this note

Pending operator direction. This note is the durable record; the gauge
implementation (follow-up todo) can proceed with four gauges initially and
this question gets folded back in when it's answered.
