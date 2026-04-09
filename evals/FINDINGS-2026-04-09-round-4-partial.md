# Round 4 — partial results under rate limit

**Date:** 2026-04-09
**Requirements version:** v4 (pressure-oriented, 4 gates, authored dungeon)
**Framework version:** v1.32.0 + commit 3ef0bb5 (post phase-25 milestones A/B/C, trace hooks installed)
**Status:** all three greenfield conditions rate-limited simultaneously around the 14-minute mark

## Summary

The first round 4 attempt hit a shared account-level rate limit and stopped all
three greenfield agents (GAD, Bare, Emergent) within ~14 minutes of launch.
None of the three runs completed. This document exists so the partial data
isn't misinterpreted as completed-run comparison data — it's not.

That said, **the partial data is itself informative**. What the three conditions
got done before stopping is a direct snapshot of where they spent their tool
budgets: planning, scaffolding, or skill inheritance. The differential matters
regardless of whether the runs reached their gates.

## Raw measurements

| Condition | tool_uses | duration | phases planned | tasks completed | build status | TRACE.json |
|---|---|---|---|---|---|---|
| **GAD** (escape-the-dungeon v9) | 81 | 14 min | 7 | 4 of 23 | ✓ dist builds (phase 01 verified) | planning_quality 0.85 |
| **Bare** (escape-the-dungeon-bare v4) | 45 | 14 min | 10 (flat worklog) | 1 of 10 | ✓ dist builds (manual vite build) | planning_quality 0.10 |
| **Emergent** (escape-the-dungeon-emergent v3) | 40 | 14 min | 0 | 0 | ✗ build fails (main.ts missing) | planning_quality 0.05 |

All three were rate-limited mid-run. None reached their gates. Human review is
pending but will NOT be compared against completed runs (decision noted in each
TRACE.json).

## What was accomplished

### GAD (v9) — planning overhead is visible

The GAD agent produced the **most complete planning artifact set of any eval
run to date**, in 14 minutes:

- `ROADMAP.xml` — 7 phases (scaffold, title screen, room navigation, combat,
  rune forge, pressure mechanics, dialogue and NPCs)
- `TASK-REGISTRY.xml` — 23 tasks broken down by phase with status fields
- `STATE.xml` — current-phase 02, current-plan "Title Screen and Game Start",
  next-action "Task 02-02: Implement scene transition system and New Game flow"
- `DECISIONS.xml` — scaffolded (empty)
- `VERIFICATION.md` — phase 01 verified as PASS with working dist
- `scenes/`, `systems/`, `types/`, `data/`, `main.ts` — clean architectural
  separation matching GAD conventions

**Implementation depth:** scaffold + title screen only. The dist builds but the
game is just the title screen — no navigation, no combat, no forge.

**Signal:** GAD spent its tool budget on *planning-first*. 23 tasks planned
before hitting the limit. If the run had continued, the remaining 19 tasks
were pre-structured and the agent could have continued without re-planning.
That's the framework's claim — that planning front-loaded is worth the cost
at run-start.

### Bare (v4) — direct implementation, shallow plan

The Bare agent:

- Wrote a single flat `worklog.md` with a 10-step plan keyed to the 4 gates
- Scaffolded Vite + TypeScript + KAPLAY game
- Wrote 6 source files (`combat.ts`, `data/`, `main.ts`, `screens/`, `state.ts`,
  `ui.ts`)
- Did NOT author new skills (inherited create-skill + find-sprites were copied
  but not extended)
- Vite build succeeds manually (54 KB bundle, 18 modules)

**Implementation depth:** project scaffold + partial implementation of all the
listed step 2 files, but no runtime verification. The game compiles but
hasn't been tested through the loop.

**Signal:** Bare spent its budget on *direct code*. 6 source files vs GAD's
architectural split across 5 subdirectories. No re-planning ceremony. If the
run had continued, Bare would have accreted more files without structured
phase boundaries — which round 3 showed is the bare workflow's strength for
creative implementation but weakness for cross-round coherence.

### Emergent (v3) — inheritance applied, entry point missing

The Emergent agent:

- Copied all 7 inherited skills from previous runs into `game/.planning/skills/`
  (create-skill, find-sprites, content-pack-loading, game-loop-verification,
  kaplay-scene-pattern, previous-workflow, state-composition)
- Wrote 6 modular source files matching the `state-composition` inherited
  skill's pattern (`content.ts`, `icons.ts`, `renderer.ts`, `state.ts`,
  `styles.ts`, `types.ts`)
