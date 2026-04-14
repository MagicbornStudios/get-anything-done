---
name: gad:create-skill
description: >-
  Create a GAD-tailored skill using the gad-skill-creator methodology. Immediately
  scaffolds an eval project. Use when creating a new skill, turning a repetitive
  CLI pattern into a skill, or when a task review reveals repeated commands.
argument-hint: "[skill-name] [--framework]"
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
Create a new GAD skill using the gad-skill-creator methodology. The skill should
use GAD CLI commands where they exist, tag task attribution, and have an eval
project scaffolded immediately.
</objective>

<process>
1. Read the gad-skill-creator SKILL.md at `skills/gad-skill-creator/SKILL.md`
2. Follow its workflow exactly — it references the Anthropic skill-creator methodology
3. Key GAD additions:
   - Check existing CLI commands first (`gad --help`)
   - Check existing skills for overlap (`ls skills/`)
   - Add `framework_skill: true` if it's a framework skill (use `--framework` flag)
   - Add `uses_cli:` frontmatter listing CLI commands the skill chains
4. Write the skill to `skills/<skill-name>/SKILL.md`
5. Create test cases in `skills/<skill-name>/evals/evals.json`
6. **MANDATORY: Scaffold eval project immediately after skill creation:**
   ```bash
   gad eval setup --project <skill-name>-eval
   ```
   This is NOT optional. Per decision gad-102, every skill must have an eval project
   on the site. The eval project validates the skill works in isolation. Verify the
   eval project exists at `evals/<skill-name>-eval/gad.json` before considering the
   skill creation complete.
7. Verify skill is discoverable: run `gad snapshot --projectid get-anything-done` and
   confirm the skill appears in the catalog scan output.
</process>
