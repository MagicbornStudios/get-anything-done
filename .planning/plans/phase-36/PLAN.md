# Phase 36 — Per-eval-repo architecture + `gad eval start/auto/finish` + `gad env`

**Project:** get-anything-done
**Depends on:** 35 (cross-runtime telemetry — runtime identity fields in TRACE)
**Decisions:** GAD-D-139, GAD-D-140, GAD-D-141, GAD-D-142, GAD-D-143
**Spec:** `.planning/specs/PER-EVAL-REPO-SPEC.md`

---

## KICKOFF

### Goal

Move eval source/build artifacts out of the monorepo into per-eval GitHub repos, split the misleading `gad eval run` into explicit `start` / `auto` / `finish` subcommands, add `gad env` preflight runtime checks, delete dead skill-invocation hook code, and update the site data pipeline to read from a cached TRACE snapshot (Option C) refreshed by `gad eval finish`.

### Scope

**In:**
- New `gad env status` / `gad env agents` with preflight integration.
- New `gad eval start` (scaffold + scoped clone of per-eval repo).
- New `gad eval auto` (runtime shell-out + stream + auto-finish).
- New `gad eval finish` (size compute + push + main-repo TRACE cache).
- `gad eval run` → deprecated alias for `start`. `gad eval preserve` → deprecated alias for `finish`. `gad eval suite` → stub pointing to phase 37.
- Dead code removal in `bin/gad-trace-hook.cjs` (`maybeSkillInvocationEvent`, `readActiveSkill`, `.trace-last-skill`).
- Site data pipeline (`site/scripts/build-site-data.mjs`, `site/lib/eval-data.ts`) reads Option C TRACE cache in main repo.
- Docs: `docs/eval-guide.md`, `docs/quick-start.md`, `AGENTS.md` updated for new commands and skill-tracking-is-GAD-only.
- One end-to-end eval run via `gad eval auto --runtime claude` to prove the loop.

**Out (non-goals, deferred):**
- Migration of 49 existing inline runs (Option B — legacy stays inline; future phase 38+).
- `gad project` top-level command (phase 37).
- Runtime identity telemetry (phase 35 owns this; phase 36 consumes it).
- GitHub Actions automation inside eval repos.
- Parallel runtime comparison dashboards.

### Definition of Done

All acceptance criteria from spec §8:

1. `gad env status` prints runtime table; `gad env agents` is the agent-only subset.
2. `gad eval start` exists; creates per-eval repo on first use via `gh repo create`; scoped clone strips other rounds; scaffolds `PROMPT.md` + `TRACE.json` + `EXEC.json` under `round-N/vM/`.
3. `gad eval auto` exists; `--runtime codex|claude|cursor`; streams stdout/stderr; calls `finish` on exit; `--timeout` default 60min; supports multiple `--projectid` for parallel.
4. `gad eval finish` exists; computes `source_size_bytes` / `build_size_bytes`; updates TRACE; commits+pushes to per-eval repo; writes Option C TRACE cache + `runs-index.json` entry in main repo.
5. `gad eval run` / `gad eval preserve` exist as deprecated aliases with warning banners.
6. `gad-trace-hook.cjs` no longer emits `skill_invocation` events; dead code removed; `tool_use` / `file_mutation` / `subagent_spawn` still flow; `trigger_skill` remains on `tool_use` hardcoded to `null`.
7. `docs/eval-guide.md` + `docs/quick-start.md` + `AGENTS.md` reflect the new commands + skill-tracking-is-GAD-only clarification.
8. End-to-end: `gad eval auto --runtime claude --projectid <smoke-target>` completes and pushes a real run to a real per-eval GitHub repo.
9. Existing 49 inline runs still render on the site (legacy mode, `legacy_inline: true`).
10. `pnpm build` in `site/` passes.

### Goal-backward truth mapping (spec §8 → tasks)

