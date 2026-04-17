# Teachings

Daily-tip-style learning material for the GAD framework. Game-style: short, dense, concrete, one actionable takeaway per tip.

## Layout

```
teachings/
├── static/              Curated, hand-authored, canonical tips. Always available.
│   ├── llm-internals/
│   ├── context-engineering/
│   ├── coding-agents/
│   ├── gad-framework/
│   └── craft/
├── generated/YYYY/MM/   Daily-generated tips from scripts/generate-daily-tip.mjs.
└── index.json           Catalog with metadata (id, category, difficulty, tags, date, source).
```

## Surfaces (zero-token CLI, zero-token snapshot footer)

- `gad tip` — today's tip at terminal (file read, zero API cost)
- `gad tip random` — random pick across all tips
- `gad tip search <query>` — substring match on title + tags
- `gad tip list [--category llm-internals]` — catalog listing
- `gad tip categories` — list available categories
- `gad snapshot` — footer line references today's tip title (1 line only, no body)
- `/teachings` on GAD site — card grid + search (phase 46)

The only time a paid model runs is the daily generator (GitHub Actions cron, 1x/day, ~$0.002/tip with web search). Reading existing tips from CLI / site / snapshots is pure file I/O — no token burn in coding agent sessions.

## Generation pipeline

1. GitHub Actions `daily-tip.yml` fires 08:00 UTC.
2. `scripts/generate-daily-tip.mjs` reads `index.json`, picks an under-covered category, queries OpenAI Responses API (GPT-4.1 + `web_search_preview` tool) for a teaching on a fresh angle, writes `teachings/generated/YYYY/MM/DD.md`, appends to `index.json`.
3. Commit + push. Next `git pull` pulls new content into your working tree.

## Tip format

Every tip is a markdown file with YAML frontmatter:

```markdown
---
id: llm-internals-tokens-01
title: Tokens are not words
category: llm-internals
difficulty: intro        # intro | intermediate | advanced
tags: [bpe, vocabulary, tokenization]
source: static           # static | generated
date: 2026-04-17
---

# Tokens are not words

<300-500 word teaching here>

## Takeaway

<one actionable sentence>
```

## Contributing

To add a static tip: write the file under the right category, then run `gad tip reindex` (or the generator will pick it up on next daily run).
