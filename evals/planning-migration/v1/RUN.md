# Run v1 — planning-migration

**Date:** 2026-04-05
**GAD version:** 1.32.0
**Baseline:** planning-sink-backup-20260404
**Reference:** See `../gad.json` for scoring weights. See `../../DEFINITIONS.md` for term definitions.

---

## What was migrated

| Project | Source format | Action | Files written |
|---------|--------------|--------|---------------|
| grime-time | XML | compile → new sink | 6 MDX files created |
| global | XML | no change (human-authored sink, not overwritten) | 0 |
| repo-planner | MD | no change (human-authored sink, not overwritten) | 0 |

## Format compliance audit

| Project | Files | Parseable? | Format |
|---------|-------|-----------|--------|
| global | STATE.xml, ROADMAP.xml, DECISIONS.xml, TASK-REGISTRY.xml | ✓ | XML |
| repo-planner | STATE.md, ROADMAP.md | ✓ | MD |
| grime-time | STATE.xml, ROADMAP.xml, DECISIONS.xml, TASK-REGISTRY.xml, REQUIREMENTS.xml, ERRORS-AND-ATTEMPTS.xml | ✓ | XML |

All 3 projects: all .planning/ files parseable by GAD CLI. **format_compliance = 1.0**

## Lossless round-trip audit (grime-time)

Source XML → compile → MDX. Counts verified verbatim:

| File | Source units | MDX units | Match |
|------|-------------|-----------|-------|
| DECISIONS.xml (81 decisions) | 81 `<decision>` tags | 81 `## id: title` headers | ✓ |
| ROADMAP.xml (18 phases) | 18 `<phase>` tags | 18 `## Phase N` headers | ✓ |
| TASK-REGISTRY.xml (120 tasks) | 120 `<task>` tags | 120 `- [✓→○] taskId` lines | ✓ |
| STATE.xml | phase=18, plan=18-02, status=in-progress, next-action (full) | all present at Full fidelity | ✓ |

All information units present and untruncated. **lossless_roundtrip = 1.0**

## Token counts

| File | Source chars | Source tokens | MDX chars | MDX tokens | Retention |
|------|-------------|--------------|-----------|-----------|-----------|
| STATE.xml / state.mdx | 757 | 189 | 877 | 219 | 116% (frontmatter adds) |
| ROADMAP.xml / roadmap.mdx | 9,321 | 2,330 | 5,964 | 1,491 | 64% (XML tags stripped) |
| DECISIONS.xml / decisions.mdx | 87,549 | 21,887 | 56,881 | 14,220 | 65% (XML tags stripped) |
| TASK-REGISTRY.xml / task-registry.mdx | 65,145 | 16,286 | 29,324 | 7,331 | 45% (XML tags stripped) |
| REQUIREMENTS.xml / requirements.mdx | — | — | 3,008 | 752 | created |
| ERRORS-AND-ATTEMPTS.xml / errors-and-attempts.mdx | — | — | 283 | 71 | created |

**Total source (4 core files):** 162,772 chars / 40,693 tokens
**Total sink (6 MDX files):** 96,337 chars / 24,084 tokens
**Token reduction from XML tags:** 41% — expected, XML tag overhead removed

## Trace coverage

Files touched:
- `vendor/grime-time-site/.planning/STATE.xml` — read
- `vendor/grime-time-site/.planning/ROADMAP.xml` — read
- `vendor/grime-time-site/.planning/DECISIONS.xml` — read
- `vendor/grime-time-site/.planning/TASK-REGISTRY.xml` — read
- `vendor/grime-time-site/.planning/REQUIREMENTS.xml` — read
- `vendor/grime-time-site/.planning/ERRORS-AND-ATTEMPTS.xml` — read
- `apps/portfolio/content/docs/grime-time/planning/state.mdx` — written (new)
- `apps/portfolio/content/docs/grime-time/planning/roadmap.mdx` — written (new)
- `apps/portfolio/content/docs/grime-time/planning/decisions.mdx` — written (new)
- `apps/portfolio/content/docs/grime-time/planning/task-registry.mdx` — written (new)
- `apps/portfolio/content/docs/grime-time/planning/requirements.mdx` — written (new)
- `apps/portfolio/content/docs/grime-time/planning/errors-and-attempts.mdx` — written (new)
- `vendor/get-anything-done/lib/docs-compiler.cjs` — rewritten (XML support, safe-overwrite)
- `planning-config.toml` — grime-time root added

All 14 file touches are accounted for. **trace_coverage = 1.0**

## Sink alignment

Post-migration `gad sink status`:
- global: STATE.xml=ok, ROADMAP.xml=stale, DECISIONS.xml=stale, TASK-REGISTRY.xml=ok
- repo-planner: STATE.md=stale, ROADMAP.md=stale
- grime-time: STATE.xml=ok, ROADMAP.xml=ok, DECISIONS.xml=ok, TASK-REGISTRY.xml=ok

grime-time: 4/4 ok. global/repo-planner stale files are human-authored sink (not overwritten by design).
Registered projects: 3/3. All projects have a planning dir.

**sink_alignment = 0.85** (grime-time fully aligned; global/repo-planner stale = known/expected)
