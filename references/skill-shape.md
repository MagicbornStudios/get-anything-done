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

### 1a. `workflows/` vs `.planning/workflows/` — not duplicates

Agents repeatedly confuse these two directories because some file names
overlap (e.g. both `workflows/gad-debug.md` and `.planning/workflows/gad-debug.md`
may exist). They are **different artifacts with different purposes**:

| Directory | Purpose | Authored how | Discovered via |
|---|---|---|---|
| `workflows/<name>.md` | **Skill-workflow spec** — the procedural body a SKILL.md points at via `workflow:` frontmatter. One file per command skill. Contains the ordered steps the agent executes when the skill fires. | By the skill author during skill creation (per §10) | `gad skill show <id>` → `workflow:` line, or `gad skill list --paths` |
| `.planning/workflows/<name>.md` | **Meta-loop workflow** — how the GAD framework itself operates. One file per top-level loop (`gad-loop`, `gad-decide`, `gad-debug`, `gad-evolution`, `gad-findings`, `gad-discuss-plan-execute`). Contains the conceptual flow diagram + participating skills, not execution steps for a single skill. | By the framework authors when defining how phases operate | Snapshot STATE.xml `<reference>` list, or `gad workflow status` |

**Rule of thumb:** if you are executing a skill, you want `workflows/<name>.md`.
If you are answering "how does the framework operate around this skill", you
want `.planning/workflows/<name>.md`. They are NOT copies of each other; if
they look identical it is a documentation bug and should be reported as a
consolidation candidate.

The `gad workflow status` command lists `.planning/workflows/` contents
(meta-loops and emergent detected workflows). The `gad skill list --paths`
command lists `skills/` + resolved `workflow:` pointers into `workflows/`.
Use the right CLI verb for the right tree.

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

## 10. Standard flow: creating a new command/workflow skill

This is the canonical procedure for creating a new GAD command skill (the
`skills/gad-<name>/SKILL.md` + `workflows/<name>.md` pattern). Apply it every
time — deviations must be justified in a decision entry.

**Step 1 — decide the identity.**

- Pick a kebab-case `<name>` (e.g. `review-backlog`, `new-project`).
- The skill directory is `skills/gad-<name>/`.
- The public `name:` frontmatter value is `gad:<name>` (colon form —
  matches slash-command invocation).
- The workflow file is `workflows/<name>.md` (no `gad-` prefix). Exception:
  a few legacy canonical workflows like `gad-debug.md`, `gad-eval-run.md`,
  `gad-execute-phase.md`, `gad-map-codebase.md`, `gad-new-project.md`,
  `gad-plan-phase.md` retain their `gad-` prefix. For new skills, default
  to unprefixed.

**Step 2 — author `workflows/<name>.md`.**

The body goes here, not in SKILL.md. Include:

- `## Objective` — one paragraph on what the skill achieves.
- `## Inputs` — what the caller must supply (flags, context files).
- `## Process` — ordered steps, each using concrete tools (gad CLI
  commands, Read/Edit/Write, Bash). Number the steps.
- `## Outputs` — files written, state mutated, exit signals.
- `## References` — links to related skills, decisions, planning docs.

Keep workflows focused on one task. If a procedure branches heavily,
split into multiple workflows and have a parent workflow orchestrate.

**Step 3 — author `skills/gad-<name>/SKILL.md`.**

Thin entry point. Shape:

```markdown
---
name: gad:<name>
description: >-
  One-paragraph when-to-fire prose. Include trigger phrases the user is
  likely to say ("let's X", "run Y", "make Z"). Describe the outcome, not
  the process — the process lives in the workflow file.
workflow: workflows/<name>.md
argument-hint: "[<args>]"
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep, Agent]
---

# gad:<name>

**Workflow:** [workflows/<name>.md](../../workflows/<name>.md)

Fire when:
- <trigger phrase 1>
- <trigger phrase 2>
- <trigger phrase 3>

Run the workflow and follow its steps. All procedural detail lives in the
workflow file per the canonical skill shape.
```

SKILL.md stays short. If it grows past ~30 lines, something belongs in
the workflow file instead.

**Step 4 — verify discovery.**

Run these checks in order:

```sh
node scripts/validate-canonical-assets.mjs          # frontmatter + pointer resolution
node --test tests/canonical-skill-records.test.cjs  # parser coverage
node bin/gad.cjs snapshot --projectid get-anything-done --skills 10
```

The new skill should appear in `EQUIPPED SKILLS` when sprint context mentions
its domain. If it does not appear, either the description lacks query-
overlap tokens or the relevance threshold filters it out.

**Step 5 — register attribution on the first task that uses it.**

When you ship a task that uses the new skill, set `skill="gad-<name>"` on
the task in TASK-REGISTRY.xml per decision gad-104. This feeds the
self-eval pipeline and makes the skill visible in the snapshot section.

**Step 6 — run an eval if the skill is non-trivial.**

For skills that could regress silently, scaffold an eval project:

```sh
gad eval setup --project gad-<name>-eval
```

Follow `gad-skill-creator` for the eval scaffolding if the skill needs
rigorous testing. Otherwise `create-proto-skill` is the lightweight path.

## 11. Skill lifecycle — candidate → proto-skill → canonical

The four lifecycle stages and the CLI verbs that move between them:

```
raw intent
   │
   │  `gad evolution evolve` writes .planning/candidates/<slug>/CANDIDATE.md
   ↓
candidate (.planning/candidates/<slug>/CANDIDATE.md)
   │
   │  `create-proto-skill` reads CANDIDATE.md, writes the bundle
   ↓
proto-skill (.planning/proto-skills/<slug>/ — self-contained bundle)
   │  SKILL.md (status: proto, workflow: ./workflow.md)
   │  workflow.md (sibling)
   │  PROVENANCE.md
   │
   │  `gad evolution install --claude [...]`  (optional, test in runtime)
   │  `gad evolution validate`                 (advisory VALIDATION.md)
   │  `gad evolution promote <slug>`
   ↓
canonical (skills/gad-<name>/SKILL.md + workflows/<name>.md)
```

Each arrow is a CLI verb — no step is manual file shuffling. If a step
lacks a CLI verb, that is a gap to close before the lifecycle is uniform.

## 12. Consumer-project parity

Consumer projects going through evolution follow the same shape. When a
consumer project promotes a proto-skill, it writes to **its own**
`skills/<name>/SKILL.md` + `workflows/<name>.md`, installs via
`gad evolution install` into its own `.claude/skills/`, and surfaces the skill
in its own `gad snapshot` output. The framework does not reach into consumer
planning trees — the uniform shape is what makes identical plumbing work at
both levels.
