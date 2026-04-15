---
name: gad:reverse-engineer
description: Analyze any codebase (local or GitHub URL) and produce requirements for clean-room reimplementation
argument-hint: --path <local-path> | --repo <github-url> [--branch <branch>]
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
workflow: workflows/reverse-engineer.md
---


# gad:reverse-engineer

**Workflow:** [workflows/reverse-engineer.md](../../workflows/reverse-engineer.md)

Run the workflow. All procedural detail, examples, and tool sequencing live in the workflow file per the canonical skill shape (references/skill-shape.md, decision gad-190).
