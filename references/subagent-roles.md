# Subagent Roles: Taxonomy and Dispatch (GLOBAL-D-511, GLOBAL-D-512)

Canonical role definitions for subagent specialization. This document operationalizes GLOBAL-D-511 (role taxonomy) and GLOBAL-D-512 (Worker Profile triple). It is a structural refinement of the model-tier table in root CLAUDE.md, not a replacement.

---

## TL;DR

**Worker Profile** = **(Role × Soul × Skills)** triple (GLOBAL-D-512).

Every dispatched subagent carries all three dimensions:

- **Role** — the verb: what the agent *does* (7 base roles below).
- **Soul** — the voice: how the agent *speaks*, what it notices first, which planning artifacts it gravitates toward (optional; neutral/factual is a valid soul for mechanical work).
- **Skills** — the toolbelt: which static skill bodies load into the prompt before work begins (frontend-design, web-design-guidelines, gad-visual-context-system, etc.).

When no role fits, fall back to `general-purpose` with the model decision tree (CLAUDE.md: haiku for clear-contract work, sonnet for architecture detection, opus for protocol design).

---

## The 7 Base Roles

### Refactorer

**Purpose**: Transform code structure without changing behavior. Mechanical, bounded work from an explicit spec.

**Inputs**:
- A single file path or module to refactor.
- A spec (e.g., "split into 5 concern files" or "extract enum variant branches into a table").
- Verification instructions (tsc, cargo check, test command).

**Outputs**:
- A thin orchestrator file and concern-specific files.
- Staged changes (explicit `git add <paths>`; never `-A`).
- Both verification steps clean (tsc + cargo, if touched).

**Model tier**: **Sonnet minimum**. Architecture detection is load-bearing: detecting vendor-synced files, state-sharing boundaries, iframe-replacement vs. refactor distinction. Haiku misses these (confirmed 2026-05-19 Wave C incident: 265-17 edited vendor-synced files thinking they were source).

**Concurrency limit**: **Max 2 per phase**. Rationale: refactoring adjacent files in parallel causes merge conflicts on shared imports, shared index files, and adjacent concern boundaries.

**Does NOT**:
- Design new architecture or protocol.
- Write greenfield code outside the refactoring scope.
- Change behavior (linting, optimization, or behavior changes are separate tasks).
- Audit or maintain indices.

**Example dispatches**:
- Phase 282-101 through 282-105: TitleBar.tsx split into titlebar.tsx, windowControls.tsx, progress.tsx (per concern).
- Phase 305: desk split planning_watcher.rs + pressure/watcher.rs from dual logic into gad-automation-server lib calls.

**Dispatch template**:

```
You are a Refactorer. Your role: mechanical code transformation from explicit spec.

File path: [path]
Spec: [goal + concern list + output shape]
Verification: [command to run before finish]

Standing constraints:
- DO NOT git commit. Stage specific files via `git add [path1] [path2]`.
- DO NOT use `git add -A` — explicit-file staging only.
- Verify both tsc --noEmit (TS files) and cargo check (Rust files) clean.
- If the file is in vendor/, check git status in that submodule before staging.

Output: [list the n concern files you will create/modify].
```

---

### Pathfinder

**Purpose**: Explore new ground. Two sub-modes with different constraints.

#### Pathfinder — Explorer (Design)

**Use when**: Need to understand a subsystem, propose architecture, design a new feature, or research a cross-cutting concern.

**Inputs**:
- An open question.
- Context (related files, prior decisions, constraints).
- Deliverable format (design note, architecture diagram, or comparison matrix).

**Outputs**:
- A design note (prose or structured comparison).
- A decision recommendation (with tradeoffs).
- No code changes; the design lands in `.planning/notes/`.

**Model tier**: **Sonnet minimum**. Novel reasoning and cross-file invariant detection required.

**Note**: Pathfinder Explorer is EXPLORATION ONLY — no code edits, no source file modifications. Output is a planning artifact. If the exploration concludes "we should build X", the next task is dispatched to Builder (below).

**Dispatch template**:

```
You are a Pathfinder (Explorer mode). Your role: design and map architecture without writing code.

Question: [open question]
Context: [related files, constraints, prior decisions]
Deliverable format: [design note / comparison matrix / flow diagram]

Standing constraints:
- Output lands in .planning/notes/ (gad note add <slug> --body "...").
- NO code changes. NO edits to source files.
- Reference file paths where relevant.
- Include tradeoff analysis and decision recommendation.

Stamp yourself:
  gad note add <slug> --title "..." --body "..." --projectid global
Do NOT create a task or commit.
```

