# Run v6 — cli-efficiency

**Date:** 2026-04-05
**GAD version:** 1.33.0
**Change from v5:** `gad state` and `gad phases` now default to the session project when an active session exists. No flag needed — `getActiveSessionProjectId()` reads the most-recent non-closed session from `.planning/sessions/`. Session project = global. Output drops from 3 projects to 1.
**Reference:** See `../REQUIREMENTS.md` and `../../DEFINITIONS.md`.

---

## Workflow A — CLI outputs (verbatim chars)

| Command | Chars | Tokens |
|---------|-------|--------|
| `gad session list --json` | 143 | 36 |
| `gad context --refs --json` | 428 | 107 |
| `gad state --json` | 892 | 223 |
| `gad phases --json` | 1,671 | 418 |
| `gad tasks --status in-progress --json` | 1,283 | 321 |
| **Total** | **4,417** | **1,104** |

### Key outputs

`gad state --json` — session-scoped, global only:
```json
[
  {
    "project": "global",
    "phase": "05",
    "milestone": "cross-project-observability-01",
    "status": "active",
    "openTasks": 2,
    "lastActivity": "2026-04-05T02:40:30.079Z",
    "nextAction": "Execute `05-01`..."
  }
]
```

`gad phases --json` — global only (6 active phases get goal field, done/planned get title only):
```json
{ "project": "global", "id": "05", "status": "active",
  "title": "Phase 05: land a cheap cross-project observability baseli...",
  "goal": "Phase 05: land a cheap cross-project observability baseline..." }
```

Override: `gad state --projectid grime-time --json` still works — explicit flag bypasses session scope.

---

## Unit-by-unit fidelity table

| Unit | v4 | v5 | v6 | Evidence |
|------|----|----|-----|----------|
| U1 | Full | Full | **Full** | `"phase": "05"` |
| U2 | Full | Full | **Full** | `"milestone": "cross-project-observability-01"` |
| U3 | Full | Full | **Full** | `"status": "active"` |
| U4 | Full | Full | **Full** | `"openTasks": 2` |
| U5 | Full | Full | **Full** | Full next-action text |
| U6 | Full | Full | **Full** | 200-char goals in tasks output |
| U7 | Truncated | Full | **Full** | `goal` field on active phases in JSON |
| U8 | Approx | Full | **Full** | ISO date from `<last-updated>` in STATE.xml |
| U9 | Full | Full | **Full** | session id + phase |
| U10 | Referenced | Referenced | **Referenced** | 4 refs in context --refs |

**All 10 units at Full or Referenced. Zero absent, zero truncated, zero approximated.**

---

## Formulas

```
baseline_tokens  = 18,495  (same as v5)
cli_tokens       = 1,104

token_reduction  = (18,495 − 1,104) / 18,495 = 17,391 / 18,495 = 0.940

completeness     = (10 full + 0 partial) / 10 = 1.000

loss_rate        = 0 / 10 = 0.000  →  (1 − loss) = 1.000

composite = (0.940 × 0.40) + (1.000 × 0.35) + (1.000 × 0.25)
          = 0.376 + 0.350 + 0.250
          = 0.976
```

---

## Design decision: session-scoped default, explicit override preserved

`gad state` and `gad phases` now read the most-recent non-closed session and use its `projectId`
as the default scope. An agent working in a session naturally sees only its project — no extra
flag required. Multi-project output is still available via `--projectid ""` or no active session.

Token drop: 2,341 → 1,104 (53% reduction from v5). The three-project penalty from v5 is gone.
