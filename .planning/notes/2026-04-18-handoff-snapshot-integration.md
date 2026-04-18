# Handoff snapshot integration — TODO (2026-04-18)

Deferred from task 60-09 to avoid touching snapshot output concurrently with parallel-agent bin/gad.cjs writes.

## Goal

Surface unclaimed handoff count inline in `gad startup` and `gad snapshot` output:

```
-- HANDOFFS (3 unclaimed) ---------------------------------
  h-...-context-framework    42.4   normal  mechanical
  h-...-byok-tab-keys-fetch  44.5   normal  reasoning
  h-...-snapshot-format      42.4   high    mechanical
-- end handoffs ------------------------------------------
```

## Implementation sketch

1. In `lib/handoffs.cjs`, add a `countHandoffs({ baseDir, bucket })` helper (thin wrapper on `listHandoffs`).
2. In the snapshot / startup render path (search for `-- HANDOFFS` or the startup section builder), call `countHandoffs({ baseDir, bucket: 'open' })`.
3. If count > 0, render the block above using the first N rows from `listHandoffs({ baseDir, bucket: 'open' })`.
4. Use same `render()` table utility already imported in bin/gad.cjs.

## Why deferred

Codex is actively writing to `bin/gad.cjs` runtime sections. Snapshot output is deep in the same file. Safe to integrate after parallel burst settles — single-agent edit at that point.

## Filed by

claude-code, task 60-09, 2026-04-18
