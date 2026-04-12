---
name: gad-skill-creator
description: >-
  Create GAD-tailored skills that use the GAD CLI, planning artifacts, and eval
  framework. Use when the user wants to create a new skill for the GAD workflow,
  turn a repetitive CLI pattern into a skill, evaluate an existing skill, or
  enhance a workflow by reviewing tasks for repeated commands. Also triggers on
  "make a skill for", "create skill", "we should have a skill that", "turn this
  into a skill", or when a task completion reveals repetitive CLI patterns.
  Immediately scaffolds an eval project for framework skills.
---

# gad-skill-creator

Create skills tailored to the GAD workflow. Built on top of the Anthropic
skill-creator methodology (see `references/anthropic-skill-creator.md`) but
specialized for GAD's CLI, planning artifacts, and evaluation framework.

## What makes a GAD skill different

GAD skills prefer CLI commands over manual file operations (decision gad-99,
use good judgment). They chain `gad` CLI commands when possible. They know about
planning artifacts (STATE.xml, TASK-REGISTRY.xml, DECISIONS.xml). Framework
skills get formal evaluation and are labeled as such.

A GAD skill is NOT just instructions with GAD references. It should:
1. Use `gad` CLI commands where they exist
2. Reference planning artifacts by their standard names
3. Tag its tasks with skill/agent attribution (decision gad-104)
4. Have an eval project scaffolded immediately (decision gad-102)

## Workflow

### 1. Identify what the skill should do

Sources of skill ideas:
- **User request**: "make a skill for X"
- **Task review (enhance)**: Review completed tasks for repetitive CLI patterns.
  If 3+ tasks used the same sequence of commands, that's a skill candidate.
  (decision gad-105)
- **Merge opportunity**: `gad:merge-skill` detected overlapping skills
- **CLI pattern**: A `gad` CLI command sequence that agents keep repeating

### 2. Check existing CLI coverage

Before creating a skill, check if the GAD CLI already handles it:

```sh
gad --help 2>&1 | grep -i "<keyword>"
gad eval --help 2>&1
gad <subcommand> --help 2>&1
```

If a CLI command exists, the skill should wrap/chain it, not reimplement.
If multiple CLI commands need chaining, that IS the skill.

### 3. Check existing skills

```sh
ls skills/
```

Read any similar skills. If overlap exists, use `gad:merge-skill` instead of
creating a new one.

### 4. Draft the skill

Follow the Anthropic skill-creator's SKILL.md anatomy:

```
skill-name/
├── SKILL.md          # Required: frontmatter + instructions
├── references/       # Docs loaded as needed
├── scripts/          # Executable automation
└── evals/
    └── evals.json    # Test cases
```

GAD-specific additions to frontmatter:
```yaml
---
name: skill-name
description: >-
  Descriptive trigger text. Be pushy per Anthropic guidelines.
framework_skill: true|false    # true = formal evaluation required
uses_cli: [gad eval, gad state] # CLI commands this skill chains
---
```

### 5. Scaffold the eval project immediately

For framework skills (or any skill the user wants evaluated):

```sh
gad eval setup --project <skill-name>
```

This creates `evals/<skill-name>/gad.json` and `template/`. The eval measures
whether the skill improves agent outcomes vs not having the skill.

### 6. Write test cases

Create `evals/evals.json` inside the skill directory with 2-3 realistic
test prompts. Follow the Anthropic skill-creator format:

```json
{
  "skill_name": "my-gad-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "Realistic user task that should trigger this skill",
      "expected_output": "What success looks like",
      "expectations": ["Verifiable outcome 1", "Verifiable outcome 2"]
    }
  ]
}
```

### 7. Run and evaluate

Use the Anthropic skill-creator's evaluation methodology:
- Read `references/anthropic-skill-creator.md` for the full eval loop
- Spawn with-skill and without-skill runs
- Grade, aggregate, review with user
- Iterate until satisfied

### 8. Enhance review (post-creation)

After the skill is in use, periodically review tasks that used it:
1. What repetitive commands appeared?
2. Should we create a script for them?
3. Should we stack CLI commands instead?
4. Should this become a `gad` CLI command?

This feeds the cycle: CLI grows → skills thin → merge overlapping → repeat.

## Installing skills into eval projects

To evaluate a skill by installing it into an existing eval project:

```sh
# Install a local skill into an eval template
gad eval run --install-skills path/to/skill <project>

# Install from npx skills format
npx skills add <url> --skill <name>
# Then point the eval at it
```

The CLI handles copying the skill into the eval template, updating AGENTS.md
skill references, and recording the installation in TRACE.json (decision gad-107).

## Framework vs non-framework skills

**Framework skills** (tagged `framework_skill: true`):
- Related to GAD CLI, planning artifacts, eval framework, or core workflow
- Require formal controlled evaluation
- Labeled and identifiable on the site
- Examples: trace-analysis, self-eval, snapshot-optimize

**Workflow skills** (default):
- Project-specific or domain-specific
- Evaluated through rounds (observational data from real usage)
- Still show usage metrics on the site from trace logs
- Examples: find-sprites, frontend-design

## Reference

Read `references/anthropic-skill-creator.md` for the full Anthropic skill-creator
methodology — this GAD skill creator follows the same eval loop but adds:
- CLI-first design
- Immediate eval project scaffolding
- Task attribution tagging
- Enhance review workflow
- Framework/workflow skill distinction
