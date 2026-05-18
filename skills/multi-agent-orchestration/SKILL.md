---
name: multi-agent-orchestration
description: >-
  Discipline for dispatching and coordinating parallel subagent waves.
  Covers no-commit policy, file-list discipline, model-per-task-kind
  routing (reads model-catalog.toml), typecheck gating, stamp discipline,
  conflict avoidance, and error paths. Ensures subagent waves produce
  attributable, type-clean, registry-consistent output.
when_to_load: "about to dispatch ≥3 subagents"
lane: orchestration
type: workflow
---

# multi-agent-orchestration

Load this skill before dispatching any wave of 3+ concurrent subagents.

---

## 1. Prerequisites

- Check `workflow.subagent_commits_disabled_by_default` (default: `true`).
  If `true`: **subagents MUST NOT commit**. The main thread owns all staging
  and committing. Pass `--no-commit` or equivalent guard to each subagent
  prompt. Subagent git hygiene failure = ERRORS-AND-ATTEMPTS.xml entry.
- Check `workflow.subagent_parallelism_max` (default: `5`). Cap the wave
  at that number. Never spawn more concurrent subagents than this value.

---

## 2. Wave sizing

```
max_streams = min(task_count, workflow.subagent_parallelism_max)
```

Group tasks into cohesive streams (one stream per independent file cluster).
Two streams that touch the same source file must be serialised (see §6).

---

## 3. Model routing

Read `.planning/runtimes/model-catalog.toml` (or use the loader API from
`vendor/get-anything-done/lib/runtimes/model-catalog.cjs`):

```js
const { getModelForKind } = require('<repo>/vendor/get-anything-done/lib/runtimes/model-catalog.cjs');
```

If `workflow.cheap_model_for_mechanical` is `true`:

| Task kind | Classification | Model tier |
|---|---|---|
| Rename, format pass, boilerplate gen, import fix | mechanical | `getModelForKind(runtime, 'cheap')` |
| Design decision, architecture, novel logic | non-mechanical | `getModelForKind(runtime, 'mid')` |
| Cross-cutting refactor, spec authorship | heavy | `getModelForKind(runtime, 'heavy')` |

If `workflow.cheap_model_for_mechanical` is `false`, use `mid` for all streams.

---

## 4. Typecheck gate

After the wave completes:

- If `workflow.subagent_typecheck_trust` is `false` (default): add one tsc
  verification subagent as the final wave step:
  `pnpm --filter @gad/desk tsc -b --noEmit`
  Fail the wave if tsc errors appear.
- If `true`: skip verification. Only safe when wave is purely mechanical
  (renames / imports) and the base was already type-clean before the wave.

---

## 5. Stamp discipline

| `workflow.task_stamp_batch` | Subagent action |
|---|---|
| `false` (default) | Each subagent calls `gad tasks stamp <id>` inline before returning. |
| `true` | Subagent returns a stamp list `[{taskId, status, files}]` to main thread; main thread stamps at wave end. If wave crashes mid-flight, stamps are lost — main thread must reconcile. |

---

## 6. Conflict avoidance

If two planned streams touch the same file:
1. Merge them into a single stream (preferred when scope allows).
2. If merge is not feasible, serialise: stream A first, then stream B with
   a re-Read of the file before Edit.
3. Never run concurrent writes to the same file. `Edit` will error on
   stale mtime — this is not a retry situation; it is a design error.

---

## 7. Attribution

Each subagent prompt MUST include:

```
--projectid <id>
--phase <n>
Task id: <GLOBAL-T-xx-yy>
GAD_AGENT_NAME=<subagent-slug>
```

Stamps without a projectid or task id create registry blind spots.

---

## 8. Error path

- On subagent failure: log to `ERRORS-AND-ATTEMPTS.xml` via `gad errors add`.
- Retry limit: `team.worker.max_inner_rotations` (default 3). After that,
  escalate to main thread — do not loop indefinitely.
- On tsc failure in §4: STOP the entire wave, report errors, do not stamp
  any partial tasks as done.

---

## Quick-check checklist

```
[ ] workflow.subagent_commits_disabled_by_default checked → no subagent commits
[ ] wave size ≤ workflow.subagent_parallelism_max
[ ] model tier set per task kind (or cheap_model_for_mechanical=false)
[ ] no two concurrent streams write same file
[ ] typecheck gate included (unless typecheck_trust=true)
[ ] every subagent receives projectid + phase + task id
[ ] stamps: inline (batch=false) OR returned to main thread (batch=true)
```
