# Agent guide — get-anything-done

**This is the canonical GAD loop definition (gad-18).** All other AGENTS.md files reference this one.

## Agent lanes (mandatory read for parallel agents)

**Spec:** `references/agent-lanes.md` — per-runtime allow/deny globs, shared-write
protocols, collision playbook, session-start etiquette. Every parallel agent
(claude-code, codex, cursor, future runtimes) reads this on session open and
before touching a non-owned file. Cross-lane edits only via the handoff queue
(`.planning/handoffs/open/`). Promoted 2026-04-18 (task 63-04).

## Communication style (default for every GAD project)

**Spec:** `references/communication-style.md` — read once, follow every turn.

Goal: maximize information density per token, not minimize tokens. Long is
fine if distinct; short is wrong if vague.

| rule | one-line |
|--|--|
| tone | military SITREP — fragments, imperative, no narration, no celebration, no apology, no emoji |
| root | set `Root: <cwd-prefix>` once, never repeat the prefix in body cells |
| structure | tables for any 2+ columns of structured state, bullets only for flat sequences |
| headers | column headers carry units (`LOC` not `lines`) |
| deltas | repeat values across rows only when they differ; hoist constants to caption |
| paths | bare cwd-relative paths so Cursor terminal makes them clickable; add `:LINE` for code |
| summaries | no trailing "what just happened"; closing line is for *what's next* |
| modes | this style applies to status / report / execution. Exploratory questions stay 2–3 sentences. Design discussions can use prose. |

Projects override this in their own `AGENTS.md` only if they need a different
tone — otherwise inherit the default.

## The loop

1. `gad snapshot --projectid <id>` — one command, full context
2. Pick one task from TASK-REGISTRY.xml (status=planned)
3. Implement it
4. Update TASK-REGISTRY.xml:
   - Set `status="done"`
   - Set `skill="<skill-used>"` — which skill(s) you used (comma-separated if multiple). Use empty string if none.
   - Set `agent="<agent-name>"` — `default` for main session, named agent otherwise (e.g. `gad-planner`, `gad-executor`)
   - Set `type="<category>"` — one of: `framework`, `cli`, `site`, `eval`, `pipeline`, `skill`, `cleanup`, `docs`
   - Example: `<task id="22-50" status="done" skill="execute-phase" agent="default" type="site">`
5. Update STATE.xml (next-action), DECISIONS.xml (if new decisions — use GAD-D-NNN format per GAD-D-125)
   - Graph auto-rebuilds after task status change and state update (gad-201) — no manual `gad graph build` needed
6. Commit

**Task attribution is mandatory (GAD-D-104).** Every completed task must have skill, agent, and type attributes. This feeds the self-eval pipeline and site data. Empty skill/agent is OK if genuinely no skill or agent was involved — but type is always required.

## Context exhaustion (gad-17)

Auto-compact handles it. After compaction, run `gad snapshot` to re-hydrate and continue. Never stop work, never ask the user to restart.

## Snapshot vs handoffs — the two-axis mental model

**`gad snapshot` = ambient orientation.** Current phase, sprint, state,
recent commits, open tasks, decisions, refs. Answers: *where am I, what
has happened, what's the terrain?* Every session opens with this.

**`gad handoffs` = directed intent.** A file someone wrote that says
*"this specific work needs doing, here's the scope, claim it if you're
the right runtime."* Answers: *what should I do next?*

Neither replaces the other. Snapshot without handoffs → you orient but
pick a task cold (risk: low-priority or already-in-flight). Handoffs
without snapshot → you know the assignment but not the terrain (risk:
wrong approach, missed constraints, duplicated work). Together: orient,
then pick up assigned work.

Handoffs are a **strict superset of note-passing** — the directory
layout is the index, the frontmatter carries routing (runtime preference,
priority, context size), and atomic `fs.rename` handles concurrency
across any number of parallel agents. See `skills/gad-handoffs/SKILL.md`
for the full lifecycle.

## Daily workflow (every session, every agent)

Same four commands in the same order. No exceptions.

```sh
# 1. Orient — state / roadmap / tasks / decisions in one bundle.
gad startup --projectid get-anything-done       # first call of a new session
gad snapshot --projectid get-anything-done      # subsequent calls (downgrades to active mode)

# 2. Pick up assigned work — unclaimed handoffs targeted at your runtime.
gad handoffs list --mine-first

# 3. Claim before you touch anything.
gad handoffs claim <id>                         # moves open/ → claimed/

# 4. Complete when done.
gad handoffs complete <id>                      # moves claimed/ → closed/
```

