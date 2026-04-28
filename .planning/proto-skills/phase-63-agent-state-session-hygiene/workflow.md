# agent-state-session-hygiene — workflow

When multiple agent runtimes (claude-code, codex, cursor, gemini) share
a working tree, every shared write becomes a race condition and every
state field becomes a contested resource. Phase 63 (highest-pressure
candidate, 219 selection pressure, 55 tasks) inventoried every write
path and classified each into one of four patterns: contested aggregate
(CLI-mediated), shared append-only (JSONL), contested single-owner
(per-agent dir), or cross-agent intent (per-file dir + fs.rename).

## When to use

- A new shared state file is being added that more than one agent will
  write.
- A multi-agent race produced inconsistent state, lost writes, or
  attribution holes.
- Subagent dispatch is broken (no env attribution, missing claim records).
- A `gad` CLI subcommand surface needs a new write path; deciding the
  contention model up front saves a regression later.

## When NOT to use

- For agent-local state (`.planning/sessions/<id>.json`) that only the
  owning agent reads/writes.
- For ephemeral runtime state (memory, transient logs) that doesn't
  need persistence.
- For purely additive logs (those just need append-safe writes, not
  the full pattern audit).

## Steps

1. Inventory every write path. Common surfaces:
   - `.planning/STATE.xml` (state log + next-action)
   - `.planning/tasks/<id>.json` (per-task canonical, post-63-53)
   - `.planning/.gad-log/*.jsonl` (CLI call log)
   - `.planning/.trace-events.jsonl` (trace hook)
   - `.planning/.gad-agent-lanes.json` (lane registry)
   - `.planning/sessions/<id>.json` (per-agent session state)
   - `.planning/handoffs/{open,claimed,closed}/*.md` (work queue)
   - `.planning/notes/<date>-<agent>-<slug>.md` (long-form context)
   - `.planning/todos/<slug>.md`
   - `.gad/secrets/<projectid>[/<scope>].enc` (BYOK)
   - `~/.claude/gad-user.json` (per-user, non-checked-in)
2. Classify each into one of four patterns:
   - **Contested aggregate** (multiple writers, single file, partial
     mutations) → CLI-mediated writes only. Example:
     `STATE.xml <state-log>` (use `gad state log`, never `Edit`).
   - **Shared append-only stream** (multiple writers, append-safe per
     line) → JSONL append. Example: `.gad-log/*.jsonl`.
   - **Contested single-owner** (one logical owner per record but
     multiple writers create records) → per-agent or per-record dir.
     Example: per-task JSON files at `.planning/tasks/<id>.json`.
   - **Cross-agent intent / handoff** (work passing between agents
     atomically) → per-file directory + `fs.rename` lifecycle. Example:
     handoff queue in `.planning/handoffs/{open,claimed,closed}/`.
3. Implement the pattern shifts:
   - **Contested aggregate** → ensure a CLI subcommand exists for every
     mutation. Hand-editing must produce the same result; the CLI is
     just the safe path.
   - **Append-only** → confirm writes are atomic per line (no partial
     line writes; use `fs.appendFile` with newline-delimited records).
   - **Per-record dir** → migrate from monolithic file to per-file via
     phased dual-write (write both for one cycle, read from new, then
     drop old).
   - **fs.rename lifecycle** → handoff dirs are atomic on POSIX +
     Windows when source and dest are on the same volume.
4. Author `references/state-writes-inventory.md` (per task 63-01) so
   the next agent inherits the classification.
5. Author the agent lane manifest (per 63-04):
   - Per-runtime allow + deny globs.
   - Shared-write protocols (use `gad tasks add`, never raw Edit on
     `.planning/tasks/*`).
   - Conflict-resolution playbook (who wins, how to cede).
   - Session-start etiquette (read this file BEFORE touching anything).
6. User settings scaffold (per 63-03):
   - `~/.claude/gad-user.json` (or `.planning/.gad-user.json` per repo).
   - Fields: `displayName` (fallback to `os.userInfo().username`),
     `lastActiveProjectid`, `assignedSouls`, `lastSessionId`,
     `preferredRuntime`, `teachingSnoozeUntil`.
   - Gitignored.
   - Read by `gad startup`, `gad snapshot`, SessionStart hook.
7. Session continuity contract (per 63-02):
   - `gad snapshot --create-session` auto-creates a session record on
     first call of the day (or `gad startup` for explicit creation).
   - Surface unclaimed handoff count + top-3 summary.
   - Auto-claim if exactly one unclaimed handoff matches the runtime.
8. Daily-tip + soul wiring (per 63-05):
   - SessionStart hook emits the day's teaching tip.
   - Emits "Active soul: <name> (SOUL.md)" when SOUL.md is present.
   - Tip generation runs at startup with dedup across multiple sessions
     per day.

## Guardrails

- The four-pattern classification is the contract. Adding a new state
  surface without classifying it is how races re-emerge.
- Sessions are local-only; never commit `.planning/sessions/*.json`.
- `STATE.xml <next-action>` is per-session field post 63-13 — keep the
  file lightweight, never rewrite it with essays.
- Handoff queue lifecycle is fs.rename only. Never edit a handoff in
  `claimed/` and re-rename to `open/` to "release" it; create a new
  handoff in `open/` instead.
- `gad subagents dispatch` must respect runtime preference + project
  filter; otherwise daily runs misfire.

## Failure modes

- **TASK-REGISTRY race** — two agents add to the XML simultaneously,
  one write wins. Migrate to per-task JSON (decision 63-53 / 63-11).
- **Stale graph cache after task status change** — `gad query <id>`
  returns old status. `lib/graph-extractor.cjs::isGraphStale` mtime-
  compares graph.json vs source XMLs (per fix 63-graph-task-stale).
- **Worker dispatcher dies on Windows with malformed argv** — the gad.exe
  sea binary's `process.execPath` returns gad.exe, not node. Use
  `lib/node-exec.cjs::pickNodeExecutable()` instead (per 63-18).
- **Codex hooks hang detached worker** — auto-inject headless flags
  `-c features.codex_hooks=false -c notify=[]` when runtime=codex-cli
  (per 63-21).
- **Worker loop reads empty handoff body** — `claimHandoff` returns
  destPath (string), not an object. Call `readHandoff()` after claim
  (per 63-19).
- **AI-written heartbeat anti-pattern** — drop `last_heartbeat` writes
  from worker-loop; infer liveness from `log.jsonl` mtime (per 63-20).

## Reference

- Decisions gad-167 (sessions are local-only), 63-53 (per-task JSON
  canonical), 2026-04-20 D2/D3/D4/D6 (handoff renames are work locks,
  TASK-REGISTRY migration, next-action per-session, startup =
  snapshot --create-session).
- Phase 63 tasks 63-01..63-21 (and beyond — 55 total).
- `gad-handoffs` skill — handoff queue operations.
- Memory entries: `project_log_inference_liveness`, `feedback_no_stash_with_parallel_agents`,
  `feedback_use_gad_team_restart`.
- ERRORS-AND-ATTEMPTS.xml — every prior failure documented for
  pattern-recognition.
