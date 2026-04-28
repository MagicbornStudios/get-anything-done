# optimize-snapshot-token-budget — workflow

`gad snapshot` is the canonical orientation surface for every cold agent.
Phase 16 cut its token cost from ~9,750 → ~3,000 against the same
project (3.25x). This workflow is the repeatable cut-list.

## When to use

- `gad snapshot --projectid <id>` is exceeding the sprint context budget
  (target: under 5k tokens for an active project).
- Adding a new section to the snapshot bundle (regression risk: token
  bloat).
- An eval run is reporting that the bootstrap snapshot consumes >10% of
  the run's total context budget.

## When NOT to use

- One-off snapshot UX issues (spacing, headings) — those are
  presentation, not budget.
- `gad startup` orientation — startup is supposed to be fuller. Touch
  snapshot only.

## Steps

1. Establish baseline. From the project's repo root:
   ```sh
   gad snapshot --projectid <id> | wc -c
   gad snapshot --projectid <id> --json | jq '.tokens // empty'
   ```
   Record the byte count and any internal token estimate. This is the
   number to beat.
2. Identify the heaviest sections. Common offenders:
   - Per-task body text for completed tasks (collapse to id|title|done).
   - Decision rationale paragraphs for old decisions (drop after N).
   - Phase goal text for done phases (id|title only).
   - Roadmap phases outside the active sprint (cite count, not detail).
3. Apply the four canonical cuts:
   - **Sprint scope** — only inline phases inside the current sprint
     window (default 5 per `gad sprint show`); reference older phases by
     id+title only.
   - **Drop cancelled** — never include cancelled tasks/decisions/phases
     in the snapshot at all.
   - **Entity decode** — replace verbose phase/task/decision objects with
     short reference encodings (`#42-3 done` instead of full prose).
   - **Active-only tasks** — completed task history is archaeology; only
     show planned + in-progress.
4. Add file refs for active tasks (per task 16-04). For each in-progress
   task, include code/doc files touched (from `git log` scoped to the
   project path). Add the last 5-10 commits for the project. Cheap
   tokens, high context value.
5. Re-measure. Aim for at least 30% reduction without hiding planned
   work. If a cut hides a real signal, revert and try a different one.
6. Run a discoverability eval to confirm the trimmed snapshot still lets
   a cold agent answer "what's the next task?" in one tool call.
7. Document the new baseline in `docs/context-budget.md` (or equivalent)
   so the next regression has a target to undershoot.

## Guardrails

- Never silently drop blocked or stalled work — those are the highest-value
  signals in the snapshot. Cuts apply to history (done, cancelled), not
  active state.
- Keep the JSON shape stable across cuts — downstream tooling (planning-app,
  TUI panels) parses it.
- Track the cut decisions in `gad decisions add` — future agents need to
  know "field X was dropped intentionally" before they re-add it.

## Failure modes

- **Cut breaks `gad query <id>` or graph reads.** Snapshot is read-only;
  if a downstream consumer breaks, the cut leaked into the wrong layer.
  Snapshot reads should never mutate the planning store.
- **Token measurement uses `wc -c` only.** Bytes are a proxy. Confirm
  against a real tokenizer (e.g. a sample with known token count) before
  declaring victory.
- **Sprint scope hides a planned task that genuinely needs attention.**
  The fix is to bump that task's phase into the active sprint via
  `gad insert-phase` or `gad phases add`, not to widen the snapshot.

## Reference

- `gad snapshot-optimize` — installed skill that automates parts of this
  loop.
- `gad-snapshot-optimize` — same skill, gad-prefixed alias.
- Memory: `feedback_snapshot_token_cuts.md` — the four canonical cuts.
- Decisions gad-188, gad-195 (post-compact behavior depends on snapshot
  brevity).
