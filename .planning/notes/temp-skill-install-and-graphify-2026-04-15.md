# Temporary skill install flow + Graphify integration — design

Date: 2026-04-15
Context: operator flagged two related concepts during the onboard flow
pass:
(1) Need a short-lived "try-before-install" mode for skills that produce
    a one-time artifact — codebase map, game scaffold, knowledge graph —
    so users can experiment without committing to a full install.
(2) Want to absorb a Graphify-equivalent knowledge graph + visualization
    into GAD, mirroring what `get-shit-done` did in commit c11ec05, but
    wired into our workflow/site/visual-context-system instead of as a
    bolt-on.

These are independent features but they compose: the temp-skill flow is
the cleanest way for a user to *try* graphify inside a GAD project
without paying the full install cost up front.

## Part 1 — Temporary skill install flow (`gad try <skill>`)

### Problem

A user wants to run one skill (e.g. codebase-map, graphify, game
scaffolder) to produce an artifact, then stop caring about the skill.
Full install via `bin/install.js --new-project <path>` is overkill:
landing 91 skills + .planning/ + hooks just to use one. The user has to
manually clean up afterward, and if the skill installs Python/Node
dependencies or binaries they have no idea what they consented to.

### Proposed shape

New `gad try` subcommand that wraps an ephemeral runtime. Shape:

```sh
gad try <skill-slug-or-url> [-- skill-args...]
# Examples:
gad try graphify -- . --mode deep
gad try codebase-map -- src/
gad try https://github.com/safishamsi/graphify -- . --wiki
```

### Flow

1. **Locate the skill source.**
   - Local slug → `skills/<slug>/SKILL.md` in the framework
   - Installed slug → `~/.claude/skills/<slug>/SKILL.md` (global) or
     `<cwd>/.claude/skills/<slug>/SKILL.md` (local)
   - URL → git clone shallow into a tmp dir, look for `skills/<name>/`
     or a `SKILL.md` at the root
2. **Dependency audit.** Parse SKILL.md frontmatter + body for dependency
   declarations:
   - `requires:` frontmatter key listing binaries (`python3.10+`,
     `node>=18`, `uv`, `git`)
   - `installs:` frontmatter key listing packages the skill itself will
     install when run (`pip install graphifyy`, `npm i -g foo`)
   - Print a **consent gate** showing exactly what will be installed:
     ```
     gad try graphify will:
       ✓ Clone https://github.com/safishamsi/graphify@v1 (shallow)
       ⚠ Run: pip install graphifyy (~15MB wheel + deps)
       ✓ Create: <project>/.gad-try/graphify/
       ✓ Output: <cwd>/graphify-out/
     Proceed? [y/N]
     ```
   - Dependency declarations are advisory — a skill can omit them. If
     omitted, `gad try` proceeds but warns "no dependency manifest,
     skill runs with ambient environment."
3. **Ephemeral sandbox.** Create `<cwd>/.gad-try/<skill>/` as the
   scratch dir. Skill runs with this dir as its effective config root
   (mirrors the `--config-dir` sandbox from `bin/install.js`).
4. **Handoff to the coding agent.** `gad try` does not *run* the skill
   itself (consistent with decision gad-18: skills are methodology
   documents, not executable code). It prints a copy-paste prompt for
   the agent:
   ```
   Skill "graphify" is staged at .gad-try/graphify/.
   Open Claude Code (or Codex/Cursor) in this directory and paste:

     /try graphify .

   Or if the agent is already running:

     invoke the graphify skill on the current directory
   ```
   The CLI also writes `.gad-try/<skill>/ENTRY.md` with the same prompt
   so the user can read it later.
5. **Artifact capture.** After the skill runs, its output (e.g.
   `graphify-out/`) lives in the user's cwd. `gad try --capture <skill>`
   moves the artifact to `.gad-try/<skill>/output/` and prints the
   absolute path.
6. **Cleanup.** `gad try --cleanup <skill>` removes `.gad-try/<skill>/`
   AND any dependencies the skill declared via the `installs:`
   frontmatter key. For system packages (pip/npm global), cleanup shows
   the uninstall command rather than running it — consent-to-remove
   symmetrical with consent-to-install.

### Non-goals

- `gad try` is not a package manager. Dependency handling is
  declarative/advisory only.
- Does not replace `gad evolution install` (which stages proto-skills
  from `.planning/proto-skills/`). `gad try` is for *external* skills,
  not the evolution loop.
