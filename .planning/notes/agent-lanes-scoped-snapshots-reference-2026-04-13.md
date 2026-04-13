# Agent Lanes, Scoped Snapshots, and Subagent Identity

Date: 2026-04-13

Status: design reference

Related decisions:

- `gad-147` — GAD workstreams are scoped execution contexts over shared planning artifacts, not duplicated planning trees
- `gad-148` — Query-oriented SDK is the canonical planning logic core; CLI remains the canonical operator surface
- `gad-146` — Claude-facing model profiles stay off by default and use runtime-safe aliases when enabled
- `gad-137` — Runtime identity in eval telemetry is runtime-derived first, self-declared second
- `gad-104` — Task attribution is a formal requirement in GAD artifacts

Related roadmap/tasks:

- Phase `41` — Scoped snapshots + query SDK + assignment-based workstreams
- `41-01` query-oriented SDK slice
- `41-02` scoped snapshot args
- `41-03` task claim/release/active
- `41-04` telemetry + site integration

---

## Origin of this reference

This document starts from the design question raised in conversation:

> "if agents have names and ids already, like the agents in the model profile and they make another subagent (not sure they would, i am pretty sure those agents are just prompt injected in to claude code again, thats great. if so and they are getting a task or they assign a task we need to have the agent id format down for tracing) we need to work through how these agents would work. like whats the pattern and workflow in our system. we need thorough examples with dialogue of a conversation"

The conversation then expanded into:

- multi-runtime coordination across Claude, Codex, and Cursor
- auto-registration via `gad snapshot`
- subagent lineage and trace attribution
- depth limits to prevent recursive explosion
- human operator lanes
- edge cases like stale claims, force-takeover, and cross-runtime spawning

This note captures the current GAD design direction so implementation work can
start from a stable contract instead of re-deriving the model later.

---

## Executive summary

GAD should model concurrent work as **agent lanes over shared planning state**.

That means:

- one canonical planning tree
- no duplicated `.planning/workstreams/<name>/` trees
- scoped snapshots for context narrowing
- explicit task claims/assignments
- unique agent ids for every worker
- trace lineage for parent/root relationships
- a hard depth limit of `1`

The CLI remains the operator and skill surface.

The query-oriented SDK becomes the canonical logic core.

---

## The core distinction: role vs id

These must stay separate forever.

### `agent-role`

Logical prompt identity or job shape.

Examples:

- `default`
- `gad-planner`
- `gad-executor`
- `gad-debugger`
- `reviewer`

This can repeat.

### `agent-id`

Unique runtime worker instance.

Examples:

- `claude-default-0001`
- `claude-gad-planner-0001`
- `codex-default-0001`
- `cursor-agent-default-0001`
- `human-reviewer-0001`

This must never repeat within the repo's coordination domain.

### Why the distinction matters

Named agents in model profiles are logical roles. They are not enough for:

- tracing
- task claims
- collision avoidance
- lineage reconstruction
- runtime/model attribution

Multiple workers can have the same `agent-role`. Only `agent-id` uniquely tells
us which worker did the work.

---

## What a "subagent" means in GAD

In practice, for Claude Code / Codex / Cursor, a subagent is usually:

- a new runtime instance or agent-tool instance
- bootstrapped with a role prompt
- given scoped context
- optionally given a model override or profile

So yes: a named agent role is typically prompt-injected into another runtime
instance.

That means subagents need:

- their own `agent-id`
- the inherited `agent-role`
- parent/root lineage
- scoped task/phase context

---

## The hard depth rule

This is non-negotiable.

### Rule

Maximum subagent depth is `1`.

### Allowed

- human operator -> root agent
- root agent -> subagent

### Not allowed

- subagent -> subagent
- subagent -> headless runner -> subagent
- recursive swarms
- implicit chains hidden inside automation

### Reason

This matches the controllable single-master-loop model and prevents:

- recursive explosion
- opaque tracing
- runaway token burn
- ownership ambiguity
- impossible debugging

### Operational interpretation

If a root agent wants more help, it can spawn several sibling subagents.

It cannot create grandchildren.

The valid lineage graph is therefore always:

