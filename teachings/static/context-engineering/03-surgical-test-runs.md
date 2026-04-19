---
id: context-engineering-surgical-tests-01
title: Surgical test runs beat full-suite noise when parallel agents are editing
category: context-engineering
difficulty: intermediate
tags: [tests, parallel-agents, noise, context-hygiene, signal]
source: static
date: 2026-04-19
related: [multi-agent-commit-fast-01, multi-agent-handoff-queue-01]
---

# Surgical test runs — don't let parallel-agent churn bleed into your context

When multiple agents share one worktree (Codex on TUI, Cursor on UI, you on planning), the full test suite is a minefield. Half the failures aren't yours. Every stack trace you read is rented context that does not help your current task.

## The rule

Run tests scoped to files YOU touched this turn. Nothing else.

```sh
# bad — inherits other agents' in-flight breaks
npm test

# good — only the files you just edited
npm test -- path/to/my.test.ts
vitest run src/module/changed.ts
pytest tests/test_thing.py::test_my_case
```

## Why it matters

1. **Context hygiene** — an unrelated 80-line stack trace costs ~300 tokens of your window. Reading it also costs attention you could have spent on your own work.
2. **Signal clarity** — if your tests pass, your work is good. Other agents' reds are their problem until they commit.
3. **Iteration speed** — surgical runs are ~10–100× faster; you can test per-edit, not per-session.

## When to escalate to full suite

- **Before a commit** — you own your commits; don't push red.
- **When you touched something cross-cutting** — shared lib, config, schema.
- **At session end** — know the baseline for next session.
- **When surgical passes but you suspect wider damage** — rare, but trust the suspicion.

## Anti-patterns

- **"Just run everything, it's faster to know"** — no, it pollutes your window with noise you'll then reason about.
- **Mental filtering** — you can't reliably ignore 40 failing tests "because they're probably someone else's." You will chase one of them.
- **Running tests you can't read the output of** — if the output is 2000+ lines, you're not going to actually use the signal.

## Related

- `multi-agent-commit-fast-01` — why commit-per-edit makes surgical runs safe
- `context-engineering-brevity-discipline-01` — same principle (signal density) applied to responses
