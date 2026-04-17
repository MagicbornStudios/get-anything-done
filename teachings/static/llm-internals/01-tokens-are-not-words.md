---
id: llm-internals-tokens-01
title: Tokens are not words
category: llm-internals
difficulty: intro
tags: [bpe, vocabulary, tokenization]
source: static
date: 2026-04-17
---

# Tokens are not words

A token is a **subword unit** — a chunk of bytes the tokenizer was trained to treat as atomic. GPT and Claude both use variants of **Byte Pair Encoding (BPE)**.

| Input | Tokens (approx) |
|---|---|
| `the` | 1 |
| ` the` (leading space) | 1 — **different** from `the` |
| `hello` | 1 |
| `helloworld` | 2 (`hello`, `world`) |
| `antidisestablishmentarianism` | ~7 |
| `👋` | 2-4 UTF-8 bytes |
| `中` | 2-3 |
| `function foo()` | 4-5 |

Rough rule: **~4 chars/token in English prose, ~3 in code.** Claude's vocabulary is fixed somewhere around 100k-200k unique tokens.

## Why subwords?

Three options when designing a vocabulary:

| Granularity | Tradeoff |
|---|---|
| Per-word | Vocabulary explodes; rare/new words become `<UNK>` and break |
| Per-character | Sequences are 5× longer → quadratic attention cost → expensive |
| Subword (BPE) | Common things are 1 token, rare/compound things decompose automatically |

BPE works by taking the most frequent byte pairs in the training corpus and iteratively merging them into single vocabulary entries, stopping at a target vocab size. That's why `the` is one token (hyper-common) and `antidisestablishmentarianism` is seven.

## Practical consequences

- **Token counts are never line counts.** A 100-line JSON blob with whitespace can be 4000+ tokens. A 500-word email can be 650.
- **Code costs more than prose.** Identifier splits (`getUserName` → 3 tokens) plus symbols make source code expensive.
- **Leading spaces matter.** `hello` and ` hello` are different tokens — the embedding the model sees is different.
- **Unicode is expensive.** Emoji, CJK, math symbols decompose into several UTF-8 bytes and chew tokens.

## Takeaway

Before a prompt hits a model, it's chopped into integer IDs — not words. Count tokens when you estimate context budget; never count words.
