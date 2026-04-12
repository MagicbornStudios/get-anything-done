---
name: gad:eval-list
description: List available eval projects and their run history
allowed-tools:
  - Read
  - Bash
---

<objective>
Display all eval projects in `evals/` with their run count, latest run status,
and last baseline SHA.
</objective>

<process>

1. **Find eval projects:**
   ```bash
   ls -d evals/*/ 2>/dev/null || echo "NO_PROJECTS"
   ```
   If none: `No eval projects found. Create one at evals/<name>/REQUIREMENTS.md.`

2. **For each project**, read its run history:
   ```bash
   ls -d "evals/$PROJECT"/v*/ 2>/dev/null | sort -V
   ```
   Read the latest `RUN.md` for status and baseline.

3. **Display table:**
   ```
   GAD Eval Projects

   NAME              RUNS   LATEST   STATUS     BASELINE
   ─────────────────────────────────────────────────────────
   portfolio-bare    2      v2       completed  abc1234
   my-feature        0      —        —          —
   ```

4. **Show totals:**
   ```
   2 projects, 2 total runs
   ```

</process>
