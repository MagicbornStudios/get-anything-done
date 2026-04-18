# Skill types — orthogonal to lane, answers "what shape is this skill?"

Lane (`dev` / `prod` / `meta`) answers *when in the lifecycle* a skill fires.
**Type** answers *what shape the skill has and what it does to the host
system.* Agents pick a skill by looking at both axes.

## The five types

| type | meaning | frontmatter | example |
|---|---|---|---|
| `system-requirements` | Installs a contract + UX pattern into any host codebase. Small, falsifiable requirements set; host-agnostic. Virus-like. | `type: system-requirements` | `gad-visual-context-system`, `scaffold-visual-context-surface` |
| `captured-answer` | "When you hit X, do Y, because Z." Fix recipe or decision capture. Scoped to one repeatable problem. | `type: captured-answer` | most `gad-add-*`, `gad-debug`, recipe fixes |
| `workflow` | Long-form procedure the skill delegates to. Thin SKILL.md + sibling `workflow.md` carrying the steps. Bundle. | `type: workflow` | `gad-visual-context-system` (thin SKILL → `workflows/visual-context-system.md`), `gad-pause-work` |
| `command-wrapper` | Thin adapter over a CLI or script. No methodology beyond "here's how to invoke this command correctly". | `type: command-wrapper` | `gad-update`, `eval-run` |
| `meta-framework` | Framework-on-framework. Creates/evolves/sheds other skills, reindexes catalogs, versions GAD itself. Always `lane: meta`. | `type: meta-framework` | `create-skill`, `gad-evolution-evolve`, `framework-upgrade` |

Type is **orthogonal to lane**. A skill can be `lane: dev, type: workflow`
(e.g. `gad-plan-phase` — dev-time workflow) or `lane: meta, type: meta-
framework` (e.g. `gad-evolution-evolve`). Common pairings:

| lane → | dev | prod | meta |
|---|---|---|---|
| **system-requirements** | VCS scaffolders | release requirements | evolution-output hygiene |
| **captured-answer** | most fix recipes | release checklists | framework-only recipes |
| **workflow** | plan/execute/verify | release/ship | evolve/promote/shed |
| **command-wrapper** | `gad-do` | `gad-update` | `gad-skill-creator` |
| **meta-framework** | rare; surfaces when lane spans `[dev, meta]` (e.g. `gad-reverse-engineer`, `gad-auto-conventions`) | — | all create/shed/evolve |

**Observed lane-type pairings worth noting** (from 2026-04-18 wave 3-5 type-tag pass):

- `gad-verify-work` — `lane: [dev, prod]`, `type: workflow`. Cross-lane workflows are common.
- `gad-validate-phase` — `lane: [dev, prod]`, `type: captured-answer`. The `prod`-side `captured-answer` cell ("release checklists") generalizes to phase-validation checklists.
- `gad-reverse-engineer` and `gad-auto-conventions` — `lane: [dev, meta]`, `type: meta-framework`. Span dev work and framework hygiene; classified by dominant shape (framework behavior wins when both apply).

When a skill genuinely sits across two lanes, classify by the dominant *shape* it instantiates on the host, not by the lane bias of the matrix's example slot.

## Why separate from `lane`

Lane answers *when* ("during the build" vs. "before release" vs. "framework
hygiene"). Type answers *what shape the agent is reading* so it can:

- Skim differently. A `workflow` skill is a thin pointer + long procedure
  file; a `captured-answer` skill is self-contained. Reader behavior differs.
- Bundle differently. Bundle skills (`workflow`, `command-wrapper`,
  `system-requirements`) ship SKILL.md + sibling files (PROVENANCE.md,
  VALIDATION.md, workflow.md, COMMAND.md). Non-bundle skills ship just
  SKILL.md.
- Shed differently. A `captured-answer` whose recipe is obsolete is safe
  to delete. A `system-requirements` skill is load-bearing — don't shed
  without checking the consumers.

## Frontmatter schema update

Add `type:` to the frontmatter of every SKILL.md, immediately after `lane:`:

```yaml
---
name: gad-visual-context-system
description: >-
  ...
lane: dev
type: system-requirements
source_phase: "44"
workflow: workflows/visual-context-system.md
---
```

Valid values: `system-requirements`, `captured-answer`, `workflow`,
`command-wrapper`, `meta-framework`. Arrays (dual-type) permitted for
genuine cross-shape skills but expect to justify in description.

## Surfacing in CLI

Once frontmatter is populated:

- `gad skill list --type workflow` — filter catalog by shape
- `gad skill list --type system-requirements --lane dev` — compound filter
- `gad skill status <id>` shows both `lane: X` and `type: Y` in the health card

## Rollout

Framework contract drift is fine — add `type:` as a **recommended** (not
required) field in `lib/skill-linter.cjs`. Warn on missing; don't block.
Landing plan mirrors the lane rollout (phase 55 waves):

| Wave | Target |
|---|---|
| 1 | `system-requirements` — VCS family, the pattern-defining ones first |
| 2 | `meta-framework` — evolution + create-skill cluster |
| 3 | `workflow` — thin-SKILL + workflow.md bundles |
| 4 | `command-wrapper` — CLI adapters |
| 5 | `captured-answer` — the long tail, default when nothing else fits |

Haiku subagent eligible for waves 3-5 (mechanical per-file frontmatter
edit). Waves 1-2 merit more care — these are the skills whose shape
defines the catalog, classification deserves human read.

## Relationship to `gad-visual-context-system` parent contract

VCS is the canonical `system-requirements` exemplar (see
`project_compartmentalized_skill_pattern` memory + the quality-bar section
in `skills/create-skill/SKILL.md`). Every `system-requirements` skill
should name, up top:

1. A small requirements contract (3-6 falsifiable items)
2. The UX or behavior pattern the skill instantiates
3. Preconditions (dev gate, runtime, eval condition, lane)
4. Host-agnostic phrasing (no "install React component X")

A `system-requirements` skill that doesn't meet this bar is really a
`captured-answer` — downgrade the type.
