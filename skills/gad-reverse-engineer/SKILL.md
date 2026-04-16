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

## Extraction tiers

The workflow uses a tiered extraction pipeline — highest available tier wins:

| Tier | Condition | Extractor | Speed |
|------|-----------|-----------|-------|
| 1 (native) | Target has `.planning/` XML | `lib/graph-extractor.cjs` / `gad query` | Fastest |
| 2 (pdf) | Target contains PDFs | `pdf-parse` (npm, installed) | Fast |
| 3 (graphify) | Python + `graphify` available | `graphify` CLI (external) | Slow |
| Fallback | None of the above | Manual 5-pass deep analysis | Manual |

## Outputs

- `REQUIREMENTS.xml` — stable IDs (REQ-NNN)
- `DECISIONS.xml` — inferred architectural decisions (RE-D-NNN)
- `notes/` — pitfalls, tech debt, gotchas (one file per topic)
- `graph.json` — knowledge graph of analyzed codebase
