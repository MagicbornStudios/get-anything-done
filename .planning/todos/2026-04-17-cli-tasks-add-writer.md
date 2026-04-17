# gad tasks add CLI writer

**Source:** 2026-04-17 session 4 — llm-from-scratch phase 01 decomposition

Missing CLI: `gad tasks add <id> --phase X --type Y --goal ...`. Currently must hand-roll TASK-REGISTRY.xml entries. Parallel to existing `gad phases add` and `gad decisions add`. Surfaced while decomposing llm-from-scratch phase 01 into 9 sub-tasks. Per memory feedback feedback_use_cli_for_conversions: hand-editing structural planning XML should be an exception — surface the gap as a framework task. Suggested signature:

gad tasks add <ID> --phase <PHASE> --type <TYPE> --goal <GOAL> [--status planned] [--projectid <ID>] [--skill <SKILL>]

Types (from TASK-REGISTRY attribution convention): framework, cli, site, eval, pipeline, skill, cleanup, docs, scaffold, code, data, teachings, verify.
