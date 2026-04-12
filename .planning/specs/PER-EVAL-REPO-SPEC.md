# Phase 36 Spec: Per-eval-repo architecture + command split + env checks

**Phase:** 36
**Depends on:** 35 (cross-runtime telemetry — for the runtime identity fields in TRACE)
**Decisions:** GAD-D-139, GAD-D-140, GAD-D-141, GAD-D-142, GAD-D-143

## 1. Why

The current eval layout inlines everything under `evals/<project>/v<N>/run/` in the main monorepo. This has three problems:

1. **Monorepo bloat** — brownfield codebases, content packs, and preserved build output all get committed to the main repo. At 49 runs today, this is already heavy. At 500 runs it becomes unworkable.
2. **No isolation** — cloning the main repo for one eval run drags every other eval's history along. The agent doing v7 of `etd-bare` shouldn't see v1 through v6 in its worktree.
3. **`gad eval run` is misleading** — the command name implies "execute the run" but actually just scaffolds a prompt for an external orchestrator. The real execution happens in a separate agent, by hand, or via `--execute` mode outputting JSON for a wrapper script.

This phase solves all three by:
- Moving eval source/build artifacts to per-eval GitHub repos
- Splitting `gad eval run` into explicit `start` / `auto` / `finish` commands
- Adding `gad env` preflight checks so failures happen at the beginning, not mid-run

## 2. Per-eval repo layout

### 2.1 Repo creation

- One GitHub repository per eval project. Name matches the eval project id: `escape-the-dungeon-bare`, `etd-phaser`, `reverse-engineer-eval`, etc.
- Org: `MagicbornStudios` (same as main GAD repo).
- Visibility: **private** for all new eval repos.
- Created on first `gad eval start` for that project if it doesn't exist.
- Uses `gh repo create` under the hood. Requires `gh auth status` to pass.

### 2.2 Repo layout

```
etd-bare/                          # eval project repo
├── README.md                      # eval project description, links back to main repo
├── gad.json                       # copy of eval metadata (source of truth stays in main repo)
├── round-4/                       # requirements version v4 round
│   ├── v1/                        # first run in round 4
│   │   ├── .planning/             # scoped to this run only
│   │   ├── src/                   # source code the agent wrote
│   │   ├── build/                 # build output (game html, composition, etc)
│   │   ├── PROMPT.md              # the prompt the agent ran against
│   │   ├── TRACE.json             # full trace for this run
│   │   ├── RUN.md                 # run metadata
│   │   └── .gad-log/              # raw trace events if under Claude Code
│   ├── v2/                        # second run in round 4 (rerun, different attempt)
│   └── v3/
├── round-5/
│   └── v1/
└── .github/
    └── workflows/                 # optional: CI for the eval itself
```

### 2.3 Main monorepo layout (post-migration)

```
vendor/get-anything-done/evals/
├── escape-the-dungeon-bare/
│   ├── gad.json                   # eval metadata (authoritative)
│   ├── REQUIREMENTS.md             # static across rounds unless overridden
│   ├── template/                   # bootstrap template for new runs
│   │   ├── .planning/
│   │   └── AGENTS.md
│   └── runs-index.json             # lightweight index: { round: N, version: M, repo: "url", trace_ref: "..." }
```

Everything heavy (source, build, full TRACE, preserved worktrees) lives in the per-eval repo. Main monorepo only has metadata + template + index.

## 3. Command split

### 3.1 `gad eval start`

**Purpose:** Scaffold a new run and hand off to an external agent.

