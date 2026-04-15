# Canonical skill shape

**Status:** canonical (decisions gad-180, gad-181, gad-183, gad-190, gad-191, gad-192)
**Last updated:** 2026-04-15

The shipped GAD catalog uses exactly one skill shape. This doc is the contract
that `bin/install.js`, `scripts/validate-canonical-assets.mjs`,
`site/scripts/build-site-data.mjs`, `gad evolution install/promote`, and every
authoring skill (`create-skill`, `create-proto-skill`, `gad-skill-creator`,
`merge-skill`) must agree on.

## 1. Layout

```
skills/<name>/
  SKILL.md               # command entry point — always present, always authoritative
  evals/evals.json       # optional — skills that ship eval cases

workflows/<name>.md      # optional — long-form ordered procedure, if non-trivial
references/<topic>.md    # optional — supporting rationale, policy, examples
templates/<topic>.*      # optional — output scaffolds only, not methodology
```

Rules:

1. `SKILL.md` is the **single** command entry point. No `COMMAND.md`, no
   `skill.json`, no sidecar manifests. The runtime discovers skills by
   recursively finding `SKILL.md` files under `skills/`.
2. A non-trivial procedural body lives in `workflows/<name>.md`. `SKILL.md`
   points at it via the `workflow:` frontmatter key (see §2). Trivial skills
   may inline the body in `SKILL.md` and omit the workflow file entirely.
3. One SKILL.md per public skill name (per decision gad-180). Thin wrappers
   that share a public `name:` with another SKILL.md are forbidden.
4. Command skills carry the `gad-` prefix in both directory and public name
   (per decision gad-181). Neutral upstream baselines (e.g. `create-skill`
   without the prefix) may coexist iff they have a distinct public identity.
5. `workflows/` is the **skill-workflow** directory. `.planning/workflows/`
   is reserved for **meta-loops** (`gad-loop`, `gad-decide`, `gad-evolution`,
   etc.) and is outside this pattern. The two dirs are different concepts.

## 2. SKILL.md frontmatter

Minimum required keys:

```yaml
---
name: gad-create-skill            # public identity, must be unique in canonical skills/
description: >-                   # one-paragraph when-to-fire prose, multiline OK
  Create a GAD-tailored skill using the gad-skill-creator methodology.
  Fires on "make a skill", "create a skill", "turn this into a skill".
workflow: workflows/gad-create-skill.md   # relative to repo root, omit if inline
---
```

Optional keys (additive, never break parsing when absent):

```yaml
status: stable | experimental | proto    # default: stable
origin: canonical | human-authored | emergent | promoted-from-proto
argument-hint: "[skill-name] [--framework]"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent]
framework_skill: true              # set on GAD-framework-maintenance skills
uses_cli: [gad snapshot, gad evolution install]
triggers: [list, of, intent, phrases]    # optional — description still primary
excluded-from-default-install: true      # legacy opt-out flag (still honored)
provenance: "promoted from proto-skill <slug> 2026-04-15"
```

**`workflow:` is the replacement for `skill.json`.** Readers that previously
parsed `{commandPath: "<name>.md"}` from `skill.json` now parse the
`workflow:` key from SKILL.md frontmatter. One source of truth, no sidecar.

## 3. SKILL.md body

Body shape when `workflow:` points elsewhere:

```markdown
# gad:create-skill

**Workflow:** [workflows/gad-create-skill.md](../../workflows/gad-create-skill.md)

Fire when:
- the operator says "make a skill for X"
- a completed task surfaces a repeated pattern worth capturing
- `gad evolution evolve` hands off a candidate for drafting

Run the workflow and follow its steps. This SKILL.md is an entry point — all
procedural detail, examples, and tool sequencing live in the workflow file.
```

Body shape when the skill is trivial enough to inline (no workflow file):

```markdown
# gad:add-todo

Capture a one-line todo into `.planning/todos/` and update STATE.xml.
Fires on "add a todo", "remember to", "track this for later".

## Steps
1. ...
```

## 4. workflows/<name>.md shape

When present, a workflow file carries the full procedural body:

```markdown
---
slug: gad-create-skill
name: Create skill
description: >-
  Create a GAD-tailored skill with eval scaffold and install hooks.
trigger: make-a-skill | create-skill | turn-this-into-a-skill
participants:
  skills: [gad-skill-creator]
  cli: [gad snapshot, gad evolution install]
  artifacts: [skills/**, evals/**]
related-phases: ["42.2"]
---

# Create skill workflow

## Objective
...

## Steps
1. ...
```

Workflow files may optionally carry one fenced `mermaid` block if they want to
participate in `build-site-data.mjs` workflow-graph extraction (decision gad-172).
This is separate from meta-loop workflows under `.planning/workflows/`.

