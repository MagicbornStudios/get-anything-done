# Phase 22 — Portfolio Experiment Documentation Implementation Plan

**Status:** Not started. Context window pressure forced handoff before execution.
**Unblocks:** Round 4 greenfield + brownfield experiments.
**Next session:** Run `gad snapshot --projectid get-anything-done`, read this file, execute.

---

## Goal

Scalable, CLI-driven compilation of eval experiment docs into the portfolio. Mirror how
`gad sink` compiles planning XML into MDX. When a new eval runs, a single command
(`gad eval sink` or similar) should regenerate all relevant portfolio pages.

## Target structure

```
apps/portfolio/content/docs/get-anything-done/evals/
├── index.mdx                      # hub: questions, methodology, conditions, current state
├── methodology.mdx                # preservation contract, composite formula, gates explained
├── requirements-versions.mdx      # v1→v2→v3→v4 evolution (from REQUIREMENTS-VERSIONS.md)
├── decisions.mdx                  # gad-29..gad-48 filtered to eval-relevant decisions
├── findings/
│   ├── index.mdx                  # all findings summary
│   └── 2026-04-08-freedom-hypothesis.mdx  # from FINDINGS-2026-04-08-round-3.md
├── rounds/
│   ├── index.mdx                  # round summary table + timeline
│   ├── round-1.mdx                # from EXPERIMENT-LOG.md section
│   ├── round-2.mdx
│   └── round-3.mdx
├── projects/
│   ├── index.mdx                  # all eval projects table
│   ├── escape-the-dungeon/
│   │   ├── index.mdx              # project overview (from gad.json), version history, scores
│   │   ├── v5.mdx                 # per-run page with scores, trace, links
│   │   ├── v6.mdx
│   │   ├── v7.mdx
│   │   └── v8.mdx
│   ├── escape-the-dungeon-bare/
│   │   ├── index.mdx
│   │   ├── v1.mdx
│   │   ├── v2.mdx
│   │   └── v3.mdx
│   ├── escape-the-dungeon-emergent/
│   │   ├── index.mdx
│   │   ├── v1.mdx
│   │   └── v2.mdx
│   ├── etd-brownfield-gad/index.mdx
│   ├── etd-brownfield-bare/index.mdx
│   └── etd-brownfield-emergent/index.mdx
```

## CLI command to build: `gad eval sink`

Location: add as a new subcommand of `evalCmd` in `vendor/get-anything-done/bin/gad.cjs`
right after `evalReport`.

Arguments:
- `--sink <dir>` target dir, default `apps/portfolio/content/docs/get-anything-done/evals/`
- `--force` overwrite existing generated files
- `--project <name>` limit to a single project

Behavior:
1. Walks `vendor/get-anything-done/evals/*/gad.json` for all eval projects
2. For each eval project, reads:
   - `gad.json` (name, description, eval_mode, workflow, baseline)
   - `v<N>/TRACE.json` for each version
   - `v<N>/scores.json` if present
   - `v<N>/run/` to confirm preservation
3. Reads shared docs:
   - `evals/REQUIREMENTS-VERSIONS.md`
   - `evals/EXPERIMENT-LOG.md`
   - `evals/FINDINGS-*.md`
   - `evals/DEFINITIONS.md`
4. Reads current GAD DECISIONS.xml, filters to decisions with eval-relevant keywords
5. Writes MDX files to target structure with frontmatter + isGenerated marker
6. Reports: `N files written, M files unchanged`

