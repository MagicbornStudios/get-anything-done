# split-planning-app-from-marketing — workflow

When marketing/landing surfaces and operator-facing surfaces have grown
into the same Next app, the split is one phase: scaffold the new app,
extract shared UI, port operator routes, build the CLI launcher
(`gad planning serve` / `gad start`), wire daily-subagent dispatch,
deprecate the original locations. Phase 59 shipped 11 tasks.

## When to use

- A site has accreted operator-facing routes (project editor, BYOK,
  /my-projects) inside the public marketing tree and the boundary needs
  to be enforced.
- Adding a CLI launcher (`gad start`) that should boot operator surfaces
  on demand.
- Daily-subagent dispatch needs a host that's not the public site.

## When NOT to use

- For pure marketing splits with no auth (use `move-route-with-deprecation-stub`).
- For operator surfaces inside a Tauri shell (use `scaffold-tauri-desktop-shell`).

## Steps

1. Scaffold the new operator app:
   - `apps/<name>` (e.g. `apps/planning-app`).
   - Layout with dev-only auth stub.
   - Home page redirecting to `/my-projects`.
   - Tailwind config mirroring the landing app.
   - Distinct dev port (e.g. 3002) so it coexists with marketing.
2. Extract shared UI primitives (per task 59-02):
   - **Option A (heavy):** `packages/ui-shared` workspace package.
   - **Option B (light, prefer initially):** direct imports from
     `vendor/<framework>/site/components/site/` with a re-export barrel.
   - Pick B unless a third consumer lands; defer package extraction.
3. Port operator routes from the landing app:
   - `/planning` (Tasks, Decisions, Requirements, Notes, Workflows,
     SkillCandidates, System tabs).
   - `/projects/edit/[id]` and the `/api/dev/*` routes that back it.
   - Keep the original on the landing app for one release with a
     deprecation banner.
4. Build the CLI launcher (per 59-05 + 59-06):
   - `gad planning serve` — spawns the new app (next dev / next start)
     on port 3002 with reuse detection (HEAD request to a health
     endpoint; if 200, attach instead of spawn).
   - `gad start` — runs `gad planning serve` if not running, waits for
     health, opens browser to `http://localhost:3002/my-projects`.
   - Aliased as `gad dashboard`. Idempotent. `--no-browser` flag.
   - Logs to `~/.gad/logs/planning-app-<date>.jsonl`.
5. Daily-subagent dispatch hook (per 59-07):
   - `gad start` (or `gad start --dispatch-subagents`) reads each project
     config for `daily-subagent: true`.
   - If today's run hasn't been recorded in
     `.planning/subagent-runs/<projectid>/`, spawn the configured runtime
     with the project snapshot + task context.
   - Write run record on completion.
6. Render subagent run history (per 59-09):
   - Read `.planning/subagent-runs/<projectid>/*.json` per the schema
     in `2026-04-17-subagent-run-history.md`.
   - Timeline view: date, task id, status, one-line outcome, link to
     full report, link to teaching tip.
7. Deprecation stubs on the landing-app routes (per 59-08):
   - Server-rendered page: "this view moved to `gad planning serve`"
     with copy-pasteable install + run commands.
   - Keep for one release cycle, then remove.
   - Update all internal cross-links to the new location.
8. CLI gap closure (per 59-10):
   - `gad tasks add` (register without hand-editing TASK-REGISTRY).
   - `gad tasks promote` (lift `.planning/todos/*.md` into a task).
   - `gad tasks --stalled` (in-progress tasks with no attribution).
   - `gad next` (cross-project priority hotlist).

## Guardrails

- Don't ship the operator app to the public deploy in the first cycle.
  Confirm middleware blocks unauthenticated access before exposing the
  port.
- Reuse detection on `gad planning serve` is non-negotiable — operators
  run it from multiple shells, and double-spawn breaks the SSE streams.
- Daily-subagent dispatch must be idempotent across multiple `gad start`
  calls in a day. Use the run-record file as the lock.
- Deprecation banner on the landing app should not silently 200 a request
  that needs auth — redirect to the new app's auth flow.

## Failure modes

- **`gad start` opens a browser even when port is in use.** Confirm
  reuse detection short-circuits before the spawn step.
- **Daily-subagent fires twice on a clock skew.** Use UTC date, not
  local, in the run-record filename.
- **Subagent run history empty after run.** Run record was written to
  the wrong projectid (cwd vs explicit `--projectid`). Always pass
  projectid explicitly to `gad start --dispatch-subagents`.
- **Operator routes still importable from landing-app.** Delete + grep
  for the old paths to ensure no stranded imports.

## Reference

- Decisions gad-262 (gad start), gad-269 (planning-app boundary).
- Phase 59 tasks 59-01..59-10, 59-23.
- `gad-handoffs` skill — handoff queue used at startup.
- `move-route-with-deprecation-stub` skill — sibling for individual
  route moves (vs the operator-app split).
