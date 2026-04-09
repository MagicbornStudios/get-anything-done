# Phase 25 — Trace schema v4 + framework versioning · discussion output

**Phase:** 25
**Status:** discuss-phase complete, ready for plan-phase
**Author:** Claude Opus 4.6 (session 4)
**Decisions referenced:** gad-50, gad-51, gad-53, gad-54, gad-55

---

## Goal

Make every dimension score on a per-run page explicable after the fact. Today, a TRACE.json
field like `skill_accuracy: 0.17` has no breakdown — we can't tell which of the expected
skills fired vs missed, which tools the agent called, which subagents spawned, how long each
phase took, or which framework commit the run was recorded against. Phase 25 fixes this by
shipping trace schema v4 (hook-captured, structured event stream) and framework versioning
(branch-frozen snapshots, commit-stamped runs). The underlying question: *when a score moves
between rounds, is it the agent or the framework?* Today we can't answer that. After phase 25,
we can.

## Non-goals

- **Not** reworking the composite formula. Weights stay; we're adding data, not changing what
  the data means.
- **Not** backfilling old TRACE.json files. Decision gad-54 pins freeze-old-stamp-new.
- **Not** adding per-agent TRACE fields. Multi-agent support is a converter problem
  (decision gad-55).
- **Not** shipping Codex / Aider / Continue support. That's future sub-phases built on the
  converter pattern.
- **Not** a Remotion phase. Phase 26 is separate.

## Scope boundaries

- **In scope:** Claude Code hook integration, trace schema v4 emission, framework version
  stamping via `gad version` + git commit hash, eval runner changes to bail out if the agent
  runtime isn't hook-capable, site-side rendering of trace v4 data.
- **Out of scope:** Codex / Aider / Continue converters, screen-scraping fallbacks, the
  Remotion video compositions that will eventually explain trace v4 visually.

---

## Discussion notes (the question list a discuss-phase would generate, answered inline)

### Q1: Where does the instrumentation live? (answered)

**Answer:** Claude Code PreToolUse / PostToolUse hooks. Decision gad-53 makes this explicit:
agents without hook runtimes are unsupported. The hooks write JSONL events directly to a
trace log file next to the eval run directory. On eval completion, the existing TRACE.json
writer reads the JSONL and merges it into schema v4.

**Rejected alternatives:**
- **Stdout parsing / Codex's `Running`/`Ran` format.** Lossy (reasoning text interleaves with
  tool calls), fragile (output format can change), doesn't work for multi-turn work. Captured
  in gad-55 as "converter problem if ever needed."
- **Claude Code session.jsonl post-processing.** Possible but indirect; hooks give us
  structured events at the exact moment the tool fires, session.jsonl requires parsing a less
  stable format.

### Q2: What events does trace v4 capture? (answered)

Four event types, each with a timestamp and a sequence number:

1. **`tool_use`** — every tool invocation. Fields: `tool` (Read / Bash / Edit / Write / Grep /
   Glob / TaskCreate / etc), `inputs` (the arguments object), `outputs` (summary: size, line
   count, exit code — NOT full content to keep traces lean), `duration_ms`, `success`.
2. **`skill_invocation`** — every time a skill document is applied. Fields: `skill_id`,
   `trigger_context` (one of: `slash_command`, `auto_detected`, `user_phrase`, `parent_skill`),
   `trigger_snippet` (the text that triggered it, truncated to 160 chars), `parent` (another
   skill id if nested), `duration_ms`.
3. **`subagent_spawn`** — every subagent delegation. Fields: `agent_id`, `inputs` (the task
   prompt + any files passed), `outputs` (the returned artifact as a file path or summary),
   `duration_ms`, `success`.
4. **`file_mutation`** — every create / edit / delete of a file under the project root.
   Fields: `path`, `op` (create / edit / delete), `size_delta`, `hash_before`, `hash_after`.

All four share an event envelope: `{ ts, seq, type, ...fields }`. The trace is emitted as
line-delimited JSON (one event per line) while the run is in flight, then a post-processor
aggregates into the structured `TRACE.json` on completion.

### Q3: How does skill_accuracy get computed from this? (answered)

