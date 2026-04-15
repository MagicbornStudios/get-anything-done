---
name: gad:eval-suite
description: Run all eval projects in parallel with bootstrap prompts
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
workflow: workflows/eval-suite.md
---

<objective>
Generate bootstrap prompts for all runnable eval projects, then launch them as parallel agents in isolated worktrees. After completion, reconstruct traces and produce a cross-project comparison report.
</objective>

<process>

1. **Generate prompts:**
   ```bash
   gad eval suite
   ```

2. **Read each generated prompt** from the suite-runs directory.

3. **Launch agents in parallel** — one per eval project, each with `isolation: "worktree"` and `run_in_background: true`. Send ALL agent launches in a single message.

4. **Wait for completion** — you will be notified as each agent finishes.

5. **Write TRACE.json** for each completed eval from the agent's reported results.

6. **Run cross-project report:**
   ```bash
   gad eval report
   ```

7. **Report findings** — what improved, what regressed, what skills were triggered or missing.

</process>

<skill>
Read and follow the companion `eval-suite` skill if it is installed.
</skill>
