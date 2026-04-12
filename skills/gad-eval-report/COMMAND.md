---
name: gad:eval-report
description: Show cross-project eval comparison and findings
allowed-tools:
  - Read
  - Bash
---

<objective>
Generate a comparison report across all eval projects showing scores, discipline, and findings from the latest runs.
</objective>

<process>

1. **Run cross-project report:**
   ```bash
   node vendor/get-anything-done/bin/gad.cjs eval report
   ```

2. **For deeper analysis on a specific project:**
   ```bash
   node vendor/get-anything-done/bin/gad.cjs eval scores --project <name>
   node vendor/get-anything-done/bin/gad.cjs eval diff v1 v2 --project <name>
   ```

3. **Interpret findings** and recommend next actions.

</process>

<skill>
Read and follow the skill at `vendor/get-anything-done/skills/eval-report/SKILL.md`.
</skill>
