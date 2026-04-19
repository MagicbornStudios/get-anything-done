---
id: context-engineering-snapshot-compaction-02
title: Three levers that cut snapshot tokens 29% with zero data hidden
category: context-engineering
difficulty: intermediate
tags: [snapshot, tokens, compaction, cost, orientation]
source: static
date: 2026-04-19
implementation: [vendor/get-anything-done/lib/snapshot-compact.cjs, vendor/get-anything-done/bin/gad.cjs]
decisions: [gad-241, gad-195]
related: [context-engineering-snapshot-compaction-01, llm-internals-tokens-01]
---

# Three levers that cut snapshot tokens 29% — zero data hidden

Every recurring context artifact you inject into a long-running session is rented at token prices, every turn, until compaction. A 3000-token snapshot shown 40 times in an Opus session is 120k tokens of snapshot alone — real money and real crowd-out of what the model is supposed to reason about.

Three cuts, applied sequentially, dropped `gad snapshot` from ~2130 → ~1514 tokens (29%) with zero information loss — just surface-area reduction.

## Lever 1 — Sprint-scope the roadmap

Full roadmap dump of 20 phases is 60% noise on any given day. Filter to current sprint (~5 phases): `in-progress`, `planned` adjacent, out-of-sprint collapsed to a `(+N)` footer. Saves ~300 tokens. The operator can always pull `ROADMAP.xml` explicitly if planning cross-sprint.

**Rule:** default to the narrowest slice that supports today's decisions. Expand only on request.

## Lever 2 — Drop `cancelled`

Cancelled tasks are archaeology, not orientation. Omit them from `TASK-REGISTRY` summaries; keep them in the file for audit. Saves ~100 tokens. If an agent needs cancelled history (rare) they query the file directly.

**Rule:** orientation includes live-or-recent state, not the graveyard.

## Lever 3 — Entity decode

Raw XML strings carry `&gt;` `&amp;` `&#x27;` etc. from hand-serialized planning files. Decode once at the snapshot boundary before printing. Saves ~200 tokens on a typical bundle, and — bigger win — the output becomes readable to humans without mental re-tokenization.

**Rule:** don't make the model pay to decode escape sequences that were serialization artifacts of the storage layer.

## When to apply

Anywhere you assemble a recurring context artifact — snapshots, dashboards, orientation docs, daily-subagent prompts, agent handoff payloads. Measure before / after with a token estimator. If the bundle is shown ≥5 times per session, the per-turn savings compound fast.

## Anti-patterns

- **Filtering by hiding data** — any cut that loses information forces the agent to re-fetch; you pay twice.
- **Collapsing without a re-entry door** — if you hide cancelled tasks but don't tell the agent they exist, it can't recover the history it needs.
- **One-size compaction** — snapshot compaction and chat compaction are different problems; different signals survive each.

## Related

- `context-engineering-snapshot-compaction-01` — kill the XML wrappers (earlier lever)
- `llm-internals-tokens-01` — why token count ≠ word count
