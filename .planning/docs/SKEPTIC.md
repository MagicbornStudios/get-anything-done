# Skeptic — devils advocate against our own hypotheses

**Owner:** GAD framework maintainers.
**Purpose:** Hold every hypothesis the project has claimed to its strongest critique. State the steelman, then enumerate the falsifications, methodological weaknesses, and alternative explanations. Then list concrete moves that would strengthen credibility.
**Why this exists:** Per the project value prop (gad-74 / gad-76), GAD is research infrastructure first and a framework second. Research infrastructure that doesn't critique itself isn't research — it's marketing. This document is the public commitment to taking our own claims apart.
**Last updated:** 2026-04-09.

---

## Methodology critiques that apply to *everything* below

Before going hypothesis-by-hypothesis, here are the critiques that hit every claim in the project:

### 1. Sample size is too small to draw any conclusion

Through round 4 we have:

- **GAD condition:** 4 attempts (v5, v6, v7, v8) + 2 partial/interrupted (v9 rate-limited, v10 api-interrupted). N=4 actual scored runs.
- **Bare condition:** 5 attempts (v1, v2, v3, v4, v5). N=5.
- **Emergent condition:** 4 attempts (v1, v2, v3, v4) — and emergent v3 was a deferred / preserved partial. N=2-3 fully comparable.

That is **not statistically significant for anything**. Two data points can't establish a curve. Three can't establish a trend. We have been speaking about "monotonic improvement" and "cross-round comparison" with sample sizes that would not survive a 101-level statistics review.

**Implication:** every "X beats Y" claim in the findings is at best directional, at worst noise.

### 2. No randomization

Every run has used:
- The same coding agent (Claude Code)
- Approximately the same model (Claude Opus 4.6 / Sonnet 4.5 family)
- The same human reviewer (the project maintainer)
- The same task domain (an authored roguelike game)
- The same rubric author (also the project maintainer)
- The same requirements author (also the project maintainer)

We have not controlled for: agent runtime, model family, reviewer identity, task domain, rubric construction, or requirements authoring style.

**Implication:** every result could be an artifact of a single decision the maintainer made about how to structure the experiment, not a property of the framework being tested.

### 3. The judge is the architect

The same person:
- Wrote the requirements
- Designed the rubric
- Reviews the runs
- Authors the findings
- Drafts the next round's requirements based on the findings

This is a **closed feedback loop with no external check**. Every observation is filtered through one head. There is no chance for the rubric to be wrong in a way that would be visible to anyone else, because no one else has scored a run.

**Implication:** confirmation bias is structural here, not personal. Even with perfect intellectual honesty, a one-person research team has no immune system against pet theories.

### 4. Hypotheses are formulated AFTER seeing data

The freedom hypothesis (gad-36) was named after round 2 produced an unexpected result. The compound-skills hypothesis (gad-65) was named after emergent v4 produced an interesting skill ratcheting cycle. The emergent-evolution hypothesis (gad-68) was named after the user noticed similarities to repomirror and Ralph Wiggum loop observations.

None of these were **pre-registered**. None were stated in writing before the data that would test them was collected. That means we cannot tell whether the hypotheses are testing the data, or whether the data is generating the hypotheses post-hoc.

**Implication:** we are doing exploratory analysis, not hypothesis testing. That is fine for early-stage research as long as we name it correctly. We have not been naming it correctly.

### 5. Single-task domain

Every eval is a variant of *Escape the Dungeon*, a roguelike game with rune crafting. We claim things about "agent performance on creative implementation tasks." We have evidence about agent performance on **one specific game**.

**Implication:** every conclusion generalizes poorly until at least one other task domain (web app, CLI tool, refactor task, infrastructure-as-code change) replicates the same finding.

### 6. The rubric has changed mid-project

- Round 2 → 3: human review weight raised from 0.15 to 0.30 (gad-34)
- Round 3 → 4: rubric reformulated as per-dimension scoring, low-score caps added
- Round 4 → 5 (planned): pressure may become a 6th dimension (open question)

Composite scores from round 1 are not directly comparable to round 4 because the formula has changed. We have been comparing them anyway.

