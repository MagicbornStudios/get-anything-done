---
name: eval-skill-install
framework_skill: true
uses_cli: [gad eval setup, gad eval run, gad eval preserve]
description: >-
  Install skills into eval project templates and run evaluations with them.
  Use when the user wants to evaluate a skill by running agents with and
  without it, install a skill from a path or URL into an eval template,
  point at a skill folder and wrap it as an eval, or compare skill versions.
  Triggers on "evaluate this skill", "test this skill", "install skill into
  eval", "run eval with skill", "compare skill versions".
lane: meta
---

# eval-skill-install

Install skills into GAD eval project templates and run evaluations to measure
their impact. This is the bridge between skill creation and skill evaluation.

## When to use

- You have a skill and want to know if it helps agents
- You want to compare agent performance with vs without a specific skill
- You want to install a skill from a local path, URL, or npx skills format
- You want to add skills to an existing eval project that already has runs

## Workflow

### 1. Identify the skill to evaluate

```sh
# Local skill
ls skills/<name>/SKILL.md

# Or download from external source
npx skills add <url> --skill <name>
```

### 2. Choose or create an eval project

```sh
# List existing projects
gad eval list

# Create a new one for this skill
gad eval setup --project <skill-name>-eval
```

### 3. Install the skill into the eval template

Copy the skill directory into the eval template:

```sh
cp -r skills/<skill-name> evals/<project>/template/skills/<skill-name>
```

Update the eval's `template/AGENTS.md` to reference the installed skill.

### 4. Run with-skill vs without-skill

Run the eval twice:
- **With skill**: template includes the skill in its skills/ directory
- **Without skill**: template has no skills/ directory (baseline)

```sh
gad eval run <project>  # with skill installed
```

For baseline, temporarily remove the skill from template/ and run again.

### 5. Score and compare

```sh
gad eval score --project <project>
gad eval scores <project>   # compare across runs
gad eval diff v1 v2         # detailed comparison
```

### 6. Preserve results

```sh
gad eval preserve <project> v<N> --from <worktree-path>
```

## Installing skills from external sources

### Local path
```sh
cp -r /path/to/skill evals/<project>/template/skills/
```

### GitHub URL
```sh
npx skills add https://github.com/<org>/<repo> --skill <name>
# Then copy the installed skill to the eval template
```

### Into an existing eval with source code
If the eval project already has runs with source code, install the skill
into a new run's template to test the skill on the same codebase:

```sh
# Copy previous run's source as starting point
cp -r evals/<project>/v<N>/run/src evals/<project>/template/src

# Install skill
cp -r skills/<name> evals/<project>/template/skills/

# Run
gad eval run <project>
```
