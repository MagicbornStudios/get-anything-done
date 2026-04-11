# Phase 27 — Structured objective data production for evaluations · discussion output

**Phase:** 27
**Status:** discuss-phase complete, ready for plan-phase
**Author:** Claude Opus 4.6 (session 5)
**Decisions referenced:** gad-29, gad-61

---

## Goal

Stop treating "a composite score per run" as the primary eval output. Start treating **structured
data that yields insights** as the primary output. A score is just one kind of derived number; the
framework should also produce per-dimension human review rubrics, automated gate checks, derived
metrics from trace events, cross-run aggregate queries, and purpose-built visualizations that
surface patterns instead of just summaries.

The underlying research question: *what does the data we already collect actually tell us, and
what are we missing because we haven't structured it yet?* When we can answer "does the
[forge-with-ingenuity-payoff](/methodology) gate correlate with a specific tool use pattern?"
with a query against structured data, the eval framework stops being "a test harness" and
becomes "a research tool."

## Non-goals

- **Not** changing the composite formula math. Weights stay.
- **Not** running new evals. Phase 27 is pure analytics + capture + visualization infrastructure
  on top of existing runs.
- **Not** shipping trace v4 — that's phase 25. Phase 27 can proceed in parallel: the rubric
  work and the aggregate queries land against v3 trace data today and get richer inputs when
  v4 arrives.
- **Not** a UI redesign. New charts go into existing sections (`/methodology`, `/runs/...`,
  `/projects/...`) or onto a new `/insights` page that reuses the existing section shell.

## Scope boundaries

- **In scope:** rubric schema + reviewer UX, playwright gate automation, derived-metric
  computation from existing TRACE.json fields, cross-run query CLI + site integration, new
  visualization components, the `objective-eval-design` methodology skill.
- **Out of scope:** trace v4 events (phase 25), Remotion video compositions for insights
  (phase 26, blocked on v4 data), ML-driven outlier detection or statistical significance
  testing (future phase).

---

## Five tracks

### Track 1 — Structured human review rubric

**Problem:** `human_review` is currently a single number + notes blob. A reviewer who thinks
the game is "visually polished but mechanically shallow" has to average those into one score.
Two reviewers can disagree about playability without disagreeing about polish, but today
they'd just see a number delta with no way to pinpoint the disagreement.

**Proposal:** Replace the single score with a dimensions object:

```json
{
  "rubric_version": "v1",
  "dimensions": {
    "playability": { "score": 0.7, "notes": "..." },
    "ui_polish": { "score": 0.6, "notes": "..." },
    "mechanics_implementation": { "score": 0.8, "notes": "..." },
    "ingenuity_requirement_met": { "score": 0.4, "notes": "..." },
    "stability": { "score": 0.9, "notes": "..." }
  },
  "aggregate_score": 0.68,
  "notes": "Overall reviewer takeaway",
  "reviewed_by": "...",
  "reviewed_at": "..."
}
```

- `rubric_version` tracks rubric evolution the same way `requirements_version` tracks spec
  evolution. v1 is the initial dimension set; a v2 might split `playability` into `controls`
  and `feedback_loops` if reviewers consistently conflate them.
