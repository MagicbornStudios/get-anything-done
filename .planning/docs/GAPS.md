# Programmatic-Evaluation Gaps Audit

**Owner:** GAD framework maintainers.
**Anchor decision:** [gad-69](DECISIONS.xml) — every eval metric must answer "can this be collected programmatically?" before "how do we score it?". Minimize agent-self-report and human-judgment dependencies.
**Scope:** every field currently captured in `TRACE.json`, `human_review_rubric`, `derived` metrics, and hook output.
**Status:** living document. Updated each round. Ranked by **severity** (how much judgment we currently rely on) × **feasibility** (how mechanically checkable the signal actually is).
**Last updated:** 2026-04-09.

---

## Methodology

For every existing eval signal, answer three questions:

1. **Current source:** where does this number come from today? (TRACE.json field written by the agent, human rubric, derived formula over traces, hook event)
2. **Trust model:** is it agent-self-report, human-judgment, tool-observed, or computed-deterministic?
3. **Programmatic alternative:** if it's self-report or human, what tooling could collect the same signal objectively?

A gap exists when the answer to (2) is self-report or human AND the answer to (3) is "yes, this is mechanically checkable with reasonable effort."

---

## Ranked gaps

### G1 · Gate-pass verdict (G1 game-loop, G2 forge, G3 UI, G4 pressure)

- **Current source:** `requirementCoverage.gate_failed` boolean + `gate_notes` string, written by the agent self-reporting in TRACE.json, optionally reviewed by a human.
- **Trust model:** agent self-report, occasionally refuted by human playtest.
- **Programmatic alternative:** a **Playwright smoke-test harness** run against the preserved build in `apps/portfolio/public/evals/<project>/<version>/`. G1 game-loop is testable (title → new game → enter room → find exit → navigate → encounter → resolve → return). G2 forge is testable (open forge → select 2 runes → craft → see new spell in inventory). G3 UI is partially testable (assert no raw ASCII, assert bars rendered, assert icons present by CSS class). G4 pressure is harder but at least one pressure signal (affinity progress bar visible, resource scarcity visible) is assertable.
- **Severity:** **critical** — these are the most load-bearing signals we have and they're currently agent self-reports.
- **Feasibility:** **high** — preserved static builds are already deployed, Playwright runs headless, CI-ready.
- **Phase:** queue into phase 27 track 2 (playwright gate checks — already deferred in STATE).

### G2 · Skill-trigger coverage (did the right skill load on the right tool_use?)

- **Current source:** we don't capture this cleanly. `expected_triggers` exist in `EXPECTED-TRIGGERS.md` but are evaluated by agent self-report at the end of a run.
- **Trust model:** agent self-report.
- **Programmatic alternative:** **trace schema v4's hook-emitted skill_invocation events** (gad-58, already partially in place) joined against `EXPECTED-TRIGGERS.md`. For every expected trigger, scan tool_uses in the same phase and check whether the corresponding skill file was opened/loaded or a `skill_invocation` event was emitted.
- **Severity:** **high** — Anthropic's guide (gad-70) names triggering tests as the first testing layer. We have the raw data but not the check.
- **Feasibility:** **medium** — requires a new `gad eval check-triggers <project> <version>` command that reads the trace events and the expected-triggers file.
- **Phase:** new task for phase 25 milestone E.

### G3 · Build/test pass-fail as stability signal

- **Current source:** the agent eventually reports "build works" via human-review notes. We don't capture exit codes.
- **Trust model:** agent self-report.
- **Programmatic alternative:** every eval `gad eval preserve` step already runs a build. Capture the **build exit code + build log digest + bundle size** as structured fields in TRACE.json's `timing` section. Add a `gad eval build-check <project> <version>` that re-runs the build against the preserved source and writes the result.
- **Severity:** **high** — we've been burned twice by "builds locally, doesn't build in preservation" (emergent v3 failure, gad v10 partial).
- **Feasibility:** **high** — the preservation pipeline already runs a build. Just capture the result.
- **Phase:** new task for phase 25 milestone D follow-up.

### G4 · Tool-use mix + skill-to-tool ratio

- **Current source:** `derived.tool_use_mix` and `derived.skill_to_tool_ratio` — **computed** from trace events by the prebuild script.
- **Trust model:** **tool-observed, deterministic** (already good).
- **Programmatic alternative:** already programmatic. Keep as-is.
- **Severity:** none — this is what good looks like.
- **Action:** none, document as the reference pattern other derived metrics should follow.

