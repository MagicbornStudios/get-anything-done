---
name: gad:snapshot-optimize
description: Verify and optimize gad snapshot output to fit within the sprint context window. Use after modifying snapshot logic, adding new planning file types, or when snapshot token count exceeds the target budget.
---

# gad:snapshot-optimize

Ensures `gad snapshot` output stays within the sprint context window budget. This skill defines what a well-optimized snapshot contains, how to measure it, and the verification gates.

## When to use

- After modifying snapshot logic in `bin/gad.cjs`
- After adding new planning file types (e.g. DOCS-MAP.xml, CONTEXT.md)
- When snapshot token count exceeds the 3,000 token target
- During phase 16 execution
- Before any cli-efficiency eval run

## Token budget

| Component | Target tokens | Max tokens |
|-----------|--------------|------------|
| STATE.xml (full) | 200 | 400 |
| ROADMAP.xml (sprint-scoped) | 400 | 800 |
| DECISIONS.xml (active-phase refs only) | 500 | 1,000 |
| TASK-REGISTRY.xml (open tasks only) | 400 | 800 |
| File refs + git log | 300 | 500 |
| DOCS-MAP.xml | 100 | 200 |
| **Total snapshot** | **~1,900** | **3,000** |

Reference: `docs/context-budget.md` — full baseline analysis with current 26,885 token overhead.

## What a correct sprint-scoped snapshot contains

### 1. STATE.xml — full (no filtering needed, already compact)
Current phase, milestone, status, next-action, last-updated.

### 2. ROADMAP.xml — sprint-scoped
- **Done phases outside sprint:** one line per phase: `id | title | done`
- **Phases in current sprint (active + planned):** full goal text, status, depends
- **Sprint size:** configurable (default 5), read from planning-config.toml

Example collapsed done phase:
```
01 | Foundation | done
02 | Session management | done
```

Example active phase (full):
```xml
<phase id="14">
  <title>Eval framework: escape-the-dungeon + tracing</title>
  <goal>Set up escape-the-dungeon eval project...</goal>
  <status>active</status>
  <depends>13</depends>
</phase>
```

### 3. TASK-REGISTRY.xml — open tasks only
- **Completed tasks:** omitted entirely (agent doesn't need them to know what to do next)
- **Planned/in-progress/blocked tasks:** full goal, status, keywords, commands
- **Phase grouping preserved:** tasks grouped under their phase id

### 4. DECISIONS.xml — active-phase referenced only
- Include only decisions referenced by active phase tasks (via keywords or explicit refs)
- Include decisions marked as "always relevant" (gad-04, gad-17, gad-18)
- Omit decisions from completed phases that don't affect current work

### 5. File refs (NEW)
- Code/doc files touched by in-progress and recently completed tasks
- Source: `<files>` block in TASK-REGISTRY.xml (when present) + `git log --name-only` scoped to project path
- Recent git log: last 5 commits for the project path

### 6. DOCS-MAP.xml — full (already compact)

## Verification steps

After any snapshot change, run these checks:

```sh
# 1. Measure token count
gad snapshot --projectid get-anything-done | wc -c
# Divide by 4 for token estimate. Must be under 12,000 chars (3,000 tokens).

# 2. Verify sprint scoping works
gad snapshot --projectid get-anything-done --sprint
# Should show only current sprint phases, not all 17.

# 3. Verify done phases are collapsed
gad snapshot --projectid get-anything-done | grep -c "<goal>"
# Should be much less than total phase count — only active/planned phases have goals.

# 4. Verify no completed tasks appear
gad snapshot --projectid get-anything-done | grep 'status="done"' | wc -l
# Should be 0 in task-registry section.

# 5. Verify file refs present
gad snapshot --projectid get-anything-done | grep "File refs"
# Should show a section with recent file paths.

# 6. Run parser tests
node vendor/get-anything-done/tests/parser-coverage.test.cjs
# All 46+ tests must pass.

# 7. Compare with full dump
FULL=$(gad snapshot --projectid get-anything-done --full | wc -c)
SPRINT=$(gad snapshot --projectid get-anything-done --sprint | wc -c)
echo "Full: $FULL chars, Sprint: $SPRINT chars, Reduction: $(( (FULL - SPRINT) * 100 / FULL ))%"
# Reduction should be >60%.
```

## Snapshot flags after optimization

| Flag | Behavior |
|------|----------|
| `--projectid <id>` | Scope to one project (required) |
| `--sprint` | Sprint-scoped output (default after optimization) |
| `--full` | Full dump like current behavior (for debugging/evals) |
| `--json` | JSON output |

## What to check in RepoPlanner for parity

Read `vendor/repo-planner/scripts/loop-cli.mjs`:
- `getSprintPhaseIds()` — how sprint boundaries are calculated
- `context sprint` command — what paths and summary it returns
- Sprint config: `sprintSize` in config, default 5

GAD sprint model should match RP's concept but use XML planning files instead of MD.

## Definition of done

1. `gad snapshot --projectid get-anything-done` fits under 3,000 tokens
2. Sprint scoping works: only current sprint phases inlined
3. Done phases collapsed to one-liners
4. Only open tasks shown
5. File refs included from git log and task registry
6. `--full` flag preserves current behavior for comparison
7. cli-efficiency eval v7 scores >= v6 composite (0.976)
8. `docs/context-budget.md` updated with new numbers
