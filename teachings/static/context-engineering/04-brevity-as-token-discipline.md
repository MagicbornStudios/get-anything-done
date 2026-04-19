---
id: context-engineering-brevity-discipline-01
title: Military-brevity responses are a token-efficiency tool, not a style choice
category: context-engineering
difficulty: intro
tags: [response-format, tokens, sitrep, discipline, compaction]
source: static
date: 2026-04-19
related: [context-engineering-snapshot-compaction-02, context-engineering-surgical-tests-01]
---

# Military brevity — SITREP format as token-efficiency discipline

Conversational LLM defaults produce padding: "Great! I've now done X. Let me walk you through..." Every paragraph of narration is tokens you pay for AND tokens that push real content out of the window when compaction fires. The agent's own output is the single largest controllable cost per turn.

## The format

```
## SITREP — <timestamp or scope>

**State:** <key deltas as a table>
**Decisions needed:** <numbered list>
**Next:** <one line>
```

- No opening acknowledgment
- No closing summary
- No emoji
- Units on column headers
- Deltas only after the first mention — don't restate the root

## Why it works

- **Density per token, not minimal tokens.** You can write 600 tokens of dense state or 600 tokens of narration; only one survives compaction as useful recall.
- **Tables beat prose for structured state.** A 5-row markdown table is ~80 tokens of grid that the model re-reads cleanly; the same data in prose is ~180 tokens of ambiguity.
- **No trailing summaries.** The user can read the diff / the tool output / the file. Self-summary is ~100 wasted tokens per response.

## Exploratory vs executed

**Executing work** — SITREP format. Tables. Deltas. No narration.

**Exploratory questions** ("what could we do about X?") — 2–3 sentences with a recommendation and the main tradeoff. Don't SITREP a brainstorm; that's theater.

## Anti-patterns

- **Confirming the ask back to the user** — "You want me to refactor X, got it!" — zero information, pure cost.
- **Narrating your tool use** — "Now let me read the file to understand…" — the tool call is visible; don't describe it.
- **Emoji as structure** — 🎯 ✅ 🚀 all cost tokens and add no meaning a header couldn't carry.
- **Pre-summarizing the summary** — "To summarize the summary…" — just write the summary.

## When to break the rule

- **Teaching mode** (this tip is an example) — exposition is the product.
- **User is visibly confused** — once, explicitly, in full sentences, then return to SITREP.
- **Safety-critical recap** — before a destructive action, spell out what's about to happen.

## Related

- `context-engineering-snapshot-compaction-02` — same discipline applied to structured artifacts
- `multi-agent-offload-cheaper-01` — response discipline is tied to which model you're on