If the queue is empty, pick one `status="planned"` task from `TASK-REGISTRY.xml`
that matches your lane (per `references/agent-lanes.md`) and execute "The loop"
above. If the queue has unclaimed work targeted at you (`runtime_preference`
matches your runtime), prefer that over picking a task cold — the handoff
carries scope + context the operator or another agent already thought through.

### Cross-lane work

If your task requires editing a file outside your lane, **do not silently
edit it**. File a handoff for the owning lane:

```sh
gad handoffs create \
  --projectid get-anything-done \
  --phase <N> \
  --task-id <id> \
  --priority <low|normal|high> \
  --context <mechanical|reasoning> \
  --runtime-preference <claude-code|codex|cursor> \
  --body "<self-contained instructions>"
```

Keep working your own lane while the target lane picks it up.

### Installed-vs-source CLI

If `gad --version` is older than the latest submodule commit, new subcommands
(e.g. `gad handoffs`, `gad tasks update --goal`) live only in source. Run
them via `node vendor/get-anything-done/bin/gad.cjs <...>` until operator
re-runs `gad install` from source. Tarball distribution is tracked as
task 44-38.

## Planning files

| File | Purpose |
|------|---------|
| `.planning/STATE.xml` | Current phase, milestone, next-action |
| `.planning/ROADMAP.xml` | Phase breakdown with goals and dependencies |
| `.planning/TASK-REGISTRY.xml` | All tasks by phase with status |
| `.planning/DECISIONS.xml` | gad-01 through gad-28 — all architectural decisions |
| `.planning/DOCS-MAP.xml` | Non-planning feature docs linked to this project |

## Planning path hygiene (CLI)

**`gad refs`** with no subcommand is the same as **`gad refs list`** (aggregated paths from decisions, requirements, phases, docs-map). After refactors, run **`gad refs verify`** to ensure `<file path>` / `<reference>` in planning XML still exist. Use **`gad refs migrate --from <old> --to <new>`** (dry-run; add **`--apply`** to write) to bulk-update path strings. **`gad refs watch`** re-runs verify when planning XML changes; **`gad refs watch --poll 3000`** if native file watching is unreliable.

GAD does **not** infer paths from TypeScript or imports — only explicit strings in XML and migrate/verify operations.

## Graph queries (gad-201)

`gad query` is the preferred path for targeted planning lookups. It queries a structural
knowledge graph built from .planning/ XML files — no LLM, no external deps, ~320ms rebuild.

| Command | What it does |
|---|---|
| `gad graph build` | Rebuild `.planning/graph.json` + `graph.html` (runs automatically after task/state mutations) |
| `gad query "open tasks in phase 44.5"` | Natural-language-ish graph query — 12.9x token savings vs raw XML |
| `gad tasks --graph` | Graph-backed task listing (auto-enabled when `useGraphQuery=true`) |
| `gad state --graph` | State output with graph stats appended |

Graph auto-rebuilds after: `gad tasks release --done`, `gad tasks claim`, `gad state set-next-action`.
Feature flag: `[features] useGraphQuery = true` in `.planning/gad-config.toml`. Set to `false` to fall back to raw XML reads.

## Snapshot output vs telemetry

- **`gad snapshot`** prints the full planning bundle to **stdout** (or JSON with `--json` / agent profile). That content is not duplicated in log files.
- Each **`gad`** invocation appends one JSON line under **`.planning/.gad-log/<YYYY-MM-DD>.jsonl`** at the resolved repo root (`ts`, `cmd`, `args`, `duration_ms`, `exit`, `summary` — usually empty). This is run metadata only, not snapshot text.
- **Legacy RepoPlanner** (`pnpm planning` → `loop-cli.mjs`) is being **migrated off**; it only logged **`{ "at", "command" }`** to **`usage.jsonl`** (no snapshot body). Remaining monorepo uses (embed-pack, init templates, cockpit parsers) are tracked in **`custom_portfolio/.planning/REPOPLANNER-TO-GAD-MIGRATION-GAPS.md`** — target state is **GAD-only** CLI and artifacts.

## Key decisions

- **gad-01** — GAD is agent-agnostic, not Claude Code-specific
- **gad-04** — Capture all session decisions in planning docs before ending
- **gad-16** — No subagents until formally evaluated
- **gad-17** — Work through auto-compact, never stop for context limits
- **gad-18** — The canonical loop: snapshot → work → update → commit
- **gad-19** — GSD is dead, GAD and RepoPlanner only
- **gad-26** — Real-time tooling: one core (watch + verify + JSON events); CLI first, MCP optional adapter; no IDE/editor integration in scope until re-opened
- **gad-27** — Tooling/MCP evals: fixtures + automated harness, `eval_type` tooling|mcp, comparable across versions
- **gad-28** — Granular metrics: `scores.json` / versioned `TRACE.json`; optional `metrics.json` for detail; no SCORE.md regex for automation

