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
| 2026-04-07 | Implementation composite: 6 dimensions with human_review, normalized auto_composite when unreviewed | Prior formula was undocumented and inconsistent across evals. skill_accuracy now only counts actual /gad:* invocations, not methodology behaviors |
| 2026-04-07 | per_task_discipline = task_id_commits / total_commits | Atomic commits per task enable rollback and traceability; batch commits reduce this score |
| 2026-04-07 | MCP acceptable p95 raised from 500ms to 5000ms | MCP tools shell out to CLI and scan filesystems; 500ms was unrealistic |
| 2026-04-07 | trace_schema_version bumped to 3 | New composite formula, human_review dimension, skill_accuracy redefined |
| 2026-04-08 | Gate criteria: if any gate="true" requirement fails, requirement_coverage = 0 | escape-the-dungeon v5 scored auto 0.955 but human 0.0 (blank screen). Automated scoring said "all requirements met" when nothing rendered. Gate criteria prevent this. |
| 2026-04-08 | requirement_coverage must verify runtime output, not just code existence | Code that compiles but produces a blank screen has zero coverage. Build output must be inspected. |
| 2026-04-08 | Vertical slice is the primary success criterion for game evals | A game with 3 rooms and visible UI scores higher than 12 invisible systems. UI-first build order is mandatory. |

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
| `eval_type` | string | `"cli-efficiency"`, `"implementation"`, `"tooling"`, or `"mcp"` |
| `trace_schema_version` | number | Schema version (current: 3). Bump when summary shape changes |
| `context_mode` | string | `"fresh"` or `"loaded"` — did agent have prior context? |
| `timing` | object | Wall clock start/end, duration, phases/tasks completed |
| `gad_commands` | array | Every `gad` CLI command run, with timestamp and token count |
| `skill_triggers` | array | Every `/gad:*` skill invoked, with phase, timestamp, result |
| `planning_quality` | object | How well planning docs were maintained during execution |
| `cli_efficiency` | object | Token comparison: gad commands vs manual file reads |
| `skill_accuracy` | object | Were the right skills triggered at the right time? |
| `human_review` | object | Manually filled after eval — human quality assessment |

### Implementation eval dimensions

| Dimension | Weight | Formula | What it measures |
|-----------|--------|---------|-----------------|
| `requirement_coverage` | 0.15 | `fully_met / total_criteria`, subject to gate override | Did the agent build what was asked? Gate criteria (game-loop, spell-crafting, UI-quality) override: if ANY gate fails, score = 0. |
| `planning_quality` | 0.15 | `(tasks_completed / tasks_planned) * (1 - state_stale_count / state_updates)` | Were planning docs maintained accurately? |
| `per_task_discipline` | 0.15 | `task_id_commits / total_commits` | Did each commit map to exactly one task? Batch commits = lower score. |
| `skill_accuracy` | 0.10 | `skills_triggered_correctly / expected_skill_triggers` | Were the right `/gad:*` skills invoked at the right time? Only actual skill invocations count — not methodology behaviors. |
| `time_efficiency` | 0.05 | `1 - (duration_minutes / expected_duration_minutes)`, clamped [0, 1] | Was the agent reasonably fast? |
| `human_review` | **0.30** | User-provided score [0, 1] via `gad eval review` | Human assessment of output quality, correctness, and polish. **Dominant weight.** |

**Low human-review caps (hard rule):**
- If `human_review < 0.20`: final composite is capped at **0.40** regardless of other dimensions
- If `human_review < 0.10`: final composite is capped at **0.25**

This prevents technically compliant but broken/unusable output from ranking highly.

### Implementation composite score

```
composite = (
  requirement_coverage * 0.15 +
  planning_quality     * 0.15 +
  per_task_discipline  * 0.15 +
  skill_accuracy       * 0.10 +
  time_efficiency      * 0.05 +
  human_review         * 0.30
)

# Then apply caps:
if human_review < 0.20: composite = min(composite, 0.40)
if human_review < 0.10: composite = min(composite, 0.25)
```

When `human_review` is null (not yet reviewed), the composite uses the remaining 5 dimensions
with weights normalized to sum to ~1.0:

```
auto_composite = (
  requirement_coverage * 0.25 +
  planning_quality     * 0.25 +
  per_task_discipline  * 0.25 +
  skill_accuracy       * 0.167 +
  time_efficiency      * 0.083
)
```

The `auto_composite` is clearly labeled in reports with `*`. Once a human review is submitted,
the full composite with caps replaces it. **auto_composite should be treated as provisional —
the real score requires human review.**

### skill_accuracy vs methodology behaviors

`skill_accuracy` counts only actual `/gad:*` skill invocations — calls to skills defined in
`vendor/get-anything-done/skills/`. Examples: `/gad:plan-phase`, `/gad:execute-phase`,
`/gad:verify-phase`, `/gad:auto-conventions`.