- root agent
- zero or more direct child agents

Never deeper.

---

## Shared planning artifacts remain canonical

These stay single-source-of-truth:

- `STATE`
- `ROADMAP`
- `TASK-REGISTRY`
- `DECISIONS`
- `REQUIREMENTS`
- codebase maps
- docs maps
- references and generated planning views

This is the major divergence from upstream file-scoped workstreams.

GAD should not create separate copies of:

- `STATE`
- `ROADMAP`
- `REQUIREMENTS`
- `phases/`

under `.planning/workstreams/<name>/`.

Instead, context is narrowed by query/CLI scoping over the shared artifacts.

---

## Scoped snapshots are the bootstrap handshake

`gad snapshot` should be both:

1. the normal context loader
2. the identity/bootstrap handshake

That means agents should not need a separate mandatory `gad agent register`
step in the normal path.

### Normal usage

```bash
gad snapshot --projectid get-anything-done
```

or:

```bash
gad snapshot --projectid get-anything-done --taskid 41-02
```

If no `agent-id` is supplied, GAD should:

- detect runtime if possible
- detect runtime session id if possible
- auto-register a new worker identity if needed
- return that identity in the snapshot output

This keeps the loop unified: every worker already starts with snapshot.

---

## Proposed `gad snapshot` contract

## Inputs

Common:

- `--projectid <id>`
- optional `--phaseid <id>`
- optional `--taskid <id>`
- optional `--agentid <id>`
- optional `--role <role>`
- optional `--runtime <runtime>`
- optional `--parent-agentid <id>`

### Notes

- `--phaseid` narrows context to a phase
- `--taskid` narrows context further to a task
- `--agentid` is optional because snapshot can auto-register
- `--role` is needed when spawning a subagent
- `--parent-agentid` is how GAD knows this is a child lane

---

## Returned identity block

### Root agent example

```json
{
  "agent": {
    "agentId": "claude-default-0001",
    "agentRole": "default",
    "runtime": "claude-code",
    "runtimeSessionId": "sess_abc123",
    "parentAgentId": null,
    "rootAgentId": "claude-default-0001",
    "depth": 0,
    "modelProfile": "off",
    "resolvedModel": null,
    "autoRegistered": true,
    "humanOperator": false
  }
}
```

### Subagent example

```json
{
  "agent": {
    "agentId": "claude-gad-planner-0001",
    "agentRole": "gad-planner",
    "runtime": "claude-code",
    "runtimeSessionId": "sess_child_55",
    "parentAgentId": "claude-default-0001",
    "rootAgentId": "claude-default-0001",
    "depth": 1,
    "modelProfile": "balanced",
    "resolvedModel": "claude-sonnet-4-6",
    "autoRegistered": true,
    "humanOperator": false
  }
}
```

### Human lane example

```json
{
  "agent": {
    "agentId": "human-reviewer-0001",
    "agentRole": "reviewer",
    "runtime": "human",
    "runtimeSessionId": null,
    "parentAgentId": null,
    "rootAgentId": "human-reviewer-0001",
    "depth": 0,
    "modelProfile": null,
    "resolvedModel": null,
    "autoRegistered": false,
    "humanOperator": true
  }
}
```

---

## Scope block

```json
{
  "scope": {
    "projectId": "get-anything-done",
    "phaseId": "41",
    "taskId": "41-02",
    "snapshotMode": "task",
    "isScoped": true
  }
}
```

### Snapshot modes

- `project`
- `phase`
- `task`

The scoping level should be explicit in output and logs.

---

## Awareness block

```json
{
  "assignments": {
    "self": ["41-02"],
    "activeAgents": [
      {
        "agentId": "claude-default-0001",
        "agentRole": "default",
        "runtime": "claude-code",
        "depth": 0,
        "tasks": ["41-01"]
      },
      {
        "agentId": "codex-default-0001",
        "agentRole": "default",
        "runtime": "codex",
        "depth": 0,
        "tasks": ["41-03"]
      }
    ],
    "collisions": [],
    "staleAgents": []
  }
}
```

This is how agents become aware of each other.

Not by hidden chat state.
Not by separate planning trees.

