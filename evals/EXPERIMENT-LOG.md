# GAD Eval Experiment Log

Running ledger of every eval experiment round. Append-only. New rounds at the bottom.

---

## Round 1 — Greenfield, single-condition, requirements v1
**Date:** 2026-04-06 to 2026-04-07
**Requirements version:** v1 (12 systems-focused criteria, no gates)
**Conditions:** GAD only (escape-the-dungeon v1-v5)
**Results:**
- v1-v4: Iterative development of the GAD eval harness itself. Not scored.
- **v5:** Auto-composite 0.935, human review 0.0 (blank screen). Gap between
  automated scoring and reality first exposed here.

**Key finding:** Automated scoring without human review is dangerously misleading.
requirement_coverage was 1.0 but nothing rendered.

**Led to:** Gate criteria design, human_review weight increase, build-must-render rule.

---

## Round 2 — Greenfield, three-condition, requirements v2
**Date:** 2026-04-08
**Requirements version:** v2 (added gate criteria, vertical-slice priority, UI-first)
**Conditions:** GAD v6/v7, Bare v1/v2, Emergent v1

**Results:**
| Condition | Version | Tokens | Commits | Human |
|-----------|---------|--------|---------|-------|
| GAD | v6 | ~100k | 21 | 0.00 (blank screen) |
| GAD | v7 | 93k | 21 | 0.30 (stuck after combat) |
| Bare | v1 | 68k | 2 | 0.10 (main menu only) |
| Bare | v2 | 88k | 6 | **0.50** (most playable) |
| Emergent | v1 | 67k | 2 | 0.10 (styled text crash) |

**Key findings:**
1. Bare workflow beats GAD on human review even at equal requirements
2. Inherited skills (emergent v1) didn't prevent new failure modes
3. GAD has perfect process metrics (planning_quality 1.0) but broken game loops
4. Commit discipline inversely tracked with output quality in this round

**Led to:**
- Requirements v3 with explicit game-loop gate, spell-crafting gate, UI quality gate
- Human_review weight raised from 0.15 to 0.30 with low-score caps
- Skills must capture failure modes and fixes, not just patterns

---

## Round 3 — Greenfield, three-condition, requirements v3
**Date:** 2026-04-08
**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)
**Conditions:** GAD v8, Bare v3, Emergent v2
**Note:** All three hit rate limits mid-run

**Results:**
| Condition | Tokens | Commits | Human | Composite | Notes |
|-----------|--------|---------|-------|-----------|-------|
| **Bare v3** | 1877 | 1 batch | **0.70** | 0.526 | **Best game overall** — best UI/UX, most enjoyable. ASCII for some menus. |
| Emergent v2 | 1609 | 2 phases | 0.50 | 0.478 | Functional forge with authored content. Medium UI. Maintained discipline under pressure. |
| GAD v8 | 1291 | 0 | 0.20 | 0.177 | Broken crafting, old ASCII design. Never committed anything (rate limit hit mid-task). |

**Key findings — the Freedom Hypothesis:**
- Bare (no framework) consistently outperforms GAD (full framework) on creative implementation
- GAD has never exceeded 0.30 human review across 4 attempts (v5, v6, v7, v8)
- Bare has improved monotonically: 0.10 → 0.50 → 0.70
- **Process metrics ≠ output quality.** GAD's planning overhead consumes tokens that
  could go to testing and fixing the game.
- Under rate-limit pressure, emergent maintained phase commits (inherited skill)
  while bare regressed to 1 batch commit

**Status of hypothesis:** PRELIMINARY — single-run variance is high, needs more trials.
Brownfield experiments may invalidate if GAD's overhead pays off on codebase extension.

**Documented in:** `evals/FINDINGS-2026-04-08-round-3.md`
**Decision:** gad-36 (Freedom hypothesis)

**Led to:**
- Eval preservation contract (gad-38)
- game/.planning/ layout mandate (gad-39)
- Brownfield eval mode (gad-40)
- Greenfield/brownfield categorization
- `gad eval preserve`, `gad eval verify`, `gad worktree` commands

