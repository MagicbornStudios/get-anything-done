# Agent guide — get-anything-done

**This is the canonical GAD loop definition (gad-18).** All other AGENTS.md files reference this one.

## The loop

1. `gad snapshot --projectid <id>` — one command, full context
2. Pick one task from TASK-REGISTRY.xml (status=planned)
3. Implement it
4. Update TASK-REGISTRY.xml (mark done), STATE.xml (next-action), DECISIONS.xml (if new decisions)
5. Commit

That's it. No reading 15 files. No fresh sessions. No memory-based task tracking.

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

Skills are methodology documents in `skills/`. Agents read SKILL.md and follow the methodology. Skills are NOT CLI commands.

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
