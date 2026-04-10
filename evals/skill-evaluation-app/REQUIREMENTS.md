# skill-evaluation-app — requirements

**Status:** scaffolded, no runs yet.
**Anchor task:** 22-51 (gad-88, new eval domain).
**Anchor decisions:** gad-88 (new eval domain), gad-85 (npx skills ecosystem), gad-87 (per-skill eval harness), gad-72 (rounds framework — this becomes round 6 when it runs).

---

## The task, in one sentence

Build a static Next.js + React 19 GUI that lets a user (a) author GAD eval requirements in XML with autocomplete + inline validation, and (b) view per-skill evaluation harness output (benchmark.json, feedback.json, timing.json per iteration) with interactive charts.

## Why this eval exists

Generalization. Per SKEPTIC cross-cutting critique #5, every GAD eval to date has been a variant of Escape the Dungeon or (planned) the Remotion explainer video. We cannot claim the freedom hypothesis, CSH, or emergent-evolution generalize beyond creative implementation without testing on a third task domain. GUI app development is the canonical front-end task — it has clear success criteria, a stable runtime stack, and a user-facing output a reviewer can play with.

It also produces a dogfood artifact: once built, the GUI becomes part of the GAD eval framework, used for authoring future requirements and viewing future eval runs. Second-order CSH experiment.

## Scope

### What the GUI must do

1. **Requirements authoring**
   - Load a `template/REQUIREMENTS.xml` file from a URL or file picker
   - Render its structure as a form: goal, core-principle, gate criteria, room types, requirements, addendums
   - Autocomplete for gate IDs, amends references, requirement IDs
   - Inline pressure preview — as the user adds or removes requirements, show the computed task_pressure (R + 2G + C formula per gad-79) in a live badge
   - Cross-cut visualization: clicking a requirement shows every other requirement that amends it
   - Export: download the edited XML

2. **Eval harness viewer**
   - Load a `benchmark.json` output from a URL
   - Render aggregate metrics (pass_rate, time, tokens) with interactive charts
   - Drill into a specific iteration and show per-assertion results
   - Show the with_skill vs without_skill delta prominently
   - Surface failed assertions inline with evidence text
   - Load a `feedback.json` alongside for human-written notes per test case

3. **Cross-page navigation**
   - A nav with dropdowns (Theory / Evaluation / Authoring / Viewing) — same IA pattern as the existing GAD site
   - A keyword search (same pattern as the existing GAD site's GlobalSearch)
   - Mobile-responsive

### What the GUI must NOT do

- **No backend.** The GUI is a static export. All I/O is file-load + URL-load. Writes stay in the user's browser (localStorage) until the user explicitly exports.
- **No authentication.** It is a research tool, not a product.
- **No user accounts.** Same reason.
- **No skill execution.** The GUI views harness output; it does not run the harness. The harness is the `gad eval skill <name>` CLI (per gad-87).

## Constraints

- **Duration:** expected agent wall-clock ≤ 45 minutes per attempt (same order as round-4 builds).
- **Runtime:** Next.js 16, React 19, Tailwind v4. Same stack as the existing GAD site so readers can visually compare.
- **Deploy target:** Vercel static export (`next build` + `next export`). No SSR, no runtime functions.
- **Test data:** a sample `benchmark.json` + sample `REQUIREMENTS.xml` ship under `template/fixtures/`. The GUI loads these by default so first-run visitors see a populated state.

## Mandatory frames (acceptance gates)

1. **G1 — Requirements load.** Loading `template/fixtures/REQUIREMENTS.xml` renders a populated form with at least the goal + 4 gates + 21 v5 addendum requirements. No console errors.
2. **G2 — Pressure preview live.** Editing a requirement (adding one, removing one, adding an amends attribute) immediately updates the task_pressure badge without a page reload.
3. **G3 — Harness viewer live.** Loading `template/fixtures/benchmark.json` renders an aggregate chart showing with_skill vs without_skill. Clicking a test case shows assertion-level detail.
4. **G4 — Mobile responsive.** The GUI is usable on 375px-wide viewports (iPhone SE). The nav collapses to a menu, the charts resize, the forms scroll.

## Scoring

See `gad.json` `human_review_rubric`. Summary:

- **ui_usability** (0.30) — can a first-time user author a requirements doc + load harness output in under 5 minutes?
- **requirements_ergonomics** (0.20) — autocomplete, inline validation, pressure preview, cross-cut viz
- **harness_integration** (0.20) — with_skill vs without_skill delta prominent, failed assertions inline
- **visualization_quality** (0.15) — interactive charts with data provenance captions
- **stability** (0.15) — no blank screens, build reproducible

## Deferred to v2

- Write-back to disk / GitHub PR flow
- Real-time harness runner embedded in the GUI
- Multi-user collaboration
- Requirements version diff view

## What this eval does NOT test

- It does NOT test game design. Different task entirely.
- It does NOT test video composition.
- It does NOT replace the other eval domains — round 5+ runs all three in parallel.

## Pre-run checklist

Before the first run of this eval:

1. Scaffold siblings: `evals/skill-evaluation-app-bare/gad.json` + `evals/skill-evaluation-app-emergent/gad.json` with workflow field swapped.
2. Author `template/REQUIREMENTS.xml` v1 (XML version of this markdown) with gate structure.
3. Author `template/fixtures/REQUIREMENTS.xml` and `template/fixtures/benchmark.json` as sample inputs.
4. Confirm `gad eval skill <name>` CLI exists (per gad-87, task 22-52) so the viewer has real output to render.
5. Write the eval prompt file `skill-evaluation-app-eval-prompt.md`.
6. Mark task 22-51 as `in-progress` in TASK-REGISTRY.xml.

After the first run:

7. Preserve run output per gad-38.
8. Submit a rubric review per gad-61.
9. Use the new GUI to author the FIRST requirements doc for an upcoming eval — dogfood the output before marking the task done.
