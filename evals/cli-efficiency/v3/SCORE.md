# Score v3 — cli-efficiency

**Method:** per DEFINITIONS.md formulas. All arithmetic shown in RUN.md.

## Component scores

| Metric | v1 | v2 | v3 | Target |
|--------|----|----|-----|--------|
| token_reduction | 0.966 | 0.953 | **0.915** | ≥ 0.90 ✅ |
| context_completeness | 0.55 | 0.95 | **0.85** | ≥ 0.95 ⚠️ |
| information_loss (1 - loss_rate) | 0.00 | 0.90 | **1.00** | = 1.00 ✅ |

## Composite score

```
v3 = (0.915 × 0.40) + (0.850 × 0.35) + (1.000 × 0.25)
   = 0.366 + 0.298 + 0.250
   = 0.914
```

| Version | Composite | Method |
|---------|-----------|--------|
| v1 | 0.579 | byte counts, incomplete parsers |
| v2 | 0.884 | byte counts, fixed parsers |
| v3 | **0.914** | token counts, content-present, scientific formulas |

## Why completeness dropped from v2 (0.95) to v3 (0.85)

v2 used a rough "units present/absent" count without fidelity scoring. v3 applies the
fidelity levels from DEFINITIONS.md (Full / Truncated / Approximated / Absent). Three units
are now scored at 0.5 rather than 1.0:

- U6 (task goals): truncated to 60 chars → Truncated → 0.5
- U7 (phase goals): truncated to ~60 chars → Truncated → 0.5
- U8 (last activity): count string not ISO date → Approximated → 0.5

These were counted as "present" in v2 — they are present, but at reduced fidelity.
The v3 score is more honest.

## Why token_reduction dropped from v2 (0.953) to v3 (0.915)

Two causes:
1. `gad state` grew: full next-action (496 chars) replaces truncated (120 chars) — correct tradeoff
2. `gad phases` grew: repo-planner registered as second project adds 7 more phase rows

Both are correct behavior. Reduction of 91.5% remains well above the 0.90 target.

## Zero information loss (first time)

v3 is the first run with zero Absent units. All 10 information units are present at some
fidelity level. The agent simulation (in RUN.md) confirms: given only CLI output, the agent
makes the same next-action decision as with full raw file reads.

## Path to v4 targets (completeness ≥ 0.95)

Requires bringing U6, U7, U8 from Truncated/Approximated to Full:

| Fix | Impact on completeness |
|-----|----------------------|
| Raise `gad tasks` goal to 200 chars or add `--full` | U6: +0.05 |
| Add `gad phases --full` with complete goal text | U7: +0.05 |
| Write `updated` ISO date to STATE.xml on session writes | U8: +0.05 |

Projected v4 composite: (0.915 × 0.40) + (0.95 × 0.35) + (1.00 × 0.25) = 0.366 + 0.333 + 0.250 = **0.949**