- Does not bundle Claude Code / Codex / Cursor CLIs. User is expected
  to have one installed.

### Safety model

| Concern | Handling |
|---|---|
| Large binary downloads | Consent gate shows size estimate, requires `y` |
| System package manager (pip/npm -g) | Consent gate lists exact commands, requires `y` |
| Writing outside cwd | Skill must declare output paths in frontmatter; violations warn |
| Leftover state | `--cleanup` removes the sandbox and lists dep removal commands |
| Interference with existing installs | `.gad-try/<skill>/` is a private scratch dir; the skill catalog at `.claude/skills/` is never touched |

### Open questions

- **Should `gad try` also be able to run a skill without downloading
  anything — pure in-place copy from the framework skill catalog?** Yes,
  for the `try a framework skill without polluting ~/.claude/` case.
- **Should the consent gate persist consent per-skill?** Probably not
  for v1 — re-prompt every run until cleanup confirmed.
- **How does `gad try` interact with the onboard flow?** Running
  `gad try` inside an already-onboarded project just uses the project's
  `.gad-try/` dir; running it in a bare folder creates it. No coupling
  required either way.

## Part 2 — Graphify integration research + proposal

### What Graphify actually is

Source: github.com/safishamsi/graphify README (fetched 2026-04-15).

| Aspect | Fact |
|---|---|
| Runtime | Python 3.10+, `pip install graphifyy` |
| Invocation | Claude Code slash command `/graphify` |
| Scope | Any folder — code, markdown, PDFs, images, tweets, papers |
| Core primitive | `graph.json` — persistent knowledge graph, queryable without re-reading source files |
| Interactive output | `graph.html` — click nodes, search, filter by community |
| Text output | `GRAPH_REPORT.md` — "god nodes", surprising connections, suggested questions |
| Agent output | `wiki/` — Wikipedia-style articles per community for agent navigation |
| Export formats | Obsidian vault, GraphML, SVG, Neo4j cypher, MCP stdio server |
| Query modes | `/graphify query "nl question"`, `/graphify path "A" "B"`, `/graphify explain "node"` |
| Update mode | `--update` re-extracts only changed files, merges into existing graph |
| Install pattern | Appends a section to `~/.claude/CLAUDE.md` (validates operator observation) |
| Token claim | 71.5x fewer tokens per query vs reading raw files |

### Can it answer the operator's use cases?

Operator asked: "What character is this project a part of? What are
characters? etc, like all from a precompiled graph json."

**Yes.** Graphify's `graph.json` is exactly the substrate for this:

- Nodes = extracted entities (projects, characters, skills, decisions,
  files, concepts)
- Edges = typed relationships (EXPLICIT from source, INFERRED from
  cross-reference analysis)
- Communities = detected clusters (the "what group is X in?" primitive)

Queries like "what character is this project part of?" map to
graph-walking: from node `project:custom_portfolio`, follow edges of
type `BELONGS_TO` or `PART_OF` until hitting a node of type `character`.
The graph structure answers the question without an LLM round-trip —
the `/graphify query` skill path adds NL parsing but the underlying
lookups are pure graph traversal.

### Can it run on JSON-only data?

Yes — Graphify consumes any file tree. Point it at `.planning/` (XML),
`site/data/` (JSON), `decisions/` (Markdown with frontmatter) and it
extracts concepts from all of them into one unified graph. The graph
does not care whether a node originated from XML, JSON, or prose.

### Integration shape for GAD

**Surface 1 — Planning graph as site data.**

Run graphify once over `.planning/` + `skills/` + `decisions/` to
produce `site/data/planning-graph.json`. Refresh on the same cadence as
existing `site/data/self-eval.json` (nightly or on commit). Four sites
can consume it:

1. **command+K** — extend the existing global search hook to layer
   graph results alongside full-text: "related to X", "decisions that
   cite X", "skills that depend on X". No LLM at query time — pure
   graph traversal against `planning-graph.json`.
2. **Visual Context System** — new `<VisualContextGraphPanel>` primitive
   renders `graph.html` (or a React-Flow equivalent driven by the same
   JSON) inside the project-editor split viewport. Every node gets a
   cid derived from its id so modal footer CRUD can target them. Feeds
   naturally into the scaffold-visual-context-surface skill shipped
   earlier this session.
3. **DB viewer** — already renders arbitrary JSON, so
   `planning-graph.json` is a free win. No new code needed — add it as a
   data source on the `/data` page.
