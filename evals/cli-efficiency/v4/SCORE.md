# Score v4 — cli-efficiency

**Method:** per DEFINITIONS.md formulas. All arithmetic in RUN.md.

## Component scores

| Metric | v3 | v4 | Target |
|--------|----|----|--------|
| token_reduction | 0.915 | **0.887** | ≥ 0.90 ⚠️ |
| context_completeness | 0.850 | **0.900** | ≥ 0.95 ⚠️ |
| information_loss (1 - loss_rate) | 1.000 | **1.000** | = 1.00 ✅ |

## Composite score

```
v4 = (0.887 × 0.40) + (0.900 × 0.35) + (1.000 × 0.25)
   = 0.355 + 0.315 + 0.250
   = 0.920
```

| Version | Composite | Key change |
|---------|-----------|------------|
| v1 | 0.579 | byte counts, incomplete parsers |
| v2 | 0.884 | byte counts, fixed parsers |
| v3 | 0.914 | token counts, scientific format |
| v4 | **0.920** | U6 Full (200 char goals), grime-time added as 3rd project |

## What improved

**U6 (in-progress task IDs + goals): Truncated → Full**

v3 truncated task goals at 60 chars — dependency notes and implementation scope were cut off. v4 raises the limit to 200 chars. Full goal text now fits within 200 chars for all current tasks. `gad tasks --full` removes the limit entirely for edge cases.

## Why token_reduction dropped (0.915 → 0.887)

grime-time registered as a 3rd project. `gad phases --json` now returns 30 phases (was 12 in v3). `gad state --json` covers 3 projects. CLI output grew from 1,358 to 2,093 tokens. The baseline also grew (grime-time raw files add ~2,519 tokens), but CLI growth outpaced baseline growth because phase titles inflate the phases output even though they carry limited new information.

This is a structural cost of multi-project scope. token_reduction falls below the 0.90 target but remains 88.7% — still strong.

## Why completeness didn't reach 0.95

Two units remain at partial fidelity:

| Fix needed | Unit | Current → Target | Blocker |
|------------|------|-----------------|---------|
| `gad phases --json` include full goal text | U7 | Truncated → Full | `--full` flag outputs human blocks, not JSON-compatible |
| state-reader.cjs read `<last-updated>` from STATE.xml | U8 | Approx → Full | `touchStateXml()` writes the tag but reader ignores it |

Projected v5 after both fixes:
```
completeness = (10 + 0) / 10 = 1.00
v5 = (0.887 × 0.40) + (1.00 × 0.35) + (1.00 × 0.25) = 0.355 + 0.350 + 0.250 = 0.955
```

## Path to v5 (composite ≥ 0.95)

1. `gad phases --json` — add `goal` field (full text, no truncation) to each row
2. `state-reader.cjs` — read `<last-updated>` XML tag and surface as ISO date in `lastActivity`
3. Rerun eval — projected 0.955
