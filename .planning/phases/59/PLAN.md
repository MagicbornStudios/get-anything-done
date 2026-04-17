# Phase 59: Planning-app split + `gad planning serve` + `gad start` — PLAN

**Depends on:** Phase 46 (site architecture redesign + CLI consolidation)
**Unblocks:** Phase 60 (BYOK UI surfaces), phase 58 (planning-app-resident learnings view)
**Authoring decisions:** gad-258, gad-261, gad-262, gad-263
**Task registry:** TASK-REGISTRY.xml `<phase id="59">` — 9 tasks, do NOT re-decompose.

---

## Phase goal (restated, not modified)

Split planning surfaces out of the landing Next app into a dedicated **planning-app** (gad-261). Ship two new CLI verbs: `gad planning serve` (spawns the planning-app dev/prod server on port 3002 with reuse detection) and `gad start` (gad-262 — operator's daily dashboard entry, opens browser to `/my-projects`). Build the `/my-projects` dashboard as the new operator home. Deprecate landing's `/planning` and `/projects` over one release cycle with redirect stubs. Wire the daily-subagent dispatch hook (gad-258 enforcement mechanism) into `gad start`. Render subagent-run history on the `/my-projects` project drawer (consumer of the todo schema at `2026-04-17-subagent-run-history.md`).

## Acceptance criteria (end-to-end "done" looks like)

1. A new Next 15 app exists at `vendor/get-anything-done/apps/planning-app/` and is registered in the monorepo workspace config.
2. `gad planning serve` — spawned with no other args — prints a health URL on port 3002, attaches to an already-running instance instead of re-spawning when one is live, logs to `~/.gad/logs/planning-app-<date>.jsonl`, shuts down cleanly on SIGINT.
3. `gad start` is idempotent: first call spawns the server + opens `http://localhost:3002/my-projects` in the default browser; second call in same session attaches silently. `--no-browser` flag is honored (editor/iframe embedding).
4. `gad dashboard` is an alias for `gad start` (both resolve the same handler).
5. `/my-projects` on planning-app lists every project that `gad projects list` knows about, with: current phase label, next-action snippet, per-project drawer showing open task count, 3 most-recent decisions, subagent-run timeline (last 7 runs), BYOK env status placeholder ("set" / "unset" — actual crypto lands in phase 60).
6. `/planning` on planning-app renders all tabs that today exist under `site/app/planning/` — Tasks, Decisions, Requirements, Notes, Workflows, SkillCandidates, System — with visual + data parity to the landing app's version.
7. `/projects/[...id]` on planning-app renders with visual + data parity to landing's current version.
8. Landing app's `/planning` and `/projects/**` routes are replaced with redirect/deprecation stubs pointing operators at `gad planning serve`. Internal cross-links (e.g., `/how-it-works`, header nav, `/project-market` card links) are rewritten to target either planning-app or the remaining landing surface, whichever is correct.
9. `gad start --dispatch-subagents` (and the implicit run during `gad start` when any project has `daily-subagent: true`) dispatches pending daily runs once per day per project, writes a run record under `.planning/subagent-runs/<projectid>/<YYYY-MM-DD>-<task-id>.json`, and is observable in the `/my-projects` drawer as a new timeline row within 10 seconds of completion.
10. `pnpm --filter planning-app build` and `pnpm --filter site build` both pass with zero new type errors. Neither app imports from the other at runtime (shared primitives come from the re-export barrel chosen in 59-02).

## Task ordering / waves

Dependencies taken verbatim from TASK-REGISTRY.xml `<depends>` attributes. Waves below are the minimal topological ordering that maximizes parallelism.

### Wave 1 — Foundation (root, blocks everything)

| Task | Title | Deps | Concurrency |
|---|---|---|---|
| **59-01** | Scaffold `apps/planning-app/` Next 15 workspace entry | none | solo (root) |

Wave gate: `pnpm --filter planning-app dev` boots on port 3002 and serves a placeholder `/my-projects` page. Next workspace is registered in root `pnpm-workspace.yaml`.

### Wave 2 — Primitives + serve shell (parallel)

| Task | Title | Deps | Can run with |
|---|---|---|---|
| **59-02** | Extract shared UI primitives via re-export barrel | 59-01 | 59-05 |
| **59-05** | Implement `gad planning serve` CLI | 59-01 | 59-02 |

These two are independent — 59-02 touches `site/components/site/**` + new `planning-app/lib/shared-ui.ts`, while 59-05 touches `bin/gad.cjs` + new `lib/planning-serve.cjs`. Zero file overlap. Run in parallel.

### Wave 3 — Routes + entry verb (parallel)

| Task | Title | Deps | Can run with |
|---|---|---|---|
| **59-03** | Port `/planning` route into planning-app | 59-02 | 59-06 |
| **59-06** | Implement `gad start` CLI (wraps `gad planning serve` + opens browser) | 59-05 | 59-03 |

59-03 touches `apps/planning-app/app/planning/**`. 59-06 touches `bin/gad.cjs` + `lib/planning-start.cjs`. Parallel.

### Wave 4 — Dashboard (sequential, blocks wave 5)

| Task | Title | Deps | Concurrency |
|---|---|---|---|
| **59-04** | Port `/projects/**` + build `/my-projects` dashboard | 59-03 | solo |

Solo wave — 59-04 is the largest and most decision-heavy task. Surface: `/my-projects`, `/projects/[...id]`, project drawer. Consumes data from `gad projects list`, `gad tasks --projectid`, `gad decisions --projectid`, `.planning/subagent-runs/`. BYOK status is a dumb placeholder (phase 60 wires the actual store).

### Wave 5 — Cleanup + dispatch (parallel)

| Task | Title | Deps | Can run with |
|---|---|---|---|
| **59-07** | Daily-subagent dispatch hook (wired into `gad start`) | 59-04, 59-06 | 59-08 |
| **59-08** | Deprecate landing `/planning` + `/projects/**` with redirect stubs | 59-04 | 59-07 |

59-07 writes `lib/subagent-dispatch.cjs` + integrates into `gad start`. 59-08 rewrites `site/app/planning/page.tsx`, `site/app/projects/**/page.tsx` as redirect stubs and updates internal cross-links in landing. Different file trees. Parallel.

### Wave 6 — History render (terminal)

| Task | Title | Deps | Concurrency |
|---|---|---|---|
| **59-09** | Render subagent-run history on `/my-projects` project drawer | 59-04, 59-07 | solo |

Terminal wave — needs real run records to render against. Depends on 59-07's dispatch writing real `.planning/subagent-runs/<projectid>/*.json` files.

### Wave diagram

```
W1: 59-01
      │
      ├─────────────┬──────────────
      ▼             ▼
W2: 59-02         59-05
      │             │
      ▼             ▼
W3: 59-03         59-06
      │             │
      └──────┬──────┘
             ▼
W4:        59-04
             │
      ┌──────┴──────┐
      ▼             ▼
W5: 59-07         59-08
      │
      ▼
W6: 59-09
```

6 waves, 9 tasks, up to 2 parallel lanes on waves 2, 3, 5.

## Risk register

Risks the operator should know about before and during execution. Each has an owner task and a mitigation. Rated L/M/H for likelihood × impact combined.

| # | Risk | Owner task | Rating | Mitigation |
|---|---|---|---|---|
| R1 | **Hot-swap breaks running sessions.** Landing `/planning` + `/projects` are live and bookmarked. If 59-08 lands before planning-app is reachable, operators see 404s mid-session. | 59-08 | H | Strict wave ordering: 59-08 runs in wave 5 AFTER 59-04 ships a working planning-app port of the routes. Redirect stubs must include a copy-pasteable `gad planning serve` command so a fallback exists even if the operator hasn't installed the new binary yet. Keep stubs for one full release cycle (not one deploy) per gad-261. |
| R2 | **Shared-primitives path choice locks downstream velocity.** 59-02 explicitly picks re-export barrel (option b) over `packages/ui` workspace extraction. If a third consumer emerges mid-phase (e.g., teachings reader from phase 46), we end up with three importers of the barrel and a refactor tax. | 59-02 | M | Stick with barrel for phase 59. Document the decision inline in the barrel file (`DO NOT add consumers without promoting to packages/ui`). Open a follow-up todo for post-phase-59 extraction if a third consumer lands. |
| R3 | **Port 3002 collision.** Operator may already have something on 3002 (common: some other dev server, a stopped container reserving the port on Windows). `gad planning serve` spawn then fails silently or attaches to the wrong service. | 59-05 | M | Health endpoint check BEFORE attach — 59-05 must probe `GET /api/health` on 3002 and verify the response carries a `planning-app` marker (`{"app": "planning-app", "version": "..."}`). If the port is held by something else, fail fast with an actionable error: "port 3002 occupied by non-planning-app service — stop it or set `GAD_PLANNING_PORT`". Add `GAD_PLANNING_PORT` env var escape hatch. |
| R4 | **Dev vs prod semantics of `gad planning serve`.** Task 59-05 says "next dev in dev / next start in prod" but the GAD binary is distributed as a compiled tool — operators run it from `%LOCALAPPDATA%\Programs\gad\bin\gad.exe`. There is no "dev vs prod" from the binary's POV; there's only "was planning-app built or not". | 59-05 | M | Resolve unambiguously in 59-05: the binary ALWAYS runs `next start` against a prebuilt `.next/` bundle that ships inside the planning-app distribution. `next dev` is reserved for `pnpm --filter planning-app dev` — the monorepo developer loop. This aligns with the already-punted task 44-28 (runtime-site bundling). Flag: if 44-28 is not landed before 59, `gad planning serve` may need to shell out to `pnpm --filter planning-app start` from the vendored tree, which couples the binary to a monorepo checkout. See open question Q1. |
| R5 | **Auth model for landing-hosted BYOK surface post-split.** Phase 60 item (9) is the landing-site project-dashboard BYOK surface. After 59-08 lands, `/projects` on landing is a redirect stub — there is no landing project dashboard anymore. Phase 60 item (9) needs to either land on planning-app (local-dev only, no landing auth needed) or a surviving landing surface (auth model undefined). | 60-08 (phase 60) | M | Phase 60 scope note: after 59-08, "landing-site project dashboard" semantically means "planning-app `/my-projects`" when running locally, and a to-be-designed authed landing surface when running against a deployed landing. Explicit open question, carried to phase 60 planning (Q4 below). Does not block phase 59 delivery. |
| R6 | **Subagent dispatch writes while main session reads.** 59-07 writes `.planning/subagent-runs/<projectid>/*.json` concurrently with 59-09 reading them. On Windows, file-read-during-write can raise EBUSY or serve a partial-write. | 59-07, 59-09 | L | 59-07 writes to `<filename>.tmp` then renames atomically. 59-09 uses `fs.readdir` + `fs.readFile` with try/catch and skips files failing JSON.parse (treat as "run in progress"). |
| R7 | **`gad start` double-spawn.** If operator runs `gad start` twice in rapid succession from two shells, both can pass the pre-check before either has bound port 3002. | 59-06 | L | Use a pidfile at `~/.gad/planning-app.pid` with `O_EXCL` create. Second invocation sees the pidfile, probes the health endpoint, attaches. Stale pidfile (process dead) is cleaned up and retried once. |
| R8 | **Next 15 on Windows — ESM + CJS interop with `bin/gad.cjs`.** The CLI is CJS (bin/gad.cjs), planning-app is Next 15 ESM. Spawning `next start` from CJS via `child_process.spawn` is fine, but if 59-05 or 59-06 tries to `require()` anything from planning-app internals, module resolution will fail on Windows. | 59-05, 59-06 | L | Strict boundary: CJS bin/gad.cjs ONLY spawns planning-app as a subprocess, never requires its internals. Health endpoint contract is the only integration surface. |
| R9 | **Daily-subagent dispatch on BYOK-less machines.** 59-07 implements dispatch BEFORE phase 60 lands encrypted env. Dispatch will need `OPENAI_API_KEY` for the subagent (per gad-258 + gad-263). If not set, dispatch fails. Operators running `gad start` will see failures with no actionable path. | 59-07 | M | 59-07 reads `OPENAI_API_KEY` from `process.env` with a clear failure mode: if missing, skip dispatch silently, log to `~/.gad/logs/planning-app-<date>.jsonl` with an explicit "BYOK not yet configured (phase 60) — set OPENAI_API_KEY in process.env to enable daily dispatch". Render same state in the `/my-projects` drawer. Do NOT crash `gad start`. |
| R10 | **Planning XML parse path assumes landing monorepo layout.** The landing app's planning data readers hardcode paths relative to `vendor/get-anything-done/site/`. Moved to `apps/planning-app/`, the relative-path-walking to `.planning/` roots changes. | 59-03, 59-04 | M | 59-03 must abstract planning data access behind a CLI-reader module (`lib/planning-readers.ts`) that uses `gad` CLI output rather than filesystem paths, or uses the existing reader functions via absolute-path resolution (`require.resolve('get-anything-done')`). Decide in 59-03 — flag in task-complete commit message. |
| R11 | **`pnpm-workspace.yaml` surgery.** Root workspace at `C:/Users/benja/Documents/custom_portfolio/pnpm-workspace.yaml` lists `vendor/get-anything-done/site`. Adding planning-app means adding `vendor/get-anything-done/apps/planning-app` as a workspace entry. Root monorepo is the portfolio, not GAD — changing it touches consumer territory. | 59-01 | L | 59-01 edits root `pnpm-workspace.yaml` with a one-line addition. Flag in commit. Dogfooding the portfolio monorepo IS the intended consumer model; this is expected, not a leak. |

## Goal-backward verification

Working from the phase goal back to each task, confirming no coverage gaps.

| Goal clause | Covered by | Coverage check |
|---|---|---|
| Planning surfaces split from landing into a dedicated app | 59-01 (scaffold) + 59-03 (/planning port) + 59-04 (/projects port) | ✓ Complete — scaffold + two route migrations |
| Shared primitives so design drift is contained | 59-02 | ✓ Barrel approach, documented |
| `gad planning serve` spawns planning-app on port 3002 with reuse detection | 59-05 | ✓ Health endpoint + attach-or-spawn |
| `gad start` opens browser to `/my-projects` | 59-06 | ✓ Wraps 59-05 + browser open |
| `/my-projects` dashboard exists | 59-04 | ✓ Task explicitly names `/my-projects` |
| Landing deprecation over one release cycle | 59-08 | ✓ Redirect stubs, not deletion |
| Subagent-run history render on `/my-projects` | 59-09 | ✓ Drawer timeline |
| Daily-subagent dispatch trigger | 59-07 | ✓ `gad start --dispatch-subagents` + implicit when `daily-subagent: true` |

**Gaps I looked for and did NOT find:**

- Teachings reader relocation (decision gad-264 defers to post-59 — lives on landing under phase 46 first, promoted to planning-app post-59). **Not in scope**, no task needed.
- BYOK store implementation (phase 60). 59-04 shows a **dumb placeholder** for BYOK status; 59-07 reads `OPENAI_API_KEY` from `process.env` with a clear degraded mode. **Not a gap** — deliberate phase boundary.
- Authenticated landing-hosted `/my-projects` (not in scope — 59-04 is local-dev/unauthenticated only). Flagged as Q4 for phase 60 planning.
- Health endpoint schema. The risk register (R3, R8) implies one but no task explicitly authors `/api/health`. **Minor gap** — implicit in 59-01's Next scaffold, but the contract (`{"app":"planning-app","version":"..."}`) should be authored in 59-01 so 59-05's attach logic has something stable to probe. **Action:** operator should ensure 59-01's scaffold includes `/api/health/route.ts` with the contract above. Not a separate task; a one-line addition to 59-01's execution.

## Commands operator will run to verify each task

Not a test script — sanity checks per task. Absolute paths assumed relative to `C:/Users/benja/Documents/custom_portfolio/`.

### 59-01 — Scaffold planning-app

```sh
ls vendor/get-anything-done/apps/planning-app/
cat pnpm-workspace.yaml | grep planning-app
pnpm --filter planning-app dev &
curl http://localhost:3002/my-projects
curl http://localhost:3002/api/health
# expected: HTML shell, {"app":"planning-app","version":"..."}
```

### 59-02 — Shared UI primitives

```sh
cat vendor/get-anything-done/apps/planning-app/lib/shared-ui.ts
# expected: re-export barrel with MarketingShell (renamed AppShell), SectionEpigraph, SiteSection, SiteProse
pnpm --filter planning-app build
# expected: build succeeds, no duplicate React warnings
```

### 59-03 — Port /planning

```sh
pnpm --filter planning-app dev &
curl -s http://localhost:3002/planning | grep -E "Tasks|Decisions|Requirements|Notes|Workflows|SkillCandidates|System"
# expected: all 7 tab labels appear
# manual: open http://localhost:3002/planning, click through every tab, confirm data parity with landing's /planning
```

### 59-04 — /projects + /my-projects

```sh
pnpm --filter planning-app dev &
curl -s http://localhost:3002/my-projects | grep -E "get-anything-done|llm-from-scratch"
# expected: project cards listed
# manual: open drawer for get-anything-done, confirm phase/next-action/open tasks/decisions/BYOK-placeholder render
curl -s http://localhost:3002/projects/get-anything-done
# expected: project detail HTML parity with landing
```

### 59-05 — gad planning serve

```sh
gad planning serve &
# expected: log line "planning-app listening on :3002" + ~/.gad/logs/planning-app-<date>.jsonl created
curl http://localhost:3002/api/health
# expected: {"app":"planning-app","version":"..."}
gad planning serve  # second invocation
# expected: "attached to existing instance on :3002" — NOT a second spawn
# test port collision:
# - occupy 3002 with another process, then:
gad planning serve
# expected: fails with actionable error "port 3002 occupied by non-planning-app service"
# test env var escape:
GAD_PLANNING_PORT=3102 gad planning serve &
curl http://localhost:3102/api/health
```

### 59-06 — gad start

```sh
gad start
# expected: planning-app spawns if not running, browser opens to http://localhost:3002/my-projects
gad start  # second invocation
# expected: no browser (already at target), attaches silently
gad start --no-browser
# expected: no browser open, returns 0
gad dashboard
# expected: alias works, same behavior as gad start
```

### 59-07 — Daily-subagent dispatch

```sh
# ensure at least one project has daily-subagent: true (llm-from-scratch)
cat projects/llm-from-scratch/.planning/config.json | grep daily-subagent
gad start --dispatch-subagents
# expected: llm-from-scratch subagent dispatches, log at ~/.gad/logs/planning-app-<date>.jsonl
ls projects/llm-from-scratch/.planning/subagent-runs/
# expected: one new file dated today, format <YYYY-MM-DD>-<task-id>.json
cat projects/llm-from-scratch/.planning/subagent-runs/<today>-*.json | jq .status
# expected: "done" (or "failed" with clear reason)
# second run same day:
gad start --dispatch-subagents
# expected: skipped, "already dispatched today"
# BYOK-less check:
OPENAI_API_KEY= gad start --dispatch-subagents
# expected: skipped with log "BYOK not yet configured — set OPENAI_API_KEY"
```

### 59-08 — Deprecate landing routes

```sh
pnpm --filter site build
pnpm --filter site start &
curl -s http://localhost:3000/planning | grep "moved to gad planning serve"
curl -s http://localhost:3000/projects/get-anything-done | grep "moved to gad planning serve"
# expected: deprecation banner + copy-pasteable commands
# internal-link audit:
grep -rEn "href=[\"']/(planning|projects/)" vendor/get-anything-done/site/app/ vendor/get-anything-done/site/components/
# expected: zero hits, or only redirect stubs themselves
```

### 59-09 — Subagent-run history render

```sh
# prerequisite: 59-07 has produced at least one run record
gad start
# manual: open http://localhost:3002/my-projects, click llm-from-scratch drawer
# expected: timeline section with date, task id, status, one-line outcome, link to full report body
# empty-state check: a project with no runs shows "trigger a run" CTA button
```

## Open questions

Flag for operator before execution. Carry into an early task's discussion or a mid-phase pause if needed.

**Q1. How does `gad planning serve` resolve the planning-app bundle outside the monorepo?**
Task 44-28 (runtime-site bundling for the landing site) is still planned. Without a similar bundling story for planning-app, `gad planning serve` distributed via the installed binary (`%LOCALAPPDATA%\Programs\gad\bin\gad.exe`) has nothing to `next start` against. Two resolution paths:
  - (A) Include planning-app's `.next/` prebuild in the binary distribution (blocks on 44-28 pattern — author a parallel 59-05 sub-item).
  - (B) `gad planning serve` requires a monorepo checkout for this phase, and 59-05 shells out to `pnpm --filter planning-app start` from the vendored tree. Acceptance criterion (2) then says "from a monorepo checkout".
  - **Recommendation:** (B) for phase 59 delivery — parallel to 44-28's existing gap. File a follow-up todo for standalone binary bundling of planning-app, gated on 44-28 pattern.

**Q2. Is 59-02's re-export barrel path choice (option b) still correct given phase 46's in-flight teachings reader?**
Phase 46 is active and lands the teachings reader on the landing app per gad-264, with long-term home on planning-app post-59. If the teachings reader migrates to planning-app during phase 59 (nothing currently says it must, but it's plausible as the operator closes out 46), then teachings reader becomes the third consumer of shared primitives and the barrel-vs-package decision flips. **Resolve before starting 59-02.**

**Q3. `/my-projects` BYOK status placeholder — what does "set" / "unset" check without phase 60's encrypted store?**
Phase 60 is the real answer, but 59-04 needs SOMETHING to render. Options:
  - (A) Read `.env` or `process.env` for the expected keys per-project, show "set" if the expected key is present.
  - (B) Read `.gad/secrets/<projectid>.enc` existence only (file presence, no decrypt) and show "store exists" / "store absent".
  - (C) Render a disabled "coming in phase 60" tile with tooltip.
  - **Recommendation:** (C) — does not encode assumptions about phase 60's shape and avoids teaching operators wrong mental model. Cheap to change post-60.

**Q4. Post-split, who owns landing's `/my-projects` authed view (phase 60 item 9)?**
After 59-08, landing has no project dashboard — only redirect stubs. Phase 60 item (9) says "landing-site project-dashboard BYOK surface — auth-gated — lands on planning-app post phase 59 split". Two readings:
  - Reading 1: post-59, "landing-site project-dashboard BYOK surface" IS planning-app's `/my-projects`, run locally. There is no authed landing surface.
  - Reading 2: there is still a remote authed `/my-projects` on landing, to be built in phase 60.
  - **Recommendation:** Reading 1 — planning-app is local-dev primary. Authed remote view is a separate phase, deferred. Resolve during phase 60 planning, not phase 59 execution.

**Q5. Scope check — is this phase too large for one unit?**
9 tasks, 6 waves, ~3-4 days of focused work. Touches: new Next app, workspace config, CLI subcommand pair, 3 route migrations, subagent dispatch hook, landing deprecation. The **waves are balanced** — no wave has more than 2 parallel tasks — and the **dependencies are real** (each wave genuinely blocks the next). **Not recommending a sub-phase split.** The scope is defensible: splitting would fragment the single coherent deliverable (new entry command + new dashboard + working subagent loop) into half-deliveries that are worse to review and ship. Operator can pause between waves if context fills; the wave boundaries are natural checkpoints.

---

## Exec protocol reminder

Per decision gad-18 (GAD loop): snapshot → pick one task → implement → update TASK-REGISTRY.xml (status=done, skill, agent, type) → update STATE.xml next-action → commit. Phase 59 tasks all take `type` values already assigned in the registry (`scaffold`, `refactor`, `migration`, `cli`, `cleanup`, `site`).

When this phase closes, STATE.xml next-action handoff should point at phase 60 task 60-01 (BYOK design doc) — 59 is 60's direct dependency.
