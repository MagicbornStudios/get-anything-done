# Phase 27 — Structured objective data production · PLAN

**Phase:** 27
**Status:** ready for execute-phase
**Discuss-phase output:** `.planning/DISCUSS-PHASE-27.md`
**Decisions referenced:** gad-29, gad-61
**Parallelizes with:** phase 25 (tracks 1, 2, and parts of 3 land against v3 data today)

---

## Goal (restated from discuss-phase)

Stop treating "a composite score per run" as the primary eval output. Produce structured
data that yields insights: structured human review rubric (dimensions), automated gate
checks (playwright), derived metrics from trace events (tool mix, commit rhythm, divergence),
cross-run aggregate queries (`gad eval query`), visualizations keyed to specific research
questions. Makes the eval framework a research tool, not just a test harness.

## Definition of done

Phase 27 is done when:

1. At least one eval project has a `human_review_rubric` block in its `gad.json` with named
   dimensions + weights, and at least 3 existing runs have been re-reviewed under the new
   rubric.
2. Per-run pages render the rubric as a radar chart + per-dimension list when rubric data is
   present, falling back to the legacy single-score view when absent.
3. At least one eval project has playwright tests in a `gates/` directory that produce a
   `gates.json` sidecar, rendered on per-run pages with screenshots.
4. Derived metrics (divergence_score, plan_adherence_delta, commit_rhythm,
   avg_commit_size, produced_artifact_density) are computed in the prebuild and exposed as
   a `derived` object on EvalRunRecord. Phase-25-dependent metrics (tool_use_mix,
   skill_to_tool_ratio, subagent_utilization) stub to null until phase 25 ships.
5. `gad eval query` CLI supports a sqlite-in-memory SELECT/WHERE/ORDER/LIMIT/GROUP subset
   against the trace dataset. Returns JSON. Documented with examples.
6. `/insights` page exists with at least 5 curated query cards rendered from build-time query
   execution.
7. Four new chart components ship: rubric radar, divergence histogram, plan adherence
   distribution, commit rhythm timeline. Each with a caption stating the research question.
8. `skills/objective-eval-design/SKILL.md` (already shipped in session 5) referenced from
   `/methodology` as the discipline.

## Non-goals

- Running new evals (we work with existing v3 runs + any v4 runs that land in parallel)
- Changing composite formula math or low-score caps
- ML-driven outlier detection / statistical significance testing (future phase)
- Full interactive SQL UI (CLI only + curated query cards on /insights)
- Remotion video compositions over structured data (phase 26 post-25)

---

## Task breakdown

### Track 1 — Structured human review rubric (tasks 27-01 → 27-05)

**27-01** — Define rubric v1 schema in `lib/rubric-schema.ts`. Interface shape:
`{ rubric_version, dimensions: { [key]: { score, notes } }, aggregate_score, notes, reviewed_by, reviewed_at }`.
Default dimensions for escape-the-dungeon family: `playability`, `ui_polish`,
`mechanics_implementation`, `ingenuity_requirement_met`, `stability`. Weights default to
equal if not declared per-project.
- **Verify:** new file compiles; unit test validates sample rubric.
- **Depends:** none
- **Produces:** `lib/rubric-schema.ts`, `tests/rubric-schema.test.cjs`

**27-02** — Add `human_review_rubric` block to `evals/escape-the-dungeon/gad.json`,
`evals/escape-the-dungeon-bare/gad.json`, and `evals/escape-the-dungeon-emergent/gad.json`
declaring the 5 dimensions above with equal weights (0.20 each).
- **Verify:** gad.json parses; rubric fields readable by schema loader.
- **Depends:** 27-01
- **Produces:** updates to 3 gad.json files

**27-03** — Update `site/scripts/build-site-data.mjs` to parse both legacy
`human_review: { score, notes }` and new `human_review: { rubric_version, dimensions, aggregate_score, notes }`.
Emit unified shape on EvalRunRecord: when legacy, synthesize a `dimensions` object with a
single `overall` key pointing at the legacy score. When new, emit as-is. Site consumers
always see the rich shape.
- **Verify:** prebuild succeeds with legacy-only runs; resulting eval-data.generated.ts
  has dimensions field for every run.