### G5 · Commit rhythm + plan-adherence delta

- **Current source:** `derived.plan_adherence_delta`, `gitAnalysis.total_commits`, `gitAnalysis.per_task_discipline` — computed from git history + planning docs.
- **Trust model:** deterministic over git log.
- **Programmatic alternative:** already programmatic. Could be sharper: right now `plan_adherence_delta` compares task count in TASK-REGISTRY to commit count. A sharper version would diff task subjects against commit subjects via fuzzy match.
- **Severity:** low.
- **Feasibility:** medium for the sharper version.
- **Phase:** nice-to-have for phase 25 polishing.

### G6 · Requirement-coverage counts (fully_met / partially_met / not_met)

- **Current source:** `requirementCoverage.fully_met` / `partially_met` / `not_met` counts — **agent self-reports** these in TRACE.json after running.
- **Trust model:** agent self-report.
- **Programmatic alternative:** requires a machine-readable requirement spec (we have REQUIREMENTS.xml already) plus per-criterion playwright assertions or static code checks. Not all criteria are mechanically checkable, but many are (file presence, feature flags, UI elements rendered). Create a `gad eval coverage <project> <version>` that walks each criterion and runs whatever check is declared on it.
- **Severity:** **high** — this feeds `requirement_coverage` which is weighted heavily in the composite.
- **Feasibility:** **medium** — requires per-criterion check definitions inside REQUIREMENTS.xml (a new `<check type="playwright|file-exists|grep">` child element).
- **Phase:** phase 27 track 2 (merge with G1).

### G7 · Sub-agent spawn count + duration

- **Current source:** trace schema v4 should capture `subagent_spawn` events (gad-50) via the hook handler.
- **Trust model:** hook-observed when captured, else we don't know.
- **Programmatic alternative:** already the plan. Audit: verify the hook handler is actually emitting subagent events for all agent runtimes we support, not just Claude Code.
- **Severity:** medium.
- **Feasibility:** high once hooks are fully installed.
- **Phase:** phase 25 milestone B verification.

### G8 · Asset-sourcing actually attempted vs geometric fallback used

- **Current source:** human inspection of the built game + agent self-report in notes.
- **Trust model:** human.
- **Programmatic alternative:** scan the preserved bundle for iconify/@iconify imports, sprite PNG/SVG assets, or pure CSS-geometric elements. A simple heuristic: if the bundle contains any `.png`, `.svg`, or iconify imports → sourcing attempted. If only CSS shapes → geometric fallback. Capture as a `derived.asset_sourcing_strategy` enum.
- **Severity:** medium — feeds UI quality gate (G3).
- **Feasibility:** high — bundle inspection is straightforward.
- **Phase:** phase 25 milestone D follow-up.

### G9 · Notification/toast persistence (stability bug pattern)

- **Current source:** human playtest only (logged in `data/bugs.json`).
- **Trust model:** human.
- **Programmatic alternative:** Playwright test — load the built game, trigger a notification, reload the page, assert no leftover notification DOM element. Testable for any build that emits notifications.
- **Severity:** medium.
- **Feasibility:** high.
- **Phase:** phase 27 track 2 (join with G1).

### G10 · Per-tick redraw / render-loop detection (perf stability)

- **Current source:** human observation ("glitchy redraws on button click").
- **Trust model:** human.
- **Programmatic alternative:** Playwright + Performance API — measure frame count while idle, assert no per-tick redraws when nothing is happening. Or a simpler heuristic: grep the built bundle for `setInterval` loops that invoke render functions, flag as warning.
- **Severity:** medium (requirement R-v5.21).
- **Feasibility:** medium — the grep heuristic is cheap; the runtime measurement is more work.
- **Phase:** phase 27 track 2.

### G11 · Skill-inheritance effectiveness (the CSH signal)

- **Current source:** 6th rubric dimension on emergent runs — **human-reviewed**.
- **Trust model:** human.
- **Programmatic alternative:** partial. A programmatic component can check: (a) did the agent read every inherited skill file (captured in hook events), (b) did it update or author new skills (file mutation events), (c) did it emit a CHANGELOG noting the disposition of each inherited skill, (d) did the authored skills follow Anthropic's frontmatter format (valid description, valid triggers, valid category). The "is the inheritance actually effective" judgment is still human, but the checklist of hygienic inheritance is programmatic.
- **Severity:** **high** — CSH is the core hypothesis, gad-65 / gad-68.
- **Feasibility:** **high** for the hygiene part, **low** for the effectiveness part.
- **Phase:** phase 27 skill-inheritance-hygiene checker — new task.

