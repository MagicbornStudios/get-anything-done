# Structural parallelism — per-agent task outbox + file-watch activity signal

**Source:** Session 2026-04-16d (operator proposal, post cost-breakdown SITREP)
**Area:** framework / cli / planning schema
**Urgency:** high (unblocks parallel scaling)

## Problem

Today every agent edits the same `.planning/TASK-REGISTRY.xml`,
`STATE.xml`, and `DECISIONS.xml`. Three agents finishing tasks at the same
time = structural merge conflict, not occasional. This is the single biggest
overhead item in the parallel-subagent cost table (see sibling todo
`2026-04-16-site-article-parallel-subagent-cost.md`).

## Proposal — outbox pattern

Each agent works against **its own scratch file**. A reconciler merges scratch
files into the canonical registry on commit. Shared files become the
**commit point**, not the work surface.

### File layout

```
.planning/
  TASK-REGISTRY.xml          # canonical, single-writer (reconciler)
  STATE.xml                   # canonical
  DECISIONS.xml               # canonical
  agent-tasks/                # scratch, one file per agent session
    <agent-id>.xml            # in-flight task(s) claimed by this agent
    <agent-id>.decisions.xml  # decisions staged but not yet merged
```

### Lifecycle

```
gad task claim <task-id> --agent <agent-id>
  -> carves task from TASK-REGISTRY into .planning/agent-tasks/<agent-id>.xml
  -> canonical TASK-REGISTRY marks task status="in-progress" agent="<agent-id>"

# agent works, may edit its own scratch file freely, no contention

gad task commit <task-id> --agent <agent-id>
  -> merges scratch back into TASK-REGISTRY with status="done" + attribution
  -> deletes scratch file entry (task line) from agent-tasks/<agent-id>.xml
  -> if scratch file empty after commit, remove the file

gad task release <task-id> --agent <agent-id>
  -> abandon without completing; returns task to planned, removes from scratch
```

### Auto-reorganization

As tasks land, the reconciler keeps TASK-REGISTRY ordered by
phase → status → task-id (current convention). No user-visible difference
from today's file.

### DECISIONS.xml — same pattern, different merge

Append-only is already natural for decisions. Scratch file
`agent-tasks/<agent-id>.decisions.xml` collects decisions staged during the
session. `gad decision commit <id> --agent <agent-id>` appends to canonical.
ID collision handled by CLI allocating next free `gad-NNN`.

### STATE.xml — still single-writer

`<next-action>` is a session-scoped narrative, not per-task. Continues to be
written by whoever is closing the session. Scratch agents do NOT touch it.

## Bonus — file-watch activity detection

The `.planning/agent-tasks/` directory becomes the canonical signal for
*"what agent is working on what right now"*:

- File watcher (existing backlog item) streams presence + mtime
- Editor / site can render live agent-activity panel without inventing
  new instrumentation
- `gad worktree list` already lists agent worktrees; joining on agent-tasks/
  content gives per-agent in-flight task list

## Open design questions

| Q | Candidate answer |
|--|--|
| ID collision on new tasks created during session | CLI allocates next free id from TASK-REGISTRY at claim time; scratch owns that range until commit |
| Agent dies, scratch file orphaned | `gad task gc` sweeps by agent-id + worktree status; stale-release after N hours |
| Two agents try to claim the same task | Atomic claim via file lock on TASK-REGISTRY; first writer wins |
| Ordering of interleaved decisions | Reconciler sorts by timestamp, not claim order |
| Schema drift between scratch and canonical | Same schema; scratch is a subset projection of TASK-REGISTRY rows |

## Dependencies

- `gad task claim/commit/release` CLI subcommands (new)
- File watcher (already wanted for agent activity UI)
- Editor UI surface for agent-activity panel (todo:
  `2026-04-16-editor-ux-and-platform.md`)

## Test plan

1. Implement claim/commit/release against canonical schema
2. Dry-run with two simulated agent-ids on disjoint tasks
3. Stress: three agents, overlapping phase subtree, finish within a few
   seconds of each other — confirm no conflicts
4. Document the pattern in `references/parallel-outbox.md`
5. Write a skill (`parallel-orchestrator`?) that uses this plumbing

## Next step

Capture as a formal roadmap phase after current sprint. Needs its own
discuss-phase because it touches schema + CLI + docs.
