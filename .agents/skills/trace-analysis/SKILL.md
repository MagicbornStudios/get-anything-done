---
name: trace-analysis
description: Analyze GAD trace data (.gad-log/ JSONL + .trace-events.jsonl) to produce usage reports — tool mix, skill invocations, commit rhythm, context compactions, per-project breakdowns.
---

# trace-analysis

Analyze the trace data that GAD hooks capture during every session. Produces structured reports showing how GAD is actually being used across all projects in this monorepo.

## Data sources

1. **`.planning/.gad-log/*.jsonl`** — Tool call log from the tool-trace.js hook. One file per day. Fields: ts, tool, session_id, input_summary, gad_command, agent_type, skill.
2. **`.planning/.trace-events.jsonl`** — Trace events from gad-trace-hook.cjs. Fields: event_type (tool_use, skill_invocation, subagent_spawn, file_mutation), seq, tool, inputs, outputs.
3. **`vendor/get-anything-done/.planning/.trace-events.jsonl`** — GAD project-specific trace events (1000 event max with rotation).

## What to produce

### Per-session report
```
Session: <session_id>
Duration: <first_event_ts> → <last_event_ts>
Tool calls: <count> (Read: N, Edit: N, Bash: N, Grep: N, Agent: N, Skill: N)
GAD CLI calls: <count> (snapshot: N, state: N, tasks: N, decisions: N)
Skills invoked: <list with counts>
Subagents spawned: <count> (types: ...)
Files mutated: <count> (created: N, edited: N)
Commits: <count from git log in time range>
```

### Per-day report
Aggregate of all sessions that day. Same metrics plus:
- Projects touched (from file paths in mutations)
- Decision count delta (from DECISIONS.xml git diff)
- Task completion rate

### Per-round report (the self-eval)
A "round" of GAD development = a milestone or sprint. Aggregate:
- Total sessions, total tool calls, total tokens (if available)
- Skill usage distribution — which skills are used, which are never invoked
- GAD loop compliance — how many sessions start with `gad snapshot`?
- Planning doc update rate — are STATE.xml and TASK-REGISTRY.xml updated per commit?
- Ratio of framework overhead to implementation (Read/Edit on .planning/ files vs source files)

## How to run

```
# Analyze today's trace data
Read .planning/.gad-log/2026-04-10.jsonl, count and categorize events.

# Analyze all trace data
Read all files in .planning/.gad-log/, aggregate across days.

# Check GAD loop compliance
For each session, check: did it start with a gad snapshot call? Did it update planning docs before committing?
```

## Output format

Structured markdown report. Can be rendered on the site under /data or /methodology.

## Future: CLI integration

When stable, this should become `gad trace report` CLI command with the same analysis logic available programmatically.
