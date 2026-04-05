# Requirements: CLI Efficiency Eval

See `../DEFINITIONS.md` for all term definitions, formulas, and fidelity levels.

## Goal

Quantify token savings from using `gad` CLI for coding agent context loading, identify
information gaps, and produce actionable improvements to the CLI.

This eval answers: **given only CLI output, can an agent resume work as effectively as if
it had read all the raw planning files?**

---

## Workflows

### Workflow A — CLI (what the agent gets with gad)

Run these commands in order. Record full verbatim output:

```sh
gad session list --json        # active sessions
gad context --session <id> --json  # file refs for current position
gad state --json               # phase, milestone, status, open tasks, next action
gad phases --json              # roadmap: all phases with done/active/planned
gad tasks --json --status in-progress  # in-flight tasks with goals
```

### Workflow B — Raw (what the agent reads without gad)

Read these files in the order an agent would. Record full file content (or full content +
byte/token counts for files >5,000 bytes):

1. `AGENTS.md` — agent conventions, loop, build commands
2. `.planning/AGENTS.md` — planning layer conventions, trigger phrases, done gate
3. `.planning/STATE.xml` — current phase, next action, references list
4. `.planning/ROADMAP.xml` — phase goals and statuses
5. `.planning/TASK-REGISTRY.xml` — all tasks; grep for `status="in-progress"`
6. `.planning/session.md` or `.planning/sessions/*.json` — in-flight session state

---

## Information units to track

Per `../DEFINITIONS.md`, units U1–U10 are session-variable and must be present in CLI output.
Units U11–U12 are static and are exempt from CLI coverage requirements.

| Unit | Required in CLI? | Target fidelity |
|------|-----------------|-----------------|
| U1 current phase | ✅ | Full |
| U2 milestone | ✅ | Full |
| U3 status | ✅ | Full |
| U4 open task count | ✅ | Full |
| U5 next action | ✅ | Full (no truncation) |
| U6 in-progress tasks + goals | ✅ | Full |
| U7 phase history | ✅ | Full (titles may truncate; status must be exact) |
| U8 last activity | ✅ | Full if available; Approximated acceptable |
| U9 session ID + phase | ✅ | Full |
| U10 file refs | ✅ | Referenced (not inlined — that is correct behavior) |
| U11 agent loop | ❌ exempt | Static; read once from AGENTS.md |
| U12 build commands | ❌ exempt | Static; read once from AGENTS.md |

---

## What each RUN.md must contain

1. **Workflow A** — verbatim output of all 5 commands (no summaries, actual text)
2. **Workflow B** — full content of STATE.xml, ROADMAP.xml, and TASK-REGISTRY.xml in-progress excerpt; byte + token counts for AGENTS.md files (too large to inline fully, but note what they contain)
3. **Unit fidelity table** — every U1–U10 scored against fidelity levels from DEFINITIONS.md
4. **Token counts** — `tokens = chars / 4` applied to each source; show arithmetic
5. **Residual content analysis** — what's in raw files that's not in CLI, and whether that's intentional
6. **Agent simulation** — given only Workflow A output, state exactly what the agent would do next; compare to Workflow B
7. **Formulas applied** — token_reduction, completeness, loss (show the numbers)

---

## Scoring

Weights from `gad.json`:
- token_reduction: 0.40
- context_completeness: 0.35
- information_loss: 0.25

### Success criteria

- token_reduction >= 0.90
- context_completeness >= 0.95
- information_loss_count = 0 (no unit at Absent fidelity)
- next-action returned at Full fidelity (no truncation)
- Agent simulation produces identical next action from Workflow A vs Workflow B

---

## Known gaps carried into v3

From v2 SCORE.md:
1. `last_activity` — returns a count string ("N tasks done"), not an ISO date; fidelity = Approximated
2. `gad context` refs list is 4 files but STATE.xml `<references>` has 22 — some of those 22 are stale/irrelevant; needs audit
3. No `gad state --full` token count recorded — v3 must include this