Reuse patterns from `vendor/get-anything-done/lib/docs-compiler.cjs` for:
- Frontmatter format
- isGenerated marker (so humans don't edit generated files)
- Skipping unchanged files

## MDX page templates

### hub (evals/index.mdx)
```mdx
---
title: "Eval Framework"
description: "How GAD measures AI workflow quality on creative implementation tasks"
isGenerated: true
---

# GAD Eval Framework

## Research questions
1. Does a structured planning framework (GAD) produce better creative implementation than freedom-first approaches?
2. Do agents improve when they inherit skills/workflow from previous runs?
3. Does framework value differ between greenfield and brownfield contexts?

## Conditions
- **GAD** — full planning framework
- **Bare** — no framework, agent creates own workflow
- **Emergent** — no framework, inherits skills from previous runs

## Current state
<ProjectSummaryTable />  (or static table)

## Key findings
- [Freedom hypothesis (round 3)](./findings/2026-04-08-freedom-hypothesis)

## Read more
- [Methodology](./methodology)
- [Requirements versions](./requirements-versions)
- [Rounds](./rounds)
- [Projects](./projects)
- [Decisions](./decisions)
```

### per-project (projects/<name>/index.mdx)
```mdx
---
title: "{name}"
description: "{description from gad.json}"
isGenerated: true
---

# {name}

**Mode:** {eval_mode} | **Workflow:** {workflow}
{baseline ? `**Baseline:** [${baseline.project} ${baseline.version}](../${baseline.project}/${baseline.version})` : ''}

## Version history

| Version | Human | Composite | Date | Notes |
|---------|-------|-----------|------|-------|
| [v8](./v8) | 0.20 | 0.177 | 2026-04-08 | Broken crafting |
| ...

## Playable builds
- [v8](/evals/{name}/v8/)
- ...

## Source
- [Template](https://github.com/MagicbornStudios/get-anything-done/tree/main/evals/{name}/template)
- [Per-run code](https://github.com/MagicbornStudios/get-anything-done/tree/main/evals/{name})
```

### per-run (projects/<name>/v<N>.mdx)
```mdx
---
title: "{project} {version}"
description: "Scores and artifacts for run {version}"
isGenerated: true
---

# {project} — {version}

**Date:** {trace.date}
**Requirements version:** {trace.requirements_version || "n/a"}
**Status:** {human_reviewed ? "Human reviewed" : "Auto-composite (provisional)"}

## Scores

| Dimension | Value |
|-----------|-------|
| requirement_coverage | {trace.scores.requirement_coverage} |
| planning_quality | {trace.scores.planning_quality} |
| per_task_discipline | {trace.scores.per_task_discipline} |
| skill_accuracy | {trace.scores.skill_accuracy} |
| time_efficiency | {trace.scores.time_efficiency} |
| human_review | {trace.scores.human_review || "not yet reviewed"} |
| **Composite** | **{trace.scores.composite}** |

## Human review
> {trace.human_review.notes}

## Resources
- [Playable build](/evals/{project}/{version}/)
- [Source code](https://github.com/.../tree/main/evals/{project}/{version}/run)
- [TRACE.json](https://github.com/.../blob/main/evals/{project}/{version}/TRACE.json)
- [PROMPT.md](https://github.com/.../blob/main/evals/{project}/{version}/PROMPT.md)

## Timing
- Duration: {trace.timing.duration_minutes} min
- Total tokens: {trace.token_usage.total_tokens}
- Commits: {trace.git_analysis.total_commits}
```

### round summary (rounds/round-<N>.mdx)
Generated from the corresponding section of EXPERIMENT-LOG.md with a results table.

### findings (findings/<slug>.mdx)
Direct MDX conversion of `FINDINGS-*.md` files with frontmatter.

## Implementation steps

1. **21-25 first** — create_skill skill (needed by bare/emergent AGENTS.md v4)
2. **21-27** — find-sprites skill (referenced by v4 UI gate)
3. **21-26** — rewrite bare/emergent AGENTS.md to be minimal
4. **22-01 to 22-10** — implement `gad eval sink` + MDX templates + run it
5. **22-10** — update DOCS-MAP.xml so `gad sink` picks up the new eval docs
6. **Verify** — run portfolio dev server, check everything renders
7. **Unblock** — mark phase 22 done, begin phase 23 (round 4 greenfield)

## Decisions and constraints

- **Simple MDX first** (per context-pressure decision). Custom React components (charts,
  live iframes) can come after round 4 ships. Use markdown tables for scores.
- **GitHub URLs** point to `MagicbornStudios/get-anything-done` for source and
  `B2Gdevs/custom_portfolio` for portfolio repo
- **Build URLs** are relative: `/evals/<project>/<version>/` (served from
  `apps/portfolio/public/evals/...`)
- **isGenerated frontmatter** on every file so humans know not to edit
- **Reuse sink pipeline** — don't write a new compiler, extend the existing one

## Files to reference

- `vendor/get-anything-done/lib/docs-compiler.cjs` — how planning docs compile
- `vendor/get-anything-done/bin/gad.cjs` line 1271 — `gad sink compile` usage
- `vendor/get-anything-done/.planning/DOCS-MAP.xml` — current doc mappings
- `apps/portfolio/content/docs/get-anything-done/planning/*.mdx` — example output format
- `apps/portfolio/content/docs/get-anything-done/evals.mdx` — current static page to replace or link from

## After phase 22

- 23-01 Run round 4 greenfield with v4 requirements
- 24-01 Run round 1 brownfield with v4 extensions
- Resume diagnosis of GAD framework (gad-48) with new data

## Open question for user (next session)

When running `gad eval sink`, should it REPLACE the existing static `evals.mdx` or coexist
with it? Recommendation: rename the static one to `evals-overview.mdx` and make the new
generated `evals/index.mdx` the canonical hub. The old one can be deleted once the new one
is verified.
