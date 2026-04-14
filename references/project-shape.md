# Canonical Planning Root Shape

> **Status:** normative. Source of truth for `gad projects init` (task 42.4-08)
> and `gad projects audit` (task 42.4-09, the "gad health" check).
> **Last reviewed:** 2026-04-14 (task 42.4-09, decision gad-185).

## 1. Purpose

Every GAD-tracked project lives under a *planning root* — a directory containing
a `.planning/` subdirectory populated with a known set of XML planning files and
optional supporting directories. Over the 40+ phases of framework evolution the
"known set" has drifted: some projects have `HUMAN-TODOS.xml`, some have
`phases/`, some have `plans/`, some have `proto-skills/`, some have `notes/`,
and no single file names the canonical shape. `gad projects init` scaffolds a
4-file markdown set that nobody actually uses, while `gad projects audit` only
checks `STATE.xml` + `ROADMAP.xml` as required and treats `REQUIREMENTS.xml`,
`DECISIONS.xml`, and `AGENTS.md` as interchangeable "recommended" files. This
drift surfaced concretely on 2026-04-14 during app-forge scaffolding: `gad
projects init` wrote markdown templates that had to be hand-converted to XML,
and nothing caught the shape mismatch until a human noticed (see
`ERRORS-AND-ATTEMPTS.xml` entry `forge-init-md-misaction-2026-04-14`).

This document pins the canonical minimum file set, the canonical optional file
set, the legacy/deprecated names to avoid, and the minimum valid XML header for
each required file. It is the contract both `gad projects init` and `gad
projects audit` MUST agree on.

## 2. Canonical minimum file set

Every `.planning/` directory MUST contain all of the following files. A planning
root that is missing any of these is "out of canonical shape" and `gad projects
audit` will flag it.

| File | Purpose |
|---|---|
| `STATE.xml` | Current phase, status, and next-action for the project. |
| `ROADMAP.xml` | Ordered phases + milestones. |
| `TASK-REGISTRY.xml` | Task ledger (every task with status, skill, agent, type). |
| `DECISIONS.xml` | Architecture / policy decision log. |

These four files are universal: they are present in 7/7 audited roots (see
§6). They are the minimum needed for `gad snapshot`, `gad state`, `gad phases`,
`gad tasks`, `gad decisions` to all return useful output.

> **Note on `PROJECT.xml`:** this file is cited in the 42.4-09 task goal as a
> candidate canonical-minimum file, but it is present in **0/7** audited roots.
> Project identity metadata currently lives in `STATE.xml` / `ROADMAP.xml`
> attributes and in the `[[planning.roots]]` entry in `gad-config.toml`. Rather
> than invent a new required file that no existing root has, `PROJECT.xml` is
> left *optional* in §3. If a future phase decides every project needs a
> dedicated identity file, that phase can promote it to minimum and backfill —
> see decision gad-185.

> **Note on `REQUIREMENTS.xml` and `ERRORS-AND-ATTEMPTS.xml`:** these are
> present in 4/7 audited roots each and are strongly recommended but not
> required. A brand-new project that has not yet captured requirements or
> negative results is still a valid planning root. They are canonical optional
> (§3) rather than canonical minimum.

## 3. Canonical optional file set

Files a planning root MAY have. `gad projects audit` reports presence as
informational and never fails on absence.

### Files

| File | When to add |
|---|---|
| `REQUIREMENTS.xml` | As soon as scope is captured. Strongly recommended; most mature projects have it. |
| `ERRORS-AND-ATTEMPTS.xml` | As soon as the first failed experiment is worth recording. Strongly recommended. |
| `HUMAN-TODOS.xml` | When the project has actions that only a human can perform (purchases, account setup, physical tasks). Agent-doable work belongs in `TASK-REGISTRY.xml`, not here (see memory `feedback_human_todos_scope`). |
| `BLOCKERS.xml` | When the project wants a durable list of cross-phase blockers separate from `TASK-REGISTRY` statuses. Rare — only 1/7 roots use it (grime-time). |
| `PROJECT.xml` | Reserved for a future phase that standardizes project identity. Currently unused. |
| `DOCS-MAP.xml` | Framework/doc-heavy projects with many cross-references that benefit from an explicit map. Currently only `get-anything-done` uses it. |
| `AGENTS.md` | Project-specific agent loop instructions that override the repo-root `CLAUDE.md`. Only `global` uses it. |
| `CONVENTIONS.md` | Project-specific enforced coding/doc conventions. Produced by `/gad-auto-conventions` in a phase 01 post-scaffold pass. |
| `README.md` | Human-authored overview of the planning dir itself. Rare. |

### Directories

