# Eval Score — reader-workspace v3

## Run info

| Field | Value |
|-------|-------|
| Project | reader-workspace |
| Version | v3 |
| Date | 2026-04-07 |
| GAD version | 1.32.0 |
| Eval type | implementation |
| Context mode | fresh |
| Trace source | agent-reported |
| Baseline | v2 |

## Timing

| Metric | Value |
|--------|-------|
| Duration | 30 min |
| Phases completed | 11 |
| Tasks completed | 35 |

## Token usage

| Metric | Value |
|--------|-------|
| Total tokens | 136,862 |
| Tool uses | 212 |
| Tokens per task | 3,910 |

## Git discipline

| Metric | Value |
|--------|-------|
| Total commits | 23 |
| Task-ID commits | 11 |
| Batch commits | 11 |
| Source files created | 40 |
| State updates | 35 |
| Decisions captured | 0 |
| **Per-task discipline** | **0.310** |

## Planning quality

| Metric | Value |
|--------|-------|
| Phases planned | 11 |
| Tasks planned | 35 |
| Tasks completed | 35 |
| Tasks blocked | 0 |
| State stale count | 0 |
| **Planning score** | **1.000** |

## Requirement coverage

| Metric | Value |
|--------|-------|
| Total criteria | 51 |
| Fully met | 51 |
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
| Per-task discipline | 0.25 | 0.310 |
| Skill accuracy | 0.25 | 0.900 |
| Time efficiency | 0.20 | 0.938 |

### **Composite: 0.816**

## vs Baseline (v2)

| Metric | v2 | v3 | Delta |
|--------|------|------|-------|
| Composite | 0.928 | 0.816 | -0.112 |
| Discipline | 0.925 | 0.310 | -0.615 |
| Planning | 1.000 | 1.000 | +0.000 |
| Skill accuracy | 80.0% | 90.0% | +0.100 |
| Duration | 40 min | 30 min | -10.000 min |
| Tokens | 152,849 | 136,862 | -15987.000 |
| Tasks | 40 | 35 | — |
