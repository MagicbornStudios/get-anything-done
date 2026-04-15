# Snapshot rehydration cost — experiment design

> **SUPERSEDED 2026-04-15 by decision gad-195.** The operator confirmed H2
> without needing the experiment run — repeated rehydration IS wasteful and
> the session-scoped static/active split is the correct architecture. This
> doc remains as history for the design reasoning and the dependent-variable
> catalog, but the experiment itself is cancelled. See `gad snapshot --mode=active`
> (task 42.2-29) for the shipped implementation of the insight.

**Date:** 2026-04-15
**Phase:** 42.2 evolution turn
**Prompted by:** operator — "i am concerned about the rehydration of the snapshots. not
sure if we need to load similar context for goal pushing. like does having the same
repeatededly loaded context help? maybe not, does it reinforce the behavior more than
just some simple context that is loaded and not repeated? if so start up can help us
save context if the snapshot rehydration overhead is doing nothing."

## The concern (restated)

Current default: agents run `gad snapshot --projectid <id>` at session start AND after
every auto-compact to re-hydrate. That's ~6-7k tokens per re-run, injected into the
conversation context. The hypothesis being tested:

**H1:** Repeatedly loading identical snapshot context **reinforces goal-pushing behavior**
in the agent (task coherence, next-action compliance, decision awareness).

**H2:** Repeatedly loading identical snapshot context is **wasted tokens** — the agent
already saw the content at session start, and the second+ loads don't change its
behavior meaningfully.

If H2 is correct, a lighter-weight startup (just `gad startup` output + the `<next-action>`
line, maybe ~500 tokens) would be a pure win: same behavior, 10x cheaper per rehydration
cycle.

The failure mode we actually want to avoid: agent forgets the next-action or decision
state after auto-compact. The question is whether FULL snapshot is needed to prevent
that, or whether a POINTER TO the planning files (which the agent can read on demand)
is sufficient.

## Why this matters

- Snapshot is ~6-7k tokens. Across a typical working session with 3-5 auto-compacts,
  that's 18-35k tokens spent on rehydration.
- The Anthropic prompt cache has a 5-minute TTL. Long rehydration blocks are cold-read
  on every re-use.
- At scale across many agents and many sessions, rehydration is one of the top cost
  line items in the trace data.
- If H2 is correct, we can cut that cost by ~10x without losing any observable
  quality.

## Experiment design

This is an **A/B test** with three arms, run across a matched set of tasks.

### Arms

| Arm | Startup mechanism | Rehydration mechanism |
|---|---|---|
| **A (baseline)** | `gad snapshot --projectid <id>` | Same — full snapshot after each auto-compact |
| **B (lightweight startup + lazy fetch)** | `gad startup --projectid <id>` (prints contract + next-action only) | None — agent runs `gad state`, `gad tasks`, `gad decisions` on-demand only when it needs specific data |
| **C (pointer-only startup)** | `gad --startup` (just the session contract, no project data at all) | None — agent runs `gad snapshot` only if it can't make progress from the planning files it reads as needed |

Arm A is the current default. Arms B and C are the hypotheses.

### Task set

To avoid confounding on task difficulty, run each arm on the same 5 task types the
discovery battery uses:

1. **A (plan-a-phase)** — high context need (needs decisions, sprint, roadmap)
2. **B (evolution-cycle)** — medium context need (needs evolution state, candidate list)
3. **C (debug-failing-test)** — low context need (mostly symptom-driven)
4. **D (fresh-session-plus-create-skill)** — mixed context need (session start + skill catalog)
5. **E (candidate-to-canonical)** — low context need (pipeline is linear, mostly CLI-driven)

Each arm × task = one run. 15 runs total. Runs happen in isolated subagent sessions
with clean histories so there's no cross-contamination.

### Dependent variables (what we measure)

| Metric | How to measure | Direction (good) |
|---|---|---|
| `task_completion_rate` | Agent self-reports "I completed the task" at end; human reviews completion | Higher = better |
| `next_action_adherence` | Agent's first action matches the next-action string verbatim or semantically | Higher = better |
| `correct_skill_cited` | Did the agent cite the correct skill for the task? | Higher = better |
| `confidence_score` | 0-10 self-report at end of run | Higher = better |
| `rehydration_tokens_total` | Sum of tokens injected via snapshot / state / tasks / decisions CLI reads | Lower = better |
| `turns_to_first_correct_action` | Count of turns before the agent takes the first correct task-relevant action | Lower = better |
| `decision_awareness_error_rate` | Did the agent make claims that contradict a decision currently active? Human-graded 0/1 per run | Lower = better |

The interesting composites:

- **efficiency = (task_completion_rate × next_action_adherence) / rehydration_tokens_total**
  — if arm B or C beats arm A on efficiency, the lightweight startup wins.
- **coherence = 1 − decision_awareness_error_rate** — if arm A beats B and C on
  coherence, the full snapshot is doing something and the concern is wrong.

### Hypothesis test structure

H1 supported if: arm A's coherence score is substantially higher than arm B and C's
(> 15% gap with p < 0.1 on a 5-task n=3 block). If supported, keep the current
behavior and document why.

H2 supported if: arm B (and maybe C) match arm A on coherence AND beat arm A on
efficiency. If supported, change the default to `gad startup` and demote full
snapshot to an explicit `--full` opt-in.

Inconclusive if: coherence is within 5% across arms (noise floor). In that case,
default to arm B on cost-savings grounds — tie goes to the cheaper option.

### Execution mechanics

Option 1 — adapt the subagent discovery battery (skill `gad:discovery-test`). Three
runs of the 5-task battery with different startup mechanisms. ~45 runs total (~750k
tokens). Wall-clock ~15 minutes if all three sets run in parallel.

Option 2 — lightweight harness that only tests arms A vs B on 3 tasks. ~18 runs
(~300k tokens). Wall-clock ~5 minutes. Sufficient to detect a 10-15% gap on coherence
but not a 5% gap.

**Recommended:** start with Option 2. If results are ambiguous, run the full
Option 1. Don't start with Option 1 — the cost is nontrivial and the ambiguity on
priors is low enough that Option 2 should give a clear signal.

### Time-locking the experiment

Run it once now, then re-run after the P1 fixes land (snapshot EQUIPPED SKILLS
rebalance, `gad startup` polish). Track the delta. This also serves as a regression
test for startup-flow changes — if a new change makes coherence drop, we notice.

## Predictions before we run

My subjective priors before running:

- **H2 is mostly correct.** The agent reads snapshot once, writes down the next-action
  line as its TodoList equivalent, and from that point on most rehydration is
  paying for information the agent already encoded in its working memory (via
  writes to planning files, commits, or its own internal state).
- **Arm C is probably wrong.** Without any project data at startup, the agent spends
  the first 3-5 turns fetching what it needs, paying the cost piecemeal. That's
  probably WORSE than arm A because the fragmentary fetches don't benefit from cache
  locality.
- **Arm B is probably the sweet spot.** Session contract + next-action at startup
  (~500 tokens) + lazy on-demand fetches when the agent actually needs a file.
- **The gap is probably not huge.** 6k tokens across a 200k-context session is 3%.
  The real question is whether it scales — sessions with 10+ auto-compacts see 30-60k
  of cumulative rehydration that IS material.

## Infrastructure needed

1. **`gad startup --light`** — variant that prints only the session contract + current
   phase + next-action. Roughly 500 tokens. Exists now as `gad startup` (task 42.2-22);
   need to verify the output IS ~500 tokens not 1500.
2. **`gad state`** and **`gad decisions`** as on-demand fetches — exist already.
3. **Experiment harness skill** — wrap `gad:discovery-test` with an arm selector that
   swaps the startup command. Minimal extension of the existing workflow. Call it
   `gad:rehydration-experiment`.
4. **Scoring rubric** — a JSON schema each experimental subagent emits, matching the
   dependent variables table above. Human review step for `decision_awareness_error_rate`
   and `task_completion_rate` (the others can be auto-scored from trace events).

## Deliverables

1. `gad:rehydration-experiment` skill — extends `gad:discovery-test` with arm selection
2. Raw results at `site/data/rehydration-experiment-<date>.json`
3. Writeup at `.planning/notes/rehydration-cost-findings-<date>.md` with verdict
4. If H2 supported: PR that changes the default session-start flow per findings
5. Decision entry in DECISIONS.xml (gad-197?) codifying the winning arm

## Adjacent concerns (for follow-up)

- **Cache coherence**: does switching from snapshot-on-every-compact to lazy-fetch
  actually reduce cold-read costs, or does it just spread the cost across more
  messages? Measure via the Anthropic prompt cache hit rate if we can get at it.
- **Subagent rehydration**: this experiment is about the main session. Subagents
  spawned via the Agent tool always run cold — their "rehydration" is the prompt
  they're given, not a snapshot re-read. Out of scope for this experiment.
- **Eval-agent rehydration**: eval-mode agents rehydrate differently (worktree-scoped
  snapshot, different CLI surface). Out of scope for this experiment.

## When to run

After the P1 fixes in 42.2-22/23 (startup + skill-list lifecycle footer) land, before
any more changes to the session-start flow. Current window is NOW — we have the
startup command shipped and the lifecycle footer shipped. The experiment becomes
stale if we add more P1 fixes before running it.