- **Depends:** 27-01
- **Produces:** updates to `site/scripts/build-site-data.mjs`, `lib/eval-data.generated.ts`
  type definitions

**27-04** — `gad eval review <project> <version>` CLI subcommand. Loads the rubric from
`evals/<project>/gad.json`, prompts interactively for each dimension's score + notes,
validates 0.0-1.0, computes aggregate, writes back into `TRACE.json` as the new
`human_review` object with `rubric_version` stamp.
- **Verify:** run against escape-the-dungeon v8, fill in dimensions, verify TRACE.json
  updates correctly and parser reads it back.
- **Depends:** 27-02
- **Produces:** `bin/commands/eval-review.cjs`, updates to `bin/gad.cjs`

**27-05** — Re-review three representative runs under the new rubric: `escape-the-dungeon/v8`
(tracing gap), `escape-the-dungeon-bare/v3` (freedom hypothesis best), `escape-the-dungeon-emergent/v2`
(emergent workflow). These become the bootstrap dataset for the radar chart and any
rubric-based insights.
- **Verify:** three TRACE.json files have populated rubric dimensions.
- **Depends:** 27-04
- **Produces:** updated TRACE.json files under `evals/escape-the-dungeon*/v*/`

### Track 2 — Automated gate checks (tasks 27-06 → 27-10)

**27-06** — Playwright infrastructure scaffold in `vendor/get-anything-done/evals/`. Install
playwright as a devDep of the repo, add npm scripts, create `evals/<project>/gates/`
convention, define `gates.json` schema (per-gate pass/fail, screenshot paths,
assertion details, playwright version).
- **Verify:** `cd vendor/get-anything-done && npx playwright --version` works; sample
  empty gates.json validates.
- **Depends:** none
- **Produces:** `package.json` updates, `lib/gates-schema.ts`, `tests/gates-schema.test.cjs`

**27-07** — G1 (game loop) playwright test for `escape-the-dungeon`. Boots the built dist
(headless chromium, file:// URL), walks title → new game → room → navigate → combat →
return → at least 3 room transitions. Asserts the page doesn't softlock (DOM state visible
after each transition). Writes result + screenshots to `gates.json`.
- **Verify:** run against a known-passing build (bare v3), returns pass; run against a
  known-failing build (gad v7 with combat softlock), returns fail.
- **Depends:** 27-06
- **Produces:** `evals/escape-the-dungeon/gates/G1-game-loop.spec.ts`

**27-08** — G3 (UI quality) playwright test. Screenshots title + first 3 rooms. Pixel
analysis: extract a colour histogram + text-density heuristic. Asserts > 5 unique colours
beyond grayscale (rules out text-only output) and < 60% of pixels are monospace-font glyphs
(rules out raw ASCII). This is a rough heuristic, not a perfect polish score — it just
catches the v5-style "blank screen" failure and the raw-text-UI failures.
- **Verify:** passes against bare v3 (has sprite colours), fails against a synthetic blank
  screen.
- **Depends:** 27-06
- **Produces:** `evals/escape-the-dungeon/gates/G3-ui-quality.spec.ts`

**27-09** — `gad eval run-gates <project> <version>` CLI subcommand. Finds the built dist
under `evals/<project>/<version>/run/dist` (or legacy `evals/<project>/game/dist`), runs
the playwright specs under `evals/<project>/gates/`, writes `gates.json` sidecar. Updates
`requirement_coverage.gate_failed` in TRACE.json to match the gates.json verdict.
- **Verify:** run against escape-the-dungeon/v7, check the gate_failed field flips to true
  with G1 failure captured.
- **Depends:** 27-07, 27-08
- **Produces:** `bin/commands/eval-run-gates.cjs`, updates to eval preserve pipeline

**27-10** — Site: render gates.json on per-run pages. New "Automated gates" section when the
sidecar is present, each gate as a card with pass/fail badge + screenshot thumbnail.
Clicking a screenshot opens fullsize. Legacy runs without gates.json hide the section.
- **Verify:** local build renders the section for a run with gates.json, hides for runs
  without.
- **Depends:** 27-09
- **Produces:** `site/components/run-detail/AutomatedGates.tsx`, updates to
  `site/app/runs/[project]/[version]/page.tsx`