By reading the shared assignment graph through snapshot output.

---

## Recommended agent id format

Use:

```text
<runtime>-<agent-role>-<seq>
```

Examples:

- `claude-default-0001`
- `claude-gad-planner-0001`
- `codex-gad-executor-0002`
- `cursor-agent-default-0001`
- `human-reviewer-0001`

### Why this format

- runtime is visible immediately
- role is visible immediately
- uniqueness comes from the sequence
- trace/reporting remains human-readable

### Do not put parent/root into the id string

Parent/root lineage should be fields:

- `parent-agent-id`
- `root-agent-id`

That is much easier to query and much easier to keep stable.

---

## Parent and root lineage

Every worker should carry:

- `agent-id`
- `parent-agent-id`
- `root-agent-id`
- `depth`

### Root worker

- `parent-agent-id = null`
- `root-agent-id = self`
- `depth = 0`

### Child worker

- `parent-agent-id = root agent id`
- `root-agent-id = root agent id`
- `depth = 1`

Because max depth is `1`, parent and root are usually the same for children.

Still store both fields explicitly because:

- it keeps the contract future-proof
- it makes root aggregation easier
- it avoids implicit assumptions in trace processing

---

## Model profiles and subagents

Model profiles should resolve at spawn/bootstrap time, not by mutating task
state later.

That means a child snapshot may include:

- `agentRole: gad-planner`
- `modelProfile: balanced`
- `resolvedModel: claude-sonnet-4-6`

This makes the contract explicit:

- role selection and model resolution are part of bootstrap
- trace records what was requested and what actually ran
- tasks can still record model metadata for audit/reporting

### Important distinction

- `agent-role` is the prompt/job role
- `model-profile` is the profile policy
- `resolved-model` is the actual runtime model

These are all different fields.

---

## Human operator lane

GAD should support a human lane explicitly.

This is useful for:

- human review
- manual task claiming
- operator overrides
- adjudicating collisions

Recommended values:

- `runtime = human`
- `agent-role = reviewer` or `operator`
- `agent-id = human-reviewer-0001` or `human-operator-0001`

This lets the system attribute:

- human claim decisions
- human review actions
- manual takeovers

without pretending a human action came from a coding runtime.

---

## Example flows

## Example 1: single root agent

Claude starts in the repo.

Command:

```bash
gad snapshot --projectid get-anything-done
```

Returned:

- `agentId = claude-default-0001`
- active agent list
- open task list
- suggested tasks

Claude claims a task:

```bash
gad tasks claim 41-01 --agentid claude-default-0001
```

Then gets a task-scoped snapshot:

```bash
gad snapshot --projectid get-anything-done --taskid 41-01 --agentid claude-default-0001
```

---

## Example 2: root agent spawning a child

Root Claude worker:

- `agent-id = claude-default-0001`

It decides to spawn a planner child for task `41-02`.

Bootstrap snapshot for child:

```bash
gad snapshot \
  --projectid get-anything-done \
  --taskid 41-02 \
  --role gad-planner \
  --runtime claude-code \
  --parent-agentid claude-default-0001
```

Returned:

- `agentId = claude-gad-planner-0001`
- `parentAgentId = claude-default-0001`
- `rootAgentId = claude-default-0001`
- `depth = 1`
- planner-scoped context

Claude then injects that into its own subagent spawn mechanism.

---

## Example 3: Claude, Codex, and Cursor at the same time

Three roots:

- `claude-default-0001`
- `codex-default-0001`
- `cursor-agent-default-0001`

Each starts with snapshot:

```bash
gad snapshot --projectid get-anything-done
```

Each gets:

- its own auto-registered id
- the current active assignment graph

Then claims:

```bash
gad tasks claim 41-01 --agentid claude-default-0001
gad tasks claim 41-02 --agentid codex-default-0001
gad tasks claim 41-03 --agentid cursor-agent-default-0001
```

Now any of them can ask:

```bash
gad tasks active
```

and see:

- `41-01` owned by Claude
- `41-02` owned by Codex
- `41-03` owned by Cursor

That is how they become aware of each other.

---

## Example 4: cross-runtime child spawning