| Criterion | Satisfied by |
|---|---|
| 1. `gad env status` / `agents` | 36-01, 36-02, 36-03 |
| 2. `gad eval start` + scoped clone | 36-06, 36-07, 36-08, 36-09 |
| 3. `gad eval auto` + streaming + timeout + parallel | 36-10, 36-11, 36-12 |
| 4. `gad eval finish` + sizes + push + cache | 36-13, 36-14, 36-15, 36-16 |
| 5. Deprecated aliases `run` / `preserve` / `suite` | 36-17 |
| 6. Dead code removal in trace hook | 36-04, 36-05 |
| 7. Docs + AGENTS.md update | 36-18, 36-19 |
| 8. End-to-end smoke via `gad eval auto --runtime claude` | 36-22 |
| 9. Legacy inline runs still render | 36-20, 36-21 |
| 10. `pnpm build` passes in `site/` | 36-21, 36-22 |

### Milestone boundaries

- **Milestone A — `gad env` (ship first):** 36-01 → 36-03
- **Milestone B — Dead code removal:** 36-04 → 36-05
- **Milestone C — `gad eval start` + per-eval repo scaffold:** 36-06 → 36-09
- **Milestone D — `gad eval auto` + runtime shell-out:** 36-10 → 36-12
- **Milestone E — `gad eval finish` + push + main-repo cache:** 36-13 → 36-17
- **Milestone F — Site pipeline + docs + smoke:** 36-18 → 36-22

Milestones A and B are independent and can ship in parallel. C depends on A (env preflight). D depends on C. E depends on C + D. F depends on E.

---

## TASKS

> All tasks: `skill="execute-phase" agent="gad-executor"` per GAD-D-104. `type` listed per task.

### Milestone A — `gad env` command

#### 36-01 — Build `lib/runtime-detect.cjs` runtime probe

- **type:** cli
- **deps:** none
- **deliverable:** New module `lib/runtime-detect.cjs` exporting:
  - `detectRuntime(name)` → `{ name, status: 'installed'|'not-found'|'error', version, path, hint }`
  - `detectAll()` → array for `claude`, `codex`, `cursor-agent`, `gh`, `node`, `git`
  - `checkGhAuth()` → `{ authed: boolean, user?: string, hint? }` via `gh auth status --json`
  - `checkRuntimeAvailable(name)` (throws with spec-formatted install hint on failure)
- **produces:** `lib/runtime-detect.cjs`, `tests/runtime-detect.test.cjs`
- **verify:** `node vendor/get-anything-done/tests/runtime-detect.test.cjs` passes; manual: `node -e "console.log(require('./vendor/get-anything-done/lib/runtime-detect.cjs').detectAll())"` prints a row for each runtime.

#### 36-02 — Wire `gad env status` and `gad env agents` subcommands

- **type:** cli
- **deps:** 36-01
- **deliverable:** Register `env` parent command with `status` and `agents` subcommands in `bin/gad.cjs`. Render aligned runtime table using `lib/table.cjs`. `agents` filters to `claude`, `codex`, `cursor-agent` only.
- **produces:** edits to `bin/gad.cjs`
- **verify:** `gad env status` prints the table matching spec §4.1 layout; `gad env agents` prints only coding agents; exit code 0 on success, 1 if any required runtime missing (tunable).

#### 36-03 — Preflight integration helper

- **type:** cli
- **deps:** 36-01
- **deliverable:** Export `preflight({ runtime, requireGh })` from `lib/runtime-detect.cjs`. Called by `gad eval auto` before any other work. On failure prints spec §4.3 error messages and exits non-zero.
- **produces:** edits to `lib/runtime-detect.cjs`, `tests/runtime-detect.test.cjs`
- **verify:** unit test mocks missing `codex` binary and asserts thrown error text matches spec §4.3.

### Milestone B — Dead code removal (trace hook)

#### 36-04 — Delete skill-invocation dead code from `gad-trace-hook.cjs`

