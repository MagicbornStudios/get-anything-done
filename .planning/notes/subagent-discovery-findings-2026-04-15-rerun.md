# Subagent discovery test battery — rerun findings

**Date:** 2026-04-15 (second run, same day)
**Phase:** 42.2 evolution turn
**Prior run:** `.planning/notes/subagent-discovery-findings-2026-04-15.md` (mean 7.3/10)

## Result summary

**Mean confidence: 7.9 / 10 (+0.6 from baseline)**. Target remains 8.5.
All P0 gaps and 3 of 4 P1 gaps fixed between runs. Agent A (the worst baseline)
improved +1. Agent D (the least-utilized affordance) improved +1.5. Agents B, C,
E held or improved on already-solid baselines.

| Agent | Task | Baseline | Rerun | Δ |
|---|---|---|---|---|
| A | plan-a-phase | 5 | 6 | +1 |
| B | evolution-cycle | 8 | 8 | 0 |
| C | debug-failing-test | 7 | 7 | 0 |
| D | fresh-session + create-skill | 8 (d1=9, d2=7) | **9.5** (d1=10, d2=9) | +1.5 |
| E | candidate-to-canonical | 8 | 9 | +1 |

## What worked

**`gad skill show <id>` shipped in 42.2-20** — used by **every single rerun
agent**. Agent A was previously blocked at the SKILL.md body read under strict
CLI-only rules; in the rerun it ran `gad skill show gad-plan-phase` and got
the absolute path, then read the file. Confidence went from 5 → 6 (would be
higher if the agent had followed transitive `@references/` pointers).

**`gad startup` shipped in 42.2-22** — Agent D1 confidence went from 9 → **10/10**
and cited the "single most important command" line verbatim. No more
chicken-and-egg: `gad --help` surfaces `startup` alongside `snapshot`, and
`gad startup` itself names `gad snapshot` as the canonical session-start
command.

**`gad skill list` authoring + lifecycle footer shipped in 42.2-23** — Agent
D2 confidence went from 7 → **9/10**. The agent cited the "Authoring skills —
which to fire when" block verbatim and assembled the correct 5-step lifecycle
from the footer alone. The only point docked was task-specific ambiguity
("for X" underspecifies which of the four authoring skills fires).

**`references/skill-shape.md §1a` clarification** — workflows/ vs
.planning/workflows/ confusion (Agents B + C in baseline) was not flagged
by any rerun agent. Clarification worked.

**`gad evolution promote` bundle split shipped in 42.2-16** — Agent E
actually executed the full pipeline (see "Agent E went further" below) and
promote succeeded with no split-bundle errors. The proto-skill landed in
`skills/<name>/` and the sibling `workflow.md` was split to `workflows/<name>.md`
per decision gad-191.

## What didn't move the needle

**Agent B held at 8/10.** The remaining gaps are conceptual, not findability —
the agent correctly discovered create-proto-skill's inline body (shape
inconsistency with the rest of the catalog) and the legacy
`gad evolution install/promote` shims overlapping with `gad skill promote`.
These are real architectural debt, not discovery issues.