Codex root:

- `codex-default-0001`

Codex wants a Claude planner child:

```bash
gad snapshot \
  --projectid get-anything-done \
  --taskid 41-02 \
  --role gad-planner \
  --runtime claude-code \
  --parent-agentid codex-default-0001
```

Returned:

- `agentId = claude-gad-planner-0001`
- `parentAgentId = codex-default-0001`
- `rootAgentId = codex-default-0001`
- `depth = 1`

This is valid.

Cross-runtime parent/child is fine.

What is not valid is allowing that child to spawn again.

---

## Example 5: invalid nested spawn

Planner child:

- `agentId = claude-gad-planner-0001`
- `depth = 1`

It tries to spawn analyzer child:

```bash
gad snapshot \
  --projectid get-anything-done \
  --taskid 41-04 \
  --role gad-assumptions-analyzer \
  --runtime claude-code \
  --parent-agentid claude-gad-planner-0001
```

Result:

```json
{
  "error": {
    "code": "MAX_AGENT_DEPTH",
    "message": "Subagents cannot spawn subagents. Maximum depth is 1."
  }
}
```

Hard failure.

---

## Example dialogue

This is a human-readable example of the intended interaction pattern.

### Conversation

User:

- Implement scoped snapshots and task claims.

Root Claude agent:

- I’m claiming `41-01` locally and assigning `41-02` and `41-03` to separate execution lanes.

Commands:

```bash
gad tasks claim 41-01 --agentid claude-default-0001
gad tasks claim 41-02 --agentid codex-default-0001
gad tasks claim 41-03 --agentid cursor-agent-default-0001
```

Claude asks for scoped context:

```bash
gad snapshot --projectid get-anything-done --taskid 41-01 --agentid claude-default-0001
```

Codex asks for scoped context:

```bash
gad snapshot --projectid get-anything-done --taskid 41-02 --agentid codex-default-0001
```

Cursor asks for scoped context:

```bash
gad snapshot --projectid get-anything-done --taskid 41-03 --agentid cursor-agent-default-0001
```

Later Claude wants a planner child for a different task:

```bash
gad snapshot \
  --projectid get-anything-done \
  --taskid 41-04 \
  --role gad-planner \
  --runtime claude-code \
  --parent-agentid claude-default-0001
```

Returned:

- `claude-gad-planner-0001`

Claude injects that snapshot into its subagent spawn.

The child works, finishes, and Claude integrates.

---

## CLI command sketch

This is the intended operator surface.

## Snapshot

```bash
gad snapshot --projectid <id> [--phaseid <id>] [--taskid <id>] [--agentid <id>] [--role <role>] [--runtime <runtime>] [--parent-agentid <id>]
```

Behavior:

- auto-register identity if needed
- return identity + lineage + scope + active assignments
- produce narrowed context when `--phaseid` or `--taskid` is present
- reject nested subagent spawn when `depth > 1`

## Task claim

```bash
gad tasks claim <taskid> --agentid <id> [--role <role>] [--runtime <runtime>] [--model-profile <profile>] [--force]
```

Behavior:

- claim a task for an agent
- fail on collision unless `--force`
- record assignment metadata

## Task release

```bash
gad tasks release <taskid> --agentid <id> [--done]
```

Behavior:

- remove active claim
- optionally mark done when appropriate

## Active assignments

```bash
gad tasks active
```

Behavior:

- list active agents
- list claimed tasks
- show stale lanes if detected

## Optional debug/operator command

```bash
gad agent register --runtime <runtime> --role <role>
```

This may exist for debugging, but should not be the normal path.

Snapshot auto-registration is preferred.

---

## TASK-REGISTRY schema direction

Tasks already support some attribution fields. The concurrency model needs a
normalized assignment contract.

Recommended fields:

- `agent-id`
- `agent-role`
- `runtime`
- `model-profile`
- `claimed`
- `completed`
- optional `lease-expires`

Example:

```xml
<task
  id="41-02"
  status="in-progress"
  agent-id="claude-gad-planner-0001"
  agent-role="gad-planner"
  runtime="claude-code"
  model-profile="balanced"
>
  <claimed>2026-04-13T10:42:01Z</claimed>
  <goal>Extend gad snapshot with scoped task context.</goal>
</task>
```

