# Agent guide — get-anything-done

**This is the canonical GAD loop definition (gad-18).** All other AGENTS.md files reference this one.

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
6. Commit

**Task attribution is mandatory (GAD-D-104).** Every completed task must have skill, agent, and type attributes. This feeds the self-eval pipeline and site data. Empty skill/agent is OK if genuinely no skill or agent was involved — but type is always required.

## Context exhaustion (gad-17)

Auto-compact handles it. After compaction, run `gad snapshot` to re-hydrate and continue. Never stop work, never ask the user to restart.

## Session start for this project

```sh
gad snapshot --projectid get-anything-done
```

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

Official consumer/runtime skills live in `sdk/skills/`. Agents read `SKILL.md` and follow the
methodology. Those skills are the canonical public install/publish surface and are what runtime
installers transpile into Claude/Codex/Cursor-compatible layouts.

Repo-root `skills/` is reserved for internal or non-official methodology used to work on GAD
itself. Repo-local `.agents/`, `.claude/`, `.codex/`, or generated `commands/` layouts are
install/build outputs only and are not canonical source.

Terminology:
- `skill` — the installable/public methodology unit; canonical source under `sdk/skills/`
- `workflow` — a reusable long-form execution spec used by skills, agents, and prompts; canonical source under `sdk/workflows/`
- `command` — a runtime-specific wrapper shape generated from skills only when a coding agent still needs command files

| Skill | Purpose |
|-------|---------|
| `manuscript` | Fiction/book creation methodology |
| `eval-run` | Run a GAD evaluation |
| `eval-report` | Compare eval runs |
| `write-intent` | Capture project intent into planning docs |
| `write-feature-doc` | Produce a feature doc into the sink |
| `write-tech-doc` | Produce a technical breakdown doc |

## Docs sink

```sh
gad sink sync                                    # compile all projects
gad sink status --projectid get-anything-done    # check sync state
```