### G12 · Human-review score itself

- **Current source:** human playtest + rubric submission.
- **Trust model:** human.
- **Programmatic alternative:** by design, this one stays human. The rubric decomposition (per gad-61) is the best we can do — we can't automate "does the game FEEL right." What we CAN automate is cross-checking: if human says playability 0.90 but programmatic G1 gate fails, flag the contradiction.
- **Severity:** low — this is what human review is for.
- **Feasibility:** consistency-check is high feasibility.
- **Phase:** nice-to-have: `gad eval consistency-check <project> <version>` command.

---

## Summary table

| Gap | Priority (revised) | Feasibility | UI-dependent? | Phase |
|---|---|---|---|---|
| **G2 Skill-trigger coverage** | **critical** | medium | no | phase 25 milestone E (new) |
| **G3 Build/test exit code** | **critical** | high | no | phase 25 milestone D follow-up |
| **G11 Skill-inheritance hygiene** | **high** | high (hygiene) | no | phase 27 new task |
| G7 Subagent spawn audit | medium | high | no | phase 25 milestone B verify |
| G8 Asset sourcing heuristic | medium | high | no (bundle inspection) | phase 25 milestone D follow-up |
| G5 Commit rhythm sharpening | low | medium | no | polish |
| G12 Consistency cross-check | low | high | no | nice-to-have |
| G4 Tool-use mix | — | — | no | already good, reference pattern |
| G1 Gate-pass verdict | **deferred** | would need Playwright | yes | revisit at UI stability |
| G6 Requirement coverage counts | **deferred** | would need Playwright | partially | revisit at UI stability |
| G9 Notification persistence | **deferred** | would need Playwright | yes | revisit at UI stability |
| G10 Per-tick redraw detection | **deferred** | would need Playwright | yes | revisit at UI stability |

## Why not Playwright yet (user directive 2026-04-09)

User review of this audit: **Playwright-based visual tests are deferred**. Reasoning: the game UI is still changing fast between rounds. A test harness built against the current UI would need constant refactoring as v5, v6, v7 land — the maintenance tax exceeds the signal value this early. Visual/integration tests become appropriate **after** a game has reached UI stability and the requirements stop moving. For now, we lean on trace-event-based signals (hooks, tool uses, file mutations) that don't assume anything about the UI. The gaps that depended on Playwright (G1, G9, G10) are re-ranked down; the gaps that depend only on trace events and build artifacts (G2, G3, G11) are re-ranked up.

This is a deliberate tradeoff, not an oversight: we accept weaker gate-pass signals in exchange for low-maintenance instrumentation.

## Recommended next actions (revised)

1. **G2 Skill-trigger coverage** — highest priority. Per gad-69 the hook-captured skill_invocation events are the single most important programmatic signal we can collect. Build `gad eval check-triggers <project> <version>` that reads trace events and joins them against EXPECTED-TRIGGERS.md. This answers "did the right skill load on the right tool_use" without touching the game UI.
2. **G3 Build/test exit code** — capture the exit code + log digest + bundle size during `gad eval preserve`. Low-effort, high-signal, no UI assumptions.
3. **G11 Skill-inheritance hygiene** — walk inherited skill files + file-mutation events + CHANGELOG + frontmatter validity (per Anthropic skills guide gad-70). Reports hygiene % as a scored dimension alongside the human-judgment part of skill_inheritance_effectiveness.
4. **G4 is the reference pattern.** Every new programmatic metric should follow its shape: trace events in, deterministic derivation out, typed field on EvalRunRecord, rendered on the per-run page with a data-provenance caption ("this score reads X from TRACE.json derived.foo").
5. **Revisit G1 + G9 + G10 when the game reaches UI stability.** Likely after v6 or v7 when the requirements stabilize. Until then, these gaps stay open as documented-but-deferred.

## Data provenance convention (follows from G4)

Every metric rendered on the site must be annotated with:
- where the number comes from (TRACE field or derived formula)
- who produced it (agent self-report, hook, prebuild computation, human review)
- whether it's programmatic or not (badge)

This is the `data provenance` view the user asked for on the /roadmap page (task 88).
