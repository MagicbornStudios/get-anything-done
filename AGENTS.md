# Agent guide — get-anything-done

This project uses its own CLI. GAD eats its own workflow.

## Context re-hydration

```sh
gad state --projectid get-anything-done
gad tasks --projectid get-anything-done
gad decisions --projectid get-anything-done
```

Or full snapshot:
```sh
gad snapshot --projectid get-anything-done
```

## Planning loop

1. `gad state --projectid get-anything-done` — read current phase and next action
2. Pick one planned task from `gad tasks --projectid get-anything-done`
3. Implement it
4. Update `.planning/TASK-REGISTRY.xml` — mark task done
5. Update `.planning/STATE.xml` — update next-action
6. `gad sink sync` — propagate to docs sink
7. Commit

## Session management

```sh
gad session new --projectid get-anything-done   # start session
gad session list                                 # see active sessions
gad session close                                # close when done
```

## Planning files

| File | Purpose |
|------|---------|
| `.planning/STATE.xml` | Current phase, milestone, status, next-action |
| `.planning/ROADMAP.xml` | Phase breakdown with goals and dependencies |
| `.planning/TASK-REGISTRY.xml` | All tasks by phase with status |
| `.planning/DECISIONS.xml` | gad-01 through gad-17 — all architectural decisions |
| `.planning/DOCS-MAP.xml` | Non-planning feature docs linked to this project |

## Key decisions to read first

- **gad-01** — GAD is agent-agnostic, not Claude Code-specific
- **gad-04** — Capture all session decisions before ending
- **gad-16** — No subagents until formally evaluated
- **gad-17** — Context exhaustion: finish → update planning → commit → fresh session

## Skills

All skills are in `skills/`. Use `gad:` prefix.

| Skill | When |
|-------|------|
| `gad:execute-phase` | Execute a planned phase atomically |
| `gad:plan-phase` | Plan a new phase |
| `gad:eval-run` | Run a GAD evaluation |
| `gad:eval-report` | Compare fresh vs loaded eval runs |
| `gad:write-intent` | Capture project intent into planning docs |
| `gad:write-feature-doc` | Produce a feature doc into the sink |
| `gad:write-tech-doc` | Produce a technical breakdown doc |

## Docs sink

Planning docs compile to: `apps/portfolio/content/docs/get-anything-done/planning/`

```sh
gad sink sync                    # compile all projects
gad sink status --projectid get-anything-done  # check sync state
```

## Current work

Phase 10 (gad-v1-cli) — active. Run `gad tasks --projectid get-anything-done` for open tasks.
