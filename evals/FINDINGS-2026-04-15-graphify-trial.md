---
title: Graphify trial via `gad try` — first look at the knowledge-graph skill
date: 2026-04-15
tasks: [42.2-41]
blocks: [42.2-42, 42.2-43, 42.2-44]
status: complete
---

# Graphify trial via `gad try` — findings

Ran the newly-shipped `gad try` flow (task 42.2-40) against the real
Graphify repository on github to see what the artifact looks like, what
dependencies it declares, and whether integrating it into GAD is a
vendor-or-native decision worth making.

## Command

```sh
gad try https://github.com/safishamsi/graphify --yes
```

## What landed in `.gad-try/graphify/`

33 files, ~200KB. Breakdown:

| Kind | Files |
|---|---|
| Skill entry points | `skill.md` (canonical, lowercase), `skill-aider.md`, `skill-claw.md`, `skill-codex.md`, `skill-copilot.md` — one per coding agent |
| Python pipeline modules | `analyze.py`, `benchmark.py`, `build.py`, `cache.py`, `cluster.py`, `detect.py`, `export.py`, `extract.py`, `hooks.py`, `ingest.py`, `manifest.py`, `report.py`, `security.py`, `serve.py`, and more — this is the actual graph extraction engine |
| gad try scaffolding | `PROVENANCE.md`, `ENTRY.md` (written by `gad try`) |

Key observation: **Graphify is not a "thin" skill.** The SKILL.md is a
short trigger doc, but the real work is in ~15 Python modules that ship
alongside it. Invoking the skill downloads the whole pipeline and
delegates to the Python package `graphifyy`. This is important for the
vendor-vs-native decision.

## Consent gate behavior

`gad try` correctly surfaced the implicit install command via body scan:

```
Implicit installs found in SKILL.md body:
  ? pip install graphifyy
```

No `installs:` frontmatter key — the skill author relied on prose
instructions. The body-scan fallback caught it anyway, which validates
the dual declared-plus-implicit approach in `gad try`'s consent gate.

## SKILL.md frontmatter

```yaml
name: graphify
description: any input (code, docs, papers, images) → knowledge graph → clustered communities → HTML + JSON + audit report
trigger: /graphify
```

Minimal — `name`, `description`, `trigger`. No `requires:`, `installs:`,
or `outputs:` keys. Per-runtime variants (`skill-aider.md`, etc.)
suggest Graphify solves the cross-runtime problem by shipping a SKILL
doc per target, not via runtime-neutral authoring. We already solved
that differently (uniform `workflow:` frontmatter + install.js
per-runtime rewriters), so if we vendor Graphify we'd need to either
consolidate these variants or let install.js route them.

## Output format — the `graph.json` shape

Based on the README (not the actual output since invoking the skill
requires Python 3.10+ and Claude Code, which the automated trial cannot
do):

- **Nodes**: typed entities extracted from source files (concepts,
  functions, files, papers, tweets — polymorphic on input)
- **Edges**: typed relationships, two classes: `EXPLICIT` (directly
  cited in source text) and `INFERRED` (detected via cross-reference
  analysis)
- **Communities**: Louvain or similar clustering over the graph
- **Interactive HTML**: `graph.html` with click/search/filter
- **Text report**: `GRAPH_REPORT.md` with "god nodes" and suggested
  questions
- **Agent navigation**: `wiki/` — one article per community

## Can it answer the operator's target queries?

Operator asked: *"what character is this project part of? what are
characters?"* — the point being natural-language queries over a
precompiled graph.

**Yes, but with a caveat.** The underlying graph primitive supports:
- `/graphify path "A" "B"` — shortest path between two nodes
- `/graphify explain "node"` — explain a node via its edges
- `/graphify query "nl question"` — natural language query (uses an LLM
  to parse the question against the graph)

The NL query path requires an LLM at query time (Claude Code invokes
the skill which reads graph.json with vision/text understanding). Pure
structural queries (path, neighbors, community membership) are
LLM-free and cheap.

