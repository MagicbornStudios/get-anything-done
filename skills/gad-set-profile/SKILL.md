---
name: gad:set-profile
description: Switch model profile for GAD agents (quality/balanced/budget/inherit)
lane: dev
type: captured-answer
argument-hint: <profile (quality|balanced|budget|inherit)>
model: haiku
allowed-tools:
  - Bash
workflow: workflows/set-profile.md
---


# gad:set-profile

**Workflow:** [workflows/set-profile.md](../../workflows/set-profile.md)

Run the workflow. All procedural detail, examples, and tool sequencing live in the workflow file per the canonical skill shape (references/skill-shape.md, decision gad-190).
