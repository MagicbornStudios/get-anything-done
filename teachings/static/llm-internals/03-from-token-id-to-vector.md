---
id: llm-internals-embeddings-01
title: From token ID to vector
category: llm-internals
difficulty: intro
tags: [embeddings, vectors, lookup, rope]
source: static
date: 2026-04-17
implementation: projects/llm-from-scratch/.planning/ROADMAP.xml
decisions: llm-002
phases: llm-from-scratch:02
related: llm-internals-tokens-01, llm-internals-attention-01
---

# From token ID to vector

Three steps happen between raw text and the attention mechanism.

## 1. Tokenize

`"hello world"` → `[15339, 1917]`

The tokenizer splits the string into subword units and emits integer IDs. Integers only — no semantics yet.

## 2. Embed (lookup)

The embedding table is a learned matrix of shape `[vocab_size × embedding_dim]`. For a hypothetical 150k vocab × 12k dim, that's a **1.8-billion-float table**. Row 15339 of that table *is* the 12k-float vector for `hello`. No computation — just a lookup.

This vector is what gets passed into the transformer stack. The integer ID has no meaning; the learned vector at that ID does.

## 3. Position-encode

The model needs to know `hello world` differs from `world hello`. Position information is injected one of two ways:

| Method | Notes |
|---|---|
| Absolute (sinusoidal) | Early transformers; fixed; doesn't extrapolate well past training length |
| **RoPE** (Rotary Position Embeddings) | Modern default; rotates Q/K vectors by angle proportional to position; extrapolates better |

After these three steps the token has become a ~12k-dim vector with position baked in, ready for Q/K/V projection.

## Why embeddings "make sense"

The embedding table is LEARNED during pretraining — gradient descent pushes tokens that appear in similar contexts toward similar vectors.

- `cat` and `dog` cluster geometrically
- `king - man + woman ≈ queen` (the famous word2vec example, still roughly true)
- `bark` sits awkwardly between "dog noises" and "tree surface" — the model disambiguates using attention over context, not the embedding alone

## Takeaway

When you read "the token is projected into Q/K/V," what's actually projected is its learned embedding vector — NOT the string. The string was discarded at step 1. Everything downstream is linear algebra on learned vectors.

## Where this lives in our stack

- **Planned implementation**: `projects/llm-from-scratch/` phase 02 hand-rolls the embedding table + RoPE. No `torch.nn.Embedding` shortcut per decision `llm-002` — forward + backward pass implemented by hand, numerically verified against a reference.
- **Phase depends**: phase 02 (embeddings) → phase 03 (attention) → phase 04 (stack + training loop). See `projects/llm-from-scratch/.planning/ROADMAP.xml`.
