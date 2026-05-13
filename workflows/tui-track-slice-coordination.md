# tui-track-slice-coordination — workflow

When a TUI build cuts across 7+ feature tracks (transcript, prompt,
runtime, tasks/handoffs, context, skills/observability/integrations,
server/watcher/workflow) and the work fans out across multiple agents
in parallel, the coordination model is "slice by track, ship slice
end-to-end, name the commits". Phase 65 shipped 27 specs across 7
tracks via slice-based parallelization in 13 tasks.

## When to use

- Building a TUI / dashboard with many parallel tracks of feature work.
- Multi-agent sprint where each agent owns 1-2 slices end-to-end.
- Releasing in cohesive feature batches rather than file-by-file.

## When NOT to use

- For single-feature TUI changes (just edit and ship).
- For a TUI rewrite / framework change (different planning shape).
- For non-TUI multi-track work (the slice model still applies but the
  track names don't carry over).

## Steps

1. Author a TUI requirements doc that breaks the work into named tracks.
   Phase 65 used 7:
   - **Track 1**: transcript / rendering (status bar, syntax highlighting,
     ANSI normalize, timestamps, collapsible blocks, compaction reminder).
   - **Track 2**: prompt input (multi-line editor, `@` autocomplete,
     slash arg hints, paste detection, history ghost text).
   - **Track 3**: runtime / session control (status strip, thread
     switcher, fleet panel).
   - **Track 4**: tasks + handoffs (resume banner, /tasks panel, task
     tree, /handoff wizard, /review queue).
   - **Track 5**: context engineering (/snapshot, /context, token
     sparkline, cache hit-rate, /cost).
   - **Track 6**: skills (/skills picker, /skill find, /skill candidates).
   - **Track 7**: observability (/events, tool intent breadcrumb,
     trace replay).
   - (Plus slices for server, watcher, workflow.)
2. Create one phase-task per slice (Slice A through G is conventional)
   with all specs in that slice listed by id (R1.1 through R1.8 for
   transcript, etc.).
3. Assign each slice to one agent end-to-end. The agent owns:
   - The track's components.
   - The keybindings.
   - The status-bar integration.
   - The state file (if the slice writes config to `.gad/tui-state.json`).
4. Commit per spec (small) but ship per slice (large). Slice commits
   reference the spec ids in the message body so reviewers can map
   commit → spec → requirements doc.
5. Cross-lane handoff protocol (per 65-B2):
   - **CLI lane (claude-code)**: `gad handoffs claim-next` + startup
     HANDOFFS section + `gad handoffs create-closeout` + `type: closeout`
     frontmatter + `gad subagents status` + `mark-completed` + startup
     DAILY SUBAGENTS PENDING section.
   - **TUI lane (codex)**: implements the panels + components.
   - **Cross-lane**: handoffs queue is the canonical channel.
6. Self-resume handoff (per 65-SR):
   - `lib/handoffs.cjs::createSelfResumeHandoff` + `findSelfResumeHandoffs`.
   - Body schema: `task_id, phase, last_commit, stopped_at, what's done,
     what's left, blockers`.
   - Frontmatter `type=self-resume + resume_task`.
7. Shell-profile installer (per 65-SP):
   - `lib/shell-profile-snippet.cjs` — idempotent BEGIN/END block
     generator for bash / zsh / pwsh, 9 runtimes.
   - `scripts/install-shell-profile.cjs` — standalone CLI
     (install / uninstall / status / show).
   - Precedence: `cursor / codex / gemini / opencode` first so inherited
     CLAUDECODE from a parent Claude Code session doesn't mask narrower
     runtime detection.
8. Liveness inference (per 65-AS):
   - `lib/agents-status.cjs` `inferLivenessFromLogs` reads
     `.planning/.gad-log` + `.planning/.trace-events`.
   - Tags sources `[cli|hook]`.
   - 10-min stale threshold.
   - No heartbeats — drop the AI-written heartbeat anti-pattern (see
     `agent-state-session-hygiene` skill).
9. Planning notes (per 65-PN):
   - Durable discussion docs at `.planning/notes/`.
   - Examples from phase 65: `tui-requirements.md`,
     `tui-requirements-discovery.md`, `skills-on-demand.md`,
     `a2a-research.md`, `task-handoff-phase-unified-model.md`,
     `llm-from-scratch-purpose.md`, `cross-lane-build-plan.md`,
     `daily-routine-a2a-windows-hud-consolidated.md`,
     `per-runtime-hooks-detection.md`.
   - `gad note questions` surfaces ## Open questions sections from
     planning notes.

## Guardrails

- Slices must be independent enough to ship out of order. If slice C
  depends on slice B, the dependency is a coordination smell — refactor
  the slice boundary.
- One agent per slice. Two agents on the same track produces merge
  conflicts on the same files.
- Commit messages must reference spec ids. Reviewer should be able to
  trace any commit back to a requirements line.
- Fleet panel + thread switcher + handoff queue all read from the same
  state surfaces. Don't introduce a new state file when an existing
  one carries the data.

## Failure modes

- **Two slices ship the same component.** Track ownership is ambiguous
  in the requirements doc — fix the doc, then collapse the duplicate
  in code.
- **Slice E (context) blocks because Slice C (runtime) hasn't shipped
  the status bar.** Status bar should be a pre-merge prerequisite, not
  inside any slice.
- **Cross-lane handoff missed because closeout type wasn't set.**
  Always use `gad handoffs create-closeout` for closure handoffs;
  `type: closeout` frontmatter is the trigger for the receiving
  agent's pickup logic.
- **Self-resume handoff has empty body.** Body schema is required;
  enforce in `createSelfResumeHandoff`.

## Reference

- Phase 65 tasks 65-A..65-G, 65-B2, 65-AS, 65-SP, 65-SR, 65-TT, 65-PN.
- Memory: `project_log_inference_liveness`, `feedback_handoff_queue_validated`,
  `project_phase_64_tui_orchestrator`.
- `agent-state-session-hygiene` skill — overlapping concerns on shared
  state.
- `gad-handoffs` skill — handoff queue operations.
