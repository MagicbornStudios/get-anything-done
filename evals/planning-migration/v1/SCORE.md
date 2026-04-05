# Score v1 — planning-migration

**Method:** per gad.json weights × component scores from RUN.md.

## Component scores

| Metric | Weight | Score | Evidence |
|--------|--------|-------|----------|
| format_compliance | 0.30 | **1.00** | All 3 projects: all .planning/ files parseable, correct format |
| lossless_roundtrip | 0.35 | **1.00** | 81/81 decisions, 18/18 phases, 120/120 tasks preserved exactly |
| trace_coverage | 0.20 | **1.00** | All 14 file touches accounted for in RUN.md |
| sink_alignment | 0.15 | **0.85** | grime-time=4/4 ok; global/repo-planner stale=by design (human-authored) |

## Composite score

```
v1 = (1.00 × 0.30) + (1.00 × 0.35) + (1.00 × 0.20) + (0.85 × 0.15)
   = 0.300 + 0.350 + 0.200 + 0.128
   = 0.978
```

## Summary

First migration run. grime-time sink created from scratch (6 MDX files). Human-authored global/repo-planner sink files correctly preserved — safe-overwrite logic works. The 0.85 on sink_alignment reflects the 4 intentionally-stale human-authored files in global/repo-planner, not a migration failure.

## Path to 1.0 sink_alignment

Run `gad sink compile` on global/repo-planner after deciding whether to adopt generated MDX or keep human-authored. If human-authored stays canonical, update sink status logic to mark those as `authoritative: human` and skip them in the stale count.