## 5. Proto-skill layout

Proto-skills stage inside the owning project's planning directory per decision
gad-183:

```
<project>/.planning/proto-skills/<slug>/
  SKILL.md           # frontmatter: status: proto, workflow: ./workflow.md
  workflow.md        # self-contained procedural body (sibling, relative ref)
  PROVENANCE.md      # candidate slug, phase id, pressure metrics, timestamp
  CANDIDATE.md       # optional — original candidate payload preserved as-is
```

Proto-skills are **self-contained**: the workflow file lives inside the
proto-skill directory as a sibling, not in the canonical `workflows/` tree.
This keeps in-flight drafts isolated until explicit promotion.

Lifecycle commands (already implemented, decision gad-183):

- `gad evolution install <slug> [--claude --codex --cursor ...]` — sync staged
  proto-skill into coding-agent runtimes without promoting. The runtime sync
  must copy the proto-skill directory whole (SKILL.md + workflow.md + provenance)
  so the in-runtime body resolves `workflow: ./workflow.md` as a sibling.
- `gad evolution validate <slug>` — run advisory validator, write VALIDATION.md.
- `gad evolution promote <slug>` — move the staged directory into canonical
  `skills/<name>/`, relocate `workflow.md` to `workflows/<name>.md`, rewrite
  the `workflow:` frontmatter pointer to the canonical location, carry
  PROVENANCE.md forward as an inlined block or alongside reference.
- `gad evolution discard <slug>` — delete the staged directory.

## 6. Runtime install contract

`bin/install.js` (and the packaged `gad install` surface) syncs canonical and
proto-skills into coding-agent runtime directories:

```
.claude/skills/<name>/         ← from skills/<name>/
.claude/skills/<name>/         ← from .planning/proto-skills/<slug>/  (via gad evolution install)
.agents/skills/<name>/          ← same, for generic .agents/ runtime
```

Installed payload always includes `SKILL.md`. Workflow files are **not**
copied into runtime — the installed SKILL.md still points at
`workflows/<name>.md` via frontmatter, and the agent reads that file on demand
from the framework checkout. Exception: proto-skills whose `workflow: ./workflow.md`
points to a sibling file **inside the proto-skill directory** are copied whole,
because the sibling is part of the staged bundle.

## 7. Validator rules

`scripts/validate-canonical-assets.mjs` enforces:

1. Every `skills/<name>/SKILL.md` parses YAML frontmatter with required keys
   `name` and `description`.
2. Every `workflow:` frontmatter pointer resolves to an existing file relative
   to the repo root (or relative to SKILL.md for proto-skill sibling refs).
3. Every public `name:` value appears in exactly one SKILL.md under canonical
   `skills/` (duplicate names fail the build — decision gad-180).
4. No `skill.json` files exist under canonical `skills/` (post-migration —
   during transition, the validator emits a warning and install.js honors a
   fallback read of `commandPath` from any stray `skill.json`).
5. Plain-name skills that shadow a `gad-*` canonical sibling emit a warning
   (existing rule retained).

## 8. Migration checklist (phase 42.2)

For each canonical skill in `skills/gad-*`:

1. Read current `skill.json` → extract `commandPath`.
2. Add `workflow: workflows/<commandPath>` to SKILL.md frontmatter.
3. Delete `skill.json`.
4. Delete `COMMAND.md` if its body is identical to (or superseded by) the
   referenced workflow file. If `COMMAND.md` holds unique content, merge it
   into the workflow file first, then delete.
5. Verify `node scripts/validate-canonical-assets.mjs` stays green.
6. Verify `node bin/install.js --dry-run` produces the same install payload.

The four authoring skills (`create-skill`, `create-proto-skill`,
`gad-skill-creator`, `merge-skill`) are the first migration targets because
they define the authoring path that future skills will follow.

## 9. Deleted artifacts

The following are removed wholesale during migration:

- `skills/gad-quick-skill/` — renamed to `skills/create-proto-skill/` per decision gad-168.
- `skills/gad-create-skill/` — folded into `skills/gad-skill-creator/`; its COMMAND.md body becomes `workflows/gad-skill-creator.md`.
- `skills/gad-merge-skill/` — folded into `skills/merge-skill/`; its COMMAND.md body becomes `workflows/merge-skill.md`.
- All `skills/**/skill.json` files (~60 sidecars).

## 10. Consumer-project parity

Consumer projects going through evolution follow the same shape. When a
consumer project promotes a proto-skill, it writes to **its own**
`skills/<name>/SKILL.md` + `workflows/<name>.md`, installs via
`gad evolution install` into its own `.claude/skills/`, and surfaces the skill
in its own `gad snapshot` output. The framework does not reach into consumer
planning trees — the uniform shape is what makes identical plumbing work at
both levels.
