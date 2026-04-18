---
id: h-2026-04-18T18-39-47-get-anything-done-63
projectid: get-anything-done
phase: 63
task_id: 60-09-followup
created_at: 2026-04-18T18:39:47.674Z
created_by: unknown
claimed_by: null
claimed_at: null
completed_at: null
priority: high
estimated_context: reasoning
runtime_preference: codex
---
# Snapshot + startup handoff surface (60-09 follow-up)

Short. Implement `.planning/notes/2026-04-18-handoff-snapshot-integration.md` verbatim.

## Before you start

1. Read `references/agent-lanes.md` — you are on **codex lane**: `bin/gad.cjs`, `bin/gad-*`, `lib/runtime-*`, `tests/runtime-*`. The snapshot render path lives in `bin/gad.cjs` / `bin/gad-snapshot.cjs` which is your lane.
2. Read `.planning/notes/2026-04-18-handoff-snapshot-integration.md` — canonical spec.
3. Read `lib/handoffs.cjs` — the listHandoffs / parseFrontmatter API already shipped in 60-09.

## Implementation

1. **Add `countHandoffs({ baseDir, bucket = 'open', projectid, runtime })`** to `lib/handoffs.cjs` — thin wrapper around `listHandoffs` that returns just the number. One-liner + test.

2. **Snapshot render path** (`bin/gad.cjs` or `bin/gad-snapshot.cjs`, wherever `-- TASKS` / `-- DECISIONS` sections are built):
   - After the TASKS section, if `countHandoffs({ bucket: 'open', projectid: resolvedProjectid }) > 0`, render:

     ```
     -- HANDOFFS (N unclaimed) ---------------------------------
       h-...-context-framework    42.4   normal  mechanical  codex
       h-...-byok-tab-keys-fetch  44.5   normal  reasoning   cursor
       h-...-snapshot-format      42.4   high    mechanical  codex
     -- end handoffs ------------------------------------------
     ```

     using the existing `render()` table utility (same call shape used for the TASKS section). Columns: id, phase, priority, context, runtime-preference. Show first 5 rows, `+N more` overflow line if longer.

   - If any row has `runtime_preference === detectedRuntime` AND that subset contains exactly one unclaimed handoff, append an auto-claim pointer on the next line:
     `Auto-claim candidate: <id> — run: gad handoffs claim <id>`

3. **`gad startup` output** — same block, placed after snapshot body.

4. **Runtime detection** — use `lib/runtime-detect.cjs` (already in your lane). Fallback to `process.env.GAD_AGENT` if that returns 'unknown'.

## Test

`tests/snapshot-handoffs-surface.test.cjs` (or extend existing snapshot test):
- Seed `.planning/handoffs/open/h-test-a.md` with `runtime_preference: codex`, and `h-test-b.md` with `runtime_preference: cursor`.
- Assert snapshot contains `-- HANDOFFS (2 unclaimed) --` block.
- Assert with `GAD_AGENT=codex`, the auto-claim pointer names `h-test-a` (single codex match).
- Assert with two codex handoffs, no auto-claim pointer (ambiguous).

## When done

`gad handoffs complete <this-handoff-id>` and file a one-line summary in `.planning/notes/` if anything diverged.