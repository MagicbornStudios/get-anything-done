# Run v2 — cli-efficiency

**Date:** 2026-04-04  
**GAD version:** 1.32.0  
**Status:** completed  
**Fixes applied since v1:** session close/resume positional arg, XML state parser, XML roadmap status parser, task-registry reader, TTY detection

## Measurements

### CLI output bytes (Workflow A)
| Command | Bytes |
|---------|-------|
| `gad context --json` | 428 |
| `gad state --json` | 348 |
| `gad phases --json` | 749 |
| `gad tasks --json --status in-progress` | 355 |
| `gad session list --json` | 143 |
| **Total** | **2,023** |

### Raw file bytes (Workflow B)
| File | Bytes |
|------|-------|
| AGENTS.md | 13,242 |
| .planning/AGENTS.md | 7,948 |
| .planning/STATE.xml | 3,333 |
| .planning/ROADMAP.xml | 2,869 |
| .planning/TASK-REGISTRY.xml | 13,700 |
| .planning/session.md | 1,590 |
| **Total** | **42,682** |

## Information unit audit

| Unit | v1 | v2 | Notes |
|------|----|----|-------|
| Current phase | ✅ | ✅ | phase=05 |
| Milestone | ✅ | ✅ | cross-project-observability-01 |
| Status | ✅ | ✅ | active |
| Open tasks count | ❌ | ✅ | 2 (cross-ref from TASK-REGISTRY.xml) |
| Next action text | ❌ | ✅ | truncated 120 chars from STATE.xml |
| Phase list (done/active) | ❌ | ✅ | 01:done, 04:done, 02/03/05:active |
| In-progress tasks w/ goals | ❌ | ✅ | 02-01, 03-02 with goal text |
| Agent context refs | ✅ | ✅ | gad context returns file refs |
| Session info | — | ✅ | gad session list |
| Last activity (date) | ❌ | ⚠️ | shows task count string, not ISO date |

## Scores
- token_reduction: (42,682 - 2,023) / 42,682 = **0.953** (95.3%)
- context_completeness: 9.5/10 units = **~0.95**
- information_loss_count: 1 (last_activity is approximate — no ISO date in STATE.xml)

## Remaining gaps (fix in v3)
1. `last_activity` — STATE.xml has no `updated` date attribute; need to populate it on write, or derive from task completion timestamps
2. `gad context` — `next-action` text not included in refs output; agents load it via state but could be in context directly
3. ROADMAP.xml phase statuses need maintenance discipline — phase 01 was "active" despite being closed (data quality, not code)
