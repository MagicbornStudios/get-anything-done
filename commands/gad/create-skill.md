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
1. Read the gad-skill-creator SKILL.md at `.agents/skills/gad-skill-creator/SKILL.md`
2. Follow its workflow exactly — it references the Anthropic skill-creator methodology
3. Key GAD additions:
   - Check existing CLI commands first (`gad --help`)
   - Check existing skills for overlap (`ls .agents/skills/`)
   - Add `framework_skill: true` if it's a framework skill (use `--framework` flag)
   - Scaffold eval project: `gad eval setup --project <skill-name>-eval`
   - Add `uses_cli:` frontmatter listing CLI commands the skill chains
4. Write the skill to `.agents/skills/<skill-name>/SKILL.md`
5. Create test cases in `.agents/skills/<skill-name>/evals/evals.json`
</process>
