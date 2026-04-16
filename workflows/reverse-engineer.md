---
name: gad:reverse-engineer
description: Analyze any codebase (local or GitHub URL) and produce requirements for clean-room reimplementation
argument-hint: --path <local-path> | --repo <github-url> [--branch <branch>]
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
---

<objective>
Analyze a codebase and produce GAD planning docs (REQUIREMENTS.xml, DECISIONS.xml, notes/, graph.json) for clean-room reimplementation. Uses a tiered extraction pipeline that adapts to what the target codebase provides.
</objective>

<process>

Parse from `$ARGUMENTS`:
- `--path <local-path>` — analyze a local directory
- `--repo <github-url>` — clone from GitHub and analyze
- `--branch <branch>` — branch to clone (default: default branch)

## 1. Acquire the target

- If `--repo`: clone to temp with `git clone --depth 1 <url> /tmp/gad-re-<name>`
- If `--path`: use the local path directly
- If the URL includes `/tree/<branch>/<path>`, extract the subdirectory

## 2. Detect extraction tier

Check the target directory and select the highest-available extraction tier:

### Tier 1 — Native GAD (fastest, always preferred)
**Condition:** Target has `.planning/` directory with XML files (TASK-REGISTRY.xml, DECISIONS.xml, ROADMAP.xml, STATE.xml).
**Action:** Use `lib/graph-extractor.cjs` directly via `gad query` to extract the full knowledge graph. This is the same extractor used internally by the GAD framework.

```bash
# Build graph from the target's .planning/ directory
node <gad-root>/bin/gad.cjs query "all tasks" --projectid <target-project>
# Or directly: require('lib/graph-extractor.cjs').buildGraph(root, baseDir, opts)
```

### Tier 2 — PDF extraction (if PDFs found)
**Condition:** Target repo contains PDF files (design docs, specs, whitepapers).
**Action:** Use `pdf-parse` (already installed) to extract text from every PDF in the target.

```bash
# Find PDFs in target
find <target-path> -name "*.pdf" -type f
```

For each PDF found, extract text and feed it into the analysis. PDFs often contain:
- Architecture diagrams (text descriptions)
- API specifications
- Design decisions and rationale
- Requirements documents

### Tier 3 — Graphify (if installed, for unstructured codebases)
**Condition:** No `.planning/` structure, and the `graphify` Python CLI is available.
**Action:** Run Graphify to extract entities from source code, markdown, images, and other unstructured content.

```bash
# Check if graphify is available
python -m graphify --version 2>/dev/null || python3 -m graphify --version 2>/dev/null

# If available, run extraction
graphify extract --path <target-path> --output /tmp/gad-re-<name>-graph.json
```

**Graceful fallback:** If Python or Graphify is not installed, skip this tier and proceed with manual analysis. Log a note: "Tier 3 (Graphify) unavailable — falling back to manual code analysis."

### Fallback — Manual deep analysis
When no automated extraction tier applies, perform the standard 5-pass manual analysis:
1. **Structure pass:** directory tree, entry points, package.json/config files
2. **Architecture pass:** module boundaries, data flow, API surface
3. **Convention pass:** naming, patterns, code style, framework idioms
4. **Decision pass:** infer why things were built a certain way
5. **Pitfall pass:** tech debt, workarounds, known issues, TODOs in code

## 3. Produce all outputs

Write outputs to `.planning/` in the current working directory (or `--output <dir>` if specified):

### Required outputs:
- **REQUIREMENTS.xml** — Functional and non-functional requirements with stable IDs (REQ-001, REQ-002, ...). Each requirement has: id, title, description, priority (must/should/could), source (which tier/file it came from).
- **DECISIONS.xml** — Inferred architectural decisions in GAD format (RE-D-001, RE-D-002, ...). Each decision has: id, title, summary (what was decided and why), impact. Mark these as "inferred" — they are reverse-engineered, not authored.
- **notes/** directory — One markdown file per discovered pitfall, gotcha, or technical debt item:
  - `notes/pitfalls-<topic>.md` — Known issues, workarounds, edge cases
  - `notes/tech-debt-<area>.md` — Technical debt observations
  - `notes/gotchas-<area>.md` — Non-obvious behaviors that would trip up a reimplementation
- **graph.json** — Knowledge graph of the analyzed codebase. If Tier 1 was used, this is the native graph. Otherwise, build a graph with nodes for: modules, files, functions/classes (major ones), dependencies, and edges for: imports, calls, depends-on, implements.

### Optional outputs (when source data supports them):
- **CONVENTIONS.md** — Coding conventions inferred from the codebase
- **ROADMAP.xml** — Suggested reimplementation phases

## 4. Clean up

- If cloned to temp, remove the temp directory
- Print summary: which tiers were used, how many requirements/decisions/notes produced, graph node/edge counts

</process>