- **type:** framework
- **deps:** none
- **deliverable:** Remove `maybeSkillInvocationEvent`, `readActiveSkill`, `.trace-last-skill` file tracking, and any `skill_invocation` emission branches. Keep `trigger_skill` field on `tool_use` events hardcoded to `null` per spec §5.1. Ensure `tool_use`, `file_mutation`, `subagent_spawn` still emit.
- **produces:** edits to `bin/gad-trace-hook.cjs`
- **verify:** `grep -r "maybeSkillInvocationEvent\|readActiveSkill\|trace-last-skill" bin/ lib/` returns nothing; `grep "trigger_skill" bin/gad-trace-hook.cjs` still shows the field; existing trace-hook tests still pass.

#### 36-05 — Update trace-hook tests + regression fixture

- **type:** framework
- **deps:** 36-04
- **deliverable:** Remove any test assertions that expect `skill_invocation` events. Add regression test that confirms a `tool_use` event still has `trigger_skill: null`. Delete `.trace-last-skill` references from test fixtures.
- **produces:** edits to `tests/*trace*hook*.test.cjs` (or equivalent)
- **verify:** `pnpm test` (or `npm test`) in vendor/get-anything-done passes.

### Milestone C — `gad eval start` + per-eval repo scaffolding

#### 36-06 — `lib/eval-repo.cjs` per-eval repo helper

- **type:** cli
- **deps:** 36-01
- **deliverable:** New module `lib/eval-repo.cjs` with:
  - `repoNameFor(projectId)` → e.g. `etd-bare`
  - `repoUrlFor(projectId)` → `https://github.com/MagicbornStudios/<name>.git`
  - `ensureRepo(projectId)` → creates private repo via `gh repo create MagicbornStudios/<name> --private --confirm` if missing (idempotent).
  - `cloneScoped(projectId, round, version, destDir)` → clones to `<os.tmpdir>/gad-eval-<project>-<round>-v<N>/`, then removes all existing `round-*/v*/` dirs, leaving only `gad.json`, `README.md`, and the new empty scaffold dir.
  - `nextRunNumber(projectId, round)` → scans cloned repo for highest `round-N/vM/` and returns `M+1`.
- **produces:** `lib/eval-repo.cjs`, `tests/eval-repo.test.cjs`
- **verify:** unit tests with a temp fixture repo cover `nextRunNumber` and the scoped-clone stripping logic. Manual: call `ensureRepo('gad-env-smoke')` twice, confirm second call is a no-op and prints `repo already exists`.

#### 36-07 — Template copier + PROMPT/TRACE/EXEC scaffolder

- **type:** cli
- **deps:** 36-06
- **deliverable:** New module `lib/eval-scaffold.cjs` that given `(worktree, projectId, round, version)`:
  - Copies `evals/<project>/template/` into `round-N/vM/`
  - Writes `round-N/vM/PROMPT.md` (reuses existing prompt generator currently in `gad.cjs`)
  - Writes `round-N/vM/TRACE.json` scaffold (runtime identity fields from phase 35, timing.started = now)
  - Writes `round-N/vM/EXEC.json` with same shape as today
  - Writes `round-N/vM/RUN.md` stub
- **produces:** `lib/eval-scaffold.cjs`, `tests/eval-scaffold.test.cjs`
- **verify:** unit test scaffolds into a tmp dir and asserts all five files exist with valid JSON/Markdown.

#### 36-08 — `gad eval start` subcommand

- **type:** cli
- **deps:** 36-06, 36-07, 36-03
- **deliverable:** Register `eval start` in `bin/gad.cjs` implementing spec §3.1 flow exactly: gh auth check → resolve project → read `evals/<project>/gad.json` for round + req version → `ensureRepo` → `cloneScoped` → `nextRunNumber` → scaffold → print handoff block with worktree path, `round-N/vM/` path, next-step hints (including `gad eval finish`). Exits 0.
- **produces:** edits to `bin/gad.cjs`
- **verify:** `gad eval start --projectid etd-bare --round 5` (against a smoke repo) produces a populated worktree under `%TEMP%/gad-eval-etd-bare-5-vN/round-5/vN/` with `PROMPT.md`, `TRACE.json`, `EXEC.json`, `RUN.md`, and template files copied. No other rounds remain in the worktree.

#### 36-09 — Main-repo `runs-index.json` writer (start-side half)

