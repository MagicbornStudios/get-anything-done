# Species & Generations

> Historical filename. This guide used to be called the "eval guide" because
> the framework's controlled-implementation vocabulary started inside the
> `gad eval` subtree. The CLI moved to evolutionary vocabulary (`projects`,
> `species`, `spawn`, `generation`) in late 2025; the file kept its URL so
> existing inbound links keep working. New copy below uses the canonical
> verbs. The legacy `gad eval` subcommand still exists but is marked
> **deprecated** in `gad --help`.

How to set up, spawn, preserve, and compare controlled implementation
generations.

## What a generation is

A **project** is the umbrella thing you are building (e.g.
`escape-the-dungeon`). A **species** is one evolutionary branch of that
project — a particular ruleset, prompt strategy, or framework mode (e.g.
`bare`, `emergent`, a test variant). A **generation** is one build of a
species: code, build output, telemetry, scoring data, all preserved as a
single immutable record.

Each generation tracks:

- domain: game, skill, software, business, stories, tooling
- mode: greenfield or brownfield
- workflow: gad, bare, emergent, or another defined condition
- optional tech stack
- runtime identity (Claude Code vs Codex vs Cursor vs ...)

Generations are the unit you compare against each other in articles and
whitepapers (the framework calls these "findings" internally — same thing,
just the operator-side name for what the public site presents as long-form
write-ups).

## Setup

### 1. Create a project

```bash
gad projects init --projectid my-thing --name "My Thing"
```

This scaffolds `.planning/` for the new project and registers it in
`gad-config.toml`.

### 2. Create a species

```bash
gad species create --project my-thing --name default
```

A species owns its requirements, prompt strategy, and any mode-specific
overrides. Most projects start with a single species and branch from there
once they have something to compare.

### 3. Write the requirements

Place the task specification in the species's planning files, usually
under:

```text
evals/my-thing/template/.planning/
```

(The directory is still called `evals/` on disk for backwards-compat.
Treat it as the species archive.)

### 4. Install skills if needed

Skills and the `gad` executable are different install paths.

```bash
# Install GAD skills from GitHub
npx skills add https://github.com/MagicbornStudios/get-anything-done

# Install a local skill into the species template
gad species edit my-thing/default --install-skills skills/my-skill

# Inherit skills from another species
gad species clone other-thing/v3 --to my-thing/inherited --inherit-skills
```

## Spawn flow

Generate the bootstrap prompt and declare the runtime that will perform
the work:

```bash
gad spawn my-thing/default --prompt-only --runtime codex
```

Or create the executable payload / worktree flow that actually launches
the runtime:

```bash
gad spawn my-thing/default --execute --runtime codex
```

`gad spawn` will attempt to ensure the selected runtime is installed
globally before the generation starts. To verify or repair manually:

```bash
gad install all --codex --global
# or:
gad install all --claude --global
```

The generated prompt always includes the per-generation env block:

```text
GAD_RUNTIME=<runtime-id>
GAD_LOG_DIR=<species-run-dir>/.gad-log
GAD_EVAL_TRACE_DIR=<species-run-dir>
```

The coding agent performs the work in the species worktree. When it stops,
preserve the result:

```bash
gad generation preserve my-thing v1 --from <agent-worktree>
gad generation verify
```

## What gets preserved

Each completed generation should be preserved once, immediately after the
agent stops.

Canonical preserved data:

- `evals/<project>/<version>/TRACE.json`
- `evals/<project>/<version>/run/`
- `evals/<project>/<version>/.gad-log/` when raw logs exist
- `TRACE.json.runtime_identity` for the actual runtime that performed the
  generation
- preserved build output for GUI/app generations

The normal cadence is one preserve step per completed generation, not
every commit. `gad generation verify` treats missing runtime identity as a
preservation failure for new generations.

## Review and scoring

Human review:

```bash
gad generation review my-thing v1 --score 0.7
gad generation review my-thing v1 --rubric '{"playability": 0.8, "ui_polish": 0.6}'
```

Cross-generation comparison:

```bash
gad generation report
```

For low-level scoring/diff calls the legacy `gad eval score|scores|diff`
verbs still work — they're deprecated but not removed, so existing
scripts keep functioning.

## Completion gates

A generation is done when:

1. the build requirement exists
2. the generation is preserved
3. human review is submitted

## Articles and whitepapers

The findings/articles surface (`/findings` in the docs site) is where
multi-generation comparisons get written up as long-form prose for
external readers. From the operator side, the inputs are the preserved
TRACE.json + run/ + scoring data described above. Treat the article
itself as a downstream artifact: write it once the generations being
compared are all preserved, verified, and reviewed.

## Site publishing

Site publishing is optional. External users can use the species &
generation system entirely from the CLI and the preserved artifacts.

If you want the marketing/landing site updated, rebuild after scoring:

```bash
cd site && pnpm build
```