| Directory | When to add |
|---|---|
| `phases/` | Multi-phase projects that want per-phase scratch dirs (KICKOFF, PLAN, VERIFICATION artifacts). Produced by `/gad-plan-phase`. |
| `plans/` | Cross-phase planning artifacts that aren't phase-scoped (e.g. forge proving-ground, inheritance specs). |
| `proto-skills/` | Staged proto-skills awaiting promotion or install per decision gad-183. Framework-adjacent projects only. |
| `workflows/` | Project-specific workflow documents (distinct from canonical framework `workflows/`). |
| `notes/` | Free-form notes that haven't been promoted to decisions/requirements yet. Captured by `/gad-note`. |
| `todos/` | Parking lot for todos captured via `/gad-add-todo` or `/gad-note`. |
| `debug/` | Persistent debugging state per `/gad-debug`. |
| `reports/` | Session / audit / self-eval output. |
| `sessions/` | Session handoff files from `/gad-pause-work` / `/gad-resume-work`. |
| `specs/` | Long-form specifications that don't fit in `REQUIREMENTS.xml` (framework projects only). |
| `context-frameworks/` | Framework meta only (`get-anything-done`). |
| `codebase/` | Output of `/gad-map-codebase`. |
| `docs/` | Project-internal docs (distinct from the repo-level docs sink). |
| `archive/` | Archived artifacts from completed milestones. |
| `templates/` | Project-local templates (distinct from canonical framework `templates/`). |
| `quick/` | Ad-hoc scratchpad. |
| `skills/` | **Deprecated project-local skill staging** — use `proto-skills/` instead (see §4). |
| `.eval-runs/` | Transient session markers from `gad:eval-spawn`. Runtime-only, git-ignored. |

## 4. Legacy / deprecated names

If `gad projects audit` finds any of these, it should warn.

| Legacy name | Replacement | Deprecated by |
|---|---|---|
| `gad.json` (top-level species config) | `species.json` | Phase 43 + task 42.4-14. |
| `PROJECT.md` (markdown project file at planning root) | no replacement yet — leave absent, or promote to `PROJECT.xml` if/when 42.4-08 decides. | Task 42.4-08 scaffolding correction. |
| `REQUIREMENTS.md` / `ROADMAP.md` / `STATE.md` / `DECISIONS.md` in a root whose other files are XML | the XML equivalent | Phase 40 canonical XML shift; reinforced by task 42.4-08. |
| `skills/proto-skills/` | `.planning/proto-skills/` | Decision gad-183. |
| `skills/` (as a project-local staging dir for proto-skills) | `.planning/proto-skills/` | Decision gad-183. Note: grime-time still has this shape and is flagged as out-of-canonical in §6. |
| `sdk/skills/` (as a promotion target) | canonical `skills/` at framework root | Decision gad-183. |
| `config.json` inside `.planning/` | superseded by `gad-config.toml` at repo root; still present in two roots for historical reasons but not read by current CLI. | Phase 41 multi-root consolidation. |
| `REPOPLANNER-TO-GAD-MIGRATION-GAPS.md` | one-shot migration note, safe to archive. | Migration complete. |

## 5. Per-file minimum valid content

These are the headers `gad projects init` MUST scaffold when bootstrapping a new
planning root. Each file is valid XML on its own and parses cleanly with the
existing `readXmlFile` helper in `bin/gad.cjs`.

### `STATE.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<state project="<project-id>" schema="1">
  <status>planning</status>
  <milestone>v1</milestone>
  <current-phase>01</current-phase>
  <last-activity>YYYY-MM-DD</last-activity>
  <next-action>Run /gad-new-project or /gad-plan-phase to bootstrap the first phase.</next-action>
</state>
```

### `ROADMAP.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<roadmap project="<project-id>" schema="1">
  <milestone id="v1" status="active">
    <title>Initial milestone</title>
    <phase id="01" status="planned">
      <title>Bootstrap</title>
      <goal>Scaffold the project and capture initial requirements.</goal>
    </phase>
  </milestone>
</roadmap>
```

### `TASK-REGISTRY.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<task-registry project="<project-id>" schema="1">
  <phase id="01">
    <!-- <task id="01-01" type="..." status="planned"><goal>...</goal></task> -->
  </phase>
</task-registry>
```

### `DECISIONS.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<decisions project="<project-id>" schema="1">
  <!-- <decision id="<project-id>-001"><title>...</title><summary>...</summary><impact>...</impact></decision> -->
</decisions>
```

### Optional: `REQUIREMENTS.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<requirements project="<project-id>" schema="1">
  <!-- <requirement id="REQ-001" priority="must"><goal>...</goal></requirement> -->