- `dimensions` keys are defined per eval project in `gad.json` under a new
  `human_review_rubric` field. Different projects can have different dimensions (e.g. a
  tooling eval wouldn't have `playability` or `ingenuity_requirement_met`).
- `aggregate_score` is the weighted sum of dimensions, weights defined alongside the dimension
  list. Backwards compatible: existing `scores.human_review` reads `aggregate_score`.
- `notes` on the top level is the reviewer's overall impression; per-dimension `notes` are
  where they justify the individual scores.
- Old runs (single-score format) keep working — the parser handles both shapes and emits
  the same `humanReview.score` field to the site. New runs render a rubric breakdown on the
  per-run page.

**Reviewer UX:** Today reviewers hand-edit TRACE.json. That's fine for bootstrapping but
bad for repeatability. Phase 27 ships a `gad eval review <project> <version>` command that
loads the current rubric for the project, prompts for each dimension interactively, validates
scores are 0.0-1.0, and writes the structured object back into TRACE.json. Could also be a
web form on the site eventually but CLI first.

### Track 2 — Automated gate checks (playwright)

**Problem:** Gate failures are assessed by human reviewers opening the built game and
playing. That's expensive, non-reproducible, and doesn't scale across rounds. G2 spell
crafting "was broken when used" (v8 human review) could be automated — a playwright test
that opens the forge, combines two runes, casts the spell in a combat, and asserts the
game state is still consistent would catch that failure objectively and deterministically.

**Proposal:** Per-eval-project `gates/` directory containing playwright tests that map to
the declared gate criteria. For escape-the-dungeon:

```
evals/escape-the-dungeon/gates/
  G1-game-loop.spec.ts         — boots build, starts new game, navigates 3 rooms, asserts no softlock
  G2-forge-ingenuity.spec.ts   — opens forge, combines runes, uses crafted spell in combat
  G3-ui-quality.spec.ts        — screenshots each scene, asserts no raw text-only UI via pixel analysis
  G4-pressure-mechanics.spec.ts — asserts baseline abilities fail against a specific elite encounter
```

Each test is run by `gad eval run-gates <project> <version>` against the built dist. Output
is a `gates.json` sidecar alongside TRACE.json with per-gate pass/fail + screenshot paths +
assertion details. The existing `requirement_coverage.gate_failed` field becomes derived
from this sidecar instead of set by the human reviewer.

Human review still happens — reviewers rate the *subjective* dimensions (polish, pacing,
"does this feel fun"). But gate pass/fail stops being a judgment call.

**Phase-27 deliverable** is the infrastructure (playwright wiring, gates.json schema, site
rendering of gate results with screenshots). The actual gate tests for each eval project
can land incrementally as sub-phases — we don't need all 12 projects automated at once.

### Track 3 — Derived metrics from trace events

**Problem:** We have rich raw data in TRACE.json already (git_analysis, planning_quality,
timing, token_usage) and v3-era skill_accuracy.expected_triggers for some runs. We compute
a handful of aggregate scores from them but barely any *derived* metrics that would surface
behaviour patterns.

**Proposal:** Compute and emit the following derived metrics per run (via the prebuild
script today; moves into the trace post-processor once phase 25 lands):

| Metric | Computed from | What it tells us |
|---|---|---|
| **tool_use_mix** | `token_usage.tool_uses` + per-event breakdown (phase 25) | Read-heavy vs Edit-heavy vs Bash-heavy run — proxy for exploration vs authoring |
| **commit_rhythm** | `git_analysis.total_commits` + per-commit timestamps | Burst vs steady vs single-big-commit — proxy for discipline |
| **avg_commit_size** | git log with `--stat` | Small atomic vs batched — correlates with per_task_discipline |
| **plan_adherence_delta** | `planning_quality.tasks_planned - planning_quality.tasks_completed` | How much the plan drifted during execution |
| **skill_to_tool_ratio** | skill_invocation count / tool_use count (phase 25) | Framework leverage per tool call — higher = more methodology-driven |
| **subagent_utilization** | subagent_spawn count / total phases (phase 25) | Did the agent delegate or go it alone |
| **divergence_score** | `\|composite - human_review\|` | Flags runs where process metrics lied |
| **produced_artifact_density** | produced skills/agents/planning files / duration_minutes | How much methodology did the agent invent per minute |

Metrics land in a new `derived` object on the generated EvalRunRecord. Site consumers (per-
run page, graphs, /insights) render them. Some are available today (plan_adherence_delta,
commit_rhythm, divergence_score); others land when phase 25 ships trace v4.

### Track 4 — Cross-run aggregate queries

**Problem:** The site shows per-run data and a few pre-built comparisons (freedom hypothesis
scatter). It doesn't let you ask new questions without writing new site code. "Which runs
used the forge room more than 3 times?" isn't answerable without opening every TRACE.json.

**Proposal:** `gad eval query` subcommand that runs SQL-like queries against the trace
dataset. Implementation: load all TRACE.json files into an in-memory sqlite db at build time,
run user queries via the CLI, emit JSON. Examples:

```sh
gad eval query "SELECT project, version, scores.composite FROM runs WHERE workflow='bare' ORDER BY scores.composite DESC"
gad eval query "SELECT AVG(derived.divergence_score) FROM runs GROUP BY workflow"
gad eval query "SELECT project, version FROM runs WHERE derived.plan_adherence_delta > 5"
```

Site side: `/insights` page with a curated set of named queries rendered as cards
("highest-divergence runs", "most methodology-authored bare runs", "skills with highest
trigger accuracy across projects"). Each card runs its query at build time and displays
the result as a small table + chart. Custom queries via the CLI for deeper digging.

Not a full interactive SQL UI — that's over-scoped. Just the common queries rendered as
insight cards + a CLI for the power user case.

### Track 5 — Visualization patterns

**Problem:** We have a few charts today (scatter, bar). Adding more charts doesn't
necessarily add insight — the question is whether each chart answers a specific research
question or is just showing a number.

**Proposal:** For every new chart, the author has to state the question it answers. The
chart caption is the answer. A short list of charts to add in phase 27, each keyed to its
question:

| Chart | Question it answers | Where it lives |
|---|---|---|
| **Tool-mix donut per run** | "Was this a reading-heavy or writing-heavy run?" | Per-run page, next to process metrics |
| **Commit rhythm timeline** | "Did the agent work in bursts or steadily?" | Per-run page |
| **Rubric radar** | "Which review dimensions did this run score best/worst?" | Per-run page, new rubric section |
| **Divergence histogram by workflow** | "Which workflow has the biggest process-vs-reality gap?" | `/insights` page |
| **Plan adherence distribution** | "How reliably do plans match execution across rounds?" | `/insights` page |
| **Skill trigger accuracy heatmap** | "Which skills fire reliably vs miss consistently?" | `/methodology` page |
| **Rubric dimension correlation matrix** | "Do reviewers who score UI low also score playability low?" | `/insights` page (requires multiple reviewers per run) |

Each chart is a React component under `components/charts/`. Ship one or two per session,
not all seven at once.

---

## Plan-phase seed tasks

When `/gad:plan-phase 27` runs, these become the initial task candidates:

- **Rubric infrastructure (tracks 1):**
  - 27-01 — Define rubric schema + add `human_review_rubric` block to evals/escape-the-dungeon/gad.json (and bare/emergent variants)
  - 27-02 — Update build-site-data.mjs to parse both the legacy single-score format AND the new rubric format; emit unified shape with backwards compat
  - 27-03 — `gad eval review` CLI command with interactive dimension prompts + validation
  - 27-04 — Site: rubric radar chart + per-dimension bar list on per-run page
  - 27-05 — Re-review 3 existing runs (v8, bare v3, emergent v2) under the new rubric as the bootstrap dataset

- **Automated gates (track 2):**
  - 27-06 — Playwright infrastructure: install, npm scripts, gates/ directory convention, gates.json schema
  - 27-07 — G1 (game loop) playwright test for escape-the-dungeon
  - 27-08 — G3 (UI quality) pixel-analysis playwright test for escape-the-dungeon
  - 27-09 — Site: render gates.json results on per-run page with screenshots
  - 27-10 — Derive `requirement_coverage.gate_failed` from gates.json when available

- **Derived metrics (track 3):**
  - 27-11 — Compute plan_adherence_delta, avg_commit_size, commit_rhythm, divergence_score, produced_artifact_density from existing TRACE.json + git data in prebuild
  - 27-12 — Emit `derived` object on EvalRunRecord; render on per-run page
  - 27-13 — Reserve tool_use_mix, skill_to_tool_ratio, subagent_utilization for after phase 25 lands

- **Aggregate queries (track 4):**
  - 27-14 — `gad eval query` CLI: sqlite-in-memory loader + simple WHERE/ORDER/LIMIT/GROUP support
  - 27-15 — `/insights` page with 5 curated query cards (highest divergence, most methodology-authored bare runs, biggest plan drift, longest runs, lowest skill trigger accuracy)
  - 27-16 — Site build integration: run queries at prebuild time, emit results as generated JSON

- **Visualization components (track 5):**
  - 27-17 — Tool-mix donut component (renders against derived.tool_use_mix when present)
  - 27-18 — Commit rhythm timeline component
  - 27-19 — Rubric radar component
  - 27-20 — Divergence histogram on /insights

- **Methodology:**
  - 27-21 — skills/objective-eval-design/SKILL.md — the research methodology skill captured in session 5 (this already ships in phase 22 task 22-34 as the meta artifact)
  - 27-22 — Update /methodology page with Data production pipeline section explaining tracks 1-5

## Dependencies + parallelism

- Phase 27 can run **parallel to phase 25**. The rubric work, playwright gates, and derived
  metrics that come from existing fields all land against v3 trace data.
- A few derived metrics (tool_use_mix, skill_to_tool_ratio, subagent_utilization) **require
  phase 25** to be meaningful. Tasks 27-13 and related chart components ship empty or stubbed
  until then.
- `/insights` page doesn't need phase 25 at all — it runs over whatever derived metrics are
  available.

## Open items for plan-phase

- **Rubric v1 dimensions — the exact list for escape-the-dungeon.** Proposed above
  (playability, ui_polish, mechanics_implementation, ingenuity_requirement_met, stability)
  but these should be reviewed before landing. Are there dimensions we routinely want to
  judge separately that aren't in the list? Should `mechanics_implementation` split into
  `combat_mechanics` and `progression_mechanics`?
- **Rubric weights.** Do we default to equal weights across dimensions or weight them per
  eval project? Proposal: per-project weights in `gad.json` under `human_review_rubric`,
  default to equal if unspecified.
- **Playwright against built dist or dev server?** dist is more reproducible (same bytes
  humans reviewed) but dev server is more debuggable (hot reload, source maps). Proposal:
  gates run against dist, a separate `gad eval debug-gates` runs against dev server for
  authoring the tests.
- **`/insights` query DSL.** Full sqlite subset or a constrained JSON query format? sqlite
  is more expressive, constrained JSON is easier to validate. Proposal: start with sqlite
  subset — we're not exposing it to untrusted users, and the expressiveness pays for itself
  the first time we want a JOIN or a subquery.