This is enough to drive:

- collision detection
- system dashboards
- per-agent tracing
- historical attribution

---

## Trace/event requirements

Every trace event relevant to agent work should carry:

- `agent-id`
- `agent-role`
- `runtime`
- `root-agent-id`
- `parent-agent-id`
- `depth`

Optional but useful:

- `task-id`
- `phase-id`
- `model-profile`
- `resolved-model`

This is required for:

- runtime comparisons
- subagent attribution
- lane-level token and tool accounting
- human/operator mixed workflows

---

## Edge cases and gotchas

These are the main ones we discussed and should explicitly test.

## 1. Same runtime, multiple terminals

Two Codex terminals must not both become `codex-default-0001`.

Need:

- runtime session discriminator
- or GAD allocation with uniqueness check

## 2. Restarted or compacted session

If the runtime reconnects to the same session, should it retain the same id?

Preferred:

- yes, if runtime session provenance matches
- otherwise allocate new id and mark old lane stale

## 3. Stale claims

An agent may disappear without releasing tasks.

Need:

- `claimed`
- `last-seen`
- optional lease expiry / staleness detection

## 4. Task stealing

Sometimes an operator wants to take over a task from another runtime.

Need:

```bash
gad tasks claim 41-02 --agentid claude-default-0001 --force
```

and this should be trace-visible.

## 5. Parent dies, child survives

Child should still retain:

- `parent-agent-id`
- `root-agent-id`

No hidden assumptions that parent must stay alive.

## 6. One agent owns multiple tasks

Valid, but should be surfaced clearly in system dashboards and snapshots.

## 7. Same role reused many times

Multiple agents may share `agent-role`.

That is expected.

Only `agent-id` must be unique.

## 8. Model changes mid-run

Do not silently overwrite the effective model.

Trace it as an event.

## 9. Cross-runtime child spawning

Valid.

Example:

- parent runtime = Codex
- child runtime = Claude

Lineage still works.

## 10. Human operator lane

Humans must be first-class in the assignment model.

Otherwise manual claims/reviews become invisible.

## 11. Invalid nested spawn

Must hard-fail, not warn.

This is a contract violation.

## 12. Snapshot without task or phase args

Project-wide snapshot is still valid.

It should:

- allocate identity
- return global active assignments
- suggest tasks

## 13. Conflicting runtime self-report vs detected runtime

Runtime-derived identity wins.

Self-reported runtime can be logged as secondary metadata only.

---

## Recommended implementation order

1. snapshot identity handshake
2. hard depth limit enforcement
3. task claim / release / active
4. scoped snapshot arguments
5. trace lineage fields
6. human operator lane
7. site/system reporting for active assignments
8. lease / heartbeat / stale-lane handling

---

## Testing guidance

This needs strong test coverage.

### Unit tests

- agent id generation
- role/id separation
- depth enforcement
- scoped snapshot assembly
- assignment collision detection
- force takeover
- stale lane detection logic

### Integration tests

- root snapshot auto-registers identity
- child snapshot inherits parent/root correctly
- child snapshot at depth 1 cannot spawn again
- three concurrent runtimes claim different tasks cleanly
- active assignment listing reflects claims/releases
- trace events include lineage fields

### Scenario tests

- Claude + Codex + Cursor active together
- cross-runtime child spawn
- human operator takeover
- runtime reconnect preserving identity
- stale task claim recovered by force or expiry

### Contract tests

- snapshot output schema
- task registry XML read/write compatibility
- CLI help and error messaging
- trace schema field presence

---

## Final recommendation

This is the GAD direction to implement:

- no duplicated planning trees
- no recursive subagent chains
- max agent depth `1`
- scoped snapshots as identity + context handshake
- task claims as the concurrency control layer
- query-oriented SDK as canonical logic
- CLI as the operator and skill surface

That gives us:

- better tracing
- better runtime interoperability
- better task coordination
- less planning drift
- a cleaner path to multi-agent work in one repo

without copying upstream workstream complexity directly.