The eval project's `gad.json` declares `expected_triggers` (array of `{ skill, when }` objects)
as it does today. After the run completes, the trace v4 post-processor walks the
`skill_invocation` events and matches each expected trigger against the closest invocation by
time + context. Matches produce `triggered: true`, misses produce `triggered: false`. The
resulting array goes into the top-level `skill_accuracy.expected_triggers` field exactly like
v5 GAD runs have today — so the site's per-run page renders the same table for every new run.
`skill_accuracy.accuracy` = matches / expected. `scores.skill_accuracy` mirrors that number.
The "tracing gap" callout on the per-run page disappears for v4+ runs.

### Q4: Framework versioning — branch strategy? (answered)

Per decision gad-51, confirmed in skills/framework-upgrade/SKILL.md:
- `main` = current framework. Eval runs default to this.
- `version/vX.Y` = frozen snapshot at a milestone close. Read-only except for security.
- Every TRACE.json stamps `framework_version` (semver), `framework_commit` (short sha),
  `framework_branch` (`main` or `version/vX.Y`), `framework_commit_ts` (commit timestamp).
- `gad version` command writes these fields into the TRACE.json post-processor.
- Re-running an old eval against current framework is a diff against the stamped version;
  `gad eval diff` already exists and is extended to surface the framework-version mismatch
  prominently.

### Q5: How do we detect that an agent isn't hook-capable? (answered)

At `gad eval run` time, the runner inspects the Claude Code settings.json for the required
hook entries (`PreToolUse`, `PostToolUse` with the GAD trace handler command). If the hooks
aren't present, the runner refuses to start the eval with a clear error:

```
ERROR: trace v4 requires hook-aware agent runtime.
  Missing: settings.json PreToolUse/PostToolUse hooks for GAD trace handler.
  Fix: run `gad install hooks` to wire up the required handlers.
  Why: decision gad-53 — agents without hook runtimes cannot produce trace v4 data.
```

This prevents half-captured traces from being written and prevents score computation against
missing data. Claude Code users run `gad install hooks` once per workspace.

### Q6: Backfill policy? (answered)

Per decision gad-54: freeze old, stamp new. No backfill commands exist in the CLI. Old runs
show what they have (aggregate scores, gate verdicts, human review). New runs land with the
full trace v4 breakdown. The site renders both gracefully: old runs get the "tracing gap"
callout on the skill accuracy section; new runs get the full expected_triggers table + tool
use summary + subagent spawn list.

### Q7: Multi-agent support? (answered)

Per decision gad-55: converter problem, not reimplementation. The trace schema itself is
agent-agnostic (just events + timestamps). If we ever want Codex, Aider, Continue support,
we write a converter that reads that agent's native format and emits trace v4 JSONL. No
per-agent site code, no fork in the scoring pipeline. Phase 25 ships the Claude Code
converter (hook-based) as the first implementation; future sub-phases add others.

Codex specifically: its terminal output format is line-delimited with `Running <cmd>` /
`• Ran <cmd>` / ` └ <output>` prefixes. Parseable but stream-based (rate limits can
truncate mid-stream). A Codex converter would tail the session file and emit tool_use events
per recognised `Running → Ran` pair. Lossy compared to hooks (no inputs object, no durations)
but better than nothing for agents without hook runtimes.

### Q8: What site-side changes does this enable? (answered)

Immediately after phase 25 lands on one real run:

1. `/runs/[project]/[version]` — existing skill accuracy table extends to handle v4 runs with
   the richer per-skill data. The "tracing gap" callout disappears for v4 runs.
2. `/runs/[project]/[version]` — new **Tool use timeline** section showing a chronological
   list of every tool call with duration and outcome. Filterable by tool name.
3. `/runs/[project]/[version]` — new **Subagent spawns** section listing every delegation
   with its inputs summary and outcome.