**For our site's command+K:** pure structural queries suffice for most
use cases ("related to X", "decisions citing X", "skills depending on
X"). NL query is optional.

## Scalability — skill invocation vs RAG embeddings

| Axis | Graphify skill invocation | RAG embeddings |
|---|---|---|
| Build cost | Low (one pass, cached by SHA256) | High (vectorize every input) |
| Per-query cost | High if LLM-backed, low if structural traversal | Low (vector math) |
| Freshness | `--update` diffs changed files and merges | Must re-vectorize on change |
| Structural queries | **Native** | Awkward |
| Fuzzy NL queries | Good via LLM | Good via cosine similarity |
| Explainability | High (exact edges) | Low (opaque distances) |

Graphify is **strictly better** for relationship-typed queries.
Embeddings only win when the question is "what looks like X" rather
than "what's connected to X" — not the shape of most GAD site
questions.

## Python dependency surface

Looking at the pipeline module list, Graphify's Python surface uses
these capabilities (inferred from file names — not verified by running
the code):

- `ingest.py` — reads files from a folder
- `extract.py` — uses Claude vision (per README) to extract concepts
- `cluster.py` — graph clustering (networkx + python-louvain?)
- `detect.py` — entity/edge type detection
- `serve.py` — runs the interactive viewer or MCP stdio server
- `benchmark.py` — the token-savings benchmark they advertise (71.5×)

None of this is fundamentally out of reach for a Node port, but
Graphify has years of accumulated extraction logic (multimodal input
handling, whisper for audio, vision for screenshots) that we cannot
reasonably reproduce. Node has decent graph libraries (`graphology`,
`cytoscape`) but no comparable extraction engine.

## The vendor-vs-native decision (input to 42.2-42)

### Option A — Vendor Graphify as `skills/gad-graphify/`

- Copy the skill + its Python runtime layout into our canonical skills tree
- Accept Python 3.10+ as a GAD dependency for any project using the graph feature
- Reuse upstream's extraction, clustering, visualization logic
- Downstream: ride upstream's release cadence, potentially diverge on per-runtime variants we consolidate

**Pro:**
- Days of work, not months
- Multimodal input handling (images, PDFs, audio) that we couldn't match in Node
- Upstream has a `--mcp` mode we can wire directly into our workflow detector
- Graph JSON shape is already the de facto standard (Obsidian,
  Neo4j, Gephi all consume it)

**Con:**
- Python in the dependency tree contradicts the zero-deps-first memory
  feedback — but we already allow optional deps with `gad models install`,
  so this is a precedent not a new pattern
- Our install.js and `gad try` flows would need a path for Python
  environments (pyenv / uv / plain pip)
- If upstream goes dormant, we inherit a dead dep

### Option B — Build a GAD-native extractor

- Node-only pipeline that walks `.planning/ + skills/ + decisions/`
  and emits the same `graph.json` shape
- Pure structural extraction (no multimodal, no vision)
- No new runtime dep

**Pro:**
- Zero new install surface
- Can bake in planning-XML schema awareness from day one (typed edges
  for `DECIDES`, `CITES`, `DEPENDS_ON`, `BELONGS_TO` reading our XML)
- Ships faster for the specific planning-graph use case

**Con:**
- Reinvents extraction — we'd never catch up to Graphify's multimodal
  capabilities
- Agent-wiki output (`wiki/` articles per community) would need its
  own implementation
- For non-XML inputs (markdown prose, screenshots, PDFs) we'd have to
  build everything from scratch

### Recommendation

**Hybrid — ship both in order.**

1. **Build Option B first** as `skills/gad-planning-graph/`. Scope:
   consume `.planning/*.xml`, `skills/*/SKILL.md`, `decisions/*.xml`,
   `workflows/*.md`. Emit `site/data/planning-graph.json` with typed
   nodes (phase, task, decision, skill, workflow, file) and typed edges
   (cites, depends_on, decides, belongs_to, authored_by). Cost: ~1
   focused task, Node-only, ships fast, unblocks site integration.

2. **Keep Option A as an opt-in trial** via `gad try` (what we just
   built). Operators who want multimodal graph extraction for an
   arbitrary folder can `gad try graphify` and get it without any
   framework commitment.

3. **If Option A usage pattern emerges**, promote it: vendor
   `skills/gad-graphify/` and commit to the Python dep. That decision
   becomes evidence-based rather than speculative.

This sequences to the narrowest-first commitment that still unblocks
the site integration tasks (42.2-43, 42.2-44). Option B goes in the
active sprint; Option A waits for demand.

## Gaps in `gad try` surfaced by this trial

Minor polish items, not blockers:

1. **Graphify uses lowercase `skill.md` (not SKILL.md).** `gad try`'s
   recursive walker handles this via case-aware prefs, but this is
   worth noting — the uniform shape contract in `references/skill-shape.md`
   says `SKILL.md` uppercase is canonical, but real-world external
   skills don't uniformly follow that.
2. **Branch detection could be smarter.** `gad try` falls back through
   `[null, v1, main, master]` which worked for graphify (v1), but a
   repo that uses `develop` or a feature branch wouldn't be caught.
   Worth a `--branch <name>` flag for explicit selection.
3. **No cleanup of the .git dir in the clone.** After staging, the
   sandbox contains the full .git/ tree from the shallow clone, which
   is wasted space. Worth an `fs.rmSync(.git)` pass after the copy.
4. **Consent gate is print-only.** Explicit confirmation prompt was
   descoped from the first cut (non-destructive staging makes it
   optional) but for future runtime-invocation flows where the skill
   actually runs, an interactive `y/N` gate is needed.

None block the 42.2-41 findings. Logged as candidate refinements for
42.2-40.a follow-up.

## Verdict

Pipeline proven end-to-end: `gad try <github-url>` → sandbox staged →
PROVENANCE + ENTRY + full source tree present → consent gate correctly
flagged the implicit `pip install graphifyy` → cleanup command
available.

Operator can now trial any external skill in any GAD project without
touching the canonical skill catalog or global runtime dirs.

Next move: Option B (`skills/gad-planning-graph/`) in the active
sprint, Option A (vendor Graphify) deferred as evidence-gated.
