---
id: multi-agent-handoff-queue-01
title: A filesystem handoff queue is the canonical channel for cross-lane work
category: multi-agent
difficulty: intermediate
tags: [handoff, coordination, lanes, filesystem, durability]
source: static
date: 2026-04-19
implementation: [vendor/get-anything-done/bin/gad.cjs, .planning/handoffs/]
related: [multi-agent-commit-fast-01, multi-agent-offload-cheaper-01]
---

# Handoff queue — canonical channel for cross-lane, cross-session work

When multiple agents share one codebase, the tempting design is "chat" — a shared log they all tail. It fails three ways: no durability, no claim semantics, no recovery after auto-compact or a new session.

The pattern that works: an **append-only filesystem queue** at `.planning/handoffs/`, with `open/`, `claimed/`, `closed/` bucket directories.

## Minimum schema per handoff

```yaml
id: h-<iso-timestamp>-<projectid>-<phase>
projectid: <id>
phase: <n>
task_id: <optional>
created_by: <agent-name>
claimed_by: <agent-name or null>
priority: low | normal | high | critical
estimated_context: mechanical | reasoning | creative
runtime_preference: claude | codex | cursor | any
body: |
  <markdown — the ask, evidence, file paths, commit shas>
```

## Why it works

- **Durable** — files survive session restarts, auto-compacts, and crashed agents.
- **Claim semantics** — moving `open/ → claimed/` is atomic on most filesystems; no two agents do the same work.
- **Async** — the receiver picks up on their next session open; no real-time dependency.
- **Auditable** — `closed/` is a decision log you can diff and grep.
- **Schema-free where it counts** — body is markdown; structure where it matters (priority, routing), flexibility where it doesn't (the actual ask).

## Operator discipline

1. **Create handoffs for any work that crosses your lane.** Don't Edit another agent's denied path — file a handoff.
2. **Check the queue at session open.** First call after `gad startup` is `gad handoffs list`.
3. **Claim only what you can finish this session.** Re-open if you bail (move back to `open/` with a reason).
4. **Close with evidence.** Commit sha + file paths + one-line resolution.

## Anti-patterns

- **Slack / Discord as work queue** — durable but no schema, no atomic claim, no bucket semantics.
- **Shared scratchpad markdown** — everyone writes; someone's work gets overwritten.
- **Direct cross-lane edits** — silently duplicates or clobbers the other agent's in-flight work.
- **Claim-and-forget** — a claimed handoff that sits for 3 days is worse than open; nobody else can pick it up.

## Failure modes to expect

- **Two agents claim near-simultaneously** — use filesystem rename (`mv`) which is atomic; a failing rename tells the losing agent to re-read.
- **Handoff body is stale** — include the commit sha at creation time; receiver verifies the base before acting.
- **Runtime mismatch** — `runtime_preference: codex` but only claude is open. Add a `preference_relaxed` timeout so any runtime can grab it after N hours.

## Related

- `multi-agent-commit-fast-01` — commits are what handoff closures cite as evidence
- `multi-agent-offload-cheaper-01` — handoffs route to runtime, then to model, both choices matter