4. `/runs/[project]/[version]` — framework version badge in the header (next to the
   requirements version badge). Cross-version comparisons surface as small text under the
   composite headline ("this run used framework v1.31.0; the previous run used v1.32.0 —
   diff").
5. `/methodology` — trace schema v4 fields table replaces the current v3 stub.
6. `/gad` — "framework versions" section showing which versions exist and how many runs each.

### Q9: What's the minimum viable milestone for phase 25? (answered)

**Milestone A — hook wiring + event capture (1 session):**
- `gad install hooks` command that writes the required settings.json entries.
- Hook handler that emits trace v4 JSONL events for tool_use + file_mutation.
- Run one eval end-to-end and verify the JSONL produces a valid TRACE.json with v4 fields.

**Milestone B — skill_invocation + subagent_spawn capture (1 session):**
- Hook handler extended to emit skill_invocation events. This requires a way to detect when
  a skill is applied — likely via a marker the main agent emits as a tool call when it starts
  following a skill.
- subagent_spawn events emitted via hook on Task tool invocations.

**Milestone C — framework versioning (1 session):**
- `gad version` command that reads package.json + git HEAD.
- TRACE.json writer stamps the four framework fields.
- `gad eval diff` surfaces framework mismatch warnings.

**Milestone D — site-side rendering (1 session):**
- Per-run page Tool use timeline section.
- Per-run page Subagent spawns section.
- Framework version badges + cross-version diff notes.
- /methodology v4 fields table.

Each milestone is a commit set with its own task id range. The whole phase is ~4 focused
sessions.

---

## Plan-phase seeds

When `/gad:plan-phase 25` runs, these become the initial task candidates:

- 25-01 — `gad install hooks` command (settings.json writer + removal tool).
- 25-02 — trace v4 JSONL event format spec (types, fields, envelope).
- 25-03 — hook handler script that emits tool_use events.
- 25-04 — post-processor that reads JSONL + existing TRACE.json v3 fields and writes v4.
- 25-05 — end-to-end test: run escape-the-dungeon eval with v4 hooks and verify trace shape.
- 25-06 — hook handler extension for file_mutation events.
- 25-07 — skill_invocation event emission (requires agent-side marker mechanism — design sub-task).
- 25-08 — subagent_spawn event emission (hook on Task tool).
- 25-09 — `gad version` command + framework version fields in TRACE.json.
- 25-10 — `gad eval diff` framework-mismatch surfacing.
- 25-11 — site per-run page: tool use timeline section.
- 25-12 — site per-run page: subagent spawns section.
- 25-13 — site per-run page: framework version badges + cross-version diff note.
- 25-14 — site /methodology page: trace schema v4 fields table.
- 25-15 — site /gad page: framework versions section showing which versions exist.
- 25-16 — test eval runner refusal when hooks not installed (decision gad-53 enforcement).
- 25-17 — documentation: skills/framework-upgrade references trace v4 fields; /lineage mentions it in the "what GAD adds" section.

## Open items for plan-phase to resolve

- **Skill invocation marker mechanism.** How does the agent signal "I'm following skill X"
  in a way a hook can capture? Two candidates: (a) the agent runs a bash command like
  `gad trace-skill-start <id>` which the hook intercepts; (b) a file-based marker written to
  .planning/.trace-active-skill that the hook reads. Option (a) is more structured, option (b)
  is more reliable across crashes. Plan-phase picks one.
- **Hook handler script location.** In the GAD repo (distributed as part of the framework) or
  written into the user's workspace by `gad install hooks`? Probably the former, referenced
  by absolute path from settings.json. Plan-phase confirms.
- **Tool output truncation limits.** What's the cap on `outputs` fields? 10KB per event? 1KB?
  Plan-phase picks a number based on how noisy real runs are.
- **Event buffering vs direct emit.** Write every event synchronously or batch every N events?
  Batch is faster but loses events on crash. Plan-phase picks; start with synchronous.

---

## Dependencies satisfied

- Decision gad-50 (trace schema v4 exists) — pinned, referenced here.
- Decision gad-51 (framework branch versioning) — pinned, referenced here.
- Decision gad-53 (hook-aware required) — pinned, referenced here.
- Decision gad-54 (freeze-old-stamp-new) — pinned, referenced here.
- Decision gad-55 (multi-agent = converter) — pinned, referenced here.
- skills/framework-upgrade/SKILL.md shipped in session 3.
- Site pages ready to consume v4 data once it exists: /runs/ already has the "tracing gap"
  callout that will be replaced when breakdowns arrive; /methodology already has the "known
  gaps" section ready to be rewritten as "what v4 fixed."

## What this discussion replaces

This doc is the output of the `/gad:discuss-phase 25` skill. It captures the decisions that
would normally come out of an interactive discuss-phase session, pre-answered from the user's
session 4 messages. Plan-phase 25 can run against this directly without another
discussion round.