## Roadmap: Phase 20 — real-time tooling and tooling evals

**ROADMAP.xml** phase **20** tracks: `gad dev` / `gad watch planning`, JSON output for scripts and CI, optional MCP over the same core, fixture-based tooling evals (CI-safe), `scores.json` + richer `gad eval report` for tooling runs. Tasks **20-01**–**20-08** in **TASK-REGISTRY.xml** — **20-07** (IDE docs) is **cancelled** until IDE work is in scope again. Close or parallelize **phase 19** (milestone close) per **STATE.xml**.

## Skills

Framework skills live in `skills/`. Agents read `SKILL.md` and follow the methodology. That tree
is the canonical source for installable skills plus framework-owned non-default entries such as
emergent, candidate, or proto skills. Repo-local `.agents/`, `.claude/`, `.codex/`, or generated
`commands/` layouts are install/build outputs only and are not canonical source.

Terminology:
- `skill` — a methodology unit in the framework skill catalog; canonical source under `skills/`
- `workflow` — a reusable long-form execution spec used by skills, agents, and prompts; canonical source under `workflows/`
- `command` — a runtime-specific wrapper shape generated from skills only when a coding agent still needs command files

### SDK asset aliases

Canonical SDK content uses repo-relative alias refs instead of runtime-local install paths.
Resolve them from the GAD framework root:

- `@skills/...` ? `skills/...`
- `@workflows/...` ? `workflows/...`
- `@templates/...` ? `templates/...`
- `@references/...` ? `references/...`
- `@agents/...` ? `agents/...`
- `@hooks/...` ? `hooks/...`

Example:

- `@references/checkpoints.md` resolves to `vendor/get-anything-done/references/checkpoints.md` in this monorepo
- in a consumer install, the same alias resolves from that installed GAD framework root

When a skill, workflow, or agent prompt mentions one of these aliases, read that file from the
SDK tree before checking any runtime-local installed layout. These aliases are canonical and
`gad snapshot` should be treated as carrying this resolution contract with it.

| Skill | Purpose |
|-------|---------|
| `manuscript` | Fiction/book creation methodology |
| `eval-run` | Run a generation via `gad spawn` (legacy skill name; the CLI is now `gad spawn <project>/<species>`) |
| `eval-report` | Compare generations via `gad generation report` |
| `write-intent` | Capture project intent into planning docs |
| `write-feature-doc` | Produce a feature doc into the sink |
| `write-tech-doc` | Produce a technical breakdown doc |

## Site vs preserved generation (CLI)

| Command | Serves |
|---------|--------|
| `gad site compile` / `gad site serve` | GAD **planning / marketing** Next app (under `site/`) compiled against a project’s `.planning/`. |
| `gad play …` / `gad generation open` / `gad eval open` | **Preserved generation build artifact** only: directory with `index.html` (game/app HTML output). Implemented with `lib/static-http-serve.cjs` — not `site-compile` (so this is not “launching the site”). |

Use **`--no-browser`** on `gad generation open` or `gad play` to print the preview URL for an **iframe** (e.g. in-project editor shells) without opening the OS browser.

Do not use `gad site serve` to preview generation builds. Do not use `gad play` for the planning dashboard. Decision **gad-225**.

### Run the marketing site from this monorepo

- **Source** lives at **`site/`** inside the get-anything-done framework root (this repo / `vendor/get-anything-done` when vendored). Full Next.js app — not a binary blob.
- **Planning static preview:** from any directory that has `.planning/`, run **`gad site serve`** (or pass **`--root <path>`** / **`--projectid`** as you already do for `gad snapshot`). First run does `next build` + extract; default listen **port `3456`** (dev).
- **Side-by-side with a packaged install:** run the consumer binary with **`gad site serve --consumer`** so the default port is **`3780`** (still overridable with **`--port`** or **`GAD_SITE_SERVE_PORT`**).
- **Hot reload while editing React:** from the framework root, **`cd site && pnpm install && pnpm dev`** (this monorepo does not list `vendor/get-anything-done/site` in the root `pnpm-workspace.yaml`, so use `cd` into `site/`). Separate from **`gad site serve`** (static extract, no HMR).

## Docs sink

```sh
gad sink sync                                    # compile all projects
gad sink status --projectid get-anything-done    # check sync state
```