### Track 3 — Derived metrics (tasks 27-11 → 27-14)

**27-11** — Implement derived metric computation in `site/scripts/build-site-data.mjs`.
For each run, compute: `divergence_score = |composite - humanReview|`,
`plan_adherence_delta = planning_quality.tasks_planned - planning_quality.tasks_completed`,
`avg_commit_size` (from git log with `--stat`, if accessible), `commit_rhythm` (time
between commits as an array), `produced_artifact_density` (produced_artifacts total
count / timing.duration_minutes). Stub phase-25-dependent metrics (tool_use_mix,
skill_to_tool_ratio, subagent_utilization) as null.
- **Verify:** prebuild emits a `derived` object on each EvalRunRecord with the 5
  today-computable metrics; nulls for the phase-25 ones.
- **Depends:** none
- **Produces:** updates to `site/scripts/build-site-data.mjs`, `lib/eval-data.generated.ts`
  type definitions

**27-12** — Per-run page: derived metrics section. Compact table showing divergence score,
plan adherence delta, avg commit size, commit rhythm summary, produced artifact density.
Each cell clickable to reveal the input data.
- **Verify:** local build shows derived section on every run.
- **Depends:** 27-11
- **Produces:** `site/components/run-detail/DerivedMetrics.tsx`

**27-13** — When phase 25 lands and trace_events arrive, wire up the three stubbed metrics:
`tool_use_mix` (count by tool name), `skill_to_tool_ratio` (skill_invocation count /
tool_use count), `subagent_utilization` (subagent_spawn count / phases_completed). This
task is deferred to the first session after phase 25 ships.
- **Verify:** for a v4 run, the three metrics populate with real values.
- **Depends:** phase 25 complete
- **Produces:** updates to `site/scripts/build-site-data.mjs`

**27-14** — Tool-mix donut chart component (stubbed until 27-13 lands). Renders a SVG donut
showing the percentage breakdown of tool types for a run. Hides when tool_use_mix is null.
Caption: "Was this a reading-heavy or writing-heavy run?"
- **Verify:** local build renders the donut for runs with populated mix data.
- **Depends:** 27-13
- **Produces:** `site/components/charts/ToolMixDonut.tsx`

### Track 4 — Cross-run aggregate queries (tasks 27-15 → 27-18)

**27-15** — `gad eval query <sql>` CLI subcommand backed by an in-memory sqlite db loaded
from all TRACE.json files at invocation time. Flattens nested fields (`scores.composite`,
`derived.divergence_score`, etc) into queryable columns using dotted paths. Supports
SELECT/FROM/WHERE/ORDER BY/LIMIT/GROUP BY/aggregate functions (COUNT, AVG, SUM, MIN, MAX).
Outputs JSON.
- **Verify:** 4-5 example queries work: highest divergence runs, bare workflow average
  composite, runs with plan_adherence_delta > 2, count runs by requirement version.
- **Depends:** 27-11
- **Produces:** `bin/commands/eval-query.cjs`, `lib/eval-query.cjs`,
  `tests/eval-query.test.cjs`

**27-16** — Prebuild script runs 5 curated queries at build time and emits their results as
a new `INSIGHTS` export in `lib/eval-data.generated.ts`. Each query card has a name, a
caption (the research question), and the result rows.
- **Verify:** prebuild emits 5 result sets; generated file parses; site consumes.
- **Depends:** 27-15
- **Produces:** updates to `site/scripts/build-site-data.mjs`

**27-17** — `/insights` page route. Renders each of the 5 curated queries as a card with
the research question as the headline, a small table of the top N result rows, and a
visualization where applicable. At the bottom, a "run your own" card with the CLI usage
example.
- **Verify:** local build renders the page with all 5 cards populated.
- **Depends:** 27-16
- **Produces:** `site/app/insights/page.tsx`

**27-18** — Nav update: add `/insights` to the top-level nav after `/methodology`.
- **Verify:** nav link works on all pages.
- **Depends:** 27-17
- **Produces:** updates to `site/components/landing/Nav.tsx`

### Track 5 — Visualization components (tasks 27-19 → 27-23)