**Flow:**
1. Check `gh auth status` — fail if not authenticated, point to `gh auth login`.
2. Resolve eval project from `--projectid`. Fail if not found with a listing.
3. Check `evals/<project>/gad.json` for `round` config and current requirements version.
4. Determine next run number: scan per-eval repo for existing `round-N/vM/` directories.
5. Clone the per-eval repo to `<os-tmpdir>/gad-eval-<project>-<round>-v<N>/` (or create it if it doesn't exist yet).
6. **Scoped clone:** after clone, remove all existing `round-N/vM/` directories except the new one we're creating. Leaves only the current scaffold + `gad.json` + `README.md`.
7. Copy `evals/<project>/template/` contents into `round-N/vM/`.
8. Generate `PROMPT.md` + `TRACE.json` scaffold inside `round-N/vM/`.
9. Write `EXEC.json` for external orchestrators (same shape as today).
10. Print the worktree path and next steps.

**Usage:**
```sh
gad eval start --projectid etd-bare
# Clones etd-bare repo to tmp, scaffolds round-5/v2/, prints handoff instructions
```

**Exit:** process exits. Agent/orchestrator runs separately.

### 3.2 `gad eval auto`

**Purpose:** End-to-end autonomous eval run using a coding agent CLI.

**Flow:**
1. Run `gad env check --runtime <name>` internally. Fail fast if runtime not installed or `gh` not authed.
2. Run the `gad eval start` flow above to scaffold the worktree.
3. Read `round-N/vM/PROMPT.md`.
4. Shell out to the coding agent CLI with the prompt:
   - **claude**: `claude --print <prompt> --output-format stream-json --cwd <worktree>`
   - **codex**: `codex exec <prompt> --cwd <worktree>` (verify exact flags)
   - **cursor**: `cursor-agent --model auto -p <prompt>` (from worktree cwd)
5. **Stream stdout/stderr** to the terminal as the agent runs.
6. Wait for the agent process to exit (or timeout after 60min — configurable via `--timeout`).
7. On exit: run `gad eval finish` automatically.
8. On timeout: mark run as `interrupted` in TRACE.json, still call finish to preserve partial work, exit non-zero.

**Usage:**
```sh
gad eval auto --projectid etd-bare --runtime codex
gad eval auto --projectid etd-phaser --runtime claude --timeout 45
```

**Multiple runs in parallel:** pass multiple `--projectid` args. They launch as concurrent child processes. Serial remains the default if only one id is given.

```sh
gad eval auto --projectid etd-phaser etd-pixijs etd-threejs --runtime codex
# Launches 3 evals in parallel
```

### 3.3 `gad eval finish`

**Purpose:** Preserve a completed run: compute metrics, push to eval repo, mark done.

**Flow:**
1. Find the worktree for the run (via `EXEC.json` or `--from <path>`).
2. Compute `source_size_bytes` (total of `src/`) and `build_size_bytes` (total of `build/`).
3. Update `TRACE.json` with `timing.ended`, durations, sizes, and (if running under Claude Code) merge any `.trace-events.jsonl` events.
4. Run `gad eval score --project <id>` to compute auto scores.
5. Copy the scoped run back to `<monorepo>/evals/<project>/runs-index.json` as a reference entry.
6. `cd` into the worktree, `git add` the run dir, commit with `feat(<project>/round-N/vM): preserve run`, push to the per-eval repo.
7. Clean up the tmp worktree (optional — leave it via `--keep-worktree`).

**Usage:**
```sh
gad eval finish --projectid etd-bare --round 5 --version v2
gad eval finish --projectid etd-bare  # auto-detects latest run
```

### 3.4 Backward compatibility

- `gad eval run` becomes an alias for `gad eval start`. Prints a deprecation notice.
- `gad eval preserve` becomes an alias for `gad eval finish`. Prints a deprecation notice.
- `gad eval suite` is removed (or becomes a stub that points to `gad project run-round` in phase 37).

## 4. `gad env` — runtime availability

### 4.1 `gad env status`

Print a table of runtime availability:

```
Runtime       Status       Version   Notes
────────────  ───────────  ────────  ──────────────────────────────────
claude        installed    0.4.12    via npm global
codex         installed    0.2.1     via npm global
cursor-agent  not found    —         Install: curl cursor.com/install
gh            authed       2.45.0    logged in as b2gdevs
node          installed    24.13.0
git           installed    2.47.0
```

### 4.2 `gad env agents`

Shorter version showing only coding agent runtimes. Same data, agents-only filter.

### 4.3 Preflight integration

`gad eval auto --runtime X` runs `checkRuntimeAvailable(X)` before anything else. If `X` is missing:

```
Error: runtime 'codex' not found.
Install: npm install -g @openai/codex
Or pick a different runtime: gad env agents
```

Same for `gh auth`:

```
Error: gh CLI is not authenticated.
Run: gh auth login
Docs: https://cli.github.com/
```

## 5. Dead code removal

### 5.1 Skill invocation hook code

`bin/gad-trace-hook.cjs` has ~60 lines dedicated to reading `.planning/.trace-active-skill` and emitting `skill_invocation` events. The marker file was never wired up in any skill, so `trigger_skill` is always `null` in the 1000 events we've captured.

**Action:** delete the `maybeSkillInvocationEvent` function, `readActiveSkill` helper, and the `.trace-last-skill` file tracking. Simplify the hook to only emit `tool_use` / `subagent_spawn` / `file_mutation` events.

**Not removed:** the `trigger_skill` field stays on tool_use events but is hardcoded to `null`. If we ever wire skill tracking via a different mechanism, the field is there.

### 5.2 Skill tracking clarification (GAD-D-142)

Skill/agent attribution via `skill=""` and `agent=""` attributes on TASK-REGISTRY.xml tasks is the real mechanism. It only applies under the GAD workflow. Document this in:
- `docs/eval-guide.md` — "Skill tracking is GAD-only, by design"
- `docs/quick-start.md` — clarify attribution is a GAD loop step, not a universal requirement
- `AGENTS.md` — the mandate still exists for GAD workflow but is explicitly scoped to GAD

## 6. Migration of 49 existing inline runs

**Option A: big bang.** Create 26 per-eval repos, migrate all runs into them, delete the inline data.

**Option B: legacy allowed.** New runs use per-eval repos. Old runs stay inline. Site data pipeline reads both. Eventual migration script.

**Recommendation: Option B.** Lower risk. The existing 49 runs have their TRACE.json data already parsed into the site. Breaking that would require parallel plumbing. Mark old runs as `legacy_inline: true` in their TRACE.json so the site can render them correctly, and move on.

A separate phase 38+ can migrate legacy runs as backfill if we decide it's worth the effort.

## 7. Site data pipeline changes

The site currently reads `evals/<project>/v<N>/TRACE.json` directly from the main repo. After phase 36:

- **Metadata** (`gad.json`, `runs-index.json`) stays in main repo — site reads it as today.
- **Per-run TRACE.json** lives in the per-eval repo. Site has two options:
  - **A) Clone at build time** — `build-site-data.mjs` does shallow clones of each eval repo into `/tmp`, reads TRACE files, caches them. Slow but full control.
  - **B) GitHub API fetch** — use `gh api` to fetch raw TRACE.json content by path. Requires `gh` + `GH_TOKEN` at build time. Fast for small files, no cache needed.
  - **C) Hybrid** — main repo holds a cached copy of each TRACE.json keyed by `{project, round, version}`. Cache is refreshed by `gad eval finish` when a run is preserved. Site reads only the main repo.

