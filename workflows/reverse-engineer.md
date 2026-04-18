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
Analyze a codebase and produce GAD planning docs for clean-room reimplementation.
This workflow is requirement-extraction first: prioritize planning artifacts,
architecture docs, and docs before implementation details in source code.
Outputs must describe behavior and constraints, not prescribe exact implementation.
</objective>

<process>

Parse from `$ARGUMENTS`:
- `--path <local-path>` - analyze a local directory
- `--repo <github-url>` - clone from GitHub and analyze
- `--branch <branch>` - branch to clone (default: default branch)

## 1. Acquire the target

- If `--repo`: clone to temp with `git clone --depth 1 <url> /tmp/gad-re-<name>`
- If `--path`: use the local path directly
- If the URL includes `/tree/<branch>/<path>`, extract the subdirectory

## 2. Build an evidence map (first-class sources)

Collect evidence in this strict priority order:

1. **Planning artifacts (highest authority)**
   - `.planning/**/*.xml`
   - `planning/**/*.{md,mdx,xml,toml}`
   - `REQUIREMENTS.*`, `ROADMAP.*`, `STATE.*`, `TASK-REGISTRY.*`, `DECISIONS.*`
2. **Architecture artifacts**
   - `**/architecture.md`, `**/ARCHITECTURE.md`, `**/*architecture*.md`
   - ADRs: `**/adr/**/*.md`, `**/decisions/**/*.md`
3. **Documentation artifacts**
   - `docs/**/*.{md,mdx,rst,txt}`
   - `README*`, design/spec docs, runbooks
4. **Code artifacts**
   - `src/**/*`, `app/**/*`, tests, configs, package manifests

When evidence conflicts:
- Planning and architecture artifacts outrank docs and code comments.
- Code behavior outranks stale narrative docs only when runtime behavior is clear.
- Record conflicts in `notes/pitfalls-evidence-conflicts.md`.

## 3. Detect extraction tier

Check the target directory and select the highest-available extraction tier:

### Tier 1 - Native GAD (fastest, always preferred)
**Condition:** Target has `.planning/` directory with XML files (TASK-REGISTRY.xml, DECISIONS.xml, ROADMAP.xml, STATE.xml).  
**Action:** Use `lib/graph-extractor.cjs` via `gad query` to extract graph-ready planning structure.

```bash
node <gad-root>/bin/gad.cjs query "all tasks" --projectid <target-project>
```

### Tier 2 - PDF extraction (if PDFs found)
**Condition:** Target repo contains PDF files (design docs, specs, whitepapers).  
**Action:** Use `pdf-parse` to extract text from each PDF and add to evidence map.

### Tier 3 - Graphify (if installed, for unstructured codebases)
**Condition:** No `.planning/` structure and `graphify` CLI is available.  
**Action:** Run Graphify to extract entities from code and docs.

```bash
python -m graphify --version 2>/dev/null || python3 -m graphify --version 2>/dev/null
graphify extract --path <target-path> --output /tmp/gad-re-<name>-graph.json
```

### Fallback - Manual deep analysis
When no automated extraction tier applies, perform 5 passes:
1. Structure pass (layout, entry points, dependencies)
2. Architecture pass (boundaries, data flow, interfaces)
3. Conventions pass (patterns and idioms)
4. Decision pass (why design choices exist)
5. Pitfall pass (tech debt, workarounds, TODOs)

## 4. Derive requirement-grade outputs (not implementation recipes)

Write outputs to `.planning/` in the current working directory (or `--output <dir>` if specified).

### Required outputs

- **REQUIREMENTS.xml**
  - Functional and non-functional requirements with stable IDs (REQ-001, REQ-002, ...)
  - Each requirement contains: id, title, description, priority (must/should/could), source evidence
  - Prefer outcome and constraint language over API/class/file prescriptions
- **DECISIONS.xml**
  - Inferred architectural decisions (RE-D-001, RE-D-002, ...)
  - Mark decisions as inferred from observed artifacts
- **SYSTEM-SKILLS.md**
  - One section per inferred reusable system capability
  - For each skill include:
    - `intent`
    - `trigger phrases`
    - `invariants`
    - `required behaviors`
    - `non-goals`
    - `evidence references`
  - Do **not** include line-by-line implementation instructions
- **notes/** directory
  - `notes/pitfalls-<topic>.md`
  - `notes/tech-debt-<area>.md`
  - `notes/gotchas-<area>.md`
- **graph.json**
  - Graph of modules/files/dependencies and major interfaces

### Optional outputs

- **CONVENTIONS.md** - inferred coding conventions
- **ROADMAP.xml** - suggested reimplementation phases

## 5. Abstraction guardrails for system-skill extraction

When extracting system skills (for example visual context systems):
- Capture what must be true, not how one repo implemented it.
- Prefer contracts such as "app-wide coverage" and "explicit dev-mode control"
  over concrete framework/component names.
- Keep examples illustrative and generic.
- Avoid copying implementation-specific internals unless needed as evidence.

## 6. Clean up and report

- If cloned to temp, remove the temp directory
- Print summary:
  - extraction tier used
  - evidence counts by lane (planning, architecture, docs, code)
  - requirements count
  - decisions count
  - system skills extracted
  - notes count
  - graph node and edge counts

</process>
