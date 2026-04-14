# Phase 43: Domain rename + project/species schema unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in 43-CONTEXT.md — this log preserves the reasoning.

**Date:** 2026-04-13
**Phase:** 43-domain-rename-project-species-schema-unification
**Mode:** discuss (interactive)

## Gray Areas Presented

1. Directory layout vs. parent_project field — physical merge, vs. keep three sibling dirs with a new `parent_project` field, vs. hybrid with symlinks.
2. Vocabulary lock — confirm rounds→evolutions, v1/v2→generations, brood, DNA, spawn.
3. Species identity tuple — (project, workflow), (project, context_framework, workflow), (project, context_framework), or (project, context_framework, tech_stack).
4. Migration atomicity — one-shot script vs. runtime dual-read adapter.
5. Sequencing with phase 44 — strict scope vs. pull forward stub fields.
6. History rewrite — rewrite closed phase prose, or going-forward only.

## User Decisions

| # | Question | User answer |
|---|----------|-------------|
| 1 | Layout | **Physical merge** into one parent dir per project |
| 2 | Vocabulary | rounds→evolution ✓, v1/v2→generation ✓, **drop "brood"** (generations alone is sufficient), DNA ✓, spawn ✓ |
| 3 | Species tuple | **(d) — (project, context_framework, tech_stack)**; workflow lives inside DNA |
| 4 | Migration | **One-shot script**, no runtime adapter |
| 5 | Phase 44 fields | **Pull forward** — phase 43 delivers cardImage/tagline/heroImage stubs |
| 6 | History rewrite | **Going forward only** (recommendation accepted after follow-up) |

## Follow-up Round (cascading from "drop brood")

| # | Question | User answer |
|---|----------|-------------|
| A | "Brood Editor" rename for phase 44.5 | **Species Editor** + a parent **Project Editor** surface with multi-species/multi-generation viewing, requirement editing, species launching. Lovable/Bolt-style DNA/framework/stack visualization for species without a build. Captured in Deferred Ideas. |
| B | Cohort term needed? | **No.** First wanted "a term" for the cross-species cohort (an evolution's cross-species output), considered "clutch" / "hatch" — then on reflection said "just call them generations." Locked: no new word. |
| C | History rewrite | **Going forward only.** |

## Reasoning Notes

- The species tuple choice (d) is the highest-leverage decision because it propagates into build-site-data grouping, the project page card layout, and how phase 44's marketplace facets are scoped. By putting workflow inside DNA rather than in the identity tuple, the model matches gad-176 (context framework as first-class axis) and gad-178 (skills determine workflows) cleanly.
- Dropping the cohort term is a deliberate vocabulary-bloat avoidance call. Phase 45 (rebrand) is supposed to *remove* terms, not add them. "Generation 4 across species" is fine in plain English.
- The "evolution = project-level requirement-change event" framing the user gave in the follow-up round is now the canonical definition (D-01) and replaces the earlier "evolution = round" partial framing.
- The Species Editor / Project Editor scope expansion is significant for phase 44.5 — it more than doubles that phase's surface area. Captured fully in Deferred Ideas so 44.5's planner inherits it without re-asking.
</content>
</invoke>