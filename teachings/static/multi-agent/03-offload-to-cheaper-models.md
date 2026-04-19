---
id: multi-agent-offload-cheaper-01
title: Opus is for reasoning; Haiku and Sonnet do the mechanical work
category: multi-agent
difficulty: intro
tags: [models, cost, subagents, token-efficiency, dispatch]
source: static
date: 2026-04-19
related: [multi-agent-handoff-queue-01, context-engineering-snapshot-compaction-02]
---

# Offload to cheaper models — don't burn Opus on mechanical work

Opus (or whatever your premium frontier model is) is roughly 15× the cost of Haiku and 3× the cost of Sonnet per token. Most work agents do is not reasoning-bound — it's mechanical: refactor this, run this command, write this test, summarize this file, reformat this doc.

## The heuristic

| Work type | Model |
|---|---|
| Architecture, design decisions, novel problem decomposition | Opus |
| Standard implementation from a clear spec | Sonnet |
| Search, summarize, reformat, translate, mechanical CRUD | Haiku |
| Verification ("does this change break anything") | Sonnet |
| Fan-out parallel searches / greps | Haiku |

## How to dispatch (Claude Code example)

When you spawn a subagent, pass the model explicitly:

```ts
Agent({
  subagent_type: "general-purpose",
  model: "haiku",          // mechanical
  // or "sonnet" for standard implementation
  prompt: "..."
})
```

The orchestrator (main session) stays on Opus — it needs the reasoning bandwidth to route, synthesize, and decide. The workers go cheap.

## Why this matters more than you think

- **Fan-out amplifies cost** — 8 parallel searches on Opus vs 8 on Haiku is a 100×+ cost delta.
- **Daily subagents are never Opus-grade** — they run a contract against a defined prompt; deterministic enough for Haiku.
- **Verification doesn't need Opus** — "did X change pass tests + match the spec" is pattern-matching; Sonnet nails it.
- **Summarization is the cheapest task there is** — anywhere you've historically defaulted to "have the model summarize X," Haiku is a free upgrade in throughput.

## When to stay on Opus

- Synthesizing info across 10+ files where the cross-file pattern is the answer
- Design decisions hidden inside an implementation (the "how" matters, not just the "what")
- After two cheap-model attempts have failed on the same task — escalate
- Work requiring novel tool sequencing / unfamiliar API orchestration

## Anti-patterns

- **"I'll just use Opus for everything, it's more reliable"** — yes, and you burn your quarter's budget in a week
- **Opus for test generation** — tests are pattern-matching; Haiku nails them
- **Haiku for real architecture** — false economy; you'll re-do the work twice
- **Mixed-model sessions with no routing logic** — random model choice = random cost profile; no learning signal

## The orchestrator pattern

You (Opus) sit in the main session. Your job is:
1. Decompose the task
2. Decide which subtasks are mechanical vs reasoning
3. Spawn the right model for each subtask
4. Synthesize results

If you're implementing code yourself in the main session, you're probably wasting the tier — that's work that could have been offloaded.

## Related

- `multi-agent-handoff-queue-01` — handoff `estimated_context: mechanical | reasoning` maps directly to model selection
- `context-engineering-snapshot-compaction-02` — same cost-discipline principle applied to context size
