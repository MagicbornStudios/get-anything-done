# Shrink ROADMAP.xml surface area

**Date captured**: 2026-04-16
**Related decisions**: gad-229 (roadmap demoted from gauge bank), gad-226
**Status**: parked — do NOT execute mid-flight. Revisit after gauge UI lands.

## The idea

Current ROADMAP.xml is 319 lines × 51 phases × `{id, title, goal, status, depends}`
per phase. The operator-facing value reduces to **`{goal, depends}`** per
phase — everything else is redundant with task data (`status` derivable) or
duplicative prose (`title` mostly paraphrases `goal`).

## Scope when it happens

Shrink each `<phase>` from five fields to three:

```xml
<!-- Before -->
<phase id="42.4">
  <title>Context framework as first-class catalog type</title>
  <goal>Introduce ContextFramework as a new top-level catalog content type...</goal>
  <status>planned</status>
  <depends>42.3,43</depends>
</phase>

<!-- After -->
<phase id="42.4" depends="42.3,43">
  <goal>Introduce ContextFramework as a new top-level catalog content type...</goal>
</phase>
```

Status becomes derived (computed from task statuses in TASK-REGISTRY) rather
than stored. Title either disappears (goal's first sentence is the title) or
moves inline.

## Dependencies

- **Do not execute until**: gauge UI (planning-artifact-gauges todo) is
  shipped and we can see whether phase-level `goal` + `depends` show up in
  any human-facing view. If they don't surface, this shrink is greenlit.
  If they do, reconsider scope.
- Reader changes: `lib/roadmap-reader.cjs` and anything consuming `title`
  or stored `status` needs migration (status consumers recompute from tasks).
- `gad phases` output stays the same (title/goal/status recomputed from the
  shrunk schema).

## Why parked

User directive 2026-04-16: "we can keep as is for now and we want to reduce
redundant context surfaces like that later." Concurrent-write pain (the
operator's primary concrete complaint) is already addressed by the outbox
todo; this shrink is pure hygiene and should not interrupt phase 45 wave 2.

## Broader principle (watch-for)

"Redundant context surfaces" is a class of things to audit, not just roadmap.
Candidates that may join this todo later:
- STATE.xml next-action vs TASK-REGISTRY phase/resolution prose
- DECISIONS.xml impact vs summary overlap
- per-phase CANDIDATE.md files vs proto-skill dir metadata

Not acting on these now; captured so the pattern is visible next time we
audit planning-doc information density.
