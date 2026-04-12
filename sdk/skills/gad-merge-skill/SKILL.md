---
name: gad:merge-skill
description: >-
  Fuse two or more overlapping skills into a single tailored skill. Use when
  skills have overlapping descriptions, redundant functionality, or when
  attaining a generic skill to a specific project domain. References agentskills.io
  and Anthropic skills guide for professional quality standards.
argument-hint: "<skill-a> <skill-b> [--name merged-name]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

<objective>
Merge overlapping skills into a single unified skill following the merge-skill
methodology. Consult agentskills.io and Anthropic guidelines for quality.
</objective>

<process>
1. Read the merge-skill SKILL.md at `skills/merge-skill/SKILL.md`
2. Follow its 6-step procedure exactly:
   - Step 1: Identify the overlap
   - Step 1b: Consult agentskills.io guidance (https://agentskills.io/home)
   - Step 2: Draft the merged skill
   - Step 3: Deprecate the originals (add `superseded-by` frontmatter)
   - Step 4: Update CHANGELOG
   - Step 5: Run evaluation harness (if available)
   - Step 6: Notify inheriting eval runs
3. The merged skill must meet the agentskills.io standard and Anthropic skills guide quality bar
4. Scaffold an eval project for the merged skill: `gad eval setup --project <merged-name>-eval`
</process>