- **type:** cli
- **deps:** 36-08
- **deliverable:** On successful `start`, append a `{ round, version, repo, status: 'scaffolded', started_at }` entry to `evals/<project>/runs-index.json` (create file if missing). Write as authoritative index for legacy+new runs.
- **produces:** edits to `bin/gad.cjs`, new `lib/runs-index.cjs`, `tests/runs-index.test.cjs`
- **verify:** After running `gad eval start`, `runs-index.json` contains the new entry; re-running with a fresh version appends without duplicating.

### Milestone D — `gad eval auto` + runtime shell-out

#### 36-10 — `lib/runtime-exec.cjs` shell-out + streaming

- **type:** cli
- **deps:** 36-01
- **deliverable:** New module `lib/runtime-exec.cjs` with `runRuntime({ runtime, prompt, cwd, timeoutMs, onStdout, onStderr })`:
  - `claude` → spawns `claude --print <prompt> --output-format stream-json`
  - `codex` → spawns `codex exec <prompt>` (verify cwd flag — fall back to `process.cwd` override)
  - `cursor-agent` → spawns `cursor-agent --model auto -p <prompt>`
  - Streams stdout/stderr live to parent terminal
  - Resolves on exit with `{ exitCode, durationMs, interrupted }`
  - Rejects/flags `interrupted:true` on timeout (kills child tree)
- **produces:** `lib/runtime-exec.cjs`, `tests/runtime-exec.test.cjs`
- **verify:** unit test spawns `node -e "console.log('hi')"` as a fake runtime and asserts streamed output + exit=0; timeout test with `node -e "setInterval(()=>{},1000)"` + 500ms timeout asserts `interrupted:true`.

#### 36-11 — `gad eval auto` subcommand (single project path)

- **type:** cli
- **deps:** 36-08, 36-10, 36-03
- **deliverable:** Register `eval auto` in `bin/gad.cjs`:
  1. `preflight({ runtime, requireGh: true })`
  2. Reuse `start` flow to create worktree
  3. Read `round-N/vM/PROMPT.md`
  4. `runRuntime(...)` with streaming
  5. On exit (success or timeout): call finish handler (36-13) in-process
  6. Return non-zero on timeout/interrupt
  - `--runtime`, `--projectid`, `--timeout` (default 60), `--keep-worktree`
- **produces:** edits to `bin/gad.cjs`
- **verify:** `gad eval auto --projectid gad-env-smoke --runtime claude --timeout 2` against a toy project completes, streams, auto-finishes, pushes to per-eval repo.

#### 36-12 — Parallel `--projectid` fan-out

- **type:** cli
- **deps:** 36-11
- **deliverable:** When multiple `--projectid` values are passed, spawn each as a concurrent child process (reusing the same `gad eval auto` binary with single-id args). Serial remains default for single id. Aggregate exit code = worst-of-N.
- **produces:** edits to `bin/gad.cjs`
- **verify:** `gad eval auto --projectid a b c --runtime codex` launches 3 child processes, each with interleaved prefixed output; all three worktrees end up populated.

### Milestone E — `gad eval finish` + push + main-repo cache

#### 36-13 — Size computation + TRACE update helper

- **type:** cli
- **deps:** 36-07
- **deliverable:** New `lib/eval-finish.cjs` exporting `computeSizes(worktree)` (walks `src/` and `build/` summing bytes), `mergeTraceEvents(traceJson, gadLogDir)` (merges `.trace-events.jsonl` if present), and `finalizeTrace(worktree, { status, sizes })` (sets `timing.ended`, `durations`, size fields, optional `interrupted: true`).
- **produces:** `lib/eval-finish.cjs`, `tests/eval-finish.test.cjs`
- **verify:** unit test builds a fake worktree with known byte counts and asserts computed sizes match; merge test injects fake `.trace-events.jsonl` and checks events appear.

#### 36-14 — Git commit + push to per-eval repo