**Implication:** the "monotonic improvement" we celebrate may partly reflect rubric drift, not agent improvement.

---

## Hypothesis-by-hypothesis critique

### Freedom Hypothesis (gad-36)

> For creative implementation tasks, agent performance correlates **inversely** with framework constraint. Less prescribed structure → better output.

**Steelman:** Across rounds 2-4, the bare condition has improved monotonically (0.10 → 0.50 → 0.70 → 0.805) while the GAD condition has never exceeded 0.30 human review across four attempts. GAD spends 7-15% more tokens than bare on the same task. The pattern is consistent, not noise.

**Devils advocate:**

- **N=4 vs N=5 is not a curve**, it's a row of data points. The claimed "monotonic improvement" of bare across 4 rounds is exactly the kind of pattern that random noise produces 1 time in 16 by chance. That's worse than statistical significance — that's coin-flip-territory.
- **The bare prompt has changed across rounds.** Bare v1 had a different AGENTS.md than bare v5. We attributed bare's improvement to "the agent is getting better at the task" when at least some of the improvement is "the requirements doc got clearer over rounds." Confounded.
- **GAD never finished a round.** GAD v5/v6/v7/v8 all hit gate failures or partial completion. We are comparing "GAD agents who got broken games done" with "bare agents who got working games done" — but the broken games might be a runtime/budget issue, not a framework issue.
- **GAD and bare may not be the same agent at all.** Same model family, but different system prompts produce different behavior. The "framework" variable is conflated with the "system prompt" variable.
- **Time efficiency hides sunk cost.** GAD spends tokens on planning artifacts that *should* pay off in multi-session work. Greenfield single-shot game implementation is exactly the workload GAD's design assumes is *not* the primary use case (gad-74). We chose a benchmark that disadvantages the framework we're testing.
- **No power calculation was ever done.** Even if the freedom hypothesis is correct, we don't know how many runs it would take to detect it at conventional confidence. The fact that we have observed the result with very few runs suggests the effect is either huge (great if true) or noise (likely if you assume the null).

**Alternative explanations for the same data:**

1. Bare's improvement is the requirements getting clearer, not the framework being absent
2. GAD's stagnation is single-condition variance — GAD might score 0.70 on its 5th attempt with no framework changes
3. GAD's task assumptions (planning loop survives compaction, multi-session work, decision tracking) are not exercised by greenfield game implementation
4. The bare AGENTS.md happens to be a better prompt than the GAD AGENTS.md — independent of the planning loop

**Falsification conditions:** the freedom hypothesis would be falsified by:

- A round where bare produces a worse game than GAD on the same requirements with N≥3 replicates per condition
- A different task domain (web app, CLI) where GAD beats bare with the same setup
- A pre-registered prediction that doesn't pan out

We have not run any of these.

**Honest current status:** preliminary observation, single-domain, low-N, post-hoc named. Calling it a "hypothesis" is generous; calling it a "finding" would be irresponsible.

---

### Compound-Skills Hypothesis (gad-65)

> A coding agent's skill library compounds in value over many rounds as skills are merged and tailored to the project. The emergent workflow should produce monotonically improving results.

**Steelman:** Round 4's emergent v4 authored two new skills (`dom-over-kaplay`, `pressure-forge-coupling`), deprecated one (`kaplay-scene-pattern`), and documented the disposition of every inherited skill in CHANGELOG.md. Its rubric aggregate (0.885 after rescoring) was the highest of any round-4 run. This is the first observed "ratcheting cycle" — inherit, evaluate, evolve, document.

**Devils advocate:**