---

## Round 4 — Greenfield, three-condition, requirements v4 (pressure-oriented)

**Date:** 2026-04-09
**Requirements version:** v4 (pressure over features, authored-only, 4 gates including forge-with-ingenuity-payoff and pressure-mechanics)
**Conditions:** GAD v10, Bare v5, Emergent v4 — run serially after round 3's parallel attempt hit the shared account rate limit (gad-62)
**Framework versioning:** first round under trace schema v4 with hook-captured events (phase 25). Framework version stamped on every TRACE.json.

**Results:**

| Condition | Version | Human (rubric) | Composite | Notes |
|-----------|---------|----------------|-----------|-------|
| **Bare v5** | v5 | TBD | TBD | Complete playable game against v4 pressure requirements. DOM + iconify-icon + @iconify-json/game-icons. 2 floors × 8 rooms. |
| **Emergent v4** | v4 | **0.805** (rubric aggregate) | TBD | Complete playable, "incredible" book-like UI, DoT/resistance/stacking mechanics, first observed full skill ratcheting cycle — authored dom-over-kaplay + pressure-forge-coupling + CHANGELOG. 6-dimension rubric including skill_inheritance_effectiveness 0.95. |
| **GAD v10** | v4 | **0.02** (rubric aggregate) | — | **API-interrupted** (HTTP 529 overloaded_error, gad-64). Title screen rendered with a novel visual treatment (ui_polish 0.10) but planning phase crashed before scene implementation. Excluded from cross-round quality comparisons per gad-63 + gad-64. |
| GAD v9 | v4 | 0.05 (legacy score) | — | Rate-limited during round 4 attempt #1 (parallel). Start screen only. Excluded from cross-round quality. |

**Key findings — freedom hypothesis holds under v4:**
- Under pressure-oriented v4 requirements, Bare + Emergent both shipped complete playable games; GAD was api-interrupted before implementation. Freedom hypothesis (gad-36) still holds, now with v4 as the stricter test.
- **First observed full skill ratcheting cycle.** Emergent v4 inherited from emergent v3, authored 2 new project-tailored skills (dom-over-kaplay, pressure-forge-coupling), documented the disposition of each inherited skill in CHANGELOG.md, and deprecated kaplay-scene-pattern as unusable under DOM architecture. This is the first round where the compound-skills hypothesis (gad-65) has evidence to evaluate.
- **Convergent design evolution.** All three conditions independently chose DOM + iconify-icon + @iconify-json/game-icons + per-floor forced-craft encounters, suggesting v4's pressure requirements are narrow enough to collapse the solution space regardless of framework.
- **Rubric replaces single-score human review** (phase 27 track 1, gad-61). Emergent gets a 6th dimension `skill_inheritance_effectiveness` as the CSH test signal.

**User playtest captured 12 v5 requirements** (`evals/_v5-requirements-addendum.md`): training-via-encounter, rune discovery loop, merchants, NPC dialogue, inventory/equipment + skill tree, spell/skill loadout slots, end-boss reachability, save checkpoints, notification lifecycle, rest rooms actually rest, 2D map navigation.

**Documented in:**
- `evals/FINDINGS-2026-04-09-round-4-complete.md`
- `evals/FINDINGS-2026-04-09-round-4-partial.md`
- `evals/_v5-requirements-addendum.md`

**Decisions landed this round:** gad-61 (programmatic eval priority), gad-62 (serial default), gad-63 (rate-limited preserve-but-exclude), gad-64 (api-interrupted as distinct failure category), gad-65 (compound-skills hypothesis), gad-66 (authored-content injection experiment queued), gad-67 (serial as permanent default).

**Led to:**
- v5 requirements addendum (12 new/changed requirements from playtest)
- Phase 27 rubric shipping (per-dimension scoring, RubricRadar SVG, /rubric page)
- gad-66 content-pack extraction experiment
- HTTP 529 investigation queued before GAD v11 retry (task 21-23b)
- Serial-only execution as permanent default (gad-67)

---