- Did NOT write `main.ts` — the entry point that `index.html` imports
- **Build fails objectively** — `vite build` errors with
  `Rollup failed to resolve import /src/main.ts from index.html`

**Implementation depth:** modular architecture designed but not integrated. The
agent was building bottom-up (types → state → renderer) and was rate-limited
before writing the top-level `main.ts` that would have assembled everything.

**Signal:** The inherited `state-composition` skill demonstrably shaped the
architecture (types.ts first, then state.ts, then the rest). Emergent ran fewer
tool_uses (40) than Bare (45) for comparable output, suggesting the inherited
skills reduced figuring-out cost. But the run died before reaching the
integration step — the rate limit truncated the critical moment.

## The rate limit itself is a finding

Three agents running in parallel on a single Claude account share a single rate
limit bucket. All three stopped at tool_uses 40/45/81 after ~14 minutes with a
"limit resets at 12am" message. Calculating token velocity: ~3-10 tool_uses per
minute per agent is well within typical limits for a single agent — but the
sum of three concurrent agents apparently tipped the account over.

**Implication for eval methodology:** parallel eval runs need either (a)
separate accounts per agent, (b) serial execution, or (c) per-agent rate limit
carveouts. Running three agents in parallel to save wall-clock time is a false
economy if the shared bucket caps their collective output.

This is also a data-integrity problem: the three runs stopped at the same wall-
clock moment, meaning whichever one started with the most efficient early steps
got proportionally more runway than the others. GAD's 81 tool_uses vs
Emergent's 40 isn't a fair comparison of "capacity" — it's a comparison of
"how much got done before a shared cap fired."

## What this does NOT tell us

- **Whether GAD beats Bare on round 4 v4 requirements.** Neither reached the
  gates. The freedom hypothesis from round 3 is neither confirmed nor refuted
  by this data.
- **Whether the inherited emergent skills help.** The inherited skills visibly
  shaped Emergent's architecture but the run didn't get far enough to validate
  the end-to-end result.
- **Whether v4 requirements are well-designed.** We didn't reach the pressure
  gate (G4) in any condition. v4 remains untested against real agent output.
- **Whether trace hooks capture what we need.** The hooks were installed but
  we haven't yet processed the `.planning/.trace-events.jsonl` from these runs
  (if any were written — agents running in worktrees may not have picked up
  the local settings.json hook wiring). Phase 25 milestone B e2e test is still
  pending.

## What to do next

1. **Do not include these runs in cross-round comparisons or Graphs scatter.**
   The TRACE.json files explicitly say so in their human_review.notes fields.
   The site's Results and Graphs sections should filter on
   `timing.rate_limited === true` and exclude rate-limited runs from the
   freedom-hypothesis visualization.
2. **Retry round 4 serially** when the rate limit resets. One agent at a time.
   Expected completion per agent: 20-30 minutes without the three-way
   competition. Total wall-clock: 60-90 minutes.
3. **Process trace events** from the three worktrees (if any were written) to
   validate phase 25 milestone A hooks — even rate-limited runs would have
   produced partial event streams before stopping.
4. **Consider a retry budget per run** — set a wall-clock cap on each eval
   run so retry-after-rate-limit is graceful.

## Cross-condition planning differential (even under rate limit)

| Measurement | GAD | Bare | Emergent |
|---|---:|---:|---:|
| Planning artifacts created | 6 XML + 1 MD | 1 MD | 0 |
| Tasks explicitly planned | 23 | 10 | 0 |
| Source files written | ~10 | 6 | 6 |
| Bootstrap skills copied | n/a (framework) | 2 | 7 |
| New skills authored | 0 | 0 | 0 |
| Build succeeds | yes | yes | no |
| Tool uses when cap hit | 81 | 45 | 40 |

The planning differential is real and observable. GAD's planning structure is
clearly visible in 14 minutes of output. Bare's direct-implementation pattern
is clearly visible. Emergent's inheritance-driven modularity is clearly
visible. What's not visible is whether any of it would have *worked* given
enough budget — that's what the retry will tell us.

## Decisions flagged for DECISIONS.xml

- **gad-62**: Parallel eval runs on a single account share one rate limit
  bucket. Serial execution is the default from now on. Parallel execution
  requires documented per-account capacity and pre-calculated budget.
- **gad-63**: Rate-limited runs are preserved as data points but explicitly
  excluded from cross-round quality comparisons. TRACE.json timing
  `rate_limited: true` is the filter key.