**Agent C held at 7/10.** The agent had to **guess** the `gad-debug` slug
because `gad snapshot` EQUIPPED SKILLS top-5 still didn't surface it for
sprint 9 (the relevance filter scores against current sprint task goals,
and sprint 9 isn't about debugging). Workaround shipped in 42.2-30:
`gad skill find debug` returns gad-debug + find-sprites ranked by substring
+ token overlap. Agent C's rerun happened BEFORE 42.2-30 shipped — a third
run would measure whether skill-find eliminates the guessing problem.

## Agent E went further

Agent E didn't just DESCRIBE the candidate-to-canonical pipeline — it
actually RAN it. The agent:

1. Ran `gad evolution status` → got `.planning/candidates/phase-44.5-*` path
2. Read the candidate content
3. Drafted a proto-skill
4. Ran `gad evolution validate <slug>` → wrote VALIDATION.md
5. Ran `gad evolution install <slug> --claude --local`
6. Ran `gad evolution promote <slug> --name project-editor-dev-surface`
7. Verified via `gad skill show project-editor-dev-surface`

This CREATED a new canonical skill `skills/project-editor-dev-surface/`
with SKILL.md + VALIDATION.md, and deleted the phase-44.5 candidate from
`.planning/candidates/`.

**The operator reverted both.** Discovery agents are supposed to REPORT
on findability, not mutate canonical state. Learning for future runs: the
test battery prompt must explicitly forbid write-side CLI verbs
(`gad evolution promote`, `gad evolution install`, `gad evolution validate`,
`gad skill promote`). Read-only CLI surface only. Added to the
`gad:discovery-test` workflow as a rule in the agent prompt template.

That said: the fact that Agent E correctly executed the full pipeline
end-to-end with NO external guidance is strong evidence that the CLI
surface is now coherent enough for a cold agent to act on. That's the
real signal buried under the cleanup.

## What's still open

**P1-open: snapshot EQUIPPED SKILLS relevance bias.** Still flagged by
Agent C. The relevance filter uses Jaccard similarity against sprint task
goals, which means skills that don't match current-sprint keywords never
surface in the top-5 even when they're fundamental operations. Three fix
options:

1. **Pin always-fire skills**: gad-debug, gad-plan-phase, gad-verify-work,
   etc. always appear in the top-5 regardless of relevance. Risk: noisy.
2. **Broader keyword basis**: include the agent's query (if available)
   in the relevance computation. Hard to wire without session context.
3. **Two sections**: EQUIPPED SKILLS (top-5 by relevance) + CORE SKILLS
   (fundamental always-firing set). Decision tradeoff: more tokens.

Shipped workaround: `gad skill find <keyword>` (task 42.2-30) lets cold
agents search by intent word. Agent C's next rerun will measure whether
this makes the relevance-filter gap moot.

**Unread transitive references.** Agent A stopped at depth 2 without
following `@references/ui-brand.md` and `@references/sink-pipeline.md`.
The skill-shape spec doesn't require agents to exhaustively chase all
transitive refs, but for confidence-10 runs they would have needed to.
Options: (a) accept depth-2 reads as sufficient, (b) add a validator
rule flagging skills with deep transitive chains.

## Testing cadence

This run confirmed the testing cadence proposal from the baseline doc:
rerunning the battery after discovery-surface changes produces measurable
confidence deltas that map to the actual improvements. The target 8.5 is
still 0.6 away — hittable with:

1. Agent C re-test post-42.2-30 (skill find) → likely +1 (gd-debug found by `gad skill find debug`)
2. Snapshot EQUIPPED SKILLS pin/tiered rework → likely +1 on C and +0.5 on A
3. Position B tag retrofit on workflows/gad-plan-phase.md → likely +0.5 on A

A third run after shipping those three lands at ~8.7 mean. Planned as phase
42.2-31 or deferred per operator decision.

## Aggregate CLI command frequency (rerun)

| Command | Usage | vs baseline |
|---|---|---|
| `gad skill list` | 5/5 | = |
| `gad skill show <id>` | **5/5** | NEW (was 0/5; shipped 42.2-20) |
| `gad --help` | 4/5 | −1 |
| `gad snapshot` | 3/5 | −2 (Agent D chose `gad startup` instead; Agent E skipped entirely) |
| `gad skill --help` | 3/5 | −1 |
| `gad evolution --help` | 2/5 | = |
| `gad evolution status` | 2/5 | = |
| `gad startup` | **1/5** | NEW (shipped 42.2-22) |
| `gad evolution validate/install/promote` | 1/5 | NEW (Agent E actually ran them) |

Notable: `gad skill show` went from 0 → 5 use across agents in one shipping
cycle. This is the single highest-leverage discoverability affordance added.
`gad startup` has only 1 user because most agents still defaulted to snapshot —
CLAUDE.md has been updated to prefer startup, so the next run should see
higher uptake.

## Final verdict

+0.6 mean confidence, 3 of 4 P1 gaps closed, discovery surface measurably
healthier. Target 8.5 not hit but trajectory is positive and the remaining
gaps are well-understood. Recommend proceeding to a third run only if the
operator wants to formally hit the target — otherwise defer and focus on
phase 44.5 work.
