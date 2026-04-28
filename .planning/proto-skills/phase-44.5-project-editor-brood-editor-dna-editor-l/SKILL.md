---
name: build-dna-editor-surface
description: >-
  Build the DNA Editor — a four-pane lifecycle viewer (DNA / Expressed /
  Mutation / Shed) over a project's skills, sandboxes, proto-skills, and
  shed candidates. Local-dev only (`NODE_ENV=development`), wired through
  the Visual Context System with deterministic cids per gene-state +
  action button, action-streamed via the dev-server command bridge. Use
  when adding the DNA Editor to a new project or extending it with a new
  gene state.
status: proto
workflow: ./workflow.md
---

# build-dna-editor-surface

Decision gad-198 collapsed skill lifecycle to a two-verb model
(express via `gad try`, integrate via `gad evolution promote`) over four
states (DNA, Expressed, Mutation, Shed). The DNA Editor is the operator
surface that makes those states visible and actionable from inside
local-dev, gated to `NODE_ENV=development` and bridged through the
canonical dev-server command bridge.

This skill is the assembly recipe — pane scaffolding, population sources,
action wiring, iframe preview, command+K shortcuts — derived from the
25-task phase 44.5 build.

**Workflow:** [./workflow.md](./workflow.md)

## Provenance

- Source candidate: `.planning/candidates/phase-44.5-project-editor-brood-editor-dna-editor-l/CANDIDATE.md`
- Drafted: 2026-04-28 by `create-proto-skill`
- See [PROVENANCE.md](./PROVENANCE.md)