**27-19** — Rubric radar chart component. SVG-rendered polygon radar with one vertex per
dimension, filled area showing the current run's scores. Caption: "Which review dimensions
did this run score best and worst?" Appears on per-run page when rubric data is present.
- **Verify:** local build renders the radar for re-reviewed runs from 27-05.
- **Depends:** 27-05
- **Produces:** `site/components/charts/RubricRadar.tsx`, updates to per-run page

**27-20** — Divergence histogram component. SVG-rendered histogram of
`derived.divergence_score` grouped by workflow. Caption: "Which workflow has the biggest
gap between process metrics and human review?" Appears on `/insights` page.
- **Verify:** local build shows the histogram.
- **Depends:** 27-11, 27-17
- **Produces:** `site/components/charts/DivergenceHistogram.tsx`

**27-21** — Plan adherence distribution component. SVG-rendered bar chart of
`derived.plan_adherence_delta` across all runs. Caption: "How reliably do plans match
execution across rounds?" Appears on `/insights`.
- **Verify:** local build renders.
- **Depends:** 27-11, 27-17
- **Produces:** `site/components/charts/PlanAdherenceBar.tsx`

**27-22** — Commit rhythm timeline component. SVG-rendered timeline of commits per run
(dots along a time axis). Caption: "Did the agent work in bursts or steadily?" Appears
on per-run page.
- **Verify:** local build renders for runs with commit_rhythm data.
- **Depends:** 27-11
- **Produces:** `site/components/charts/CommitRhythmTimeline.tsx`

**27-23** — Update `/methodology` page "Data production pipeline" section to reference the
new components and `/insights` page. Add a subsection explaining the query DSL with
examples.
- **Verify:** local build renders updated section.
- **Depends:** 27-17, 27-19, 27-20, 27-21, 27-22
- **Produces:** updates to `site/app/methodology/page.tsx`

## Verification commands

```sh
# After each track lands:
cd vendor/get-anything-done && npm test
cd vendor/get-anything-done/site && node scripts/build-site-data.mjs && npx next build

# Track 1 end:
gad eval review escape-the-dungeon v8
jq '.human_review.dimensions' evals/escape-the-dungeon/v8/TRACE.json

# Track 2 end:
gad eval run-gates escape-the-dungeon v7
jq '.' evals/escape-the-dungeon/v7/gates.json

# Track 4 end:
gad eval query "SELECT project, version, derived.divergence_score FROM runs WHERE derived.divergence_score > 0.3 ORDER BY derived.divergence_score DESC"
# Visit /insights on the site
```

## Execution order recommendation

Phase 27 has 5 parallel tracks. If executing sequentially, prioritize:

1. **Track 3 first** (derived metrics) — no dependencies, unblocks track 4 and track 5 charts.
2. **Track 1 next** (rubric) — unblocks rubric radar chart and improves per-run pages immediately.
3. **Track 2** (playwright gates) — can run parallel to tracks 1 + 3. Infrastructure-heavy but
   independent.
4. **Track 4** (query + /insights) — needs track 3 complete.
5. **Track 5** (charts) — needs tracks 1, 3, and 4 partially done for meaningful chart data.

If executing in parallel across sessions, tracks 1, 2, and 3 can all start at the same time.
Tracks 4 and 5 start after track 3. Full phase completion estimated at 4-6 focused sessions
depending on how much rubric re-review effort we're willing to do.

## Commits

One atomic commit per task with prefix `feat(rubric):`, `feat(gates):`, `feat(metrics):`,
`feat(query):`, or `feat(charts):` as appropriate. Update `.planning/TASK-REGISTRY.xml`
with the resolution field on each commit. Update STATE.xml next-action at milestone
boundaries.

## Rollback plan

Each track is independently revertible:
- Track 1: remove the new rubric block from gad.json + revert parser changes → legacy
  single-score path is still intact.
- Track 2: delete `gates/` directories + revert `gad eval run-gates` command → human
  reviewers continue to judge gates manually.
- Track 3: revert the `derived` computation + type changes → site hides the derived section.
- Track 4: delete the query command + `/insights` page → existing per-run and summary
  pages unaffected.
- Track 5: delete chart components + their usages → underlying data still ships in the
  generated files.

No destructive operations. No migration of old runs. Everything is additive.