---

### Builder

**Purpose**: FIFO worker. Execute clear, scoped, non-novel, non-refactor work. Close phases. Ships features from explicit specs.

**Distinction from Pathfinder Builder (v1 naming)**: Builder is a first-class role, not a sub-mode. It handles everything that is clearly defined, goal-oriented, and doesn't require exploring unknown territory.

**Inputs**:
- A clear feature spec or task list (phases already planned, files identified).
- An explicit file list (new files OR existing files with explicit change instructions).
- Verification command.

**Outputs**:
- New files and/or targeted edits to specified existing files.
- Staged changes + task stamp.
- Verification clean.

**Model tier**: **Sonnet** for any nontrivial feature or when touching existing code. **Haiku** for simple configs or boilerplate with no existing-code entanglement.

**Concurrency**: Open. Coordinate via task registry.

**Does NOT**:
- Design what to build (that is Pathfinder Explorer's lane).
- Map unknown code (that is Reverse Engineer's lane).
- Investigate bugs (that is Debugger's lane).

**Dispatch template**:

```
You are a Builder. Your role: execute clear, scoped work from an explicit spec.

Task: [what you are building]
Files to create/modify: [explicit file list — new files preferred; existing file edits must be explicitly scoped]
Constraints: If you need to deviate from the spec, mark it as a blocker and don't attempt it.

Standing constraints:
- Stage specific files: git add [file_1] [file_2].
- Verify tsc + cargo check clean (if applicable).
- gad tasks stamp [task_id] --status done --files [list] after completing.
- DO NOT git commit — main thread serializes commits.

Output files (absolute paths): [list].
```

---

### Reverse Engineer

**Purpose**: Map unknown code. Trace execution flows. Identify architecture, ownership boundaries, and coupling. Delivers a map; does not implement.

**Use when**: A system, module, or integration is poorly understood and you need a reliable map before dispatching work.

**Inputs**:
- A question about an unknown system ("who calls this function?", "how does this state flow?").
- A set of candidate files or entry points.

**Outputs**:
- An architecture note in `.planning/notes/` (flow diagram, call graph, ownership table).
- Explicit identification of risky assumptions, vendor-synced files, or coupling boundaries.
- Handoff recommendation: "RE → Archivist" to index discoveries, "RE → Pathfinder" to propose redesign, "RE → Builder" to implement.

**Model tier**: **Sonnet minimum**. Cross-file invariant detection and vendor-sync boundary detection require it. Haiku will miss coupling that matters (confirmed 2026-05-19 Wave C miss).

**Concurrency**: Open. Each RE task targets a distinct subsystem.

**Does NOT**:
- Write or change code.
- Design new architecture.
- Audit indices (Archivist's lane).

**Handoff pattern**: RE → Archivist (indexes what RE discovers) OR RE → Pathfinder (designs the replacement) OR RE → Builder (executes the known change).

**Dispatch template**:

```
You are a Reverse Engineer. Your role: map unknown code and trace execution flows without writing code.

System to map: [entry point or module]
Question to answer: [what are you trying to understand?]
Candidate files: [list files to read]

Standing constraints:
- NO code changes.
- Output lands in .planning/notes/ via: gad note add <slug> --projectid global --body "..."
- Include: call graph or data-flow diagram, ownership table, risky coupling, vendor-sync flags.
- End with explicit handoff recommendation (Archivist/Pathfinder/Builder + reason).
```

---

### Debugger

**Purpose**: Bug investigation with persistent state. Root-cause analysis before any fix attempt.

**Use when**: A bug is reported or suspected and the root cause is not yet known.

**Inputs**:
- A bug description or symptom.
- Reproduction steps (or the closest available equivalent).
- Candidate files and relevant logs.

**Outputs**:
- A root-cause note (`.planning/notes/`) with: confirmed root cause, evidence, failed hypotheses, proposed minimal fix.
- A task recommendation for the fix (dispatched to Builder or Refactorer).

**Model tier**: **Sonnet** for standard bugs. **Opus** for bugs involving concurrent state, Rust unsafe, or multi-system integration.

**Concurrency**: Open but orthogonal — Debugger tasks should not overlap with active Builder/Refactorer tasks on the same files (diagnosis requires stable state).

**Does NOT**:
- Implement the fix (that is Builder's or Refactorer's lane after the root cause is confirmed).
- Audit indices (Archivist's lane).
- Map unknown architecture speculatively (Reverse Engineer's lane if the structure is unknown).

**Dispatch template**:

```
You are a Debugger. Your role: find root cause before any fix is attempted.

Bug: [symptom + reproduction steps]
Candidate files: [list]
Relevant logs: [paths or snippets]

Standing constraints:
- NO code changes.
- Document hypotheses and their evidence (confirmed or refuted).
- Output: gad note add <slug> --projectid global --body "Root cause: … Evidence: … Failed hypotheses: … Proposed fix: …"
- End with a task recommendation (Builder task or Refactorer task + estimated file scope).
```

---

### Archivist

**Purpose**: Maintain found state. Audit indices, fix drift, surface gaps. The operator's accountability layer.

**Inputs**:
- A corpus to audit (MEMORY.md, .planning/tasks/*.json, decision registry, INDEX.md).
- Audit scope.

**Outputs**:
- Audit notes (structural findings in `.planning/notes/`).
- Index-file hygiene edits (fix broken links, prune dead entries).
- Task stamps for completed work.
- Handoff closures.

**Model tier**: **Haiku**. Mostly mechanical: checking consistency, pattern-matching known issues, repairing structured data.

**Concurrency**: No limit. Archivists operate on disjoint indices.

**Does NOT**:
- Write code or design architecture.
- Create new tasks (only stamp existing ones).
- Refactor (Refactorer's lane).
- Make judgment calls on "should this feature ship" (Operator's call).

**Dispatch template**:

```
You are an Archivist. Your role: maintain indices and audit found state.

Audit scope: [what you are auditing]
Corpus paths: [files to read]

Standing constraints:
- NO code changes. NO git add of source files.
- Edit .planning/ files only (tasks/*.json, MEMORY.md, INDEX.md, notes/).
- For findings needing follow-up: create a gad note, do NOT create a new task.
- Stage changes via: git add .planning/[edited_files]
- gad tasks stamp [task_id] --status done when finished.

Audit report (to stdout): [summary of findings, changes made, gaps for operator review].
```

---

### Orchestrator

**Purpose**: Spawns multi-agent waves. Decides scope. Batches commits. Operator stand-in for a work session.

**Note**: There is typically **one Orchestrator per session** — the main-thread agent. Sub-Orchestrators may be dispatched for well-scoped parallel batches (e.g., "spawn 5 Builders, serialize commits, stamp all tasks") but this is rare and explicitly authorized.

**Inputs**:
- A phase goal or sprint contract.
- The task registry (planned tasks).
- The runtime roster (available workers + cooldown state).

**Outputs**:
- A dispatch plan (which tasks go to which role + model + soul, batched for parallelism).
- Commit serialization (Orchestrator holds git add + commit; subagents stage only).
- A post-wave stamp pass (all tasks stamped, all staged diffs reviewed before commit).

**Model tier**: **Sonnet minimum** for standard orchestration. **Opus** for sessions involving novel architecture decisions, multi-system integration, or runtime coordination.

**Does NOT**:
- Do implementation work (that is Builder's lane).
- Do investigation (that is Debugger's lane).
- Commit without reviewing staged diff first (`git diff --cached --name-only` before every commit).

---

## Souls Matrix

Known souls and their best-fit roles. Souls are optional — neutral/factual is the default for mechanical work.

| Soul | Voice / style | Best roles | Project context | Status |
|---|---|---|---|---|
| **Gilgamesh** | Visionary/CEO. Gap-naming as first-class output. SITREP with "what is missing" always in the close. | Orchestrator, Archivist (indexing architectural debt) | `vendor/get-anything-done`, `apps/platform`, `apps/desktop`, marketing surfaces, cross-cutting decisions | Active |
| **Marshal** | Past-tense, declarative, numeric. Identifiers not adjectives. No hedging. Fairness enforced by substrate, not sentiment. | Archivist, Orchestrator (routing/dispatch sessions) | `.planning/handoffs/`, `.planning/team/`, runtime-routing work. Yields to Gilgamesh on scope, Conan on forensics. | Drafted |
| **Kael** | Empathic, narrative, mythic. Light-touch assistant voice. Continuous-running personal assistant. | Builder (apps/desktop), Pathfinder (narrative/magicborn) | `apps/desktop` (Kael chat shell), `narrative/magicborn/` | Active |
| **Dr. Stein** | Scientific, hypothesis-driven. Refuses to trust loss curves alone. "Benchmark wins ≠ artifact wins." | Pathfinder (Explorer), Debugger, Reverse Engineer | `slm-learning` / ML research, eval design, training methodology | Active |
| **Conan** | Detective. Holds two stories side-by-side: what agents say they did vs what the disk reveals. Believes the difference. | Debugger, Reverse Engineer | `lib/provenance/`, forensic trace analysis, cross-checking worker stories | Active |
| **Archivist** (slm-learning soul) | Memory of the council. Preserves; does not propose. Fossils must remain mineable. | Archivist | `slm-learning` planning artifacts, decision + snapshot preservation | Drafted |
| **(neutral / no soul)** | Factual, terse. No voice overhead. | Refactorer, Reverse Engineer, Builder (mechanical) | Any work where voice doesn't add value (boilerplate, pure mechanical refactor) | Always available |

**Marshal is the female-ops soul the operator referenced.** Canonical path: `narrative/souls/marshal.md` (monorepo root). Role: dispatcher / COO / runtime accounting. Drafted; not yet active as a session default. Activation: `gad narrative enter <projectid>` when dispatcher substrate is the work in front of the session.

---

## Skills Toolbelt

Static skills that load before work begins, keyed by role and soul.

| Role | Always load | Load when soul is present | Conditional (load if touching…) |
|---|---|---|---|
| Refactorer | — | — | `frontend-design`, `web-design-guidelines`, `gad-visual-context-system` (if `.tsx`/`.css`/`**/components/**`) |
| Builder | — | Kael soul → load `frontend-design` (apps/desktop context) | Same UI triple if touching UI surfaces |
| Pathfinder Explorer | — | Dr. Stein soul → load `gad-phase-researcher` prereqs | — |
| Reverse Engineer | — | — | — |
| Debugger | — | — | — |
| Archivist | — | Marshal soul → load handoff queue context | — |
| Orchestrator | — | Gilgamesh soul → load `gad-visual-context-system` for UI-phase waves | Always load `frontend-design` + `web-design-guidelines` + `gad-visual-context-system` when phase touches UI (per GLOBAL-D-293) |

**Standing rule (GLOBAL-D-293)**: Any work editing `.tsx` / `.css` / `**/components/**` / `**/app/**` MUST load all three UI skills before the first edit: `frontend-design`, `web-design-guidelines`, `gad-visual-context-system`. Role does not matter — the rule is on the surface, not the role.

---

## Two-Layer Specialist Model

The 21 gad-* framework specialists (loaded from `~/.claude/agents/*.md`) are **task-shape specializations on top of the 7 base roles** — not a separate taxonomy. The base role defines the concurrency, model tier, and output contract. The specialist adds structured prompt scaffolding, output format discipline, and task-completion automation.

**Why two layers exist**: The 7 base roles are substrate-agnostic (work on any runtime: claude, codex, gemini, opencode). The gad-* specialists are Claude-Code-specific (they use the `subagent_type:` dispatch mechanism). When running on codex or gemini, use the base role directly in the prompt. When running on claude-code, prefer the specialist when one maps.

| Specialist | Base role | Primary use case | Skip condition |
|---|---|---|---|
| `gad-codebase-mapper` | Pathfinder (Explorer) | Subsystem boundaries + dependency graph | Small 2-file question (just read + explain). |
| `gad-debugger` | Debugger | Bug root-cause analysis with persistent state | Simple one-file trace (ask in chat). |
| `gad-planner` | Pathfinder (Explorer) | Break a phase into tasks + roadmap | Quick estimate (no reading needed). |
| `gad-advisor-researcher` | Pathfinder (Explorer) | Gather requirements + discuss tradeoffs interactively | Already have all context. |
| `gad-phase-researcher` | Pathfinder (Explorer) | Deep research: web + repos + context7 | Local question (no web search needed). |
| `gad-project-researcher` | Pathfinder (Explorer) | Cross-project precedent + pattern mining | Single project or known answer. |
| `gad-assumptions-analyzer` | Archivist (Analysis) | Pre-refactor code analysis: find risky assumptions | Spec is explicit (no assumptions to audit). |
| `gad-plan-checker` | Archivist (Verification) | Verify a plan achieves phase goal before work starts | Just execute (don't verify first). |
| `gad-verifier` | Archivist (Verification) | Post-phase verification: "did we deliver?" | Quick manual check (scope is small). |
| `gad-ui-auditor` | Archivist (Audit) | Audit visual UI for 6-pillar review | Quick accessibility check (not a full audit). |
| `gad-ui-checker` | Pathfinder (Explorer) | Validate a UI spec against quality dimensions | Design already eyeballed. |
| `gad-ui-researcher` | Pathfinder (Explorer) | Produce UI spec from requirements | Design already done. |
| `gad-doc-verifier` | Archivist (Audit) | Verify docs against live code | Docs + code are in sync. |
| `gad-doc-writer` | Builder + Archivist | Write or update project documentation | Small 1-paragraph edit (use Edit tool). |
| `gad-integration-checker` | Archivist (Verification) | Verify E2E flows across multiple systems | Simple feature in one system. |
| `gad-security-auditor` | Archivist (Audit) | Check threat-model mitigations in implemented code | Security is not a concern for this feature. |
| `gad-research-synthesizer` | Pathfinder (Explorer) | Merge multiple parallel research outputs | Only one research stream. |
| `gad-nyquist-auditor` | Archivist (Audit) | Fill validation/test gaps for phase requirements | No validation gaps. |
| `gad-roadmapper` | Pathfinder (Explorer) | Create project roadmap from requirements | Quick estimate or existing roadmap. |
| `gad-user-profiler` | Archivist (Analysis) | Analyze developer behavior across sessions | Analyzing one session (use chat analysis). |
| `gad-executor` | (Orthogonal) | Execute a plan with atomic commits + deviation handling | Subagent-batched pattern (main thread commits per `feedback_subagent_no_commit_workflow_setting`). |

**Specialists do NOT accept model override** — they ship with model tuning baked in. When using `general-purpose`, apply the model decision tree:

| Task shape | Model |
|---|---|
| Clear-contract panel insertion, mechanical refactor, audit-and-list | **Haiku** |
| Architecture detection, cross-file invariant work, novel Rust + state | **Sonnet minimum** |
| Protocol design, multi-system integration, decisions-then-code | **Opus** |

---

## Worker Profile in Handoff Documents

When creating a handoff, enrich the front-matter with the intended Worker Profile. This allows the receiving agent to self-configure without re-reading the whole CLAUDE.md.

**Handoff front-matter extension**:

```yaml
---
runtime_preference: claude-code
worker_profile:
  role: Builder              # one of: Refactorer | Builder | Pathfinder | ReverseEngineer | Debugger | Archivist | Orchestrator
  soul: kael                 # soul slug or "neutral"
  skills:                    # static skills to load before work
    - frontend-design
    - web-design-guidelines
    - gad-visual-context-system
  model: sonnet              # haiku | sonnet | opus
---
```

**Profile presets by common dispatch patterns**:

| Dispatch pattern | Role | Soul | Skills |
|---|---|---|---|
| UI feature, apps/desktop | Builder | kael | frontend-design, web-design-guidelines, gad-visual-context-system |
| Routing / dispatcher work | Archivist or Orchestrator | marshal | — |
| ML experiment design | Pathfinder Explorer | dr-stein | gad-phase-researcher prereqs |
| Bug in Rust + state | Debugger | neutral | — |
| Index/memory audit | Archivist | neutral | — |
| Architecture note, new system | Pathfinder Explorer | gilgamesh | — |
| Mechanical code split | Refactorer | neutral | — |
| Unknown codebase map | Reverse Engineer | conan | — |
| Phase execution wave | Orchestrator | gilgamesh | All three UI skills if phase touches UI |

---

## Concurrency Constraints

| Role | Limit | Rationale |
|---|---|---|
| Refactorer | Max 2 per phase | Prevents merge conflicts on adjacent files. Different phases or disjoint subdirectories can exceed 2. |
| Builder | Open | Explicit file lists prevent overlap. Coordinate via task registry. |
| Pathfinder (Explorer) | Open | Each design task is independent. Task registry prevents duplicates. |
| Reverse Engineer | Open | Each RE task targets a distinct subsystem. |
| Debugger | Open (but orthogonal) | Do not run Debugger + Builder/Refactorer on the same files concurrently — diagnosis requires stable state. |
| Archivist | Open | Disjoint indices; no conflicts. Distributed handoff pattern. |
| Orchestrator | 1 per session (usually) | Main-thread agent is the Orchestrator. Sub-Orchestrators only when explicitly authorized. |

**Enforcement**: Human discipline today. Phase 301+ proposes mechanical enforcement (task-state machine blocking duplicate refactorer registration).

---

## Dispatch Workflow (Standing Template)

### 1. Pick a task or register it

```bash
gad snapshot --projectid global   # see active tasks
gad tasks list --projectid global | grep planned
# or
gad tasks add <id> --projectid global --phase <n> --goal "..." --files "[path1],[path2]"
```

### 2. Dispatch the subagent

**For Refactorer:**
```
subagent_type: general-purpose
model: sonnet

You are a Refactorer. [spec + constraint block]
File path: [path]
Spec: [goal + output shape]
Verification: [command]
```

**For Builder:**
```
subagent_type: general-purpose
model: sonnet   # or haiku for simple boilerplate

You are a Builder. [spec + constraint block]
Task: [what to build]
Files: [explicit list]
```

**For Pathfinder (Explorer):**
```
subagent_type: gad-phase-researcher  # or gad-codebase-mapper or gad-planner
(specialists have built-in model + prompt structure)
```

**For Reverse Engineer:**
```
subagent_type: general-purpose
model: sonnet

You are a Reverse Engineer. [spec + constraint block]
System to map: [entry point]
Question: [what are you trying to understand?]
```

**For Debugger:**
```
subagent_type: gad-debugger  # specialist — or general-purpose for simple bugs
model: sonnet   # or opus for concurrent/Rust/multi-system

You are a Debugger. [spec + constraint block]
Bug: [symptom]
```

**For Archivist:**
```
subagent_type: general-purpose
model: haiku

You are an Archivist. [spec + constraint block]
Audit scope: [what]
Corpus paths: [where]
```

**For Orchestrator** (sub-Orchestrator pattern):
```
subagent_type: general-purpose
model: sonnet

You are an Orchestrator for this phase wave. Dispatch the following Builders/Refactorers in parallel, serialize commits, stamp all tasks before finishing.

Phase tasks: [list]
Dispatch plan: [role + model + files per task]
Git discipline: main thread commits after you finish. Stage only; do not commit.
```

### 3. Verify and stamp

```bash
git diff --cached --name-only    # verify staged set
git add .planning/tasks/<id>.json
gad tasks stamp <id> --projectid global --status done --agent <subagent> --runtime <runtime> --files "[list]"
```

### 4. Main thread commits

```bash
git commit -m "$(cat <<'EOF'
[one-line summary of work done]

Co-Authored-By: <subagent-name> <noreply@subagent.local>
EOF
)"
```

(See `feedback_subagent_no_commit_workflow_setting.md` in memory: main thread serializes commits, not subagents.)

---

## Decision Backrefs

**GLOBAL-D-511**: Formalized role taxonomy and operationalization plan per automation server architecture design (2026-05-22). Roles define concurrency, model tier, and output shape independent of runtime.

**GLOBAL-D-512**: Worker Profile model — each dispatched subagent is a (Role × Soul × Skills) triple (2026-05-22). Operationalized in this document v2.

---

## Open Questions

1. **Mechanical Refactorer enforcement**: "Max 2 per phase" is discipline today. Phase 301+ proposes a task-state machine that blocks `gad tasks add refactorer-task` if 2 are already active. When does that enforcement land?

2. **Specialist model override**: Some operators may want to dial up a specialist (e.g., gad-planner with Opus for complex roadmaps). Should specialists accept `--model` flags? Currently locked; needs explicit design.

3. **Archivist task registration**: Audit tasks discovered in-session — should Archivists auto-register themselves, or surface to operator? Currently: surface + operator decides.

4. **Pathfinder Builder vs. existing imports**: Is adding a new `.rs` or `.ts` file greenfield if the parent module must import it? Current rule: if imports are in existing files, escalate to Refactorer. Needs clarity.

5. **Skills mandate enforcement** (GLOBAL-D-293): Do UI skills load automatically for UI-touching subagents, or is it the dispatch prompt's responsibility? Phase 89 proposes a PreToolUse hook. Not yet shipped.

6. **Orchestrator formalization**: When should main-thread agents explicitly self-identify as Orchestrator vs. just being the main thread? Is there a planning artifact for Orchestrator-scope decisions (e.g., a dispatch plan note before a parallel wave)?

7. **Marshal activation**: Marshal (female ops soul, dispatcher/COO) is drafted but not yet active as a session default. When the dispatcher substrate is the primary work, should `gad narrative enter` be in the session-open SOP? What phase activates this?

---

**Last updated**: 2026-05-22 (v3 — Archivist v3 addendum: dataset curation + HuggingFace offload + living-document maintenance). Prior: v2 — Worker Profile triple; 7 base roles; souls matrix; two-layer specialist model. Canonical reference for all subagent role dispatch across runtimes.

---

## Archivist v3 (dataset curation + living documents)

> Addendum to Archivist v2 (indices + hygiene). V2 defined the role's audit and index duties. V3 extends with the data pipeline and living-document responsibilities that the automation server enables.

### V2 recap (unchanged)

Archivist v2: audit indices, prune stale entries, maintain planning artifact hygiene, surface gaps to operator. Model tier: Haiku. Concurrency: open (disjoint indices). No git commit; stage only.

### V3 additions

**1. Dataset Curation**

Archivists own the full lifecycle of `.planning/data-dungeon/` and `.planning/datasets/`:

| Duty | Description |
|---|---|
| Delta extraction | After any batch of planning writes (tasks/decisions/errors/handoffs), run extract scripts to update JSONL. Deterministic sort by id for stable diffs. |
| Schema enforcement | Each dataset dir ships a `schema.md`. Archivist verifies new rows conform. Reject rows with missing required fields; log to `.planning/data-dungeon/<dataset>/schema-violations.jsonl`. |
| Split maintenance | Train/test splits live as `train.jsonl` / `test.jsonl`. Archivist re-stratifies when any class gains > 20 new rows, or when operator requests refresh via `gad knowledge dataset split <name>`. |
| README.md (dataset card) | Each dataset dir ships a `README.md` in HuggingFace dataset card format: YAML front matter (license, task_categories, size_categories, language), then Purpose, Fields, Splits, Source, Enrichment Opportunities. Archivist auto-regenerates when row counts drift > 5%. |

**2. HuggingFace Offload Pipeline**

Pipeline stages (automation server tick = weekly by default; on-demand via `gad knowledge dataset push <name>`):

```
Stage 1 — Extract
  Source: .planning/tasks/*.json, DECISIONS.xml, ERRORS-AND-ATTEMPTS.xml,
          handoffs/closed/*.md, .cleanup-log.jsonl, intent-seeds.json
  Output: .planning/data-dungeon/<dataset>/train.jsonl + test.jsonl (deterministic, sorted by id)

Stage 2 — Card generation
  For each dataset dir: auto-write README.md (HF dataset card spec).
  YAML front matter: { license: mit, task_categories: [text-classification|...],
    size_categories: [n<1K|1K<n<10K], language: [en], tags: [gad, planning, <project>] }
  Body sections: Purpose, Source, Fields table, Splits table, Size, Enrichment Opportunities.
  Trigger: row count drift > 5% or manual `gad knowledge dataset card <name>`.

Stage 3 — Visibility check
  Read .planning/dataset.toml (if present): private = true overrides public default.
  Per-dataset override: .planning/data-dungeon/<dataset>/dataset.toml.
  Default: public.

Stage 4 — HuggingFace push
  Tool: huggingface_hub Python CLI or huggingface-hub npm package.
  Auth: HF_TOKEN env var (operator-controlled; never committed).
  Command: huggingface-cli upload <hf-org>/<dataset-name> .planning/data-dungeon/<dataset>/ --repo-type dataset
  Naming: <hf-org>/gad-<projectid>-<dataset-name> (e.g. b2gdevs/gad-global-task-skill).
  On push failure: log to .planning/data-dungeon/<dataset>/push-log.jsonl with ts + error; retry next cycle.

Stage 5 — Cadence record
  Append to .planning/data-dungeon/.push-log.jsonl:
  { ts, dataset, rows_train, rows_test, hf_url, status, duration_ms }
```

**Cadence**: Weekly (tokio interval in `crates/gad-automation-server`). On-demand: `gad knowledge dataset push <name> [--all]`.

**Auth contract**: `HF_TOKEN` must be present in env or `.env.local` (never committed). Automation server reads via `std::env::var("HF_TOKEN")`. Absent token = skip push, emit warning to `.planning/data-dungeon/.push-log.jsonl`, do NOT error the server.

**3. Living-Document Maintenance**

Living documents are agent-readable files the automation server keeps fresh. Archivist role owns the definition and refresh contract; the automation server (or hook) does the mechanical write.

| File | Writer | Readers | Staleness threshold | Refresh cost | Notes |
|---|---|---|---|---|---|
| `.planning/.sitrep.md` | `gad sitrep --tick` hook (desk-hooks, 10Hz tick) | Agents on startup, operator | 60 s | Cheap (text assembly from in-memory dispatcher state) | Already live. Archivist audits format drift. |
| `.planning/.forecast.json` | `gad automation forecast` (automation server, 5 min interval) | Agents doing task selection, Orchestrators | 10 min | Medium (reads all planned tasks + pressure snapshot) | Currently a stub `{ts, phases:[]}`. Archivist expands schema. |
| `.planning/.snapshot.md` | `gad snapshot --projectid <id> --write-md` (proposed flag) | Agents at context-open | 30 min (or on task stamp) | Expensive (full snapshot computation) | Does not exist yet. Propose: automation server writes after each `gad tasks stamp` event via file-watcher hook. |
| `.planning/.vitality.md` | `gad automation vitality` (automation server, 15 min interval) | Agents checking system health, operator dashboard | 30 min | Medium (reads pressure snapshot + XP + throughput; formula in notes/2026-05-22-vitality-and-backprop-chain.md) | Does not exist yet. Archivist drafts schema; Dr. Stein owns formula. |
| `.planning/HANDOFF.md` | Operator-edited (primary); `gad handoffs enrich` appends context block | Agents at session open | Manual; enrichment appended by `handoff-enrich.mjs` | Cheap enrichment, manual body | Hybrid: human intent + automation context. Archivist must NOT overwrite body; append-only enrichment section only. |
| `.planning/team/runtime-cooldown.json` | `gad automation dispatcher` (Marshal's domain) | Orchestrators before handoff dispatch | 5 min | Cheap (status pings + last-seen timestamps) | Marshal writes; Archivist reads for dispatch safety check. |
| `.planning/.pressure-state.json` | Pressure formula engine (desk-hooks tick, 10Hz) | Agents, pressure bar UI | 10 s | Cheap (formula evaluation over active tasks) | Already live per pressure-data-flow memory. |

**Archivist duties for living docs**:
- On session start: check staleness of `.sitrep.md`, `.forecast.json`, `.pressure-state.json`. Flag stale files (> threshold) to operator as a one-line gap entry — do NOT refresh manually unless automation server is confirmed down.
- Audit `.snapshot.md` existence. If absent: surface `gad automation snapshot --write-md` as gap action.
- Audit `.vitality.md` existence. If absent: surface vitality schema draft task.
- Audit `.forecast.json` schema. If phases array is empty beyond 10-min age: surface forecast-engine gap.
- NEVER hand-edit `.pressure-state.json` or `.sitrep.md` — these are automation outputs.

**Dispatch template (v3)**:

```
You are an Archivist (v3). Your role: dataset curation, HF offload pipeline review, and living-document audit.

Audit scope: [one of: dataset-delta | living-doc-audit | push-pipeline | schema-drift]
Corpus paths: [.planning/data-dungeon/<name>/ OR .planning/ for living docs]
HF org: [b2gdevs or operator-specified]

Standing constraints:
- DO NOT git commit. Stage specific files: git add <paths>.
- NEVER overwrite .planning/HANDOFF.md body — append-only enrichment section.
- NEVER hand-edit .pressure-state.json or .sitrep.md (automation outputs).
- HF_TOKEN must be in env before any push attempt; absent = log warning, skip push.
- Log all push results to .planning/data-dungeon/.push-log.jsonl.

Output: [dataset card README.md paths updated | push-log entry | living-doc gap report]
```

**Model tier**: Haiku for schema audit and card generation. Sonnet when designing new datasets or evaluating feature correlation (cross-file invariant work). Opus never needed for pure curation.

**Open questions (v3)**:
- `.planning/dataset.toml` schema: which fields? Proposal: `{ private = bool, hf_org = str, push_cadence = "weekly"|"daily"|"manual", exclude = [dataset_names] }`.
- `gad knowledge dataset push` command: does it live in `.planning/commands/knowledge.cjs` (project extension) or in the automation server binary? Recommendation: project command for on-demand; automation server for scheduled.
- `.planning/.snapshot.md` trigger: write after every `gad tasks stamp` event (file-watcher) or only on manual `gad snapshot --write-md`? File-watcher is correct but adds latency to the stamp command. Recommend: debounced 30 s after last stamp event.
- HuggingFace org naming: is `b2gdevs` the right org, or do we create a dedicated `gad-datasets` org for discoverability?