- **type:** cli
- **deps:** 36-06, 36-13
- **deliverable:** In `lib/eval-repo.cjs` add `commitAndPush(worktree, { project, round, version })` using `git -C`:
  - `git add round-<N>/v<M>/`
  - `git commit -m "feat(<project>/round-<N>/v<M>): preserve run"`
  - `git push origin HEAD`
- **produces:** edits to `lib/eval-repo.cjs`, test updates
- **verify:** test uses a bare local repo as remote; `commitAndPush` results in the run dir visible in the bare remote.

#### 36-15 — Main-repo TRACE cache writer (Option C)

- **type:** cli
- **deps:** 36-13
- **deliverable:** New helper in `lib/runs-index.cjs`: `writeTraceCache(project, round, version, traceJson)` writing to `evals/<project>/trace-cache/round-<N>/v<M>.json`. Update `runs-index.json` entry to set `status: 'done'`, `trace_ref`, `source_size_bytes`, `build_size_bytes`, `ended_at`.
- **produces:** edits to `lib/runs-index.cjs`, tests
- **verify:** after calling, `evals/<project>/trace-cache/round-N/vM.json` exists and matches TRACE content; `runs-index.json` entry is promoted to `done`.

#### 36-16 — `gad eval finish` subcommand

- **type:** cli
- **deps:** 36-13, 36-14, 36-15
- **deliverable:** Register `eval finish` in `bin/gad.cjs` implementing spec §3.3:
  1. Resolve worktree (via `--from` or `EXEC.json` discovery; auto-detect latest if `--round`/`--version` omitted)
  2. `computeSizes` + `finalizeTrace`
  3. Call existing `gad eval score --project` in-process
  4. Copy cached TRACE to main repo via `writeTraceCache`
  5. `commitAndPush` to per-eval repo
  6. Optional worktree cleanup unless `--keep-worktree`
- **produces:** edits to `bin/gad.cjs`
- **verify:** after `gad eval start` + manual placeholder work, `gad eval finish --projectid X` pushes to per-eval repo, writes cache, updates index, and cleans tmp dir.

#### 36-17 — Deprecated aliases (`eval run`, `eval preserve`, `eval suite` stub)

- **type:** cli
- **deps:** 36-08, 36-16
- **deliverable:** Keep `gad eval run` and `gad eval preserve` as thin aliases that print a deprecation warning (`deprecated: use 'gad eval start/finish'`) then call through. Replace `gad eval suite` with a stub that prints `'gad eval suite' is removed — see 'gad project run-round' (phase 37)` and exits 2.
- **produces:** edits to `bin/gad.cjs`
- **verify:** `gad eval run --project X` prints the deprecation banner on stderr then runs the new `start` flow; `gad eval suite` exits 2 with the stub message.

### Milestone F — Site pipeline, docs, smoke

#### 36-18 — Docs: eval-guide + quick-start + AGENTS.md

- **type:** framework
- **deps:** 36-16, 36-17
- **deliverable:** Update `docs/eval-guide.md`, `docs/quick-start.md`, root `AGENTS.md` to:
  - Document `gad env status|agents`, `gad eval start|auto|finish`
  - Note `gad eval run`/`preserve` are deprecated
  - Clarify skill-tracking is GAD-workflow-only (GAD-D-142) — `skill=""`/`agent=""` attributes belong to TASK-REGISTRY.xml under the GAD loop, not universal
- **produces:** edits to `docs/eval-guide.md`, `docs/quick-start.md`, `AGENTS.md`
- **verify:** `grep -n "gad eval start" docs/eval-guide.md docs/quick-start.md` returns hits; `grep -n "GAD-only" docs/eval-guide.md` matches.

#### 36-19 — Command docs in `commands/gad/`

- **type:** framework
- **deps:** 36-18
- **deliverable:** Add `commands/gad/eval-start.md`, `eval-auto.md`, `eval-finish.md`, `env-status.md`, `env-agents.md`. Mark `commands/gad/eval-run.md` + `eval-suite.md` as deprecated with a pointer. Use existing command doc format.
- **produces:** new `commands/gad/*.md` files
- **verify:** new files exist; `gad eval start --help` surfaces the same content (if autoloaded) or at minimum matches spec §3.1.