</requirements>
```

### Optional: `ERRORS-AND-ATTEMPTS.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<errors-and-attempts project="<project-id>" schema="1">
  <!-- <entry id="<slug>-YYYY-MM-DD" date="YYYY-MM-DD"><what>...</what><why>...</why><lesson>...</lesson></entry> -->
</errors-and-attempts>
```

## 6. Audit results (2026-04-14)

Captured by listing every `.planning/` dir in every `[[planning.roots]]` entry
in `gad-config.toml`. Columns = the seven registered roots. Rows = every file
or directory observed in at least one root. `Y` = present, `-` = absent.

### 6a. Canonical minimum

| File | gad (framework) | global | app-forge | magicborn | grime-time | mb-cli | repub-builder |
|---|---|---|---|---|---|---|---|
| `STATE.xml` | Y | Y | Y | Y | Y | Y | Y |
| `ROADMAP.xml` | Y | Y | Y | Y | Y | Y | Y |
| `TASK-REGISTRY.xml` | Y | Y | Y | Y | Y | Y | Y |
| `DECISIONS.xml` | Y | Y | Y | Y | Y | Y | Y |

**Result:** 7/7 roots are canonical-minimum-clean. No root needs a backfill for
the required set.

### 6b. Canonical optional — files

| File | gad | global | app-forge | magicborn | grime-time | mb-cli | repub-builder |
|---|---|---|---|---|---|---|---|
| `REQUIREMENTS.xml` | - | Y | Y | - | Y | - | - |
| `ERRORS-AND-ATTEMPTS.xml` | Y | Y | Y | - | Y | - | - |
| `HUMAN-TODOS.xml` | - | Y | - | - | - | - | - |
| `BLOCKERS.xml` | - | - | - | - | Y | - | - |
| `DOCS-MAP.xml` | Y | - | - | - | - | - | - |
| `AGENTS.md` | - | Y | - | - | - | - | - |
| `README.md` | - | - | - | - | Y | - | - |
| `config.json` (legacy) | Y | Y | - | - | - | - | - |
| `session.md` | - | Y | - | - | - | - | - |
| `REPOPLANNER-TO-GAD-MIGRATION-GAPS.md` | - | Y | - | - | - | - | - |
| `gad-config.toml` (symlink/copy) | - | Y | - | - | - | - | - |

### 6c. Canonical optional — directories

| Dir | gad | global | app-forge | magicborn | grime-time | mb-cli | repub-builder |
|---|---|---|---|---|---|---|---|
| `phases/` | Y | Y | - | - | Y | - | - |
| `plans/` | Y | - | Y | - | - | - | - |
| `proto-skills/` | Y | - | - | - | - | - | - |
| `workflows/` | Y | - | - | - | Y | - | - |
| `notes/` | Y | - | - | - | Y | - | - |
| `specs/` | Y | - | - | - | - | - | - |
| `context-frameworks/` | Y | - | - | - | - | - | - |
| `docs/` | Y | - | - | - | - | - | - |
| `archive/` | Y | - | - | - | - | - | - |
| `codebase/` | - | Y | - | - | - | - | - |
| `debug/` | - | Y | - | - | Y | - | - |
| `reports/` | - | Y | - | - | Y | - | - |
| `sessions/` | - | Y | - | - | - | - | - |
| `templates/` | - | - | - | - | Y | - | - |
| `todos/` | - | - | - | - | Y | - | - |
| `quick/` | - | - | - | - | Y | - | - |
| `skills/` (legacy) | - | - | - | - | Y | - | - |

### 6d. Out-of-canonical-shape flags

- **`grime-time`** — has legacy project-local `skills/` directory (decision
  gad-183 deprecated this in favor of `.planning/proto-skills/`). Remediation:
  move or archive. Otherwise canonical-minimum-clean.
- **`gad` (framework) and `global`** — have legacy `config.json` inside
  `.planning/`. Remediation: confirm no current CLI path reads it, then remove.
- **`magicborn`, `mb-cli-framework`, `repub-builder`** — missing both optional
  `REQUIREMENTS.xml` and `ERRORS-AND-ATTEMPTS.xml`. Not a shape violation (both
  are optional), but flagged as "thin" — these projects may benefit from
  capturing scope and negative results explicitly. Informational only.
- No root contains `PROJECT.xml`. Consistent with its optional status in §3.
- No root contains a legacy markdown `*.md` variant of the canonical XML set.
  The hand-converted forge scaffolding is the only known recent drift and has
  already been corrected.

## 7. Change log

| Date | Task | Change |
|---|---|---|
| 2026-04-14 | 42.4-09 | Initial version. Defined minimum (4 files), optional files + dirs, legacy list, per-file headers, and audit matrix. Decision gad-185. |
