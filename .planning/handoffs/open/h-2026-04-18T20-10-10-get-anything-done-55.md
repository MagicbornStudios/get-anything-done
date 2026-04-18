---
id: h-2026-04-18T20-10-10-get-anything-done-55
projectid: get-anything-done
phase: 55
task_id: evolution-startup-cli
created_at: 2026-04-18T20:10:10.138Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: reasoning
runtime_preference: codex
---
# Evolution + skill-hygiene CLI — full wiring pickup

Five CLI surfaces. All backed by existing claude-lane libs (lib/skill-linter.cjs, lib/skill-usage-stats.cjs). Policy docs: references/evolution-on-startup.md, references/skill-types.md.

## Before you start

1. Read `references/agent-lanes.md` (codex lane = bin/gad.cjs).
2. Read `references/evolution-on-startup.md` — policy for when evolution runs.
3. Read `references/skill-types.md` — taxonomy orthogonal to lane.
4. Read `lib/skill-usage-stats.cjs` + `lib/skill-linter.cjs` — the APIs you wrap.

## Five CLI surfaces to add/extend under existing `skillCmd` + new `evolutionCmd`

### (a) `gad skill lint [--id <id>] [--json] [--severity X]`

Per previous handoff (h-2026-04-18T19-42-01). Non-blocking, exit 0 on issues.

### (b) `gad skill status <id>`

Health card per previous handoff — EXTEND with usage-stats + type:

```
Skill: gad-visual-context-system
  lane:      dev
  type:      system-requirements        ← NEW
  status:    stable
  workflow:  workflows/visual-context-system.md  ✓
  tokens:    ~780 SKILL.md + ~1200 workflow (~1980 total)  ← NEW: pair with lib/skill-linter.cjs.auditSkillTokens
  bundle:    SKILL.md ✓  VALIDATION.md ✓  references/ ✓
  usage:     2 done tasks, 1 project (get-anything-done); last run 2026-04-15  ← NEW: from lib/skill-usage-stats.cjs
  parent:    gad-visual-context-panel-identities

Issues: (none)

Section tokens (from auditSkillTokens):
  (prelude)                            ~80
  Workflow                            ~30
  (total)                            ~780
```

### (c) `gad skill token-audit [--top N] [--json]` (NEW)

Produces the trim-target report. Runs `auditSkillTokens` over the whole catalog.

```
Skill token audit — 93 skills, 57154 total tokens, 615 avg

Top 10 bloat:
  3770  skills/build-and-release-locally/SKILL.md
  2830  skills/create-skill/SKILL.md
  ...

Per-section breakdown for top 3:
  build-and-release-locally:
    (prelude)                ~200
    When to use              ~400
    The release flow       ~1800   ← trim target
    Failure modes            ~900
    ...
```

### (d) `gad evolution scan` + `gad evolution shed` (NEW subcommand family)

`gad evolution scan` — reads usage-stats, outputs candidate + shed-flag lists per policy in `references/evolution-on-startup.md`. Writes `.planning/.evolution-scan.json` per project. Exits 0. Non-destructive.

`gad evolution shed [--dry-run|--confirm <slug>]` — `--dry-run` default; prints what would be deleted. `--confirm <slug>` actually moves the skill dir to `.archive/skills/<slug>-<date>/` (never hard-delete — shedding is soft).

### (e) Startup integration — EVOLUTION block (per policy doc)

Extend `gad startup` and `gad snapshot` to emit the EVOLUTION block when `gad evolution scan` surfaces candidates. Format in references/evolution-on-startup.md. Suppress when zero. Cap 4 lines. Follow snapshot token discipline.

### (f) Attribution-quality fix — BLOCK sentinel `skill=` values

`gad tasks release --done --skill <x>` currently silently accepts `default` / empty. Per `lib/skill-usage-stats.cjs` SENTINEL_SKILL_VALUES = {default, none, -, unknown}. When `--skill` matches a sentinel, reject with:

```
Error: skill="default" is a placeholder, not a real skill. Either:
  - Pass a real skill id (gad skill list shows valid options)
  - Pass --no-skill if no skill was used
```

Accept `--no-skill` as explicit opt-out; writes `skill=""` (existing tolerated value).

## Tests

`tests/skill-lint-cli.test.cjs` + `tests/evolution-cli.test.cjs` — spawn the CLI against tmp fixtures.

## Acceptance

- `gad skill lint` prints baseline (87/93 clean today after fixes), exits 0.
- `gad skill status gad-visual-context-system` prints full card including tokens + usage + type.
- `gad skill token-audit --top 10` matches the report shape above.
- `gad evolution scan` writes JSON output + prints one-line summary.
- `gad evolution shed --dry-run` lists candidates per the policy rules.
- `gad tasks release --done --skill default` REJECTS with help text.
- Startup EVOLUTION block appears when signal exists; suppressed otherwise.

## References (in order)

1. `references/evolution-on-startup.md` — cadence, shedding rules, immediate action items
2. `references/skill-types.md` — the new `type:` frontmatter axis
3. `lib/skill-usage-stats.cjs` — attribution aggregation + sentinel filtering
4. `lib/skill-linter.cjs` — non-blocking validator + token audit
5. `.planning/notes/skill-lane-taxonomy-2026-04-18.md` — existing lane classification
6. Open skill-hygiene handoff h-2026-04-18T19-42-01 — subsumes into this one

## When done

`gad handoffs complete <this-id>`. Post:
- Attribution-quality delta (before/after "default" count in get-anything-done TASK-REGISTRY)
- Whether attribution-reject landed with a `--no-skill` escape hatch
- First `gad evolution scan` output (json path + one-liner summary)