# Workstream + Query SDK Design — 2026-04-12

## Summary

GAD should adopt the upstream intent behind workstreams without copying the
upstream file-tree split.

Upstream `get-shit-done` solves parallel planning by namespacing planning files
under `.planning/workstreams/<name>/`. That works, but it duplicates planning
surfaces and complicates milestone completion, eval preservation, runtime
tracing, and site reporting.

For GAD, the better primitive is:

- one canonical shared planning tree
- scoped snapshots over that tree
- explicit task/phase assignment metadata
- unique agent ids for concurrent workers
- a query-oriented SDK layer that becomes the canonical logic core
- CLI commands as wrappers over that query layer

## Why this differs from upstream

Upstream workstreams are file-scoped.

That means:

- shared files stay at `.planning/`
- scoped files move to `.planning/workstreams/<name>/`
- routing depends on `--ws`, active pointers, and path rewriting

For GAD, that is too much indirection for the value we want.

What we actually need is:

- better context loading for a specific task or phase
- real-time coordination between multiple agents in one repo
- traceable ownership of work
- compatibility with evals and runtime telemetry

Those goals are better served by assignment and snapshot scoping than by
duplicating `STATE`, `ROADMAP`, `REQUIREMENTS`, and `phases/`.

## Canonical model

### Shared artifacts stay canonical

These remain single-source-of-truth:

- `STATE`
- `ROADMAP`
- `TASK-REGISTRY`
- `DECISIONS`
- `REQUIREMENTS`
- codebase maps / references / docs maps

### Scoped execution contexts are derived, not stored separately

Agents do not get a separate planning subtree.

Instead, they get a scoped view produced by the CLI/query layer:

```bash
gad snapshot --projectid get-anything-done --phaseid 35
gad snapshot --projectid get-anything-done --taskid 35-03
gad snapshot --projectid get-anything-done --taskid 35-03 --agentid codex-a17
```

The snapshot should inline:

- the targeted task or phase
- neighboring tasks that matter for collision awareness
- linked requirements / decisions
- referenced docs / workflows / templates
- assignment and runtime metadata

## Agent ids and assignment

Workstreams should be modeled as execution lanes, not file trees.

The lane key is the assigned agent.

### Agent identity fields

- `agent-id`
- `agent-role`
- `runtime`
- `model-profile`
- `resolved-model`

### Task assignment fields

Add or normalize these on tasks:

- `agent-id`
- `agent-role`
- `status`
- `claimed`
- `completed`
- `runtime`
- `model-profile`
- optional `lease-expires`

## Query-oriented SDK

### Current GAD shape

Today the SDK mixes:

- in-process orchestration
- subprocess calls to `gad-tools`

Example current bridge:

- `sdk/src/gsd-tools.ts` shells out through `execFile(...)`
- `sdk/src/index.ts` orchestrates phases and milestones around that bridge

### Desired shape

Move planning operations into typed query handlers that run in-process.

Examples:

- `getState(projectDir)`
- `getTaskRegistry(projectDir)`
- `getTask(projectDir, taskId)`
- `getScopedSnapshot(projectDir, { phaseId, taskId, agentId })`
- `claimTask(projectDir, { taskId, agentId, runtime, modelProfile })`
- `releaseTask(projectDir, { taskId, agentId })`
- `listActiveAssignments(projectDir)`

Then make the CLI thin:

```ts
const result = await getScopedSnapshot(projectDir, opts)
print(result)
```

instead of:

```ts
sdk -> exec gad-tools -> parse stdout -> continue orchestration
```

## Why this is better

### For skills

Skills should still call the CLI.

That is the operator-facing contract and keeps agent behavior explicit.

### For pipelines

Pipelines should use the query layer directly when possible:

- site data generation
- trace reconstruction
- eval preservation/reporting
- runtime adapters

### For future workstreams

A query layer makes scoped snapshots and assignment-state much easier to add
without inventing a second planning filesystem.

## First implementation slice

1. Extend `gad snapshot`:
   - `--phaseid`
   - `--taskid`
   - `--agentid`

2. Add task claim commands:
   - `gad tasks claim <taskid> --agentid <id>`
   - `gad tasks release <taskid> --agentid <id>`
   - `gad tasks active`

3. Introduce `sdk/src/query/` in GAD for:
   - state
   - roadmap
   - tasks
   - scoped snapshot context assembly
   - assignment

4. Normalize task attributes:
   - `agent-id`
   - `agent-role`
   - `runtime`
   - `model-profile`
   - `claimed`
   - `completed`

5. Extend trace/reporting to include assignment context when present.

## Non-goals for first implementation

- no duplicated `.planning/workstreams/*` directories
- no milestone completion branching based on workstream state yet
- no hidden pointer files
- no separate scoped `STATE` / `ROADMAP` / `REQUIREMENTS` trees

## Recommendation

Adopt this as the GAD workstream direction:

- workstreams are execution lanes over shared planning artifacts
- scoped snapshots are the context mechanism
- agent assignment is the concurrency mechanism
- query handlers are the canonical logic core
- CLI remains the primary operator and skill surface
