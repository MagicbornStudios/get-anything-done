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