Methodology behaviors (did the agent capture decisions? did it complete phases? did it track
task lifecycle?) are **not** skill triggers. They are observable outcomes already captured by
other dimensions:
- Decision capture → `planning_quality` (via `decisions_captured` field)
- Phase completion → `requirement_coverage`
- Task lifecycle → `per_task_discipline`

### per_task_discipline

Measures commit hygiene: does each commit correspond to exactly one task?

```
per_task_discipline = task_id_commits / total_commits
```

Where:
- `task_id_commits` = commits whose message contains a task ID (e.g. "01-03")
- `total_commits` = all commits in the eval session (excluding merge commits)

A score of 1.0 means every commit maps to a task. Batch commits (multiple tasks in one commit)
or untracked commits lower the score. This matters because atomic commits enable rollback,
review, and traceability.

---

## Tooling eval trace format

Tooling evals test GAD CLI commands and infrastructure — not agent behavior. They use fixed
fixtures, automated harnesses, and no LLM in the loop.

### When to use tooling evals

- Testing `gad watch planning` / `gad dev` correctness and latency
- Testing MCP server tool invocations
- Regression testing after changes to gad.cjs or verify libraries
- CI gating on every PR touching the CLI

### Tooling TRACE.json schema

```json
{
  "eval": "tooling-watch-baseline",
  "version": "v1",
  "date": "2026-04-07",
  "gad_version": "1.32.0",
  "eval_type": "tooling",
  "trace_schema_version": 2,
  "scenario": "watch-edit-verify",

  "timing": {
    "started": "2026-04-07T10:00:00Z",
    "ended": "2026-04-07T10:00:45Z",
    "duration_ms": 45000
  },

  "tooling": {
    "invocations": 12,
    "passes": 11,
    "failures": 1,
    "cold_start_ms": 320,
    "per_invocation": [
      { "command": "gad refs verify", "duration_ms": 85, "pass": true },
      { "command": "gad refs verify", "duration_ms": 42, "pass": true }
    ]
  },

  "metrics": {
    "p50_ms": 45,
    "p95_ms": 120,
    "p99_ms": 320,
    "error_rate": 0.083,
    "events_processed": 24
  },

  "scores": {
    "correctness": 0.917,
    "latency": 0.95,
    "tooling_composite": 0.934
  }
}
```

### MCP TRACE.json schema

```json
{
  "eval_type": "mcp",
  "trace_schema_version": 2,
  "scenario": "golden-tools",

  "mcp": {
    "tools_tested": 5,
    "tools_passed": 5,
    "cold_start_ms": 1200,
    "per_tool": [
      { "tool": "gad_snapshot", "duration_ms": 450, "pass": true, "output_tokens": 1200 },
      { "tool": "gad_state", "duration_ms": 85, "pass": true, "output_tokens": 150 }
    ]
  },

  "scores": {
    "correctness": 1.0,
    "latency": 0.88,
    "mcp_composite": 0.94
  }
}
```

### Tooling composite score

```
tooling_composite = (correctness * 0.60) + (latency * 0.40)
```

Where:
- `correctness` = passes / invocations
- `latency` = 1 - (p95_ms / acceptable_p95_ms), clamped to [0, 1]. Acceptable p95 = 500ms for watch, 5000ms for MCP (MCP tools shell out to CLI and scan filesystem).

### Optional metrics.json

High-cardinality data (per-invocation latencies, histogram buckets, full event traces) goes in
`metrics.json` alongside TRACE.json — not in the trace itself. The trace keeps only summary
composites for gates and trend comparison.

### Comparing tooling runs

Compare runs with the same `scenario` id. The `gad_version` and `trace_schema_version` fields
enable attribution — did a score change because the CLI changed, or because the schema evolved?

### scores.json (machine-readable, all eval types)

Every eval run should produce `scores.json` alongside `SCORE.md`:

```json
{
  "eval": "escape-the-dungeon",
  "version": "v5",
  "eval_type": "implementation",
  "trace_schema_version": 3,
  "composite": 0.935,
  "auto_composite": 0.935,
  "human_reviewed": false,
  "dimensions": {
    "requirement_coverage": 1.0,
    "planning_quality": 1.0,
    "per_task_discipline": 0.83,
    "skill_accuracy": 0.90,
    "time_efficiency": 0.963,
    "human_review": null
  }
}
```

`gad eval report` and `gad eval diff` read `scores.json` for machine comparison, not `SCORE.md`.

---

## Skill eval methodology (A/B comparison)

Skills are methodology documents — they teach agents how to approach work. You can't test a
skill by trigger detection. The only valid measurement is: **does the agent produce better
outcomes WITH the skill than WITHOUT it?**

### Experiment design

Every skill eval is an A/B comparison:

| | Condition A (control) | Condition B (treatment) |
|---|---|---|
| Setup | Same task, same requirements | Same task, same requirements |
| Agent | No skill document | Skill document in AGENTS.md |
| Measurement | Outcome metrics | Same outcome metrics |

