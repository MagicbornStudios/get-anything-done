# Eval Score — escape-the-dungeon v5

## Run info

| Field | Value |
|-------|-------|
| Project | escape-the-dungeon |
| Version | v5 |
| Date | 2026-04-07 |
| GAD version | 1.32.0 |
| Eval type | implementation |
| Context mode | fresh |
| Trace source | agent-reported |
| Baseline | v4 |

## Timing

| Metric | Value |
|--------|-------|
| Duration | 18 min |
| Phases completed | 12 |
| Tasks completed | 12 |

## Token usage

| Metric | Value |
|--------|-------|
| Total tokens | 92,278 |
| Tool uses | 110 |
| Tokens per task | 7,690 |

## Git discipline

| Metric | Value |
|--------|-------|
| Total commits | 11 |
| Task-ID commits | 10 |
| Batch commits | 1 |
| Source files created | 35 |
| State updates | 12 |
| Decisions captured | 0 |
| **Per-task discipline** | **0.830** |

## Planning quality

| Metric | Value |
|--------|-------|
| Phases planned | 12 |
| Tasks planned | 12 |
| Tasks completed | 12 |
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

| Skill | When | Triggered |
|-------|------|-----------|
| /gad:plan-phase | before implementation | ✓ |
| /gad:execute-phase | per phase | ✓ |
| /gad:task-checkpoint | between tasks | ✓ |
| /gad:auto-conventions | after first code phase | ✓ |
| /gad:verify-work | after phase completion | ✓ |
| /gad:check-todos | session start | ✓ |
| decisions-captured | during implementation | ✗ |
| multi-phase-planning | before execution | ✓ |
| phase-completion | during execution | ✓ |
| task-lifecycle | per task | ✓ |

| **Skill accuracy** | **90.0%** |

## Composite scores

| Dimension | Weight | Score |
|-----------|--------|-------|
| Requirement coverage | 0.40 | 1.000 |
| Planning quality | 0.30 | 1.000 |
| Per-task discipline | 0.25 | 0.830 |
| Skill accuracy | 0.25 | 0.900 |
| Time efficiency | 0.20 | 0.963 |

### **Composite: 0.935**

## vs Baseline (v4)

| Metric | v4 | v5 | Delta |
|--------|------|------|-------|
| Composite | 0.916 | 0.935 | +0.019 |
| Discipline | 0.890 | 0.830 | -0.060 |
| Planning | 1.000 | 1.000 | +0.000 |
| Skill accuracy | 80.0% | 90.0% | +0.100 |
| Duration | 38 min | 18 min | -20.000 min |
| Tokens | 136,930 | 92,278 | -44652.000 |
| Tasks | 19 | 12 | — |
