# gad-explainer-video — requirements

**Status:** scaffolded, no runs yet.
**Anchor task:** 22-31 (Phase 26 scaffolding).
**Anchor decisions:** gad-57 (Remotion: 30s max, cinematic passthrough, stoppable, /videos route), gad-52 (Remotion is how we ship video explainers — player, not compiler).

---

## The task, in one sentence

Produce a Remotion video (max ~3 minutes) that explains the GAD framework — what it is, what hypotheses it tests, what its current state is, and what the viewer should do next if they want to engage with it — in a way that a first-time visitor can understand without prior context.

## Why this eval exists

Every eval the project has run to date has been a variant of Escape the Dungeon. Per the /skeptic cross-cutting critique #5 ("single-task domain"), we cannot claim generalization about agent behavior when we only have evidence from one game. The `gad-explainer-video` eval is the first attempt at a **different task domain** — the agent is not writing a game, it's composing a video — while testing the same hypotheses (freedom / CSH / emergent-evolution). If freedom still holds here, the hypothesis generalizes. If it doesn't, the hypothesis is specific to creative game implementation.

## Scope

The video must cover:

1. **What GAD is** in under 20 seconds, framed for a visitor who has never heard of it.
2. **The research thesis** — "evaluate and evolve agents under measurable pressure" — explained as a concrete claim with a concrete question behind it, not as marketing copy.
3. **The three workflow conditions** — GAD / bare / emergent — with a visual distinction so the viewer remembers which is which.
4. **The current hypotheses** — freedom, compound-skills, emergent-evolution, content-driven — each named once, each with one concrete piece of evidence, each with a skeptic disclaimer that the sample size is too small to call a finding.
5. **What round 5 is going to test** and why it's the first scientifically defensible round.
6. **How a viewer can participate** — fork the repo, run an eval, submit a rubric review, open an issue against /skeptic critiques.
7. **A closing frame** that points at the current state of /hypotheses and /skeptic with visible URLs.

## Constraints

- **Duration:** 60-180 seconds. Shorter is better if the content fits.
- **Runtime:** Remotion (`@remotion/player` for site embed, `@remotion/cli` for rendering). No external video editors.
- **Stack:** TypeScript + React. Compositions live at `vendor/get-anything-done/site/remotion/`.
- **Audio:** optional for v1. If present, must be captioned.
- **Assets:** no copyrighted material. SVG / emoji / shadcn-style geometric compositions only.
- **Rendering:** must be reproducible via `npx remotion render` from the site directory.
- **Embedding:** must be playable in-browser via `@remotion/player` on the `/videos` route.

## Mandatory frames (acceptance gates)

Every acceptance run must hit these visual checkpoints in order:

1. **G1 — The thesis frame.** A full-screen title card stating the working value proposition line from gad-76 verbatim: "A system for evaluating and evolving agents through real tasks, measurable pressure, and iteration."
2. **G2 — The three-condition diagram.** A visual split showing GAD / bare / emergent side by side, each with one sentence describing what it is and one numeric current-state data point (e.g. GAD = 0-4 scored runs, Bare = 5 scored runs monotonically improving, Emergent = 2-3 scored runs with a ratcheting cycle observed).
3. **G3 — The skeptic frame.** A frame stating explicitly: "N=2-5 runs per condition. One human reviewer. One task domain. This is exploratory analysis, not hypothesis testing." Must be at least 3 seconds of screen time — viewer has time to read it.
4. **G4 — The contribution frame.** Closing card with the fork URL and a one-line "clone → install → open in Claude → talk" flow matching /contribute.

## Scoring

See `gad.json` `human_review_rubric` for the per-dimension breakdown. Summary:

- **pedagogical_clarity** (0.30) — does a first-time viewer understand GAD after watching?
- **video_polish** (0.25) — composition quality, typography, transitions
- **accuracy** (0.20) — no overclaiming of findings; skeptic disclaimers present
- **scope_fit** (0.15) — hits the duration window without padding or rushing
- **stability** (0.10) — renders without errors

## Deferred to v2

- Narration / voice-over
- Multi-language captions
- Interactive seek-to-chapter navigation
- Longer-form 10-minute deep-dive variant

## What this eval does NOT test

- It does **not** test game design. The agent is not writing a game here.
- It does **not** test the rubric for the escape-the-dungeon family. Different task, different rubric.
- It does **not** replace the escape-the-dungeon evals. Both tracks run in parallel from round 5 onward.

## Pre-run checklist

Before the first run of this eval:

1. Install `@remotion/cli` (sibling of `@remotion/player` which is already in site/package.json).
2. Scaffold `site/remotion/Root.tsx` with an empty Composition registry.
3. Scaffold `site/app/videos/page.tsx` that loads compositions via `@remotion/player`.
4. Author `template/REQUIREMENTS.xml v1` for the script (the XML version of this markdown).
5. Write the eval prompt file `gad-explainer-video-eval-prompt.md` that the agent receives.
6. Mark task 22-31 as `in-progress` in TASK-REGISTRY.xml.

After the first run:

7. Preserve run output per gad-38.
8. Submit a rubric review per gad-61.
9. Mark task 22-31 as `done` with a link to the run.