4. **Agent wiki** — `wiki/` output becomes `.planning/wiki/` published
   at `/wiki/<community>` routes. Agents hitting an unfamiliar part of
   the project read the wiki article first instead of grepping raw
   XML.

**Surface 2 — Skill-level knowledge graph.**

Run graphify per-skill on `skills/<slug>/`. Output feeds the existing
skill-find pass: instead of Jaccard overlap on trigger words, use graph
community membership to surface "related skills when you're asking
about X". Could also power a `gad skill explain <slug>` command that
describes what a skill depends on and what depends on it via graph
neighbors.

**Surface 3 — Candidate-to-skill graph.**

When `create-proto-skill` drafts a new proto-skill, graphify the
candidate's source phase → proto-skill → proximate skills. The resulting
graph tells the human reviewer "this proto-skill sits next to X, Y, Z
in concept space" without asking an LLM. Feeds decision gad-171's
bulk-batching review step.

### Skill vs embeddings tradeoff

Operator flagged the scalability question: skill-based query (LLM reads
graph) vs RAG embeddings (vectorize + approx nearest neighbor).

| Axis | Skill + graph.json | Embeddings |
|---|---|---|
| Build cost | Low (one pass, cached) | High (vectorize every input) |
| Per-query cost | High (LLM turn) | Low (vector math) |
| Freshness | Easy (diff + re-extract changed files) | Needs re-vectorize on change |
| Structural queries (path, neighbors, community) | **Native** | Awkward (embeddings don't know structure) |
| Fuzzy NL queries | Good via LLM | Good via similarity |
| Explainability | High (exact edges) | Low (opaque distances) |

**Recommendation:** the graph is the primary substrate. Embeddings
become an optional secondary layer only if query volume justifies the
build cost. For the site's command+K and VCS use cases, graph
traversal is strictly better than embedding similarity — the questions
are "what's connected to X?" not "what looks like X?".

### Why not just install Graphify directly?

The operator said: "i want get-anything-done to have this knowledge
graph and visualization as part of our framework, just like
get-shit-done had it, but in our workflow system and etc we have been
wrangling."

Two options:

**Option A — absorb graphify as a vendored skill.** Copy its SKILL.md
into `skills/gad-graphify/` and invoke the same Python package
underneath. Pro: reuses upstream's extraction pipeline and output
formats. Con: Python dependency creeps into the GAD install footprint,
and we inherit upstream's release cadence.

**Option B — build a GAD-native graph extraction skill.** Use the
canonical skills/agents/workflows triples we already have as the
structural backbone; write extraction rules against the planning XML
schema we own; output the same `graph.json` shape Graphify uses so
third-party tools (Obsidian, Neo4j, Gephi) still work.
Pro: no Python dep, stays entirely inside the Node+JS framework, can
evolve with our planning schema, and the graph can embed decisions and
skills with typed edges from day one. Con: reinvents Graphify's
extraction logic for non-XML files (Markdown, images, PDFs).

**Recommendation: start with Option A via `gad try graphify`** to see
the output shape against a real GAD project, then decide whether to
commit to a vendored copy (A) or build a native extractor (B). The
temporary-skill-install flow from Part 1 is the cheapest way to run
that experiment — one command, no commitment, easy cleanup.

### Proposed sequencing

1. Ship `gad try` (Part 1) as a new task, small CLI surface, no
   external deps.
2. Run `gad try graphify -- .planning skills decisions` against this
   repo, capture the output, eyeball the graph shape.
3. Decide A vs B based on what the output actually contains.
4. Either way: add `site/data/planning-graph.json` to the site data
   pipeline and wire command+K + VCS + DB viewer to read it.
5. Follow up: agent wiki routes if the use case materializes.

## Tasks this note spawns

| Id | Title | Status | Scope |
|---|---|---|---|
| 42.2-39 | CLAUDE.md/AGENTS.md writer + hooks fallback | done | shipped same session |
| 42.2-40 | Temporary skill install flow (`gad try`) | planned | new CLI subcommand, consent gate, sandbox, cleanup |
| 42.2-41 | Graphify trial via `gad try` against this repo | planned | experiment, produces a FINDINGS-*.md |
| 42.2-42 | Decision: vendor Graphify vs native extractor | planned | decision doc based on 42.2-41 findings |
| 42.2-43 | `site/data/planning-graph.json` pipeline + command+K integration | planned | depends on 42.2-42 outcome |
| 42.2-44 | VCS `<VisualContextGraphPanel>` primitive | planned | depends on 42.2-43 |

Ships incremental. No single mega-task.
