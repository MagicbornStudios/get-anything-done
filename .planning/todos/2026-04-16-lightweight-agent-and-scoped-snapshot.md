# Lightweight agent profile + scoped snapshot — cheaper subagent cold-start

**Source:** Session 2026-04-16d (operator proposal, post cost-breakdown SITREP)
**Area:** framework / cli / context engineering
**Urgency:** high (drops parallel-subagent token cost)

## Problem

Every spawned subagent today pays full cold-start:
- `gad snapshot` ~7k tokens of static+active context
- AGENTS.md mandatory reading
- Project CLAUDE.md overrides
- Skill catalog + decision log re-hydration

Most of that is irrelevant to a narrow task. If the task is "rename X to Y in
file Z", the agent does not need 220 decisions, 61 open tasks, or the full
skill list.

## Proposal — agent profiles

Define **profiles** as tiers of context a spawned subagent receives. Profile
picked at spawn time based on task shape.

| profile | includes | token budget | use when |
|--|--|--|--|
| `scoped-minimal` | task spec + file list from `gad query` + one SKILL.md | ~1.5k | single-file edit, known-scope refactor |
| `scoped-task` | above + phase context + relevant decisions (via graph) | ~3k | multi-file task inside a known phase |
| `sprint-active` | current active snapshot (mode=active) | ~3.9k | task needs cross-task awareness |
| `full` | full snapshot (mode=full) | ~7k | planning, discuss-phase, framework work |

Today's default for subagents is effectively `full`. Goal: default becomes
`scoped-task`, with orchestrator opting up or down explicitly.

## Scoped snapshot — CLI

```
gad snapshot --task <task-id>
  # emits task description + file refs from graph + minimal skill context

gad snapshot --scope <phase-id>
  # emits one phase subtree + its decisions

gad snapshot --profile scoped-minimal --task <task-id> --skill <skill-id>
  # composable filters
```

Backed by the existing planning graph (`889 nodes, 1251 edges`,
`gad query` at 12.9× token savings vs raw XML). The scoped snapshot is a
*view* over the graph, not a reimplementation.

## Minimal-agent mode — drop AGENTS.md and CLAUDE.md

Some tasks are simple enough that a subagent does not need the framework
preamble at all. E.g. "apply this diff and run npm run build". For those:

- Spawn with a tiny bespoke system prompt
- Input: task spec, file list, expected output shape
- Output: structured report (JSON or fragment-table)
- No session, no loop, no memory — stateless worker

Candidate trigger: orchestrator agent decides task is "mechanical" and
delegates with `scoped-minimal` profile + no framework preamble.

## Output format — delta per communication-style.md

Subagent reports to orchestrator should follow SITREP:

- Root set once, paths relative after
- Headers carry units, cells = values only
- Deltas only (operator's example: drop "file 1, file 2" → header "file"
  + column of `1 / 2`)
- No narration, no apology, no trailing summary
- JSON-queryable where feasible (orchestrator parses, no re-reading)

Enforce via an output-schema reference in the minimal profile's spawn prompt.
Reference: `vendor/get-anything-done/references/communication-style.md`.

## AGENTS.md / CLAUDE.md slimming

Separate angle, same theme. The root `AGENTS.md` and project `CLAUDE.md`
should be reviewed against decision gad-18:

> *The GAD loop is simple: snapshot → work → update docs → commit.*

Any content not strictly required for the loop should live in deeper docs
(referenced, not inlined). Audit candidates:

- Content that repeats what `gad snapshot` already prints
- Verbose "when to do X" that could be a skill trigger instead
- History / rationale that belongs in DECISIONS.xml

Cut target: root AGENTS.md < 2k tokens; project CLAUDE.md < 1k tokens,
assuming snapshot provides the rest.

## Parallel-orchestrator skill

The skill that ties outbox + profiles together (see sibling todo
`2026-04-16-structural-parallelism-task-outbox.md`). Orchestrator agent
logic:

1. Parse its own task list (scratch file getting large + parallelizable)
2. For each parallelizable chunk, pick a profile and spawn a subagent
3. Subagents claim their tasks via `gad task claim` → work in scratch
4. Orchestrator watches scratch files for completion
5. On commit, orchestrator reconciles and reports up

Triggers: task scratch file > threshold, task list has N independent items,
task items match a "mechanical" pattern.

## Open questions

| Q | Notes |
|--|--|
| How does scoped snapshot handle decisions that span phases? | Graph traversal N hops; tunable |
| How to detect "mechanical" tasks automatically? | Heuristic: task description matches known verb set (rename, move, apply patch) |
| Does minimal-agent mode need its own trace format? | Stateless workers should still emit JSONL for trace-analysis |
| Upgrade path — can today's subagents read a `scoped-task` snapshot? | Yes, it is strictly a subset |

## Dependencies

- Planning graph (exists — `gad query`)
- `gad task claim/commit/release` (new — sibling outbox todo)
- `gad snapshot --profile`, `gad snapshot --task`, `gad snapshot --scope`
  (new subcommand flags)
- Audit of root `AGENTS.md` and project `CLAUDE.md` files

## Test plan

1. Implement `gad snapshot --task <id>` — measure token output vs full
2. Spawn a subagent on a trivial task (e.g. 45-15 vocabulary grep-replace)
   using scoped-minimal profile, measure vs full-profile baseline
3. Compare: task completion rate, correctness, time, tokens
4. If scoped-minimal completes the task at ≥90% quality with ≤25% tokens,
   promote as default for mechanical tasks
5. Publish results as second article on /articles/ (pairs with parallel-cost)

## Next step

After outbox plumbing (sibling todo) lands, implement `gad snapshot --task`
and run the two-profile A/B. Outbox is prerequisite — without scratch
isolation, profile work can't be measured cleanly.
