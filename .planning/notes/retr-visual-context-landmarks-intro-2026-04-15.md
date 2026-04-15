# Retrospective: Visual Context landing — intro vs showcase landmarks (2026-04-15)

## Context

Work targeted the **Visual Context** band on the GAD landing site (`http://localhost:3000/`, home). Goal: **DevPanel / Visual Context tools** can target **individual intro pieces** (kicker, headline, body) via `Identified` + `data-cid`, not only the inner static showcase (“meteor” / panel demo).

## What shipped

| Layer | Token | Location |
| --- | --- | --- |
| Section shell | `cid="visual-context-site-section"` | `SiteSection` on `LandingVisualContextAndPromptBand` |
| Outer band | `as="LandingVisualContextShowcase"` | Wraps full band (intro + showcase + pattern list + prompt block) |
| Intro | `LandingVisualContextIntroKicker` | Kicker line (“Visual context system”) |
| Intro | `LandingVisualContextIntroTitle` | `h2` + gradient span |
| Intro | `LandingVisualContextIntroBody` | `SiteProse` with Alt+I / Alt+K instructions |
| Showcase | `LandingVisualContextPanelShowcase` | Static VC panel demos |
| Below-fold | `LandingVisualContextPatternList` | Three-column pattern bullets |
| Below-fold | `LandingPageGenerationPromptExample` | Verbatim prompt `pre` |

Primary file: `vendor/get-anything-done/site/components/landing/home/LandingVisualContextAndPromptBand.tsx`.

Inner detail landmarks live in `LandingVisualContextPanelShowcase.tsx` (separate task thread).

## Where the confusion was

1. **Ambiguous “section”**: User asked to refine the **intro** so each piece is clickable; implementation initially focused on **inner showcase / meteor-style** components because that was where the most complex `Identified` graph already existed.
2. **Composite vs atoms**: `SiteSectionIntro` (or equivalent) collapsed kicker + title + body into **one** subtree. Without splitting, DevPanel only sees **one** inner target for the whole intro block — not aligned with “click different pieces of the intro.”
3. **Routing hint vs DOM scope**: A route like `Target: Identified | LandingVisualContextShowcase` correctly names the **outer** wrapper but does **not** imply the intro was already split; the agent needed an explicit requirement: **“same treatment for the band intro as for the showcase.”**

## Mitigations (repeatable)

1. **Name the scope in the ask**: e.g. “Intro block only: kicker, title, body — each `Identified`.” vs “Showcase component only.”
2. **Prefer atomic `Identified` for any block that must be a separate DevPanel target**; keep section-level wrappers (`SiteSection`, one outer `Identified`) for grep/search hints.
3. **When reusing subagent workflow**: if UI context matches a prior lane, reuse; else spawn one lane per **surface** (intro vs showcase) to avoid cross-scope assumptions.
4. **Verification**: grep `as="LandingVisualContextIntro` in the band file before calling the intro done.

## GAD loop

- **Task**: `44-37` in `TASK-REGISTRY.xml` (phase 44) — this note is the resolution artifact.
- **Related**: `44-15` (VC identity pattern), `44-16` (normalize `cid` across sections), `44-17` (methodology reference), skill `gad-visual-context-panel-identities`, `references/visual-context-panel-methodology.md`.

## Decision

No new product decision; process/communication lesson only. If this becomes policy (“every marketing intro must have kicker/title/body `Identified`”), promote to `DECISIONS.xml` under a new `gad-NNN` in a follow-up.
