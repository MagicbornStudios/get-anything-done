# Eval: subagent-utility

**Project:** Subagent utility formal evaluation
**Purpose:** Determine whether spawning subagents improves or degrades outcomes on
representative GAD tasks. Informs whether gad-16 (no subagents until evaluated) should
be revised.

## Background

gad-16 forbids subagents until formally evaluated. Two prior spawn attempts both failed:
agents burned their context budget reading large task descriptions without producing useful
output. However, this was under high context pressure (96%+) — a biased sample.

## What is measured

For a set of representative tasks, compare:

| Condition A | Condition B |
|-------------|-------------|
| Single-session, no subagents | Main session + 1 subagent per task |

Measure for each:

1. **Task completion rate** — tasks finished / tasks attempted
2. **Context consumed** — total tokens used across all sessions/agents
3. **Correctness** — output quality vs reference (reviewer-scored 0–1)
4. **State hygiene** — planning files accurate after completion
5. **Wall time** — total elapsed time (if measurable)

## Hypothesis

Subagents help for **research tasks** (broad codebase search, multi-source synthesis)
and hurt for **execution tasks** (file edits, sequential state updates) due to cold-start
context overhead.

## Task categories to test

| Category | Example task | Predicted winner |
|----------|-------------|-----------------|
| Research: broad search | Find all usages of X across 6 vendor projects | Subagent |
| Research: multi-source synthesis | Summarize all DECISIONS.xml entries | Subagent |
| Execution: single-file edit | Update TASK-REGISTRY.xml status | Single-session |
| Execution: sequential state | Complete 3 tasks in sequence with sync after each | Single-session |
| Hybrid: research + edit | Find X, then update planning doc with findings | Unknown |

## Eval criteria for revising gad-16

gad-16 should be revised to ALLOW subagents if, for at least 2 of 5 task categories:
- Condition B (subagent) achieves ≥ 0.90 task completion rate
- Condition B consumes ≤ 1.5× the tokens of Condition A
- Condition B correctness score ≥ Condition A correctness score − 0.05

If subagents only help for specific categories, gad-16 should be revised to allow
subagents for those categories only (category-specific guidance in AGENTS.md).

## Running the eval

```sh
gad eval run --project subagent-utility
gad eval score --project subagent-utility
gad eval diff v1 v2 --project subagent-utility
```
