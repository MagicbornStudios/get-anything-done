# Candidate: gad-cli-over-file-foraging

## Source
Evolution scan 2026-05-09, gad-ask MoE design + tool-use DPO seed rows.

## Observation
Agents habitually open `.planning/` XML files with Glob+Read+Grep to answer questions that `gad decisions list`, `gad tasks list`, `gad errors`, and `gad snapshot` answer cheaper and more completely. The pattern wastes context tokens and bypasses CLI parsing that aggregates multi-source data.

## Hypothesis
If agents default to `gad <subcommand>` and `gad ask` for planning-data questions before file-foraging, context cost drops and answer quality improves (CLI aggregates; raw files don't).

## Evidence
- `gad ask` MoE design (today's session)
- Tool-use DPO seed rows showing file-forage patterns as negative examples
- CLAUDE.md "Do NOT manually read 10+ planning files" standing rule
