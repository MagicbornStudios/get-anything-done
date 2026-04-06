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
| `.planning/DECISIONS.xml` | gad-01 through gad-19 — all architectural decisions |
| `.planning/DOCS-MAP.xml` | Non-planning feature docs linked to this project |

## Key decisions

- **gad-01** — GAD is agent-agnostic, not Claude Code-specific
- **gad-04** — Capture all session decisions in planning docs before ending
- **gad-16** — No subagents until formally evaluated
- **gad-17** — Work through auto-compact, never stop for context limits
- **gad-18** — The canonical loop: snapshot → work → update → commit
- **gad-19** — GSD is dead, GAD and RepoPlanner only

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
