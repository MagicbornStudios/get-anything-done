# Phase 25 — Trace schema v4 + framework versioning · PLAN

**Phase:** 25
**Status:** ready for execute-phase
**Discuss-phase output:** `.planning/DISCUSS-PHASE-25.md`
**Decisions referenced:** gad-50, gad-51, gad-53, gad-54, gad-55, gad-58, gad-59, gad-60

---

## Goal (restated from discuss-phase)

Make every dimension score on a per-run page explicable after the fact. Today,
`skill_accuracy: 0.17` has no breakdown — we can't tell which of the expected skills fired,
which tools the agent called, which subagents spawned, or which framework commit the run was
recorded against. Phase 25 ships trace schema v4 (hook-captured, structured event stream) and
framework versioning (branch-frozen snapshots, commit-stamped runs).

## Definition of done

Phase 25 is done when:

1. Running `gad install hooks` in a workspace writes PreToolUse + PostToolUse handler
   references into `~/.claude/settings.json` pointing at the GAD-shipped handler.
2. Running an eval with hooks installed produces a `.planning/.trace-events.jsonl` file
   alongside the run with tool_use, skill_invocation, subagent_spawn, and file_mutation
   events, each with the envelope `{ ts, seq, type, ... }`.
3. `gad eval preserve` reads the JSONL and merges it into a trace schema v4 TRACE.json with
   the aggregate fields populated from the event stream (skill_accuracy.expected_triggers is
   derived from skill_invocation events matched against gad.json's declared triggers).
4. Every new TRACE.json stamps `framework_version`, `framework_commit`, `framework_branch`,
   `framework_commit_ts`.
5. `gad eval run` refuses to start when hooks are not installed (enforces decision gad-53).
6. `gad eval diff` surfaces framework-version mismatches in its output.
7. The site's per-run page renders tool-use timeline, subagent-spawn list, and framework
   version badge. Legacy pre-v4 runs continue to render with the existing "tracing gap"
   callout.
8. At least one real eval run completes end-to-end with the full v4 data populated (use
   escape-the-dungeon or escape-the-dungeon-bare).

## Non-goals

- Codex / Aider / Continue converters (future sub-phases per decision gad-55)
- Backfilling old TRACE.json files (decision gad-54: freeze old, stamp new)
- Rewriting the composite formula
- Remotion video authoring against v4 data (that's phase 26 post-25)

---

## Task breakdown

### Milestone A — hook wiring + tool_use capture (tasks 25-01 → 25-06)

**25-01** — Design the `.trace-events.jsonl` event envelope and four event types as a TypeScript
interface in `vendor/get-anything-done/lib/trace-schema.ts`. Document the four event types:
`tool_use`, `skill_invocation`, `subagent_spawn`, `file_mutation`. Export type guards.
- **Verify:** new file compiles; unit test validates a sample event matches the schema.
- **Depends:** none
- **Produces:** `lib/trace-schema.ts`, `tests/trace-schema.test.cjs`

**25-02** — Write the hook handler script at `vendor/get-anything-done/bin/gad-trace-hook.cjs`.
Reads the Claude Code hook payload from stdin (per its hook contract), detects the hook type
(PreToolUse vs PostToolUse), builds the appropriate event, appends it to
`<project-root>/.planning/.trace-events.jsonl` synchronously. On PreToolUse: read
`.planning/.trace-active-skill` if present and attach its content as `trigger_skill`. On
PostToolUse: attach outcome + truncated output (4 KB cap per decision gad-60).
- **Verify:** direct invocation with a mock hook payload writes a valid JSONL line.
- **Depends:** 25-01
- **Produces:** `bin/gad-trace-hook.cjs`, `tests/gad-trace-hook.test.cjs`

**25-03** — Implement the 4 KB output truncation helper with head+tail split (2 KB head + 2 KB
tail joined by `... [truncated N bytes] ...` marker, `truncated: true` flag). Used by 25-02
for tool output fields.
- **Verify:** unit tests cover under-cap, over-cap, exactly-cap, and multibyte edge cases.
- **Depends:** 25-01
- **Produces:** `lib/trace-truncate.cjs`

**25-04** — `gad install hooks` CLI subcommand. Writes PreToolUse + PostToolUse entries into
`~/.claude/settings.json` referencing the absolute path to `bin/gad-trace-hook.cjs` from the
installed GAD package. Preserves existing settings via merge, not overwrite.
`gad uninstall hooks` is the reverse operation.
- **Verify:** install + uninstall round-trip on a sample settings.json leaves the file
  identical except for the GAD handler entries.
- **Depends:** 25-02
- **Produces:** `bin/commands/install.cjs`, updates to `bin/gad.cjs`

**25-05** — Update `gad eval run` to refuse starting if hooks aren't installed. Detection:
inspect `~/.claude/settings.json` for the GAD handler entries. Error message includes the
fix (`gad install hooks`) and references decision gad-53.
- **Verify:** run `gad eval run escape-the-dungeon` with hooks removed — errors clearly with
  the fix instruction.
- **Depends:** 25-04
- **Produces:** updates to `lib/eval-runner.cjs`

**25-06** — End-to-end test: install hooks, run `gad eval run escape-the-dungeon`, verify a
`.trace-events.jsonl` file lands with at least 10 tool_use events.
- **Verify:** file exists, events parse, every event matches the schema.
- **Depends:** 25-01 through 25-05
- **Produces:** `tests/trace-e2e.test.cjs`

### Milestone B — skill_invocation + subagent_spawn events (tasks 25-07 → 25-11)

**25-07** — Implement the `.planning/.trace-active-skill` marker contract. Document in
`skills/create-skill/SKILL.md` that skill authors must include a line "write the active skill
id to `.planning/.trace-active-skill` at start, clear on end." The hook handler from 25-02
already reads this file; this task is documentation + updating existing skill docs to
include the marker discipline. No code change beyond the docs.
- **Verify:** `skills/create-skill/SKILL.md` includes the marker section; spot-check
  `skills/plan-phase/SKILL.md` and `skills/execute-phase/SKILL.md` also mention it.
- **Depends:** 25-02
- **Produces:** updates to 5-6 skill docs

**25-08** — Hook handler detects file content changes to `.trace-active-skill` between
events and emits a discrete `skill_invocation` event on each transition. Captures `parent`
field when a skill transitions from a previously-active one. Handles the "cleared" state as
"no active skill."
- **Verify:** manual test writing a sequence of skill ids to the marker file + confirming
  the hook emits the right sequence of skill_invocation events with correct parents.
- **Depends:** 25-02, 25-07
- **Produces:** updates to `bin/gad-trace-hook.cjs`

**25-09** — `subagent_spawn` event emission. Hook handler checks the PostToolUse payload for
`Task` tool invocations and emits a `subagent_spawn` event with the agent id (parsed from
the Task inputs), the inputs, and a summary of the outputs. Uses the 4 KB truncation helper.
- **Verify:** mock a Task tool call in a test payload, confirm subagent_spawn event is
  correctly shaped.
- **Depends:** 25-02
- **Produces:** updates to `bin/gad-trace-hook.cjs`, `tests/gad-trace-hook.test.cjs`

**25-10** — `file_mutation` event emission. Hook handler checks PostToolUse payload for
`Write`, `Edit`, `NotebookEdit` tool invocations and emits a `file_mutation` event with
path, op (create/edit/delete), size_delta. Hash fields (hash_before, hash_after) are deferred
to a follow-up if needed — the simpler size-delta captures most of the signal for phase 25.
- **Verify:** mock each write-class tool call, confirm file_mutation event correctly shaped.
- **Depends:** 25-02
- **Produces:** updates to `bin/gad-trace-hook.cjs`

**25-11** — Milestone B e2e test: re-run escape-the-dungeon with the extended hook. Verify
the JSONL contains at least one event of each type (tool_use, skill_invocation,
subagent_spawn where applicable, file_mutation).
- **Verify:** file contains all four event types; counts are reasonable relative to the
  run's observed work.
- **Depends:** 25-06, 25-08, 25-09, 25-10
- **Produces:** updates to `tests/trace-e2e.test.cjs`

### Milestone C — framework versioning (tasks 25-12 → 25-14)

**25-12** — `gad version` CLI subcommand. Reads `package.json` version, git HEAD commit sha
(short form), current branch name, commit timestamp. Returns as JSON. Used by the eval
preserver to stamp TRACE.json.
- **Verify:** `gad version` prints `{"version": "...", "commit": "...", "branch": "...", "commit_ts": "..."}`.
- **Depends:** none
- **Produces:** `bin/commands/version.cjs`

**25-13** — `gad eval preserve` writes framework version fields into TRACE.json via
`gad version`. Also merges `.planning/.trace-events.jsonl` into the TRACE.json as a
`trace_events` array (full v4 data) AND derives the v3-compatible aggregate fields
(`skill_accuracy.expected_triggers`, `requirement_coverage.gate_failed`, etc) from the
event stream. Preserves both so the site can render either. Bumps `trace_schema_version`
from 3 to 4 only for runs that have v4 events.
- **Verify:** preserve a run with a populated JSONL; resulting TRACE.json has
  `trace_schema_version: 4`, framework fields, full `trace_events` array, and the v3
  aggregate fields derived from events.
- **Depends:** 25-06, 25-12
- **Produces:** updates to `lib/eval-preserver.cjs`

**25-14** — `gad eval diff <project> <v1> <v2>` surfaces framework version mismatch in its
output. If the two runs recorded different `framework_commit` values, prepend a bold warning
to the diff output with the commit range and a note that score deltas may reflect framework
changes rather than agent changes.
- **Verify:** diff two runs with different framework commits, verify the warning appears.
- **Depends:** 25-13
- **Produces:** updates to `lib/eval-differ.cjs` (or wherever diff output lives)

### Milestone D — site rendering (tasks 25-15 → 25-22)

**25-15** — Update `site/scripts/build-site-data.mjs` to parse trace_schema_version 4
TRACE.json files. New fields on EvalRunRecord: `traceSchemaVersion`, `frameworkVersion`,
`frameworkCommit`, `frameworkBranch`, `frameworkCommitTs`, and a `traceEvents` array (or
lazy-loaded reference if the array is too large to ship in the generated TS).
- **Verify:** prebuild succeeds with a mix of v3 and v4 runs in the evals/ dir.
- **Depends:** 25-13
- **Produces:** updates to `site/scripts/build-site-data.mjs`, `lib/eval-data.generated.ts`
  type definitions

**25-16** — Per-run page: tool use timeline section. When `traceEvents` contains at least one
`tool_use`, render a chronological list with tool name, duration, outcome, and trigger_skill
attribution. Filterable by tool name. When absent, the section hides entirely.
- **Verify:** local build renders the section for a v4 run, hides for a v3 run.
- **Depends:** 25-15
- **Produces:** updates to `site/app/runs/[project]/[version]/page.tsx`,
  new `site/components/run-detail/ToolUseTimeline.tsx`

**25-17** — Per-run page: subagent spawns section. Same pattern as 25-16 but for
`subagent_spawn` events. Each row is a card with the agent id (linked to
`/agents/[id]`), inputs summary, outputs summary, duration.
- **Verify:** local build renders for a run with subagent spawns.
- **Depends:** 25-15
- **Produces:** new `site/components/run-detail/SubagentSpawns.tsx`

**25-18** — Per-run page: framework version badge. Next to the existing requirements version
badge in the header. When hovering, shows the commit sha + branch. When a cross-version
comparison link exists (diff against previous run), show a small note like "this run used
framework v1.32.0; the previous run used v1.31.0 — diff".
- **Verify:** local build shows the badge on a run with framework fields populated.
- **Depends:** 25-15
- **Produces:** updates to `site/app/runs/[project]/[version]/page.tsx`

**25-19** — Update the skill accuracy section on per-run pages: when `traceEvents` has
`skill_invocation` events, derive the per-skill breakdown client-side OR rely on the
v4-derived `skill_accuracy.expected_triggers` field. The existing "tracing gap" callout
automatically disappears for v4 runs because the breakdown is populated.
- **Verify:** local build shows the full skill breakdown for a v4 run, the tracing gap
  callout still shows for v3 runs.
- **Depends:** 25-13, 25-15
- **Produces:** updates to `site/app/runs/[project]/[version]/page.tsx`

**25-20** — `/methodology` page: replace the v3 trace field stubs with the v4 schema
documentation. List the four event types, their envelope, the truncation cap, the framework
version fields. Keep the "known gaps" callout but rewrite it as "what v4 fixed".
- **Verify:** local build renders the updated section.
- **Depends:** 25-15
- **Produces:** updates to `site/app/methodology/page.tsx`

**25-21** — `/gad` page: framework versions section. Lists every framework version seen
across runs, with a count of runs per version. Links each version to a page showing the
diff against the previous version.
- **Verify:** local build shows a version list.
- **Depends:** 25-15
- **Produces:** updates to `site/app/gad/page.tsx`

**25-22** — Update `skills/framework-upgrade/SKILL.md` to reference the v4 trace fields and
the `gad install hooks` requirement. Update `/lineage` page to note that GAD adds trace v4
as the honest-measurement contribution beyond GSD and RepoPlanner.
- **Verify:** doc links work, site renders.
- **Depends:** 25-20
- **Produces:** doc updates

## Verification commands

```sh
# After each task, run:
cd vendor/get-anything-done && npm test          # unit tests
cd vendor/get-anything-done/site && node scripts/build-site-data.mjs && npx next build   # site build

# Milestone A end:
gad install hooks && gad eval run escape-the-dungeon     # should produce .trace-events.jsonl

# Milestone B end:
cat <run-dir>/.planning/.trace-events.jsonl | grep -c skill_invocation    # > 0
cat <run-dir>/.planning/.trace-events.jsonl | grep -c subagent_spawn      # >= 0

# Milestone C end:
gad eval preserve escape-the-dungeon v<N> --from <worktree>
jq '.trace_schema_version, .framework_version' evals/escape-the-dungeon/v<N>/TRACE.json
# → 4, "1.33.0" (or whatever semver)

# Milestone D end:
# Visit /runs/escape-the-dungeon/v<N> on the deployed site
# Confirm: tool use timeline, subagent spawns, framework badge, skill accuracy breakdown all present
# Confirm: legacy /runs/escape-the-dungeon/v5 still renders v3 shape correctly
```

## Commits

One atomic commit per task, commit message prefix `feat(trace):` or `feat(install):` or
`feat(version):` as appropriate. Every commit updates `.planning/TASK-REGISTRY.xml` to mark
the task done with its resolution field. Every 3-4 commits, update `.planning/STATE.xml`
next-action to reflect current position. Milestone boundaries get a roadmap status bump.

## Rollback plan

If any milestone lands broken:
- Milestone A/B hook issues: `gad uninstall hooks` reverts settings.json; stop writing to
  trace-events.jsonl; the old eval runner still works unchanged (decision gad-54 — old runs
  unaffected).
- Milestone C preserver bug: revert the preserver changes; old `gad eval preserve` still
  produces v3 TRACE.json; site still renders v3 runs correctly.
- Milestone D site issues: revert the site commits; v4 runs will still exist on disk, just
  won't be rendered with the new sections until the site is re-shipped.

No destructive operations. Every milestone is independently revertible.
