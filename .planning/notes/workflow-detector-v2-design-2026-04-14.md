# Workflow detector v2 — design deep-dive

**Phase:** 42.3-16
**Decision lineage:** gad-172, gad-173, gad-174, gad-178
**Status:** design locked from 2026-04-14 discuss round; implementation queued

## Problem statement

The v1 detector (shipped in phase 42.3-09) mines `tool_use` event
sequences and emits candidates like `bash × 271` or
`read → edit → edit`. These describe editing mechanics, not agent
intent. The top emergent candidates on /planning right now are noise
that would confuse anyone other than the operator.

Decision gad-178 said: **skills determine workflows**, not raw tool
names. A workflow is the sequence of skill invocations plus the CLI
commands and planning artifacts those skills touch. The detector v2
needs to mine skill-level sequences to produce meaningful candidates.

## Constraint: current skill signal is task-level only

The critical constraint, surfaced during the discuss round:

> Skill tagging is only done on the task. So we would have to use
> tools to track. I'm not sure what should be since that is the case
> and how we mix in skill tracing from the task registry.

Today, skills are attached to **completed tasks** via the `skill=`
attribute in `.planning/TASK-REGISTRY.xml` (decision gad-104). Trace
events (`.planning/.trace-events.jsonl`) only have `tool_use` and
`file_mutation` entries; there are no skill-level events. This means
the detector has two information sources that don't overlap in time:

- **Task registry**: authoritative skill attribution, but sparse —
  one entry per completed task, no granularity inside the task
- **Trace events**: fine-grained tool-use sequence, but no skill
  labels — the detector sees `Bash Bash Read Edit Edit Bash` with
  no hint that those 6 tool calls belonged to the same
  `check-todos → gad-execute-phase` transition

The question is how to align them.

## Three design decisions from the discuss round

### 1. Standard skill format declares skill-to-skill references

> I think we should have standard ways we build skills so we can
> parse. We need a skill syntax format we use to trace if other
> skills have reference to other skills. Their tracing would be the
> tagging in the tasks. We could update instructions for more
> tagging and ordering.

**Lock:** Skill files gain a frontmatter field `invokes: [<slug>, ...]`
listing any other skills the skill may invoke during its run. This
gives the detector a static call graph BEFORE it ever reads trace data
— we know that `gad-execute-phase` invokes `task-checkpoint`, which
can invoke `gad-debug`, etc.

When the detector mines task-registry sequences, it uses the static
call graph to expand each top-level skill into its expected sub-skill
set and checks which of those actually appear in the trace. A skill
that declares `invokes: [task-checkpoint, gad-debug]` but whose traces
never show any tool-use patterns characteristic of those sub-skills is
a signal that either (a) the declared call graph is stale, or (b) the
run deviated from the expected pattern.

**Implementation:** `skills/*/SKILL.md` frontmatter gains `invokes`
(optional). `parseSkills()` in build-site-data.mjs already reads
frontmatter — we just surface the new field in the CatalogSkill type.

