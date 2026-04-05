# Run v1 — cli-efficiency

**Date:** 2026-04-04  
**GAD version:** 1.32.0  
**Status:** baseline measurement captured, gaps catalogued

## Measurements

### CLI output bytes (Workflow A)
| Command | Bytes |
|---------|-------|
| `gad context --json` | 428 |
| `gad state --json` | 156 |
| `gad phases --json` | 751 |
| `gad tasks --json` | 21 |
| **Total** | **1,356** |

### Raw file bytes (Workflow B)
| File | Bytes |
|------|-------|
| AGENTS.md | 12,389 |
| .planning/AGENTS.md | 7,451 |
| .planning/STATE.xml | 3,333 |
| .planning/ROADMAP.xml | 2,869 |
| .planning/TASK-REGISTRY.xml | 13,700 |
| **Total** | **39,742** |

## Scores
- token_reduction: (39742 - 1356) / 39742 = **0.966** (96.6% reduction)
- context_completeness: ~0.55 (CLI missing tasks, milestone, last_activity, done phase status)
- information_loss_count: HIGH — TASK-REGISTRY.xml (13,700 bytes) has zero CLI coverage

## Known bugs (fix in next session)
1. `session close <id>` — citty positional arg `args._` not parsed; id never received
2. `gad state` — XML parser returns "—" for milestone, open_tasks, last_activity
3. `gad phases` — ROADMAP.xml all phases show "active" (done status not parsed)
4. `gad tasks` — only reads STATE.md task tables; TASK-REGISTRY.xml ignored
5. `gad context` — outputs JSON in TTY (shouldUseJson() returns true in subprocess)
6. Session position tracks phase only — no plan/task granularity
