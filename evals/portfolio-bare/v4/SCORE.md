# Eval Score — portfolio-bare v4

## Run info

| Field | Value |
|-------|-------|
| Project | portfolio-bare |
| Version | v4 |
| Date | 2026-04-07 |
| GAD version | 1.32.0 |
| Eval type | implementation |
| Context mode | fresh |
| Trace source | agent-reported |
| Baseline | v3 |

## Timing

| Metric | Value |
|--------|-------|
| Duration | 12 min |
| Phases completed | 5 |
| Tasks completed | 12 |

## Token usage

| Metric | Value |
|--------|-------|
| Total tokens | 78,550 |
| Tool uses | 119 |
| Tokens per task | 6,546 |

## Git discipline

| Metric | Value |
|--------|-------|
| Total commits | 19 |
| Task-ID commits | 12 |
| Batch commits | 0 |
| Source files created | 15 |
| State updates | 12 |
| Decisions captured | 3 |
| **Per-task discipline** | **1.000** |

## Planning quality

| Metric | Value |
|--------|-------|
| Phases planned | 5 |
| Tasks planned | 13 |
| Tasks completed | 13 |
| Tasks blocked | 0 |
| State stale count | 0 |
| **Planning score** | **1.000** |

## Skill accuracy

| Skill | When | Triggered |
|-------|------|-----------|
| /gad:plan-phase | before implementation | ✓ |
| /gad:execute-phase | per phase | ✓ |
| /gad:task-checkpoint | between tasks | ✓ |
| /gad:auto-conventions | after first code phase | ✓ |
| /gad:verify-work | after phase completion | ✓ |
| /gad:check-todos | session start | ✓ |
| decisions-captured | during implementation | ✓ |
| multi-phase-planning | before execution | ✓ |
| phase-completion | during execution | ✓ |
| task-lifecycle | per task | ✓ |

| **Skill accuracy** | **100.0%** |

## Composite scores

| Dimension | Weight | Score |
|-----------|--------|-------|
| Planning quality | 0.30 | 1.000 |
| Per-task discipline | 0.25 | 1.000 |
| Skill accuracy | 0.25 | 1.000 |
| Time efficiency | 0.20 | 0.975 |

### **Composite: 0.994**

## vs Baseline (v3)

| Metric | v3 | v4 | Delta |
|--------|------|------|-------|
| Composite | 0.944 | 0.994 | +0.050 |
| Discipline | 1.000 | 1.000 | +0.000 |
| Planning | 1.000 | 1.000 | +0.000 |
| Skill accuracy | 80.0% | 100.0% | +0.200 |
| Duration | 24 min | 12 min | -12.000 min |
| Tokens | 90,181 | 78,550 | -11631.000 |
| Tasks | 12 | 13 | — |
