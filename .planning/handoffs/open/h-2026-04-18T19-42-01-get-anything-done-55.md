---
id: h-2026-04-18T19-42-01-get-anything-done-55
projectid: get-anything-done
phase: 55
task_id: skill-hygiene-cli
created_at: 2026-04-18T19:42:01.774Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: normal
estimated_context: mechanical
runtime_preference: codex
---
# Skill hygiene CLI — wire lib/skill-linter.cjs surfaces

Lib is landed (commit 15623e9). Non-blocking linter with 18 passing tests. Baseline on 93 skills: 87 clean, 6 info-level issues, 2 real gaps. Add the CLI surface so operators + agents can use it.

## Before you start

1. Read `references/agent-lanes.md` — you are on **codex lane** (bin/gad.cjs).
2. Read `lib/skill-linter.cjs` — the module already exports everything the CLI needs.

## Three subcommands to add under existing `skillCmd` in bin/gad.cjs

### (a) `gad skill lint [--id <skill>] [--json] [--severity <error|warning|info>]`

Default: lint every SKILL.md under `skills/**/`.
`--id <skill>` lints a single skill directory (`skills/<id>/SKILL.md`).
`--json` emits structured output for tooling.
`--severity X` filters output to issues at or above that severity.

Rendering (non-JSON):

```
Skill lint report — 93 skills, 87 clean, 6 with issues

skills/create-proto-skill/SKILL.md (1 issue)
  [info] BROKEN_BODY_REF — Body references `./workflow.md` but the target is missing.

skills/scaffold-visual-context-surface/SKILL.md (1 issue)
  [info] BROKEN_BODY_REF — Body references `./workflow.md` but the target is missing.

Summary: 0 errors, 0 warnings, 6 info
Total tokens: 57,154 across 93 skills (avg 615/skill)
```

Exit code: **0 even with issues** (per operator: non-blocking). Only exit 1 on unrecoverable errors (gadDir not found, etc.).

Implementation sketch:

```js
const { lintAllSkills, lintSkill, summarizeLint } = require('../lib/skill-linter.cjs');
const gadDir = path.resolve(__dirname, '..');
const skillsDir = path.join(gadDir, 'skills');
const reports = args.id
  ? [lintSkill(path.join(skillsDir, args.id, 'SKILL.md'), { gadDir })]
  : lintAllSkills(skillsDir, { gadDir });
// filter by severity, render
```

### (b) `gad skill status <id>`

Single-skill health card. Shows:

- Frontmatter dump (name, description, lane, workflow, status, parent_skill)
- Token estimate
- Lint issues (same shape as `lint --id`)
- Bundle completeness: which sibling files exist (VALIDATION.md, PROVENANCE.md, workflow.md, COMMAND.md, references/)
- Promoted-from lineage if canonicalized (read `canonicalization_rationale`)

Rendering:

```
Skill: scaffold-visual-context-surface
  lane:      dev
  status:    stable
  workflow:  workflows/scaffold-visual-context-surface.md  ✓
  tokens:    ~780 (SKILL.md)
  bundle:    SKILL.md ✓  PROVENANCE.md ✓  VALIDATION.md ✓  workflow.md ✗

Issues (1):
  [info] BROKEN_BODY_REF — Body references ./workflow.md but the target is missing.
```

### (c) Integrate into existing `gad skill list`

Add `--lint-summary` flag that appends a one-line summary block to the list output:

```
93 skills (listed above)

Lint: 87 clean, 0 errors, 0 warnings, 6 info — run `gad skill lint` for detail.
```

Non-blocking. Off by default (adds ~200ms to list).

## Tests

`tests/skill-lint-cli.test.cjs` — spawn the CLI against a tmp skills dir with seeded good + bad SKILL.md files; assert the rendered output + exit code.

## Acceptance

- `gad skill lint` prints the report shape above, exits 0 regardless of issues.
- `gad skill lint --id gad-visual-context-system` prints only that skill's result.
- `gad skill status scaffold-visual-context-surface` prints the health card above.
- `gad skill list --lint-summary` adds the summary block.
- `node --test tests/skill-lint-cli.test.cjs` passes.

## When done

`gad handoffs complete <this-id>`. Post the current-baseline counts in the completion note so future runs can measure skill-hygiene drift.