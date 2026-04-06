# Context & Evaluation Definitions

This document defines the terms, formulas, and measurement methodology used across all GAD evals.
It is the scientific foundation — every eval RUN.md and SCORE.md must reference these definitions.

---

## What is "context"?

**Context** is the complete set of information an agent needs to begin work on a task without
asking the user any clarifying questions. It has two layers:

### Static context
Information that is true for the entire project and changes rarely (days to weeks):
- Agent conventions (AGENTS.md) — loop steps, file roles, verification gates
- Architecture and tech stack
- Style and copy conventions

### Dynamic context
Information that changes every session (hours to days):
- Current phase and task
- What is in-progress vs planned vs done
- Last decision made, next action queued
- Active blockers or unresolved questions
- Which specific files are relevant right now

**For context resumption after compaction, only dynamic context is needed.** Static context
can be re-read once from the AGENTS.md refs that `gad context` returns.

---

## Information units

An **information unit** is the smallest piece of context that independently affects what an
agent would do next. Information units are defined per workflow, not per file.

### Standard units for a "resume work" workflow

| Unit ID | Unit | Where it lives (raw) | CLI surface |
|---------|------|---------------------|-------------|
| `U1` | Current phase ID | STATE.xml `<current-phase>` | `gad state .phase` |
| `U2` | Current milestone / plan name | STATE.xml `<current-plan>` | `gad state .milestone` |
| `U3` | Project status (active/paused/done) | STATE.xml `<status>` | `gad state .status` |
| `U4` | Open task count | TASK-REGISTRY.xml count | `gad state .openTasks` |
| `U5` | Next action (full text) | STATE.xml `<next-action>` | `gad state --full` |
| `U6` | In-progress task IDs + goals | TASK-REGISTRY.xml | `gad tasks --status in-progress` |
| `U7` | Phase history (done/active/planned) | ROADMAP.xml | `gad phases` |
| `U8` | Last activity date | STATE.xml (rarely present) | `gad state .lastActivity` |
| `U9` | Active session ID + phase | .planning/session.md | `gad session list` |
| `U10` | Which files to read (refs) | STATE.xml `<references>` | `gad context` |
| `U11` | Agent loop steps | AGENTS.md | read once; in gad context refs |
| `U12` | Build / verify commands | AGENTS.md | read once; not in CLI |

Units U1–U10 are **session-variable** — they change between sessions.
Units U11–U12 are **static** — read once; not worth repeating in CLI output.

---

## Fidelity levels

Each unit present in CLI output gets a fidelity score:

| Level | Symbol | Definition |
|-------|--------|------------|
| Full | ✅ | Complete, unmodified, same information as raw source |
| Truncated | ⚠️ T | Present but cut off; key information may be missing |
| Approximated | ⚠️ A | Present but derived or summarized; not verbatim |
| Referenced | 📎 | Not inlined; file path returned so agent can read it |
| Absent | ❌ | Not present at all |

---

## Formulas

### Token count (approximate)
```
tokens(text) = len(text) / 4
```
English prose averages ~4 chars/token. Code and XML average ~3.5 chars/token.
Use 4 as the conservative estimate unless measuring with a real tokenizer.

### Token reduction
```
token_reduction = (baseline_tokens - cli_tokens) / baseline_tokens
```
Where:
- `baseline_tokens` = sum of tokens across all files read in Workflow B
- `cli_tokens` = sum of tokens across all CLI command outputs in Workflow A

### Context completeness
```
completeness = (units_full + 0.5 * units_partial) / total_units
```
Where:
- `units_full` = count of units at fidelity Full or Referenced
- `units_partial` = count of units at fidelity Truncated or Approximated
- `total_units` = total information unit count for the workflow

### Context loss
```
loss = 1 - completeness
```
A unit is "lost" if it is Absent. A unit is "degraded" if it is Truncated or Approximated.

### Information density
```
density = units_present / cli_tokens
```
Higher is better — more information per token consumed. This is what we are optimizing for.

### Composite eval score
Weights are defined per eval in gad.json. For cli-efficiency:
```
score = (token_reduction * 0.40) + (completeness * 0.35) + ((1 - loss) * 0.25)
```

---

## What a RUN.md must contain

Every eval run document must include:

1. **Workflow A output** — the actual text output of every CLI command run, verbatim
2. **Workflow B output** — the actual content read from each file (or a representative excerpt with byte + token counts for large files)
3. **Unit-by-unit fidelity table** — each information unit, its fidelity level in CLI vs raw, and evidence
4. **Token counts** — both byte and token counts per source
5. **Formulas applied** — show the arithmetic, not just the result
6. **Residual content analysis** — what is in the raw files that is NOT in the CLI, and why it is or isn't needed

---

## What is a "comparison"?

A comparison is a RUN.md that satisfies: given only Workflow A output, could an agent pick up the
work that Workflow B would have enabled? If yes, completeness = 1.0. If no, identify exactly
which unit was missing and what the agent would have done differently.

---

## How to define context loss precisely

Context loss is not "bytes missing." It is:

> A context loss occurs when an information unit present in the raw workflow is absent or
> sufficiently degraded in the CLI workflow that an agent would make a different decision
> (or ask a question it would not have needed to ask) as a result.

**Test:** simulate the agent. Given only the CLI output, what would it do next? Given the full
raw files, what would it do next? If the answer differs, there is context loss on the unit(s)
responsible for the difference.