The **nested invocation question** from the original open-questions
list (gad-174 impact #6) is answered by this: nested skills are
parent-child relationships declared in the `invokes` field, and the
detector walks that tree when synthesizing a run.

### 2. CLI calls carry the active skill as a tag

> We could pass the skill being used to the CLI for logs. That's the
> better plan I think. We still want to keep skills associated with
> tasks though in the artifacts.

**Lock:** The `gad` CLI gains a `--skill <slug>` flag at the top level.
Every CLI invocation can identify which skill called it. The CLI's
logging layer (already feeds `.gad-log/`) records the skill slug on
the log entry. The trace hook picks it up (from an env var the CLI
sets for child processes, or from the log file directly) and stamps
the outgoing `tool_use` event with `trigger_skill: <slug>`.

This solves the **"skills that don't wrap in a Skill tool call"**
question (gad-174 impact #6) for the most common case: skills that
mostly do work by running CLI commands. A skill like `gad-next` that
just runs `gad snapshot` and `gad tasks` becomes visible in the trace
stream because those CLI invocations now carry its identity.

Task-registry attribution stays load-bearing — it's the canonical
record of "which skill completed this task" — but it's no longer the
only skill signal. The CLI tag is the per-invocation supplement.

**Implementation:**
- `bin/gad.cjs`: top-level `--skill <slug>` flag, sets
  `GAD_ACTIVE_SKILL` env var for child processes and stamps the log
  entry
- `.gad-log/` JSONL entries gain a `skill` field
- `gad-trace-hook.cjs`: when emitting a `tool_use` event, read the
  active skill from the most recent `.gad-log` entry (or env var)
  and populate `trigger_skill`
- Skills that call CLI commands are instructed to pass their slug:
  `gad snapshot --skill gad-next` instead of plain `gad snapshot`

### 3. Skills stay tagged on tasks in planning artifacts

> We still want to keep skills associated with tasks though in the
> artifacts.

**Lock:** Nothing changes about task-registry attribution. `skill=`,
`agent=`, `type=` remain mandatory on completed tasks (decision
gad-104). The task registry is the coarse-grained ground truth; CLI
tagging + trace events are the fine-grained supplement. Both exist.

The detector uses both:

1. **Task registry** gives the authoritative skill sequence for
   each completed phase — a list of `(task_id, skill, agent, type)`
   tuples in commit order.
2. **Trace events** give the fine-grained tool-use sequence inside
   each task's time window, tagged with `trigger_skill` from the
   CLI layer (when available) or inferred from the task registry
   entry that brackets the events temporally.

## Detector v2 algorithm sketch

```
for each completed phase in TASK-REGISTRY.xml:
  task_sequence = [(task_id, skill) for task in phase.tasks if task.status == "done"]
  for (task_id, skill) in task_sequence:
    task_start = commit_timestamp(task_id - 1)  # approximate
    task_end   = commit_timestamp(task_id)
    trace_window = trace_events.filter(t.ts in [task_start, task_end])
    for event in trace_window:
      if event.trigger_skill: continue  # already tagged
      event.trigger_skill = skill       # inherit from task
    # walk the static call graph for `skill` and check which
    # declared sub-skills appeared in the window; those become
    # children of `skill` in the emitted workflow graph

emit:
  - per-phase actual workflow graph (nodes = skills + CLI + artifacts,
    edges = temporal adjacency within the task)
  - per-skill invocation count aggregated across phases
  - frequent skill subsequences (length >= 3, support >= 3) as
    emergent-workflow candidates, same format as v1 but skill-level
```

## What ships in the detector v2 task (42.3-16)

1. `skills/*/SKILL.md` frontmatter gains optional `invokes:
   [<slug>, ...]`. `parseSkills()` reads it.
2. `bin/gad.cjs` top-level `--skill <slug>` flag sets
   `GAD_ACTIVE_SKILL` and stamps log entries.
3. `gad-trace-hook.cjs` reads the active skill from the env var or
   most recent log entry and writes it into `trigger_skill` when
   emitting `tool_use` events. (v1 already supports
   `trigger_skill` — we just need to populate it.)
4. `detectEmergentWorkflows()` in build-site-data.mjs is rewritten to
   mine skill-level sequences via the task-registry-plus-trace merge
   described above. Tool-level candidates become a secondary stream
   for noise-filtering / gap detection.
5. /planning Workflows tab gains a caveat strip on emergent cards
   that come from the tool-level v1 fallback vs the skill-level v2
   stream, so readers can tell them apart.

## What doesn't ship in v2

- **Explicit `workflow_enter` / `workflow_exit` events** are still
  queued (decision gad-173) but we don't need them for v2 — the
  task-registry-plus-`trigger_skill` merge gives us enough signal.
  They become the primary input for v3 if/when we move to real-time
  workflow conformance (advisory scoring during a run, not just
  post-hoc).
- **LLM-based workflow naming** remains a future consideration
  (decision gad-174 impact #6) — v2 uses whatever names the skills
  declare.
- **pm4py / process-mining upgrade** — v2 stays in pure Node; pm4py
  is still an optional future path.

## Dependencies

- Requires task **42.3-14** (hook-level scope tagging) — already
  shipped this turn. The hook now stamps `scope` on every event;
  adding `trigger_skill` is a small extension.
- Requires the CLI `--skill` flag wiring — small but touches
  `bin/gad.cjs` and every skill file that calls the CLI.
- **Does NOT require** phase 42.4 (context frameworks). The two can
  ship in parallel.

## Open question parked for later

When a skill invokes another skill transparently (e.g. through the
Skill tool), does the child skill's trace window belong to the parent
or to the child? v2 treats the child as a sub-span of the parent
because that matches the call graph. If we later want child-first
attribution (e.g. for granular per-skill cost accounting), the data
is already there — we just re-slice the same trace events.