The delta between A and B is the skill's measured value-add.

### What to measure per skill

| Skill | Primary metric | Secondary metric | Control condition |
|-------|---------------|-----------------|-------------------|
| `debug` | error-fix cycles, tokens wasted on retries | time-to-resolution per bug | Agent debugs without methodology |
| `plan-phase` | plan-to-outcome alignment, task scoping quality | rework rate (tasks added mid-phase) | Agent plans without template |
| `auto-conventions` | convention-to-code consistency score | drift over subsequent phases | Agent has no conventions doc |
| `reverse-engineer` | human review of reimplementation quality | requirement coverage vs original | Agent reverse-engineers without methodology |
| `execute-phase` | per_task_discipline, commit hygiene | state corruption rate | Agent executes without checkpoint discipline |

### Shared dimensions for A/B comparison

When comparing evals that use different frameworks (e.g. escape-the-dungeon vs
escape-the-dungeon-bare), only shared dimensions are directly comparable:

| Dimension | Comparable? | Notes |
|-----------|-------------|-------|
| requirement_coverage | Yes | Same requirements, same criteria |
| implementation_quality | Yes | Build succeeds, game runs, no critical bugs |
| time_efficiency | Yes | Same clock, same token budget |
| human_review | Yes | Same reviewer, same rubric |
| total_tokens | Yes | Raw efficiency comparison |
| per_task_discipline | Partially | Different tracking = different commit patterns |
| skill_accuracy | No | Only meaningful with GAD skills |
| workflow_emergence | No | Only meaningful for bare eval |

### Token overhead analysis

For A/B comparisons, break down token usage:

```json
"token_breakdown": {
  "total_tokens": 92000,
  "planning_tokens": 15000,
  "code_tokens": 65000,
  "debugging_tokens": 8000,
  "verification_tokens": 4000
}
```

`planning_tokens / total_tokens` = framework overhead ratio. If GAD adds 16% overhead
but produces 20% better human_review scores, the overhead pays for itself.

### Error/retry tracking

Implementation evals should capture debugging behavior for skill comparison:

```json
"debugging": {
  "build_failures": 3,
  "typecheck_failures": 5,
  "fix_attempts": 8,
  "retry_tokens": 12000,
  "unique_errors": 4,
  "resolution_rate": 1.0
}
```

Where:
- `build_failures` = times `npm run build` or `tsc` returned non-zero
- `fix_attempts` = code edits made between failure and next success
- `retry_tokens` = tokens spent on error→fix→retest cycles
- `resolution_rate` = errors_resolved / unique_errors

### Statistical validity

A single eval run is an anecdote, not data. To claim "skill X improves outcomes":

1. Run the same eval ≥ 3 times per condition (A and B)
2. Report mean and standard deviation
3. The difference between means must be > 1 standard deviation to be meaningful
4. If variance is high (SD > 0.05), run more trials

Until we have multiple runs, label all comparisons as "preliminary" in reports.

---

## Eval categories

### Implementation evals (agent builds something)
Test the full GAD loop on a real project. Measure all 6 dimensions.
- escape-the-dungeon, portfolio-bare, reader-workspace, escape-the-dungeon-bare

### Tooling evals (automated, no LLM)
Test CLI commands and infrastructure. Fixture-based, deterministic, repeatable.
- tooling-watch, tooling-mcp

### Context evals (measure information delivery)
Test whether CLI commands deliver complete context. Unit-based fidelity measurement.
- cli-efficiency, planning-migration

### Skill evals (A/B methodology comparison)
Test whether a specific skill improves outcomes. Require paired runs.
- (none yet — escape-the-dungeon-bare is the first)

### Lifecycle evals (test project lifecycle)
Test project creation, milestone management, session persistence.
- gad-planning-loop (unrun), project-migration

---

## Open questions (experiment queue)

These are hypotheses we should test but haven't yet:

1. **Does GAD survive context compaction?** Run an impl eval with forced early compaction.
   Measure: does `gad snapshot` re-hydrate correctly? Does the agent continue without drift?

2. **What's GAD's token overhead?** Compare total_tokens between escape-the-dungeon and
   escape-the-dungeon-bare. Break down planning vs code vs debugging tokens.

3. **Why is reader-workspace discipline 0.31?** Diagnose the 11 batch commits. Was it skill
   doc clarity? Time pressure? Complexity? Fix the root cause and re-run.

4. **Does skill_accuracy discriminate?** Currently 100% everywhere. Either add quality
   scoring per invocation or acknowledge the dimension doesn't help.

5. **How much variance between runs?** Run escape-the-dungeon 3 times. If SD > 0.05,
   single-run composites are unreliable.

6. **Does GAD work cross-model?** Run an impl eval with a non-Claude model (Codex/GPT).
   If it fails, the skill docs need improvement.

7. **What is the minimum viable GAD?** Strip skills one at a time and re-run. Which skill
   removal causes the biggest score drop? That's the most valuable skill.
