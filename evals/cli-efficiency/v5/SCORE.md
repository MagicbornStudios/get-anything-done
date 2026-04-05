# Score v5 — cli-efficiency

**Method:** per DEFINITIONS.md formulas. All arithmetic in RUN.md.

## Component scores

| Metric | v3 | v4 | v5 | Target |
|--------|----|----|-----|--------|
| token_reduction | 0.915 | 0.887 | **0.874** | ≥ 0.90 ⚠️ |
| context_completeness | 0.850 | 0.900 | **1.000** | ≥ 0.95 ✅ |
| information_loss (1 − loss) | 1.000 | 1.000 | **1.000** | = 1.00 ✅ |

## Composite score

```
v5 = (0.874 × 0.40) + (1.000 × 0.35) + (1.000 × 0.25)
   = 0.350 + 0.350 + 0.250
   = 0.950
```

| Version | Composite | Key improvement |
|---------|-----------|-----------------|
| v1 | 0.579 | baseline |
| v2 | 0.884 | fixed parsers |
| v3 | 0.914 | token counts, scientific format |
| v4 | 0.920 | U6 Full (200-char task goals) |
| v5 | **0.950** | U7 Full (active phase goals in JSON), U8 Full (ISO date from STATE.xml) |

## Completeness milestone: 1.000 for the first time

All 10 session-variable information units (U1–U10) are at Full or Referenced fidelity.
Zero units absent. Zero truncated. Zero approximated.

An agent running only Workflow A commands can make the same next-action decision as one
reading all raw planning files — context loss is zero.

## Why token_reduction is below 0.90

Three projects are now registered (global, repo-planner, grime-time). `gad state` and
`gad phases` cover all three. The CLI token count (2,341) is 72% higher than v3 (1,358)
because scope tripled. The baseline grew too (v3: 15,976 → v5: 18,495) but proportionally
less, because AGENTS.md is shared overhead that doesn't triple.

Per-project token reduction remains high. The aggregate 0.874 is a multi-project cost,
not a CLI efficiency regression.

## Path to token_reduction ≥ 0.90

Option A: scope `gad state` and `gad phases` to a single project by default when a session
is active. The session already knows the project — no flag needed. Would drop CLI tokens
to ~1,300, pushing token_reduction above 0.92.

Option B: accept 0.874 as the correct multi-project number and raise the target to ≥ 0.85.
The reduction is still strong. The completeness win (1.000) is more valuable.

Recommended: implement Option A (session-scoped default) in v6.
