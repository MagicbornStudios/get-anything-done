---
id: llm-internals-attention-01
title: Attention, in one picture
category: llm-internals
difficulty: intro
tags: [attention, transformer, qkv]
source: static
date: 2026-04-17
implementation: projects/llm-from-scratch/.planning/ROADMAP.xml
decisions: llm-002
phases: llm-from-scratch:03
related: llm-internals-tokens-01, llm-internals-embeddings-01, context-engineering-snapshot-compaction-01
---

# Attention, in one picture

Self-attention is the mechanism that lets every token "look at" every other token in the sequence and pull information from them.

For each token the model projects three vectors:

| Role | Question the token is asking |
|---|---|
| **Query (Q)** | What am I looking for? |
| **Key (K)** | What do I identify myself as? |
| **Value (V)** | What information do I carry forward? |

For every pair (i, j), the attention score is `softmax(Q_i · K_j / √d)`. Token i's output is the weighted sum `Σ weight_ij · V_j` across every j in the sequence.

## Multi-head

Run the Q/K/V projection N times in parallel (often 32-128 heads). Each head learns a different kind of relationship — syntactic, coreferential, long-range topical, positional. Outputs concatenate, then a linear projection mixes them.

## The zero-sum property

Softmax forces the attention weights to **sum to 1** across the whole sequence. Consequences you will actually feel:

| Effect | What happens in practice |
|---|---|
| **Dilution** | A token that got 0.05 attention at 10k context gets ~0.025 at 20k. The signal is still there, it just weighs less. Multiply across layers and early information fades. |
| **Lost in the middle** | Retrieval accuracy is highest at the start and end of long context, worst in the middle. Instruction-following degrades the same way. |
| **Recency bias** | Positional encodings + training distribution tilt models toward the last few thousand tokens. Fine for "what did I just say", bad for "that constraint from 30k tokens ago." |
| **Needle vs reasoning** | Finding one injected fact holds up at long lengths; doing *multi-hop reasoning* across distant spans degrades faster. |

## Takeaway

Attention is a zero-sum, softmax-normalized weighted read across the sequence. Long contexts don't lose information — they *dilute* it. Keep what matters near the top or the bottom; don't bury load-bearing instructions in the middle of a 50k-token dump.

## Where this lives in our stack

- **Planned implementation**: `projects/llm-from-scratch/` phase 03 hand-rolls a multi-head self-attention block from primitives — raw matrix ops, no `torch.nn.MultiheadAttention` shortcut per decision `llm-002`.
- **GAD behavior that exploits dilution**: `gad snapshot --session <id>` auto-downgrades to `active` mode after the first call per decision `gad-195` — precisely to avoid re-dumping static context that dilutes the attention budget on each turn.
- **GAD behavior that fights lost-in-the-middle**: `gad state set-next-action` is capped at 600 chars and sits at the TOP of the STATE block — the single load-bearing instruction gets put where attention is strongest.
