---
id: h-2026-04-18T18-40-38-get-anything-done-55
projectid: get-anything-done
phase: 55
task_id: 55-wave5
created_at: 2026-04-18T18:40:38.869Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: normal
estimated_context: mechanical
runtime_preference: codex
---
# Wave 5 — skill-lane CLI filter + catalog + site chips

Waves 1-4 (frontmatter on all 92 SKILL.md) landed in commit 6398065. This handoff covers Wave 5: make the lane tags queryable and filterable.

## Before you start

1. Read `references/agent-lanes.md` — Wave 5 splits across **codex lane** (CLI) and **cursor lane** (site chips). Do the CLI pieces here; file a sibling handoff with `--runtime-preference cursor` for the site filter work if you don't own it.
2. Read `.planning/notes/skill-lane-taxonomy-2026-04-18.md` — canonical lane assignments.

## Three pieces (splittable)

### (a) `gad skill list --lane <value>` CLI filter  (codex lane)

- File: `bin/gad.cjs` — find `skill list` command (grep `skill.*list\b` or `skillListCmd`).
- Add flag: `lane: { type: 'string', description: 'Filter by lane (dev|prod|meta)', default: '' }`.
- Read `lane:` frontmatter from each SKILL.md during listing. Array values (`lane: [dev, meta]`) match if `--lane dev` OR `--lane meta` is passed.
- Test: `tests/skill-list-lane-filter.test.cjs`.

### (b) Catalog emission  (site-adjacent, mostly codex)

- File: `site/scripts/build-site-data.mjs` (and anything it imports).
- When enumerating skills, read `lane:` from each SKILL.md frontmatter.
- Emit `lane: "dev"` or `lane: ["dev", "meta"]` onto each catalog entry in `site/lib/catalog.generated.ts` (or wherever the generator writes).
- Preserve existing fields; lane is additive.

### (c) Site `/skills` page lane chips  (cursor lane — file separate handoff)

- Route: probably `site/app/skills/page.tsx` or a Skills component.
- Add filter chips: `[ALL] [dev] [prod] [meta]`. Clicking filters the catalog grid by `lane` field (supporting arrays).
- Styling follows existing site pattern.
- This piece is **cursor's lane**, not codex. File a sibling handoff: `gad handoffs create ... --runtime-preference cursor ...` with this content.

## Current lane counts (for test fixtures)

| lane        | count |
|-------------|-------|
| dev         | 63    |
| meta        | 20    |
| prod        | 3     |
| [dev, meta] | 4     |
| [dev, prod] | 2     |

## Acceptance

- `gad skill list --lane prod` prints 3 skills.
- `gad skill list --lane meta` prints 20 + 4 dual = 24 skills.
- `gad skill list --lane dev` prints 63 + 4 [dev,meta] + 2 [dev,prod] = 69 skills.
- `catalog.generated.ts` emits `lane` on every entry.
- Site `/skills` page (after cursor handoff) shows chip filters.

## When done

`gad handoffs complete <this-id>`. If you only finish (a) + (b) and file the cursor handoff for (c), complete this one and note the dependency in the completion.