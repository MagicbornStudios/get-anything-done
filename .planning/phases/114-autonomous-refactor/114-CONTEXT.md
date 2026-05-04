# Phase 114: Autonomous refactor pass — merge-conflict + race-condition reduction

## Goal

Identify and refactor the top merge-conflict and race-condition hotspots in the GAD framework via heuristic analysis (large file + multi-agent edit history + multi-concern exports), then sequence the refactor splits to avoid introducing new conflicts.

## Tasks (registered 114-01..114-07)

| Task ID | Title | Status |
|---|---|---|
| 114-01 | Implement hotspot audit script (.gad-log analysis) | pending |
| 114-02 | Split handoffs.cjs into three modules | pending |
| 114-03 | Split worker-loop.cjs into five modules | pending |
| 114-04 | Extract handoffs command family to bin/commands/handoffs.cjs | pending |
| 114-05 | Add lock-wrapper for state-file writes | pending |
| 114-06 | Update CLAUDE.md with Extracted Module Pattern section | pending |
| 114-07 | Add pre/post conflict-rate measurement | pending |

## Context

The GAD framework has several large, multi-concern files that multiple agents edit concurrently, creating merge conflicts and race conditions. This phase drafts the refactor plan (no implementation) to split these files into single-concern modules.

### Key files analyzed

| File | LOC | Concerns | Multi-agent risk |
|---|---|---|---|
| `lib/handoffs.cjs` | 601 | frontmatter, lifecycle, self-resume | HIGH — multiple agents claim/complete handoffs |
| `lib/team/worker-loop.cjs` | 289 | heartbeat, mailbox, claim, prompt, subprocess, rate-limit | HIGH — team workers run in parallel |
| `bin/gad.cjs` | 433 | CLI commands (monolith being broken up) | MEDIUM — sweep E extractions in progress |
| `.planning/STATE.xml` | varies | state-log, next-action | HIGH — handled via phase 109 |
| `.planning/.gad-log/*.jsonl` | 10-20MB | Telemetry logs | LOW — append-only |

### Hotspot identification heuristic

1. **Large file** (>250 LOC)
2. **Multi-concern exports** (object with 5+ disparate functions)
3. **Multi-agent edit history** (referenced in recent parallel-agent commits bc8dd354, dfc6fbcf)

### Top hotspots (draft)

1. **`lib/handoffs.cjs`** — 601 LOC, 10 exported functions across 3 concerns:
   - Bucket/frontmatter utilities (parseFrontmatter, stringifyFrontmatter)
   - Handoff lifecycle (list, read, claim, complete, unclaim, create)
   - Self-resume helpers (createSelfResumeHandoff, findSelfResumeHandoffs)

2. **`lib/team/worker-loop.cjs`** — 289 LOC, single large function `runWorker` + helpers:
   - Heartbeat management
   - Mailbox polling
   - Handoff claiming
   - Prompt composition
   - Subprocess execution
   - Rate-limit handling

3. **`bin/gad.cjs`** — 433 LOC (post-sweep E), still contains:
   - Main CLI dispatch
   - Multiple inline `defineCommand` blocks
   - Sweep E extractions pending (state, note, todos already extracted)

4. **State files** (multi-writer surfaces):
   - `STATE.xml` next-action (phase 109 handled)
   - `TASK-REGISTRY.xml` (legacy, being replaced by per-task JSON)
   - `.planning/handoffs/*/` directories (properly bucketed, low risk)
   - `.planning/.gad-log/*.jsonl` (append-only, low risk)

## Refactor sequence (conflict-avoidance ordering)

To avoid refactor conflicts, sequence splits from least-likely-to-be-edited to most-actively-edited:

1. **`bin/gad.cjs` sweep-E extractions** (if any remain) — low churn
2. **`lib/handoffs.cjs` split** — medium churn, but clean boundary
3. **`lib/team/worker-loop.cjs` split** — high churn, do last
4. **State-file race-surface audit** — documentation only

## Regression strategy

Each split must include:
- Unit tests for new modules
- Integration smoke test (`node --test tests/<area>.test.cjs`)
- CLI smoke (`node bin/gad.cjs <family> --help`)
- `gad snapshot` verification (no state corruption)