**Recommendation: C.** Simplest for the site. The cache IS the source of truth from the site's perspective. The eval repo has the full source; the main repo has the metrics snapshot. `gad eval finish` writes both.

## 8. Acceptance criteria

1. `gad env status` exists and prints runtime table. `gad env agents` is its alias subset.
2. `gad eval start` exists. Creates per-eval repo on first use. Scoped clone strips other rounds. Scaffolds PROMPT + TRACE + EXEC.
3. `gad eval auto` exists. Accepts `--runtime codex|claude|cursor`. Streams agent output. Calls finish on exit. 60min default timeout.
4. `gad eval finish` exists. Computes sizes, pushes to eval repo, updates main repo index + TRACE cache.
5. `gad eval run` and `gad eval preserve` exist as deprecated aliases with warnings.
6. `gad-trace-hook.cjs` no longer emits `skill_invocation` events. Dead code removed. Hook still captures tool_use/file_mutation/subagent_spawn.
7. `docs/eval-guide.md` and `docs/quick-start.md` updated with the new commands and skill-tracking-is-GAD-only clarification.
8. At least one new eval run completes end-to-end via `gad eval auto --runtime claude` to prove the loop closes.
9. Existing 49 inline runs still render on the site (legacy mode).
10. `pnpm build` in `site/` passes.

## 9. Non-goals for phase 36

- **Migrating legacy runs** — separate phase if needed.
- **`gad project` command** — phase 37.
- **Runtime identity telemetry** — phase 35 handles runtime-derived identity fields in TRACE; phase 36 just uses them.
- **GitHub Actions automation for eval repos** — manual auth + push for now.
- **Parallel runtime comparison dashboards** — data will start flowing; visualization comes later.

## 10. Open questions for implementer

1. **Per-eval repo visibility** — confirm private initially. Do we flip to public for canonical projects (ETD, explainer)?
2. **Scoped clone mechanism** — `git clone --no-checkout` then sparse-checkout? Or clone full then `rm -rf` non-current rounds? (Sparse is cleaner but Windows-git has quirks.)
3. **`cursor-agent` streaming output format** — need to verify what `-p` mode returns on stdout. Might need a stdout parser.
4. **Main repo TRACE cache** — per-run files or one big index? Files are simpler for git diffs, an index is smaller but harder to read.

## 11. Phase 37 preview — what this unblocks

Phase 37 ships `gad project` as the top-level project lifecycle command:
- `gad project create <name>` — scaffold a real project or eval project
- `gad project update-requirements` — trigger new round, auto-create gad+bare variants
- `gad project install-skill` — inject skill into per-eval repo, new injected-condition eval
- `gad project add-content` — inject content pack, new content-driven eval
- `gad project run-round --roundnumber N` — execute all variants in a round

All of these depend on per-eval repos existing so they know where to push the injected content/skill.
