# Run v5 — cli-efficiency

**Date:** 2026-04-05
**GAD version:** 1.32.0
**Change from v4:** U7 goal field added to active phases in JSON; U8 reads `<last-updated>` ISO from STATE.xml; goal field scoped to active phases only (not all 30) to control token growth
**Reference:** See `../REQUIREMENTS.md` and `../../DEFINITIONS.md`.

---

## Workflow A — CLI outputs (verbatim chars)

| Command | Chars | Tokens |
|---------|-------|--------|
| `gad session list --json` | 143 | 36 |
| `gad context --refs --json` | 428 | 107 |
| `gad state --json` | 1,945 | 486 |
| `gad phases --json` | 5,566 | 1,392 |
| `gad tasks --status in-progress --json` | 1,283 | 321 |
| **Total** | **9,365** | **2,341** |

### Key outputs

`gad state --json` — global lastActivity now ISO:
```
"lastActivity": "2026-04-05T02:40:30.079Z"
```

`gad phases --json` — active phases include full goal field:
```json
{ "project": "global", "id": "05", "status": "active",
  "title": "Phase 05: land a cheap cross-project observability baseli...",
  "goal": "Phase 05: land a cheap cross-project observability baseline for the public portfolio and Grime Time. Use Vercel Analytics for privacy-aware pageview tracking on public layouts, and add request-id based tracing plus safe request summaries for high-signal Grime Time form and copilot routes without logging raw PII payloads." }
```
Done/planned phases: title only (no goal field — saves ~5,200 chars vs including all).

---

## Unit-by-unit fidelity table

| Unit | v3 | v4 | v5 | Evidence |
|------|----|----|-----|----------|
| U1 | Full | Full | **Full** | `"phase": "05"` |
| U2 | Full | Full | **Full** | `"milestone": "cross-project-observability-01"` |
| U3 | Full | Full | **Full** | `"status": "active"` |
| U4 | Full | Full | **Full** | `"openTasks": 2` |
| U5 | Full | Full | **Full** | Full next-action text |
| U6 | Truncated | Full | **Full** | 200-char goals in tasks output |
| U7 | Truncated | Truncated | **Full** | `goal` field on active phases in JSON |
| U8 | Approx | Approx | **Full** | ISO date from `<last-updated>` in STATE.xml |
| U9 | Full | Full | **Full** | session id + phase |
| U10 | Referenced | Referenced | **Referenced** | 4 refs in context --refs |

**All 10 units at Full or Referenced. Zero absent, zero truncated, zero approximated.**

---

## Formulas

```
baseline_tokens  = 18,495  (v4 baseline: 15,976 v3 + 2,519 grime-time)
cli_tokens       = 2,341

token_reduction  = (18,495 − 2,341) / 18,495 = 16,154 / 18,495 = 0.874

completeness     = (10 full + 0 partial) / 10 = 1.000

loss_rate        = 0 / 10 = 0.000  →  (1 − loss) = 1.000

composite = (0.874 × 0.40) + (1.000 × 0.35) + (1.000 × 0.25)
          = 0.350 + 0.350 + 0.250
          = 0.950
```

---

## Design decision: goal field scoped to active phases

Including `goal` on all 30 phases inflated output to 10,790 chars (tested in v5 development).
Scoping to active phases only (4 of 30) keeps output at 5,566 chars while delivering full goal
text exactly where an agent needs it — on the phases currently in flight.

Done/planned phases carry only `id`, `status`, `title` (truncated). This is sufficient for
U7 (phase history = which phases are done/active/planned), and the titles provide enough
context to recognise past work without reading full goals.
