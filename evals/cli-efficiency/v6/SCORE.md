# Score v6 — cli-efficiency

**Method:** per DEFINITIONS.md formulas. All arithmetic in RUN.md.

## Component scores

| Metric | v4 | v5 | v6 | Target |
|--------|----|----|-----|--------|
| token_reduction | 0.887 | 0.874 | **0.940** | ≥ 0.90 ✅ |
| context_completeness | 0.900 | 1.000 | **1.000** | ≥ 0.95 ✅ |
| information_loss (1 − loss) | 1.000 | 1.000 | **1.000** | = 1.00 ✅ |

## Composite score

```
v6 = (0.940 × 0.40) + (1.000 × 0.35) + (1.000 × 0.25)
   = 0.376 + 0.350 + 0.250
   = 0.976
```

| Version | Composite | Key improvement |
|---------|-----------|-----------------|
| v1 | 0.579 | baseline |
| v2 | 0.884 | fixed parsers |
| v3 | 0.914 | token counts, scientific format |
| v4 | 0.920 | U6 Full (200-char task goals) |
| v5 | 0.950 | U7 Full (active phase goals), U8 Full (ISO date) |
| v6 | **0.976** | session-scoped state+phases by default |

## All three targets met

token_reduction: **0.940** (target ≥ 0.90) ✅
context_completeness: **1.000** (target ≥ 0.95) ✅
information_loss: **0.000** (target = 0) ✅

Composite **0.976** — highest ever. First eval where all three metrics simultaneously hit target.

## Why token_reduction recovered

v5 token_reduction dropped to 0.874 because three projects (global, repo-planner, grime-time)
all appeared in `gad state` and `gad phases` output, tripling CLI tokens to 2,341.

v6 fixes this: when a session is active, state and phases default to the session project only.
CLI tokens drop from 2,341 to 1,104 — a 53% reduction vs v5, even though completeness holds at 1.000.

The multi-project baseline (18,495 tokens) is unchanged. Only CLI output narrowed.

## Token trend

| Version | CLI tokens | Baseline | Reduction |
|---------|-----------|----------|-----------|
| v2 | 1,480 | 14,622 | 0.899 |
| v3 | 1,358 | 15,976 | 0.915 |
| v4 | 2,093 | 18,495 | 0.887 |
| v5 | 2,341 | 18,495 | 0.874 |
| v6 | **1,104** | 18,495 | **0.940** |