- **N=2-3 emergent runs is not a curve.** Emergent v1, emergent v2, emergent v4 (v3 was deferred). Three points cannot establish a trend, especially when v4 is the only one against the v4 requirements.
- **The "monotonic improvement" you'd need to demonstrate the hypothesis hasn't happened.** v1 scored 0.10, v2 scored 0.50, v4 scored 0.885 — but the requirements got harder between each (v1 against requirements v2, v2 against requirements v3, v4 against requirements v4). We do not know whether emergent improved or whether the maintainer got better at writing prompts.
- **The 6th rubric dimension is circular.** `skill_inheritance_effectiveness` is human-rated by the same person who authored the rubric. We are using human judgment to measure whether human-authored skills are useful. There is no ground-truth check.
- **Inherited "skills" are project-specific.** `dom-over-kaplay` and `pressure-forge-coupling` would be useless for any other game. Is that "compounding" or just "specialization that won't generalize"? We have not defined what "compounding" should look like operationally.
- **No ablation.** We have never run an emergent project that *doesn't* inherit skills. Until we do, we cannot tell whether emergent v4's score comes from inherited skills or simply from the agent being a more capable agent in 2026 than in 2025.
- **CHANGELOG self-report is exactly the trust model gad-69 says we should not rely on.** The agent decides what its CHANGELOG entries say. We trust them because they're text in the repo, but the agent could lie about whether a skill was useful.

**Alternative explanations:**

