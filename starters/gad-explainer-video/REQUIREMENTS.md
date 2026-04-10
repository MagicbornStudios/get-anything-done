# gad-explainer-video — requirements v1

**Status:** ready for round 1.
**Anchor task:** 22-31 / 22-45 (Remotion scaffold).

---

## The task, in one sentence

Produce a Remotion video (max 30 seconds) that graphically shows what GAD does — how it manages planning at scale across many folders and tasks, the evaluation loop, and how builds emerge from requirements — with motion and visual energy, for a viewer who has never heard of GAD.

## Duration

**Maximum 30 seconds.** Every second must earn its place. No padding, no slow fades, no lingering title cards. The video is a hook, not a lecture. It should make someone want to click through to the site, not replace the site.

## What the video must show (4 sections, ~7 seconds each)

### Section 1 — The thesis (seconds 0-7)

Full-screen text with motion: **"A system for evaluating and evolving agents through real tasks, measurable pressure, and iteration."**

Graphically: show a .planning/ folder structure expanding — STATE.xml, ROADMAP.xml, TASK-REGISTRY.xml, DECISIONS.xml — files appearing with a cascade animation. The visual message is: this is a system that manages complexity in-repo.

### Section 2 — The three conditions (seconds 7-14)

A visual split into three columns with motion. Each column represents one workflow condition and shows its template contents appearing:

| Bare | GAD | Emergent |
|---|---|---|
| AGENTS.md | AGENTS.md + .planning/ | AGENTS.md + inherited skills |
| REQUIREMENTS.xml | + 10 skills | + 6 evolving skills |
| 2 skills | Full framework | Compounding craft |

Each column gets a color tint (emerald / sky / amber) and a one-line label. The visual message is: same task, different scaffolding, compare the results.

### Section 3 — The skeptic disclosure (seconds 14-21)

Rose-tinted frame. Text: **"N=2-5 runs per condition. One reviewer. Exploratory analysis, not proven findings."** Must be readable for the full 7 seconds. The visual message is: we're honest about our limitations.

### Section 4 — The hook (seconds 21-30)

Show the playable archive — a thumbnail grid of game builds emerging, each with a score badge. Then a single CTA: **"Play the builds. Read the research. Fork the repo."** with the URL `get-anything-done.vercel.app` prominent. The visual message is: come see for yourself.

## Mandatory frames (acceptance gates)

1. **G1 — Thesis text visible** for at least 3 seconds
2. **G2 — Three-condition split** with distinct visual treatment per workflow
3. **G3 — Skeptic disclosure** readable for at least 5 seconds
4. **G4 — CTA with site URL** visible at the end

## Constraints

- **Duration:** maximum 30 seconds. Hard cap.
- **Runtime:** Remotion (`@remotion/player` for site embed, `@remotion/cli` for rendering)
- **Stack:** TypeScript + React. Compositions at `site/remotion/`
- **Audio:** none for v1
- **Assets:** no copyrighted material. SVG, geometric shapes, text animations, data-driven visuals only
- **Rendering:** reproducible via `npx remotion render`
- **Embedding:** playable via `@remotion/player` on `/videos`

## Scoring

- **pedagogical_clarity** (0.30) — does a first-time viewer understand what GAD does after 30 seconds?
- **video_polish** (0.25) — composition quality, motion design, typography, pacing
- **accuracy** (0.20) — no overclaiming; skeptic frame present and readable
- **scope_fit** (0.15) — fits in 30 seconds without feeling rushed or empty
- **stability** (0.10) — renders without errors, reproducible

## Deferred to v2

- Narration / voice-over
- Multi-language captions
- Hypothesis deep-dives (one video per hypothesis)
- The "loop evolution" visualization (showing how different hypothesis loops differ)
- Interactive seek-to-section

## What this eval does NOT test

- Game design. The agent is composing a video, not building a game.
- The escape-the-dungeon rubric. Different task, different rubric.
