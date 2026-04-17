# Subagent-run history store — capture daily llm-from-scratch runs (decision gad-258)

**Source:** 2026-04-17 session 4 — subagent execution model set

After gad-258 llm-from-scratch tasks run in a subagent and the main session gets a report. That report needs to be persisted so: (a) the operator can scroll back over past days' tips + outcomes, (b) the 'my projects' dashboard can render a run timeline, (c) attribution data flows into self-eval / trace pipeline.

Schema (draft):
  .planning/subagent-runs/<projectid>/<YYYY-MM-DD>-<task-id>.json
    { runId, projectId, taskId, startedAt, endedAt, model, status: done|failed|timeout,
      oneLineOutcome, teachingTipId?, nextTaskId, commitSha, reportBody }

CLI surfaces:
  gad subagent-runs list --projectid X
  gad subagent-runs show <runId>

Subagent dispatch wrapper responsible for writing this record at run end. Wrapper also handles: snapshot injection, task claim via 'gad tasks claim', commit discipline, report format contract.
