---
id: multi-agent-commit-fast-01
title: When parallel agents share one tree, commit each cohesive edit immediately
category: multi-agent
difficulty: intro
tags: [git, parallel-agents, commits, work-preservation, stash]
source: static
date: 2026-04-19
related: [multi-agent-handoff-queue-01, context-engineering-surgical-tests-01]
---

# Commit-fast — when the tree is shared, commit per edit, not per session

Default agent habit: edit, edit, edit, run tests, then commit once at the end. This fails in multi-agent setups where another agent is writing to the same tree.

## Failure modes

- **Silent overwrite** — Agent B rewrites a file you'd modified but not committed. Your work vanishes with no warning.
- **Stash loss** — you `git stash` to pull Agent B's changes; stash-pop hits conflicts from Agent B's concurrent writes; sometimes stash entries are lost or silently dropped.
- **Compaction with uncommitted state** — auto-compact fires mid-task, you lose the edit intent, and uncommitted state has no recovery path.
- **Race on registries** — TASK-REGISTRY, package.json, route maps: both agents touch the same file; last writer wins; both commits want the same line.

## The rule

**One cohesive edit → one commit.** Not "when I've finished the task" — every time you have a coherent unit of change, commit it.

## What "cohesive" means

- A single function implemented + its test file passing
- A migration applied + schema doc updated
- A refactor of one module, not the cross-cutting sweep
- A registry entry + the code it points to

## Commit message discipline

Short, typed, task id included if there is one:

```
feat(tokenizer): byte-level encode/decode round-trip (01-03)

Why: needed before BPE training in 01-04.
```

The "why" is where commit-fast earns its keep — future-you (or the other agents) need to know why each incremental state exists.

## When this matters most

- **Parallel agents active** — team mode, multi-Cursor, codex-alongside-claude
- **Auto-compact imminent** (~60%+ context) — commit-before-compact is the only safe recovery
- **Working on a file any other agent might touch** — configs, registries, indexes, schema
- **The task will span a session boundary** — commits are your resume points

## Anti-patterns

- **`git stash` with parallel agents** — don't. Commit or copy aside to a scratch path.
- **"I'll squash later"** — you won't; and the intermediate state is your real insurance.
- **Batching 5 logically independent changes into one "WIP" commit** — unpickable if you need to revert one.
- **Committing only when tests pass** — fine for solo work; in parallel, you want a commit even if just the first edit is stable, so Agent B can see your intent.

## Cleanup after

If your commits are messier than desired, rebase / squash at a **session boundary** (after all agents are quiet). Never mid-task.

## Related

- `multi-agent-handoff-queue-01` — commits are how handoffs cite completed work
- `context-engineering-surgical-tests-01` — surgical tests + commit-fast = clean increments
