---
name: gad:eval-bootstrap
description: Bootstrap an eval agent with full GAD context injected into its prompt
argument-hint: --project <name>
allowed-tools:
  - Read
  - Write
  - Bash
  - Agent
---

<objective>
Generate a bootstrap prompt for a single eval project and launch an agent in an isolated worktree. The agent starts with all GAD context inline — it does not need to discover the loop.
</objective>

<process>

1. **Generate the bootstrap prompt:**
   ```bash
   node vendor/get-anything-done/bin/gad.cjs eval run --project $PROJECT --prompt-only
   ```

2. **Read the generated PROMPT.md** from the eval run directory.

3. **Launch an agent** with `isolation: "worktree"` using the prompt content.

4. **After completion**, reconstruct the trace:
   ```bash
   node vendor/get-anything-done/bin/gad.cjs eval trace reconstruct --project $PROJECT
   ```

</process>

<skill>
Read and follow the skill at `vendor/get-anything-done/skills/eval-bootstrap/SKILL.md`.
</skill>
