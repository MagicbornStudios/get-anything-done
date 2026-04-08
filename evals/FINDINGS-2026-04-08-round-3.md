# Round 3 Findings — Freedom Hypothesis

**Requirements version:** v3 (game-loop gate, spell-crafting gate, UI quality gate)
**Date:** 2026-04-08
**Conditions:** GAD v8, Bare v3, Emergent v2 — all hit rate limits but produced builds

## Results — inverted from expectations

| Condition | Framework constraint | Tokens | Commits | Human score | Notes |
|-----------|---------------------|--------|---------|-------------|-------|
| **Bare v3** | **None (most freedom)** | 1,877 | 1 batch | **0.70** | Best UI/UX by far, most enjoyable |
| Emergent v2 | Medium (inherited skills) | 1,609 | 2 phases | 0.50 | Solid forge, more content, maintained discipline |
| GAD v8 | Full framework | 1,291 | 0 | 0.20 | Broken crafting, ASCII UI, hard to read |

**The result is monotonic and inverse to framework constraint.** More freedom = better output.

## Running tally across all rounds

| Run | Requirements | Human | Key observation |
|-----|-------------|-------|----------------|
| GAD v5 | v1 | 0.00 | Blank screen |
| GAD v6 | v2 | 0.00 | Blank screen |
| GAD v7 | v2 | 0.30 | Stuck after combat |
| **GAD v8** | **v3** | **0.20** | Broken crafting |
| Bare v1 | v2 | 0.10 | New Game broken |
| Bare v2 | v2 | 0.50 | Playable, ASCII UI |
| **Bare v3** | **v3** | **0.70** | **Best game overall** |
| Emergent v1 | v2 | 0.10 | Styled text crash |
| **Emergent v2** | **v3** | **0.50** | Functional forge, medium UI |

**GAD has never exceeded 0.30 human review across 4 attempts.**
**Bare has improved monotonically: 0.10 → 0.50 → 0.70.**
**Emergent has improved: 0.10 → 0.50.**

## Freedom hypothesis

> For creative/game implementation tasks, agent performance correlates INVERSELY with
> framework constraint. Less prescribed structure leads to better output.

### Supporting evidence

1. **Bare always beats GAD** on human review, across all 3 rounds with same requirements
2. **GAD has more tokens, more tool uses, more commits** — but produces worse games
3. **GAD v8 had 0 commits** because it was so busy following the framework it hit the rate limit
   before completing a work unit worth committing
4. **Bare v3 best UI/UX** despite no framework telling it how to build UI
5. **Emergent sits in the middle** — some framework, some freedom, middle results

### Counter-evidence / confounds

1. Rate limits hit all three runs — GAD v8 may have been about to commit when cut off
2. Single-run variance is high — we haven't established statistical significance
3. GAD's strength is discipline/traceability, not creative output — we may be measuring the
   wrong thing for game evals
4. Bare v3's "one giant commit" means if it had broken, there'd be no checkpoint. GAD's
   discipline is insurance against catastrophic failure, not a booster for success

### Alternative interpretation: the framework hurts speed

GAD's planning overhead (reading/writing .planning/ docs, per-task commits, state updates,
decision capture) consumes tokens that could have gone to implementation and testing. In
a time-limited or token-limited environment, this overhead compounds:

| Metric | GAD | Bare | Ratio |
|--------|-----|------|-------|
| Rounds completed with playable game | 0/4 | 2/3 | Bare 5x better |
| Rounds with blank screen | 2/4 | 0/3 | GAD worse |
| Rounds with gate failure | 4/4 | 1/3 | GAD worse |

**GAD is producing disciplined garbage.** The process is followed but the product fails.

## What this means for GAD

1. **GAD may not be the right framework for creative implementation tasks.** It was designed
   for planning/tracking, not for game development. Game dev rewards iteration speed and
   visual feedback, which GAD's planning overhead slows down.

2. **The bare condition's success suggests "AGENTS.md + requirements + freedom" is sufficient**
   for implementation. The planning doc maintenance may be dead weight.

3. **GAD's value proposition needs to be re-examined.** If process compliance doesn't correlate
   with output quality, what is GAD actually optimizing for?
   - Traceability across sessions (context compaction recovery)
   - Multi-agent coordination
   - Long-horizon planning (months, not days)
   - Regulatory/compliance work where process matters

4. **The game eval may be the wrong benchmark for GAD.** A better benchmark would be:
   - Resuming work after context compaction
   - Multi-phase refactors where state matters
   - Documentation that has to be kept in sync with code
   - Bug triage and root-cause analysis

## Open questions

1. Would GAD win if we measured context-resumption rather than fresh implementation?
2. Does GAD win when the agent is replaced mid-run (simulating handoff)?
3. What happens if we give Bare the same token budget as GAD's planning overhead in the form of free research time?
4. Is the freedom hypothesis specific to KAPLAY/games, or does it generalize to web apps, APIs, CLIs?
5. Would GAD do better with a "lite mode" that strips planning doc maintenance but keeps verification?

## Immediate actions

1. Treat this as a preliminary finding — needs more runs for statistical validity
2. Create a GAD-lite mode for comparison (no per-task planning doc updates, only phase-level)
3. Add a context-resumption eval where GAD's advantages should appear
4. Do NOT abandon GAD — this finding may be specific to greenfield game implementation

## Infrastructure findings

- **Rate limits revealed discipline pressure response:** Emergent v2 was the only condition
  that maintained phase commits under pressure. Bare regressed to 1 batch commit. GAD never
  committed anything. Emergent's inherited skill "game-loop-verification" (which mandated
  verify-per-phase) may have enforced a checkpoint discipline that kicked in before the limit.

- **Build preservation was broken:** All previous runs overwrote the same path in
  apps/portfolio/public/evals/. Now fixed — all 8 builds preserved per-version.
