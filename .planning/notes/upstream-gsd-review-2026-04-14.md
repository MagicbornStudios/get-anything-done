# Upstream GSD Review — 2026-04-14

Mirror refreshed from `tmp/get-shit-done` (note: `.tmp/` path in prior note was a typo — actual path is `tmp/` per `.gitignore:72`). Upstream pinned at `62b5278` (2026-04-14), previous review at `c11ec0555451338c3ef666753ec2b24731d7a2c7` (2026-04-12).

Delta: 5 commits, notably the **v1.36.0** release cut on the upstream branch — the biggest upstream drop since our last review.

## Commits since last review

| sha | title |
|---|---|
| 62b5278 | fix(installer): restore detect-custom-files + backup_custom_files lost in release drift (#2233) |
| 50f61bf | fix(hooks): stamp .sh version headers + fix stale-hooks detector regex (#2224) |
| 201b8f1 | 1.36.0 (version bump) |
| 73c7281 | docs: CHANGELOG + README for v1.36.0 |
| e6e3360 | fix(init): ignore archived phases from prior milestones sharing a phase number (#2186) |

## v1.36.0 — What shipped upstream

Pulled from `CHANGELOG.md` in commit `73c7281`. Grouped by relevance to GAD.

### Overlapping with work GAD already shipped or planned

| Upstream feature | GAD equivalent | Status |
|---|---|---|
| `gsd-pattern-mapper` agent (#1861) | `gad-map-codebase` skill / subagent | GAD already has this |
| Project skills awareness for 9 GSD agents (#2152) | `gad snapshot` EQUIPPED SKILLS block (44-35) | GAD ships this via snapshot hoist, shape is different |
| `/gsd-skill-manifest` pre-compute (#2101) | `gad snapshot` caches skill list | GAD's is a snapshot block, not a manifest file |
| Global skills `~/.claude/skills/` (#1992) | `gad skill promote --project --claude` (44-36) | GAD routes via installer path rewriters |
| `/gsd-debug` session manager + TDD gate (#2146, #2154) | `gad-debug` skill + persistent state | GAD has the skill; no explicit TDD gate |
| Artifact audit gate for milestone close + phase verify (#2157, #2158, #2160) | `gad verify` + `gad milestone` (audit-milestone skill) | GAD has audit-milestone; artifact audit specifically is worth extracting |
| Stale/orphan worktree detection — W017 (#2175) | `gad worktree list/clean/prune` | GAD has the CLI, no health validator yet |
| Seed scanning in new-milestone step 2.5 (#2177) | `gad-plant-seed` skill + `gad-new-milestone` | GAD has seeds but no automatic surface at milestone start — **gap** |
| Context-window-aware prompt thinning (#1978) | Snapshot token budgeting | GAD does this implicitly via `--skills` cap; upstream may be more explicit |
| Context exhaustion auto-recording (#1974) | Decision gad-17 (work-through-compact) | GAD's approach is doc-centric; upstream auto-records state on exhaustion |
| `--dry-run` + state prune (#1970) | N/A | Worth reviewing for STATE.xml hygiene |
| Cross-AI execution hook step 2.5 + plan bounce hook | `gad review` (cross-AI peer review) | GAD has a similar concept |

### New shapes worth watching

1. **`/gsd-graphify` — knowledge graph for planning agents (#2164).** Upstream is building a literal graph over project artifacts. GAD's workflow detector (decision gad-172/174/177) is a graph of skills → workflows. Worth diffing the two approaches once upstream exposes the API — likely distinct problems (their graph is over planning docs, ours is over observed tool traces).

2. **Opt-in TDD pipeline mode — `tdd_mode` in init JSON + `--tdd` flag (#2119, #2124).** Upstream exposes TDD as a first-class workflow toggle. GAD has ad-hoc test generation (`gad add-tests` skill) but no TDD pipeline gate. **Candidate for GAD**: a `tdd_mode` in `gad-config.toml` that changes the execute-phase loop to write-test → fail → implement → pass per task. Low-cost add if we want it.

3. **`@gsd-build/sdk` Phase 1 typed query foundation.** Upstream is formalizing `gsd-sdk query` as a registry of classified handlers (state, roadmap, phase, init, config, validation, skills, workstream, todo, intel, profile, uat, summary, websearch, frontmatter). Security hardening: realpath path containment, ReDoS mitigation on frontmatter regex, PID-liveness stale lock cleanup, depth-bounded JSON search, `QUERY_MUTATION_COMMANDS` for event emission. GAD's CLI is a flat `bin/gad.cjs` dispatcher. **Worth extracting** for GAD's SDK if/when we layer a typed query surface on top of the CLI. Not urgent — our call sites are in-process.

4. **Planner context-cost sizing (#2091/2092/2114).** Upstream replaced time-based phase sizing ("small/medium/large = N hours") with context-cost sizing and a multi-source coverage audit. Aligns with GAD's hydration metric (decision gad-163). Worth re-reading once upstream has the full PR merged.

5. **Inline execution for small plans (#1979) + prior-phase context optimization (#1969).** Upstream now defaults to inline execution (no subagent spawn) for small plans and limits prior-phase context to the 3 most recent + `Depends on` phases. GAD's `gad-execute-phase` already prefers inline for small waves; the prior-phase trim is worth copying into `gad snapshot` phase context assembly.

### Security

`get-shit-done/bin/lib/security.cjs` remains the upstream reference. GAD restored its own `lib/security.cjs` (task 35-08). The upstream SDK query layer hardening (ReDoS, realpath containment, PID-liveness, depth-bounded JSON) is all relevant to GAD's equivalent surfaces. **Follow-up**: sweep GAD's equivalents for each specific fix — none are logged as done yet.

## Recommendations

1. **Do NOT blanket-adopt v1.36.0 features.** Most of them overlap with GAD work already shipped in a different shape. Cherry-pick only.

2. **Specific items worth lifting into GAD planning docs as new tasks or seeds**:
   - Seed scanning at milestone start (#2177) — GAD has `gad-plant-seed` but no auto-surface. **Seed candidate.**
   - Artifact audit gate pattern (#2157/58/60) — GAD has audit-milestone but not artifact-level. **Small task worth queuing.**
   - TDD pipeline mode (#2119/24) — optional GAD toggle. **Seed for v1.2.**
   - Worktree health validator (#2175) — GAD has worktree CLI but no validator. **Small task.**
   - Prior-phase context trim (#1969) — GAD snapshot could adopt. **Small task.**
   - Security sweep against SDK query hardening list. **Task for next security pass.**

3. **Keep the mirror current.** Next refresh target: after the next upstream tag (likely v1.37.0). Process: `git -C tmp/get-shit-done pull --ff-only` + update the pin in this file + write `upstream-gsd-review-<date>.md`.

4. **Mirror path bug**: prior note said `.tmp/get-shit-done`, actual is `tmp/get-shit-done` (no leading dot). Task 35-06 goal text should be updated in a future pass. Not worth a standalone task.

## Mirror state

- Path: `tmp/get-shit-done/` (gitignored via `.gitignore:72`)
- Pin: `62b5278` (2026-04-14)
- Previous pin: `c11ec0555451338c3ef666753ec2b24731d7a2c7` (2026-04-12)
- Upstream tags since pin: `v1.9.8`, `v1.9.9`, `v1.36.0` (the 1.x tags appear to be old release-line tags surfacing via unshallow, not new work)