#### 36-20 — Site data pipeline reads Option C cache

- **type:** site
- **deps:** 36-15
- **deliverable:** Update `site/scripts/build-site-data.mjs` and `site/lib/eval-data.ts` to:
  - Prefer reading `evals/<project>/trace-cache/round-N/vM.json` when present
  - Fall back to legacy inline `evals/<project>/v<N>/TRACE.json` and tag `legacy_inline: true`
  - Merge both shapes into the same `EvalRun` record for downstream renderers
- **produces:** edits to `site/scripts/build-site-data.mjs`, `site/lib/eval-data.ts`, `site/lib/eval-data.generated.ts` regen
- **verify:** `pnpm --filter site build-data` produces output with both a cached run (synthetic fixture) and a legacy run flagged correctly.

#### 36-21 — Site build verification + legacy render check

- **type:** site
- **deps:** 36-20
- **deliverable:** Run `pnpm build` in `site/` and fix any type errors introduced by the new shape. Manually sanity-check one legacy run page still renders.
- **produces:** any touch-up edits under `site/`
- **verify:** `pnpm --filter site build` exits 0; visit `/evals/<legacy-project>/v1` locally — renders without errors.

#### 36-22 — End-to-end smoke: `gad eval auto --runtime claude`

- **type:** cli
- **deps:** 36-11, 36-16, 36-20
- **deliverable:** Pick the smallest existing eval project (e.g. `escape-the-dungeon-bare`). Run `gad eval auto --projectid <id> --runtime claude --timeout 10` end-to-end. Confirm: per-eval repo created (if missing), worktree scaffolded, claude streams to terminal, finish auto-runs, TRACE cache written to main repo, new entry in `runs-index.json`, push visible on GitHub.
- **produces:** one real eval run pushed to a per-eval repo; updated `runs-index.json` + `trace-cache/`
- **verify:** `gh repo view MagicbornStudios/<repo> --json` shows the new `round-N/vM/` commit; `cat evals/<project>/trace-cache/round-N/vM.json` shows finalized TRACE with non-zero sizes; `evals/<project>/runs-index.json` contains the entry with `status: done`.

---

## Open questions / spec gaps flagged for implementer

These are unresolved in the spec and will need a decision during execution:

1. **Scoped clone mechanism (spec §10.2):** sparse-checkout vs full clone + `rm -rf`. Task 36-06 defaults to full clone + strip for Windows safety; revisit if repos get large.
2. **`cursor-agent -p` stdout format (spec §10.3):** task 36-10 assumes line-based streaming. Verify during implementation; may need a parser.
3. **TRACE cache shape (spec §10.4):** task 36-15 defaults to per-run files (`round-N/vM.json`), not a single index. Decision embedded in the plan.
4. **Per-eval repo visibility (spec §10.1):** always `--private` in 36-06. No public-flip logic in scope.
5. **`--projectid` vs `--project` flag naming:** current `gad.cjs` uses `--project` for `eval run`. Spec uses `--projectid`. Task 36-08 standardizes on `--projectid` for the new commands; the deprecated `eval run` alias (36-17) keeps accepting `--project` for back-compat.
6. **`gad eval score` integration point (task 36-16):** score command today takes `--project`; new flow calls it in-process. If that's not currently exposed as a function, 36-16 must refactor it into `lib/score.cjs` first — flag as a sub-task if encountered.
7. **Runtime identity fields from phase 35:** task 36-07 writes placeholders if phase 35 hasn't landed yet. If phase 35 ships first, update the scaffolder to use real fields.
8. **Spec §5.2 AGENTS.md scoping wording** is vague — 36-18 will propose exact wording during execution; not pre-decided here.

---

## Task summary

- **Total tasks:** 22
- **Milestones:** 6 (A: 3, B: 2, C: 4, D: 3, E: 5, F: 5)
- **Parallelizable first wave:** Milestones A and B (no mutual dependencies)
- **Critical path:** A → C → D → E → F (smoke at end)
