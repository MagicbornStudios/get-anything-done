# Eval Score — escape-the-dungeon v4

## Run info

| Field | Value |
|-------|-------|
| Project | escape-the-dungeon |
| Version | v4 |
| Date | 2026-04-07 |
| GAD version | 1.32.0 |
| Eval type | implementation |
| Context mode | fresh |
| Trace source | agent-reported |
| Baseline | v2 |

## Timing

| Metric | Value |
|--------|-------|
| Duration | 38 min |
| Phases completed | 10 |
| Tasks completed | 19 |

## Token usage

| Metric | Value |
|--------|-------|
| Total tokens | 136,930 |
| Tool uses | 189 |
| Tokens per task | 7,207 |

## Git discipline

| Metric | Value |
|--------|-------|
| Total commits | 19 |
| Task-ID commits | 19 |
| Batch commits | 2 |
| Source files created | 20 |
| State updates | 19 |
| Decisions captured | 0 |
| **Per-task discipline** | **0.890** |

## Planning quality

| Metric | Value |
|--------|-------|
| Phases planned | 10 |
| Tasks planned | 19 |
| Tasks completed | 19 |
| Tasks blocked | 0 |
| State stale count | 0 |
| **Planning score** | **1.000** |

## Requirement coverage

| Metric | Value |
|--------|-------|
| Total criteria | 12 |
| Fully met | 12 |
| Partially met | 0 |
| Not met | 0 |
| **Coverage** | **100.0%** |

## Skill accuracy

| **Skill accuracy** | **—** |

## Composite scores

| Dimension | Weight | Score |
|-----------|--------|-------|
| Requirement coverage | 0.40 | 1.000 |
| Planning quality | 0.30 | 1.000 |
| Per-task discipline | 0.25 | 0.890 |
| Skill accuracy | 0.25 | 0.800 |
| Time efficiency | 0.20 | 0.920 |

### **Composite: 0.916**

## vs Baseline (v2)

| Metric | v2 | v4 | Delta |
|--------|------|------|-------|
| Composite | 0.285 | 0.916 | +0.631 |
| Discipline | 0.029 | 0.890 | +0.861 |
| Planning | 0.000 | 1.000 | +1.000 |
| Skill accuracy | 60.0% | 80.0% | +0.200 |
| Duration | 174 min | 38 min | -136.000 min |
| Tokens | — | 136,930 | — |
| Tasks | 34 | 19 | — |

## Notes

All 12 success criteria met. 20 source files, full content pack with 12 floors. 2 batched commits (04-02/04-03 and 03-03/03-04). Massive improvement over v2 (0.285 composite).