---

## Decisions captured here

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Evals must capture actual content, not just byte counts | Byte counts cannot reveal whether information is actually present or readable |
| 2026-04-04 | Token counts replace byte counts as the primary efficiency metric | Tokens are what models consume; bytes are a proxy that varies by encoding |
| 2026-04-04 | Context = dynamic session-variable information units, not file size | Static docs (AGENTS.md style guide) do not count as context loss if absent from CLI |
| 2026-04-04 | Information fidelity levels: Full / Truncated / Approximated / Referenced / Absent | Needed to score partial presence scientifically, not binary present/absent |
| 2026-04-04 | next-action: no truncation in CLI output | 500 byte field; truncation caused real context loss on dependency notes |
| 2026-04-04 | GAD is agent-agnostic; skills are methodology docs, not Claude Code workflows | Framework must work with any AI coding assistant |
| 2026-04-04 | All session intents/decisions/guidance must be captured in planning docs each session | Prevents drift between what was decided in chat and what planning docs reflect |
| 2026-04-06 | Implementation evals extend TRACE.json with skill_triggers, gad_commands, and timing | CLI-efficiency evals measure context delivery; implementation evals measure the full loop |

---

## Implementation eval trace format (v2)

Implementation evals (escape-the-dungeon, portfolio-bare with tracing) extend the base TRACE.json
with additional fields that track how the GAD loop performed during a real build.

### Extended TRACE.json schema

```json
{
  "eval": "escape-the-dungeon",
  "version": "v1",
  "date": "2026-04-06",
  "gad_version": "1.x.x",
  "eval_type": "implementation",
  "context_mode": "fresh",

  "timing": {
    "started": "2026-04-06T10:00:00Z",
    "ended": "2026-04-06T14:30:00Z",
    "duration_minutes": 270,
    "phases_completed": 5,
    "tasks_completed": 18
  },

  "gad_commands": [
    { "cmd": "gad snapshot --projectid escape-the-dungeon", "at": "2026-04-06T10:00:05Z", "tokens": 1200 },
    { "cmd": "gad state", "at": "2026-04-06T10:15:00Z", "tokens": 250 }
  ],

  "skill_triggers": [
    { "skill": "/gad:discuss-phase", "phase": "01", "at": "2026-04-06T10:01:00Z", "result": "CONTEXT.md written" },
    { "skill": "/gad:plan-phase", "phase": "01", "at": "2026-04-06T10:20:00Z", "result": "PLAN.md written, 6 tasks" },
    { "skill": "/gad:execute-phase", "phase": "01", "at": "2026-04-06T10:30:00Z", "result": "6/6 tasks done" },
    { "skill": "/gad:verify-work", "phase": "01", "at": "2026-04-06T11:00:00Z", "result": "pass" }
  ],

  "planning_quality": {
    "phases_planned": 5,
    "tasks_planned": 18,
    "tasks_completed": 18,
    "tasks_blocked": 0,
    "decisions_captured": 12,
    "state_updates": 15,
    "state_stale_count": 0
  },

  "cli_efficiency": {
    "total_gad_commands": 25,
    "total_gad_tokens": 8500,
    "manual_file_reads": 3,
    "manual_file_tokens": 2200,
    "token_reduction_vs_manual": 0.79
  },

  "skill_accuracy": {
    "expected_triggers": [
      { "skill": "/gad:discuss-phase", "when": "before planning", "triggered": true },
      { "skill": "/gad:plan-phase", "when": "before execution", "triggered": true },
      { "skill": "/gad:execute-phase", "when": "to implement tasks", "triggered": true },
      { "skill": "/gad:verify-work", "when": "after phase completion", "triggered": true }
    ],
    "accuracy": 1.0
  },

  "scores": {
    "cli_efficiency": 0.79,
    "skill_accuracy": 1.0,
    "planning_quality": 1.0,
    "time_efficiency": 0.85,
    "composite": 0.91
  },

  "human_review": {
    "score": null,
    "notes": null,
    "reviewed_by": null,
    "reviewed_at": null
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `eval_type` | string | `"cli-efficiency"` or `"implementation"` |
| `context_mode` | string | `"fresh"` or `"loaded"` — did agent have prior context? |
| `timing` | object | Wall clock start/end, duration, phases/tasks completed |
| `gad_commands` | array | Every `gad` CLI command run, with timestamp and token count |
| `skill_triggers` | array | Every `/gad:*` skill invoked, with phase, timestamp, result |
| `planning_quality` | object | How well planning docs were maintained during execution |
| `cli_efficiency` | object | Token comparison: gad commands vs manual file reads |
| `skill_accuracy` | object | Were the right skills triggered at the right time? |
| `human_review` | object | Manually filled after eval — human quality assessment |

### Implementation eval composite score

```
composite = (cli_efficiency * 0.25) + (skill_accuracy * 0.25) + (planning_quality * 0.30) + (time_efficiency * 0.20)
```

Where:
- `cli_efficiency` = token_reduction_vs_manual (same formula as cli-efficiency eval)
- `skill_accuracy` = triggered_correctly / expected_triggers
- `planning_quality` = (tasks_completed / tasks_planned) * (1 - state_stale_count / state_updates)
- `time_efficiency` = 1 - (duration_minutes / expected_duration_minutes), clamped to [0, 1]

`human_review.score` is separate — not folded into composite. It is the qualitative assessment added after.