1. Emergent v4's score is an outlier produced by the maintainer playing the game more carefully than v1/v2 on a more polished build
2. Skills don't compound — agents just get better at games as the agent (model + maintainer) improves
3. The "ratcheting cycle" is just one agent author (one of round 4's runs) getting lucky on naming
4. The 6th dimension is rewarding the maintainer's preference for emergent, not measuring inheritance effectiveness

**Falsification conditions:**

- An emergent-no-inherit run that scores comparably to emergent-with-inherit at the same round
- Round 5 emergent scoring lower than round 4 emergent against the harder v5 requirements
- A second human reviewer giving meaningfully different scores

**Honest current status:** First observation of a ratcheting cycle. Not enough data to claim compounding. The 6th rubric dimension is at best a measurement *of intent to test the hypothesis*, not a measurement *of the hypothesis being true*.

---

### Emergent-Evolution Hypothesis (gad-68)

> Projects are themselves emergent. Skills must be tailored continually and merged with foundational skills to maintain consistency. The combination of freedom + compounding + the GAD-provided foundational pool will produce better work over time.

**Steelman:** This is the synthesis hypothesis — it explains both the freedom hypothesis and the compound-skills hypothesis with a single mechanism. The craftsman/lifter metaphor is intuitive. The repomirror and Ralph Wiggum loop creators independently observed similar dynamics. The in-game rune/spell merge mechanic is a real-world analogue we can point to.

**Devils advocate:**

- **It is a synthesis of two not-yet-proven hypotheses, framed as if it's a new claim.** If freedom is unproven and CSH is unproven, gad-68 is the conjunction of two unproven things. That's *less* credible than either alone, not more.
- **The metaphor is doing the heavy lifting.** Craftsman, lifter, blacksmith — these are all good stories. None of them are evidence. We have not shown that human craftsmanship dynamics transfer to agent skill libraries.
- **The merge-skill primitive does not yet exist.** gad-73 names create-skill / merge-skill / find-skills as the foundational triumvirate, but the audit task is unfinished. We are claiming the framework provides a "substrate for evolution" while at least one of the substrate's three primitives is unbuilt.
- **"Projects are emergent" is unfalsifiable as currently stated.** What evidence could convince me a project is *not* emergent? None. That's a vibe, not a hypothesis.
- **Repomirror and Ralph Wiggum loop observations are anecdotes from creators of related tools.** They're suggestive, not evidence. We don't have their data and they don't have ours.

**Alternative explanations:**

1. The emergent workflow is just bare with a few extra files, and its improvement is the same bare-improvement attributed to a different cause
2. The "evolution substrate" is a metaphor we like, not an observed mechanism
3. The synthesis is post-hoc justification for keeping the GAD framework around after the freedom hypothesis cast doubt on it

**Falsification conditions:**

- A round 5 emergent run that performs WORSE than round 4 emergent against harder requirements
- An emergent project against a different task domain (web app, refactor) failing to compound
- The triumvirate audit revealing that merge-skill / find-skills don't exist and the framework is not actually providing the substrate we claim

**Honest current status:** A working synthesis. Useful as a research direction. Not yet a hypothesis with stakes — we have not stated what would make us drop it.

---

### Pressure as a measurable dimension (gad-75)

> Pressure = constraint intensity applied to the agent. Composed of requirement complexity, ambiguity, constraint density, iteration budget, failure cost. Pressure is what the requirements have been implicitly encoding.

**Steelman:** Naming pressure as a first-class variable explains a lot of confusing observations: why bare improved monotonically (the maintainer was implicitly raising pressure each round), why GAD's gate failures clustered in early rounds (low ambiguity tolerance), why emergent v4 felt qualitatively different from v2 (higher constraint density). It also gives us a normalization variable for cross-round comparisons.

**Devils advocate:**

- **The formula does not exist.** We are calling pressure "measurable" while the measurement is currently a hand-typed constant in `app/roadmap/page.tsx`. That is exactly self-report — the same problem gad-69 says we should fight.
- **The five sub-dimensions overlap.** "Requirement complexity" and "constraint density" are nearly synonymous. "Ambiguity" and "interpretation required" are the same thing. We have five labels because five sounds like a satisfying number, not because there are five orthogonal axes.
- **All five sub-dimensions are author-rated.** The agent doesn't know what pressure level it's operating under. The reviewer doesn't either. Only the requirements author does, and the requirements author is the same person rating the dimensions.
- **Pressure-tier ratings are post-hoc and predictive simultaneously.** Round 5's pressure rating (0.92) is in the file before round 5 has run. That makes it a prediction about how the requirements will feel — but we will then evaluate round 5's results against that prediction, creating circular validation.
- **There is no validation step.** Even if we compute a pressure score programmatically, we have no way to check whether the score matches agent-experienced pressure. We would correlate it against tool_uses-to-failure ratio and call that validation, but that's measuring agent struggle, not pressure.

**Alternative explanations for what "pressure" is actually capturing:**

1. Just requirement word count
2. Just the maintainer's intuition about how hard a round felt
3. A retrofit narrative justifying why early rounds scored lower

**Falsification conditions:**

- Round 5 produces results inconsistent with the predicted pressure tier
- A second researcher rating the same requirements gives meaningfully different pressure scores
- A programmatic pressure score correlates poorly with the hand-rated one

**Honest current status:** A useful conceptual lens. Not yet a measurement. The current presentation in /roadmap overstates how operational it is.

---

### GAD's value proposition (gad-74)

> GAD's primary value is task management at scale in-repo + scientific framework for skill effectiveness, NOT "ship software faster."

**Steelman:** The freedom hypothesis suggests GAD doesn't beat bare on creative implementation. So we positioned GAD's value elsewhere: durable in-repo state, decisions auditable, fork-and-go, the eval framework as the load-bearing feature. This is more honest than the original framing, which was implicitly "use GAD to ship faster."

**Devils advocate:**

- **We have no evidence GAD does task management at scale BETTER than alternatives.** Linear, Notion, GitHub Issues, Jira, plain markdown files — any of those can hold tasks in-repo or near-repo. We claim "in-repo" is a differentiator without showing it improves outcomes. It's a preference dressed up as a feature.
- **"Forkable + no SaaS" is true of any text-files-in-git system.** Specifically, RepoPlanner, GSD, Aider, and Continue all qualify. What does GAD add over `cat .planning/state.md`? Mostly: a CLI, an XML schema, and a snapshot command. That's not nothing, but it's not a moat.
- **The eval framework IS load-bearing — but we measure ourselves with our own framework.** Circular validation. There is no external benchmark we score against. If our rubric is wrong, all our findings are wrong, and we have no way to find out.
- **"Skill security" is a future commitment, not a current feature.** /security correctly says we don't host third-party skills and the certification model is a research direction. That's honest, but it means the third leg of the value prop is aspirational.
- **The pivot from "ship software" to "evaluate agents" is post-hoc.** It happened after round 3 made the original framing untenable. We renamed the value prop instead of shipping the original one. That's a valid response, but it should be acknowledged as a pivot.

**Alternative framings of GAD's value:**

1. "GAD is a research notebook for one person" — true and honest, smaller audience claim
2. "GAD is an opinionated convention for keeping decisions in repo" — true, but doesn't justify the framework overhead
3. "GAD is an experiment in whether task management improves agent reliability" — accurate, lower stakes

**Falsification conditions:**

- A team using a non-in-repo task system (Linear) demonstrably runs better evals
- The eval framework reaches 10+ external contributors and we still have to defend its construction

**Honest current status:** The new value prop is more defensible than the old one. It's still partially aspirational (skill security) and partially circular (the eval framework validates itself).

---

## What would make us more credible

Concrete moves, ranked by how much they'd actually move the needle:

### 1. Pre-register hypotheses for round 5 BEFORE running it

Write down in `.planning/PRE-REGISTRATION-ROUND-5.md` exactly what we expect each condition to score, what the falsification thresholds are, and what we will conclude if the data goes either way. Commit it BEFORE running the eval. This is the single highest-value move available to us.

### 2. Run replicate runs per condition

3-5 replicates per condition per round, not 1. Same requirements, same workflow, different worktrees. Measures within-condition variance so we can tell if "X beats Y" is signal or noise. Cost: tokens. Benefit: we stop confusing one-shot results with effects.

### 3. Add a true ablation arm

For round 5, add `escape-the-dungeon-emergent-no-inherit` — same requirements, same workflow, but starting with an empty skill library. If emergent-no-inherit scores comparably to emergent-with-inherit, the compound-skills hypothesis is dead.

### 4. Get a second human reviewer

One person scoring everything is a single point of failure. Even one external review per round (a friend, a colleague, a community member) would surface where the rubric is biased. Cost: politeness. Benefit: enormous credibility lift.

### 5. Run the same eval against a different game / task

Generalization is the difference between "we observed this" and "we discovered this." Pick one non-roguelike task (a TODO app, a CLI parser, a markdown converter) and run all three workflows against it. If freedom hypothesis holds, it should hold there too.

### 6. Compute pressure programmatically before the run

Define the formula in code. Compute it from REQUIREMENTS.xml at prebuild. Display the value as "computed" not "estimated." Allow human override but flag it visually. This converts pressure from self-report to deterministic.

### 7. Open the rubric to community input

The rubric is currently `gad.json human_review_rubric` blocks edited by one person. Move it to `data/rubric.json` and explicitly invite issue-based proposals to add or reweight dimensions. Even if no one proposes anything, the openness is meaningful.

### 8. State falsifiability inline in every finding

Every Findings doc must include a section: "What would falsify this finding?" Forces the writer to think about what could be wrong. Reader can immediately see if the threshold has been crossed.

### 9. Stop calling preliminary observations "hypotheses"

We have used the word "hypothesis" to mean "thing we noticed and gave a name." A real hypothesis has a falsification threshold, a sample size estimate, and a pre-stated direction. Until we hit that bar, the right word is "observation" or "working theory" — and the site copy should reflect it.

### 10. Audit the triumvirate

gad-73 names find-skills / merge-skill / create-skill as the foundational primitives. Verify they exist. Build whichever doesn't. Until this audit completes, gad-68 (emergent-evolution) is making claims about a substrate that may not exist.

---

## How this document is used

- **When publishing a new finding:** read the relevant hypothesis section here first. If the finding doesn't survive the critique, soften the claim.
- **When designing a new round:** check the falsification conditions. If the round can't possibly produce data that would falsify a claim, the round is testing something else.
- **When a reader asks "how do I know this is real?":** point them here. The credibility move is admitting what we don't know.
- **When the maintainer is feeling confident:** also point them here. Confidence in early-stage research is the most dangerous failure mode.

---

## What's NOT in this critique

This document does not critique:

- The decision to do this research at all (research is research, low-N exploratory work is fine if named correctly)
- The choice of an authored game as the eval domain (defensible — needs UI, mechanics, narrative, breaks-on-impl-bug, all in one task)
- The decision to keep everything in repo (pragmatic — see ASSUMPTIONS.md)
- The specific weights in any rubric version (those are subjective and changing them mid-project is fine if documented)

Those are choices, not claims. The critique is reserved for claims.
